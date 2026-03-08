import { Router, type Router as ExpressRouter } from 'express';
import { createCrudController } from '../controllers/crudController';
import { supabaseAdmin, createUserClient } from '../config/supabase';
import { findUsuario } from '../controllers/authController';

const router: ExpressRouter = Router();
const controller = createCrudController('clientes', {
    filterByEmpresa: true,
    empresaColumn: 'idempresa',
    selectFields: '*',
    searchFields: ['nome', 'email', 'documento', 'telefone'],
    orderBy: 'nome',
    orderAscending: true,
});


// Rota customizada: Total de clientes ativos
router.get('/clientes/ativos/total', async (req, res) => {
    try {
        const userId = req.supabaseUser?.id;
        const userEmail = req.supabaseUser?.email;

        if (!userId && !userEmail) {
            res.status(401).json({ error: 'Usuário não autenticado.' });
            return;
        }

        const user = await findUsuario(userId || '', userEmail);
        const empresaId = user?.empresa ?? null;

        if (empresaId === null) {
            res.status(403).json({ error: 'Usuário sem empresa vinculada.' });
            return;
        }

        const accessToken = req.accessToken;
        const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;

        const { count, error } = await client
            .from('clientes')
            .select('id', { count: 'exact', head: true })
            .eq('idempresa', empresaId)
            .eq('ativo', true);

        if (error) {
            console.error('Erro ao contar clientes ativos:', error);
            res.status(500).json({ error: 'Erro ao contar clientes ativos' });
            return;
        }

        res.json({ total: count ?? 0 });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao contar clientes ativos' });
    }
});

router.get('/clientes', controller.list);
router.get('/clientes/:id', controller.getById);

router.get('/clientes/:id/processos', async (req, res) => {
    const clienteId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(clienteId)) {
        res.status(400).json({ error: 'ID de cliente inválido.' });
        return;
    }

    const accessToken = req.accessToken;
    const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;

    const { data, error } = await client
        .from('processos')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('atualizado_em', { ascending: false, nullsFirst: false });

    if (error) {
        res.status(500).json({ error: 'Erro ao buscar processos do cliente.' });
        return;
    }

    const processos = data ?? [];
    const numerosCnj = Array.from(
        new Set(
            processos
                .map((processo: any) =>
                    typeof processo?.numero_cnj === 'string' ? processo.numero_cnj.trim() : '',
                )
                .filter((numero: string) => numero.length > 0),
        ),
    );

    if (numerosCnj.length === 0) {
        res.json(processos);
        return;
    }

    const { data: advogadosData, error: advogadosError } = await client
        .from('processo_advogados')
        .select('numero_cnj,representante_nome,oab_numero,oab_uf,representante_tipo')
        .in('numero_cnj', numerosCnj)
        .order('id', { ascending: true });

    if (advogadosError) {
        res.status(500).json({ error: 'Erro ao buscar advogados dos processos do cliente.' });
        return;
    }

    const { data: movimentacoesData, error: movimentacoesError } = await client
        .from('trigger_movimentacao_processo')
        .select('numero_cnj,data_movimentacao')
        .in('numero_cnj', numerosCnj)
        .order('data_movimentacao', { ascending: false, nullsFirst: false });

    if (movimentacoesError) {
        res.status(500).json({ error: 'Erro ao buscar movimentações dos processos do cliente.' });
        return;
    }

    const advogadosPorProcesso = new Map<string, Array<Record<string, unknown>>>();
    for (const item of advogadosData ?? []) {
        const numero = typeof item?.numero_cnj === 'string' ? item.numero_cnj.trim() : '';
        if (!numero) {
            continue;
        }

        const nome = typeof item?.representante_nome === 'string' ? item.representante_nome.trim() : '';
        if (!nome) {
            continue;
        }

        const advogados = advogadosPorProcesso.get(numero) ?? [];
        advogados.push({
            id: advogados.length + 1,
            nome,
            name: nome,
            funcao:
                typeof item?.representante_tipo === 'string' && item.representante_tipo.trim().length > 0
                    ? item.representante_tipo.trim()
                    : null,
            oab:
                item?.oab_numero && item?.oab_uf
                    ? `${item.oab_numero}/${String(item.oab_uf).toUpperCase()}`
                    : null,
        });
        advogadosPorProcesso.set(numero, advogados);
    }

    const ultimaMovimentacaoPorProcesso = new Map<string, string>();
    for (const item of movimentacoesData ?? []) {
        const numero = typeof item?.numero_cnj === 'string' ? item.numero_cnj.trim() : '';
        const dataMovimentacao =
            typeof item?.data_movimentacao === 'string' ? item.data_movimentacao : null;

        if (!numero || !dataMovimentacao || ultimaMovimentacaoPorProcesso.has(numero)) {
            continue;
        }

        ultimaMovimentacaoPorProcesso.set(numero, dataMovimentacao);
    }

    const enriched = processos.map((processo: any) => {
        const numero = typeof processo?.numero_cnj === 'string' ? processo.numero_cnj.trim() : '';
        const advogados = numero ? advogadosPorProcesso.get(numero) ?? [] : [];
        const ultimaMovimentacao = numero ? ultimaMovimentacaoPorProcesso.get(numero) ?? null : null;

        return {
            ...processo,
            advogados,
            advogados_resumo: advogados.map((advogado) => advogado.nome).join(', '),
            ultima_movimentacao_data: ultimaMovimentacao,
            atualizado_em: ultimaMovimentacao ?? processo.atualizado_em,
        };
    });

    res.json(enriched);
});

