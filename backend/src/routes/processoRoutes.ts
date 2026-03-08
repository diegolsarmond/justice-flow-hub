import { Request, Response, Router, type Router as ExpressRouter } from 'express';
import { createCrudController } from '../controllers/crudController';
import { createUserClient, supabaseAdmin } from '../config/supabase';
import { findUsuario } from '../controllers/authController';
import { syncProcessosPdpj } from '../services/syncProcessosService';

const router: ExpressRouter = Router();

const PROCESSOS_SYNC_LOCK_TTL_MS = 2 * 60 * 1000;
const processosSyncLocks = new Map<string, number>();

const normalizeProcesso = (record: any) => {
    if (!record) return null;

    const getJsonField = (json: any, field: string) => {
        if (!json || typeof json !== 'object') return null;
        return json[field] ?? null;
    };

    const getFirstNome = (arr: any) => {
        if (Array.isArray(arr) && arr.length > 0) {
             const first = arr[0];
             return first?.nome || first?.descricao || null;
        }
        return null;
    };

    // Helper para extrair texto de JSONBs (tribunal, orgao_julgador, etc)
    const resolveNome = (val: any) => {
        if (typeof val === 'string') return val;
        if (typeof val === 'object' && val) return val.nome || val.descricao || null;
        return null;
    };

    // Mapeia advogados a partir de partes
    // Assumindo que advogados estão em 'partes' com algum tipo específico ou apenas listamos todos por enquanto?
    // O frontend espera { id, nome, oab, funcao }
    // pje_processo_partes: { nome, tipo_parte, ... }
    const partes = Array.isArray(record.partes) ? record.partes : [];
    const advogados = partes
        .filter((p: any) => {
            const tipo = (p.tipo_parte || '').toLowerCase();
            return tipo.includes('advogado') || tipo.includes('procurador');
        })
        .map((p: any, index: number) => ({
            id: p.id ?? index + 1,
            nome: p.nome,
            oab: null, // pje_processo_partes não tem coluna explicita de OAB nas partes, as vezes vem no nome
            funcao: p.tipo_parte
        }));
    
    // Se não achou advogados nas partes, tenta pegar do payload se existir
    // Mas vamos manter simples.

    const cliente = record.cliente ? {
        id: record.cliente.id,
        nome: record.cliente.nome,
        documento: record.cliente.documento,
        tipo: record.cliente.tipo
    } : null;

    const movimentos = Array.isArray(record.movimentos) ? record.movimentos.map((m: any) => ({
        id: m.id,
        data: m.data_hora, // Frontend espera 'data'
        conteudo: m.descricao, // Frontend espera 'conteudo'
        tipo: 'Movimentação', // Valor default já que pje_processo_movimentos só tem descricao
        // Tenta pegar mais detalhes do payload se existir
        ...(typeof m.payload === 'object' ? m.payload : {})
    })) : [];

    const documentos = Array.isArray(record.documentos) ? record.documentos.map((d: any) => ({
        id: d.id,
        id_anexo: d.id,
        title: d.nome, // Frontend espera 'title' ou 'nome'
        nome: d.nome,
        date: d.data_hora_juntada, // Frontend espera 'date' ou 'data_cadastro'
        data_cadastro: d.data_hora_juntada,
        url: d.href_binario || d.href_texto, // Frontend espera 'url'
        tipo: d.tipo_nome,
        // Tenta pegar mais detalhes do payload
         ...(typeof d.payload === 'object' ? d.payload : {})
    })) : [];

    // Extract movement description with multiple fallback strategies
    const ultimaMovimentacaoDescricao = (() => {
        // 1. Try resolveNome on the ultimo_movimento JSONB
        const fromUltimoMov = resolveNome(record.ultimo_movimento);
        if (fromUltimoMov) return fromUltimoMov;

        // 2. Try additional JSONB field names on ultimo_movimento
        if (record.ultimo_movimento && typeof record.ultimo_movimento === 'object') {
            const mov = record.ultimo_movimento as Record<string, unknown>;
            const desc = mov.complemento ?? mov.tipo ?? mov.tipoNome ?? mov.nomeCompleto ?? null;
            if (typeof desc === 'string' && desc.trim()) return desc.trim();
        }

        // 3. Try to extract from tramitacao_ativa JSONB (if it contains ultimoMovimento)
        if (record.tramitacao_ativa && typeof record.tramitacao_ativa === 'object') {
            const tram = record.tramitacao_ativa as Record<string, unknown>;
            const ultimoMovTram = tram.ultimoMovimento as Record<string, unknown> | undefined;
            if (ultimoMovTram) {
                const nomeFromTram = resolveNome(ultimoMovTram);
                if (nomeFromTram) return nomeFromTram;
            }
        }

        return null;
    })();

    // Extract movement date with fallback strategies
    const ultimaMovimentacaoData = (() => {
        // 1. Direct column value
        if (record.ultimo_movimento_data) return record.ultimo_movimento_data;

        // 1.5. Check data_ultima_distribuicao as fallback
        if (record.data_ultima_distribuicao) return record.data_ultima_distribuicao;

        // 2. Try from the ultimo_movimento JSONB
        if (record.ultimo_movimento && typeof record.ultimo_movimento === 'object') {
            const mov = record.ultimo_movimento as Record<string, unknown>;
            const dataHora = mov.dataHora ?? mov.data ?? mov.dataMovimento ?? mov.data_hora ?? null;
            if (dataHora) return dataHora;
        }

        // 3. Try from tramitacao_ativa JSONB
        if (record.tramitacao_ativa && typeof record.tramitacao_ativa === 'object') {
            const tram = record.tramitacao_ativa as Record<string, unknown>;
            const ultimoMovTram = tram.ultimoMovimento as Record<string, unknown> | undefined;
            if (ultimoMovTram) {
                const dt = ultimoMovTram.dataHora ?? ultimoMovTram.data ?? null;
                if (dt) return dt;
            }
            // Try dataHoraUltimoMovimento from tramitacao itself
            const dtFromTram = tram.dataHoraUltimoMovimento ?? tram.dataUltimoMovimento ?? null;
            if (dtFromTram) return dtFromTram;
        }

        return null;
    })();

    return {
        id: record.id,
        numero: record.numero_processo,
        numero_cnj: record.numero_processo,
        cliente_id: record.cliente_id ?? null,
        status: record.tramitacao_ativa ? 'Ativo' : 'Inativo',
        tipo: 'Judicial',
        classe_judicial: resolveNome(record.classe),
        assunto: resolveNome(record.assunto) || (Array.isArray(record.assunto) ? getFirstNome(record.assunto) : 'Não informado'),
        jurisdicao: record.sigla_tribunal,
        orgao_julgador: resolveNome(record.orgao_julgador),
        data_distribuicao: record.data_ajuizamento,
        criado_em: record.created_at,
        ultima_atualizacao: record.updated_at,
        ultima_sincronizacao: record.synced_at,
        ultima_movimentacao: ultimaMovimentacaoDescricao,
        ultima_movimentacao_data: ultimaMovimentacaoData,
        movimentacoes_count: movimentos.length,
        consultas_api_count: 0,
        cliente: cliente,
        advogados: advogados,
        advogados_resumo: advogados.map((a: any) => a.nome).join(', '),
        valor_acao: record.valor_acao,
        grau: resolveNome(record.grau),
        idempresa: record.idempresa,
        nao_lido: false,
        lido_em: null,
        movimentacoes: movimentos,
        attachments: documentos, // Frontend usa 'attachments'
        anexos: documentos
    };
};

