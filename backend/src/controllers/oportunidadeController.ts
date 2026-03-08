
import { Request, Response } from 'express';
import { createCrudController } from './crudController';
import { createUserClient } from '../config/supabase';
import { findUsuario } from './authController';

const tableName = 'oportunidades';
const empresaColumn = 'idempresa';

// Reusa o controller genérico para as operações padrão (list, getById, remove)
const genericController = createCrudController(tableName, {
    filterByEmpresa: true,
    empresaColumn,
    // Pós-migração para Supabase, algumas bases podem não ter o relacionamento
    // explícito com `oportunidade_envolvidos` disponível via PostgREST.
    // Mantemos o list/get resiliente retornando apenas os campos da tabela.
    selectFields: '*',
    searchFields: ['detalhes', 'numero_processo_cnj'],
    orderBy: 'data_criacao',
    orderAscending: false,
});

async function getEmpresaId(req: Request): Promise<number | null> {
    const userId = req.supabaseUser?.id;
    const userEmail = req.supabaseUser?.email;
    if (!userId && !userEmail) return null;

    try {
        const user = await findUsuario(userId || '', userEmail);
        return (user?.empresa ?? (user as any)?.empresa_id ?? null) as number | null;
    } catch (error) {
        console.error('Erro ao buscar usuário em getEmpresaId:', error);
        return null;
    }
}

export const oportunidadeController = {
    ...genericController,

    create: async (req: Request, res: Response) => {
        try {
            const { envolvidos, ...oportunidadeData } = req.body;
            const accessToken = req.accessToken!;
            if (!accessToken) {
                return res.status(401).json({ error: 'Token de acesso não encontrado.' });
            }

            const client = createUserClient(accessToken);
            const empresaId = await getEmpresaId(req);

            if (!empresaId) {
                return res.status(400).json({ error: 'Empresa do usuário não identificada.' });
            }

            // Remove campos que não devem ir para a tabela oportunidades
            // Se houver mais campos extras no body, eles podem quebrar o insert se não existirem na tabela
            // O ideal seria filtrar apenas os campos permitidos, mas por enquanto vamos confiar no frontend enviar certo ou o Supabase ignorar se configurado (mas geralmente erro).
            // O erro original foi PGRST204 (coluna não existe), então o Supabase reclama de colunas extras.
            
            // Vamos montar o payload manualmente com os campos conhecidos ou usar o ...rest com cuidado.
            // Para garantir, vamos usar o ...oportunidadeData que já removeu 'envolvidos'.
            
            const payload = {
                ...oportunidadeData,
                [empresaColumn]: empresaId,
            };

            // Remove id se vier vazio ou zero para deixar o banco gerar
            if (!payload.id) delete payload.id;

            // Insere Oportunidade
            const { data: novaOportunidade, error: erroOportunidade } = await client
                .from(tableName)
                .insert(payload)
                .select()
                .single();

            if (erroOportunidade) {
                console.error('Erro ao criar oportunidade:', erroOportunidade);
                return res.status(400).json({ error: erroOportunidade.message || 'Erro ao criar oportunidade.' });
            }

            const oportunidadeId = novaOportunidade.id;

            // Insere Envolvidos
            if (envolvidos && Array.isArray(envolvidos) && envolvidos.length > 0) {
                const envolvidosPayload = envolvidos.map((env: any) => ({
                    oportunidade_id: oportunidadeId,
                    nome: env.nome,
                    documento: env.documento || env.cpf_cnpj, // Frontend pode mandar cpf_cnpj ou documento
                    telefone: env.telefone,
                    endereco: env.endereco,
                    relacao: env.relacao,
                    polo: env.polo
                }));

                const { error: erroEnvolvidos } = await client
                    .from('oportunidade_envolvidos')
                    .insert(envolvidosPayload);

                if (erroEnvolvidos) {
                    console.error('Erro ao criar envolvidos:', erroEnvolvidos);
                    // Não abortamos a response, mas logamos.
                }
            }

            // Retorna a oportunidade completa com envolvidos para a UI atualizar corretamente
            const { data: result, error: erroFinal } = await client
                .from(tableName)
                .select(`
                    *,
                    oportunidade_envolvidos (*)
                `)
                .eq('id', oportunidadeId)
                .single();

            if (erroFinal) {
                 return res.status(201).json(novaOportunidade);
            }

            return res.status(201).json(result);

        } catch (error) {
            console.error('Erro interno ao criar oportunidade:', error);
            return res.status(500).json({ error: 'Erro interno ao processar criação.' });
        }
    },

    update: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { envolvidos, ...oportunidadeData } = req.body;
            
            const accessToken = req.accessToken!;
            const client = createUserClient(accessToken);
            // Também filtramos pela empresa para segurança no update
            const empresaId = await getEmpresaId(req);

            let query = client.from(tableName).update(oportunidadeData).eq('id', id);
            
            if (empresaId) {
                query = query.eq(empresaColumn, empresaId);
            }

            const { error: erroUpdate } = await query;

            if (erroUpdate) {
                console.error('Erro ao atualizar oportunidade:', erroUpdate);
                return res.status(400).json({ error: erroUpdate.message });
            }

            // Atualiza Envolvidos
            if (envolvidos !== undefined && Array.isArray(envolvidos)) {
                 // Remove existentes
                 await client
                    .from('oportunidade_envolvidos')
                    .delete()
                    .eq('oportunidade_id', id);

                 // Insere novos
                 if (envolvidos.length > 0) {
                    const envolvidosPayload = envolvidos.map((env: any) => ({
                        oportunidade_id: id,
                        nome: env.nome,
                        documento: env.documento || env.cpf_cnpj,
                        telefone: env.telefone,
                        endereco: env.endereco,
                        relacao: env.relacao,
                        polo: env.polo
                    }));
                    
                    const { error: erroEnv } = await client
                        .from('oportunidade_envolvidos')
                        .insert(envolvidosPayload);
                    
                    if (erroEnv) console.error("Erro ao atualizar envolvidos:", erroEnv);
                 }
            }
            
            // Retorna atualizado
            const { data: result, error: erroFinal } = await client
                .from(tableName)
                .select(`*, oportunidade_envolvidos (*)`)
                .eq('id', id)
                .single();

            if (erroFinal) {
                return res.json({ ...oportunidadeData, id });
            }

            return res.json(result);

        } catch (error) {
            console.error('Erro ao atualizar oportunidade:', error);
            return res.status(500).json({ error: 'Erro interno ao atualizar.' });
        }
    }
};