router.get('/clientes/:id/atributos', async (req, res) => {
    const clienteId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(clienteId)) {
        res.status(400).json({ error: 'ID de cliente inválido.' });
        return;
    }

    const accessToken = req.accessToken;
    const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;

    const { data, error } = await client
        .from('cliente_atributos')
        .select('id,idclientes,idtipodocumento,valor,datacadastro,tipo_documento:tipo_documento(id,nome)')
        .eq('idclientes', clienteId)
        .order('datacadastro', { ascending: false, nullsFirst: false });

    if (error) {
        res.status(500).json({ error: 'Erro ao buscar atributos do cliente.' });
        return;
    }

    const mapped = (data ?? []).map((item: any) => ({
        id: item.id,
        cliente_id: item.idclientes,
        tipo_documento_id: item.idtipodocumento,
        tipo_documento_nome: item.tipo_documento?.nome ?? '',
        valor: item.valor,
        datacadastro: item.datacadastro,
    }));

    res.json(mapped);
});

router.post('/clientes/:id/atributos', async (req, res) => {
    const clienteId = Number.parseInt(req.params.id, 10);
    const tipoDocumentoId = Number.parseInt(String(req.body?.idtipodocumento ?? req.body?.tipo_documento_id ?? ''), 10);
    const valor = typeof req.body?.valor === 'string' ? req.body.valor.trim() : '';

    if (!Number.isFinite(clienteId) || !Number.isFinite(tipoDocumentoId) || !valor) {
        res.status(400).json({ error: 'Dados inválidos para criação de atributo.' });
        return;
    }

    const accessToken = req.accessToken;
    const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;

    const { data, error } = await client
        .from('cliente_atributos')
        .insert({ idclientes: clienteId, idtipodocumento: tipoDocumentoId, valor })
        .select('id,idclientes,idtipodocumento,valor,datacadastro,tipo_documento:tipo_documento(id,nome)')
        .single();

    if (error) {
        res.status(500).json({ error: 'Erro ao criar atributo do cliente.' });
        return;
    }

    res.status(201).json({
        id: data.id,
        cliente_id: data.idclientes,
        tipo_documento_id: data.idtipodocumento,
        tipo_documento_nome: (data as any).tipo_documento?.nome ?? '',
        valor: data.valor,
        datacadastro: data.datacadastro,
    });
});

router.put('/clientes/:id/atributos/:attributeId', async (req, res) => {
    const attributeId = Number.parseInt(req.params.attributeId, 10);
    const tipoDocumentoId = Number.parseInt(String(req.body?.idtipodocumento ?? req.body?.tipo_documento_id ?? ''), 10);
    const valor = typeof req.body?.valor === 'string' ? req.body.valor.trim() : '';

    if (!Number.isFinite(attributeId) || !Number.isFinite(tipoDocumentoId) || !valor) {
        res.status(400).json({ error: 'Dados inválidos para atualização de atributo.' });
        return;
    }

    const accessToken = req.accessToken;
    const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;

    const { data, error } = await client
        .from('cliente_atributos')
        .update({ idtipodocumento: tipoDocumentoId, valor })
        .eq('id', attributeId)
        .select('id,idclientes,idtipodocumento,valor,datacadastro,tipo_documento:tipo_documento(id,nome)')
        .single();

    if (error) {
        res.status(500).json({ error: 'Erro ao atualizar atributo do cliente.' });
        return;
    }

    res.json({
        id: data.id,
        cliente_id: data.idclientes,
        tipo_documento_id: data.idtipodocumento,
        tipo_documento_nome: (data as any).tipo_documento?.nome ?? '',
        valor: data.valor,
        datacadastro: data.datacadastro,
    });
});