const controller = createCrudController('pje_processos', {
    filterByEmpresa: true,
    empresaColumn: 'idempresa',
    selectFields: '*, cliente:clientes(*), partes:pje_processo_partes(*)',
    searchFields: ['numero_processo', 'sigla_tribunal'], // pje_processos usa numero_processo
    orderBy: 'ultimo_movimento_data', // Ordenar por ultima movimentação
    orderAscending: false,
    orderNullsFirst: false,
    countType: 'estimated', // Melhorar performance de carregamento
    normalizeOutput: normalizeProcesso
});



// Rota específica ANTES de /:id para evitar que Express capture 'unread-count' como id
router.get('/processos/unread-count', async (req: Request, res: Response) => {
    try {
        // pje_processos não possui coluna nao_lido, retorna 0 por enquanto
        res.json({ unread: 0 });
    } catch (error) {
        console.error('Erro ao buscar unread-count de processos:', error);
        res.json({ unread: 0 });
    }
});

// Custom wrapper logic for list and getById

router.get('/processos', async (req: Request, res: Response, next) => {
    try {
        const accessToken = req.accessToken;
        const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;
        
        const supabaseUser = req.supabaseUser;
        let empresaId = null;
        if (supabaseUser) {
            const userData = await findUsuario(supabaseUser.id, supabaseUser.email);
            empresaId = userData?.empresa ?? null;
        }

        let page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
        let limit = Math.min(10000, Math.max(1, parseInt(req.query.limit as string, 10) || parseInt(req.query.pageSize as string, 10) || 20));
        const search = (req.query.search as string || '').trim();

        // não paginar o filtro de pesquisa
        if (search) {
            page = 1;
            limit = 10000;
        }

        const offset = (page - 1) * limit;

        let query = client.from('pje_processos')
            .select('*, cliente:clientes!left(*), partes:pje_processo_partes(*)', { count: 'estimated' });

        if (empresaId) {
            query = query.eq('idempresa', empresaId);
        }

        if (req.query.semCliente === 'true') {
            query = query.is('cliente_id', null);
        }

        // Filtro exato por numero via query param 'numero'
        if (req.query.numero) {
            const numText = String(req.query.numero);
            const numClean = numText.replace(/\D/g, '');
            if (numClean && numClean !== numText) {
                query = query.or(`numero_processo.ilike.%${numClean}%,numero_processo.ilike.%${numText}%`);
            } else {
                query = query.ilike('numero_processo', `%${numText}%`);
            }
        }

        if (search) {
             const searchClean = search.replace(/\D/g, '');
             let orConds = [
                 `numero_processo.ilike.%${search}%`,
                 `sigla_tribunal.ilike.%${search}%`
             ];
             
             if (searchClean && searchClean !== search) {
                 orConds.push(`numero_processo.ilike.%${searchClean}%`);
             }

             if (searchClean.length === 20) {
                 const formattedNum = searchClean.replace(/^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/, '$1-$2.$3.$4.$5.$6');
                 orConds.push(`numero_processo.ilike.%${formattedNum}%`);
             }
             
             let clientesIds: number[] = [];
             if (empresaId) {
                 // Build or queries for clientes
                 let cliOrConds = [
                     `nome.ilike.%${search}%`,
                     `documento.ilike.%${search}%`
                 ];
                 if (searchClean && searchClean !== search) {
                     cliOrConds.push(`documento.ilike.%${searchClean}%`);
                 }
                 
                 const { data: cData } = await client.from('clientes')
                     .select('id')
                     .eq('idempresa', empresaId)
                     .or(cliOrConds.join(','));
                     
                 if (cData && cData.length > 0) {
                     clientesIds = cData.map((c: any) => c.id);
                 }
             }
             
             if (clientesIds.length > 0) {
                 orConds.push(`cliente_id.in.(${clientesIds.join(',')})`);
             }
             
             query = query.or(orConds.join(','));
        }

        const sortField = (req.query.order as string) || 'ultimo_movimento_data';
        const sortAsc = req.query.orderDirection === 'asc' ? true : false;
        query = query.order(sortField, { ascending: sortAsc, nullsFirst: false });

        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            console.error(`Erro ao listar pje_processos:`, error);
            res.status(500).json({ error: `Erro ao listar pje_processos.` });
            return;
        }

        res.json({
            data: (data ?? []).map((record: any) => normalizeProcesso(record)),
            total: count ?? 0,
            page,
            limit,
            totalPages: count ? Math.ceil(count / limit) : 0,
        });
    } catch (err) {
        console.error('Erro ao listar processos:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
});

router.get('/processos/:id', async (req: Request, res: Response) => {
    const { id } = req.params;

    const dispararSincronizacaoEmBackground = async (
        processo: { idempresa?: number | null; oab_numero?: number | string | null; oab_uf?: string | null },
    ) => {
        const empresaId = Number(processo.idempresa);
        const oabNumero = `${processo.oab_numero ?? ''}`.replace(/\D/g, '');
        const oabUf = (processo.oab_uf ?? '').trim().toUpperCase();

        if (!empresaId || !oabNumero || !/^[A-Z]{2}$/.test(oabUf)) {
            return;
        }

        const lockKey = `${empresaId}:${oabUf}:${oabNumero}`;
        const now = Date.now();
        const previousLock = processosSyncLocks.get(lockKey);

        if (previousLock && now - previousLock < PROCESSOS_SYNC_LOCK_TTL_MS) {
            return;
        }

        processosSyncLocks.set(lockKey, now);

        const { data: monitorada } = await supabaseAdmin
            .from('oab_monitoradas')
            .select('usuario_id')
            .eq('empresa_id', empresaId)
            .eq('tipo', 'processos')
            .eq('uf', oabUf)
            .eq('numero', oabNumero)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const usuarioId = Number(monitorada?.usuario_id);
        if (!usuarioId) {
            return;
        }

        syncProcessosPdpj({ empresaId, usuarioId, uf: oabUf, numero: oabNumero }).catch((error) => {
            console.error('[processos/:id] Erro ao sincronizar processo em background:', error);
        });
    };

    try {
        const accessToken = req.accessToken;
        const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;

        const supabaseUser = req.supabaseUser;
        let empresaId: number | null = null;
        if (supabaseUser) {
            const userData = await findUsuario(supabaseUser.id, supabaseUser.email);
            empresaId = userData?.empresa ?? null;
        }

        const idNumerico = Number(id);
        const isIdNumerico = Number.isFinite(idNumerico) && /^\d+$/.test(id);

        let query = client.from('pje_processos').select('*, cliente:clientes(*), partes:pje_processo_partes(*), movimentos:pje_processo_movimentos(*), documentos:pje_processo_documentos(*)');

        if (isIdNumerico) {
            query = query.eq('id', idNumerico);
        } else {
            // Tenta buscar pelo número exato ou pelo número apenas com dígitos
            // Caso o banco armazene formatado e o input seja sem formato, ou vice-versa.
            // Assumindo que numero_processo é texto.
            const cleanId = id.replace(/\D/g, '');
            // Se o id original já for limpo, não precisa do OR duplicado, mas não faz mal.
            // Para garantir que funciona independente de como está salvo (com ou sem máscara)
            // Se o input tem máscara (ex: 123-45...), cleanId é 12345...
            // Se o banco tem máscara, id (com mascara) deve dar match.
            // Se o banco não tem máscara, cleanId deve dar match.
            // O problema é se o input não tem máscara e o banco tem. Aí precisariamos formatar o input.
            // Mas geralmente ou é tudo limpo ou tudo formatado.
            // Vamos tentar buscar pelas duas formas.
            
            if (cleanId !== id) {
                 query = query.or(`numero_processo.eq.${id},numero_processo.eq.${cleanId}`);
            } else {
                 query = query.eq('numero_processo', id);
            }
        }

        if (empresaId) {
            query = query.eq('idempresa', empresaId);
        }

        const { data, error } = await query.maybeSingle();

        if (error) {
            console.error(`Erro ao buscar processo ${id}:`, error);
            res.status(500).json({ error: 'Erro interno.' });
            return;
        }

        if (!data) {
            res.status(404).json({ error: 'Processo não encontrado.' });
            return;
        }

        res.json(normalizeProcesso(data));
        void dispararSincronizacaoEmBackground(data);
    } catch (err) {
        console.error(`Exceção ao buscar processo ${id}:`, err);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

router.post('/processos', controller.create);
router.put('/processos/:id', controller.update);
router.delete('/processos/:id', controller.remove);

export default router;