router.delete('/clientes/:id/atributos/:attributeId', async (req, res) => {
    const attributeId = Number.parseInt(req.params.attributeId, 10);
    if (!Number.isFinite(attributeId)) {
        res.status(400).json({ error: 'ID do atributo inválido.' });
        return;
    }

    const accessToken = req.accessToken;
    const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;

    const { error } = await client.from('cliente_atributos').delete().eq('id', attributeId);
    if (error) {
        res.status(500).json({ error: 'Erro ao remover atributo do cliente.' });
        return;
    }

    res.status(204).send();
});

router.get('/clientes/:id/documentos', async (req, res) => {
    const clienteId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(clienteId)) {
        res.status(400).json({ error: 'ID de cliente inválido.' });
        return;
    }

    const accessToken = req.accessToken;
    const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;

    const { data, error } = await client
        .from('cliente_documento')
        .select('id,nome_arquivo,arquivo_base64,tipo_documento:tipo_documento(id,nome)')
        .eq('cliente_id', clienteId)
        .order('id', { ascending: false });

    if (error) {
        res.status(500).json({ error: 'Erro ao buscar documentos do cliente.' });
        return;
    }

    res.json((data ?? []).map((item: any) => ({
        id: item.id,
        nome_arquivo: item.nome_arquivo,
        arquivo_base64: item.arquivo_base64,
        tipo_nome: item.tipo_documento?.nome ?? '',
    })));
});

router.post('/clientes/:id/documentos', async (req, res) => {
    const clienteId = Number.parseInt(req.params.id, 10);
    const tipoDocumentoId = Number.parseInt(String(req.body?.tipo_documento_id ?? ''), 10);
    const nomeArquivo = typeof req.body?.nome_arquivo === 'string' ? req.body.nome_arquivo.trim() : '';
    const arquivoBase64 = typeof req.body?.arquivo_base64 === 'string' ? req.body.arquivo_base64.trim() : '';

    if (!Number.isFinite(clienteId) || !Number.isFinite(tipoDocumentoId) || !nomeArquivo || !arquivoBase64) {
        res.status(400).json({ error: 'Dados inválidos para upload de documento.' });
        return;
    }

    const accessToken = req.accessToken;
    const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;

    const { data, error } = await client
        .from('cliente_documento')
        .insert({
            cliente_id: clienteId,
            tipo_documento_id: tipoDocumentoId,
            nome_arquivo: nomeArquivo,
            arquivo_base64: arquivoBase64,
        })
        .select('id,nome_arquivo,arquivo_base64,tipo_documento:tipo_documento(id,nome)')
        .single();

    if (error) {
        res.status(500).json({ error: 'Erro ao salvar documento do cliente.' });
        return;
    }

    res.status(201).json({
        id: data.id,
        nome_arquivo: data.nome_arquivo,
        arquivo_base64: data.arquivo_base64,
        tipo_nome: (data as any).tipo_documento?.nome ?? '',
    });
});

router.delete('/clientes/:id/documentos/:docId', async (req, res) => {
    const docId = Number.parseInt(req.params.docId, 10);
    if (!Number.isFinite(docId)) {
        res.status(400).json({ error: 'ID do documento inválido.' });
        return;
    }

    const accessToken = req.accessToken;
    const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;

    const { error } = await client.from('cliente_documento').delete().eq('id', docId);
    if (error) {
        res.status(500).json({ error: 'Erro ao remover documento do cliente.' });
        return;
    }

    res.status(204).send();
});

router.post('/clientes', controller.create);
router.put('/clientes/:id', controller.update);
router.delete('/clientes/:id', controller.remove);

export default router;
