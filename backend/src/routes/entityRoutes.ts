import { Request, Response, Router, type Router as ExpressRouter } from 'express';
import { createCrudController } from '../controllers/crudController';
import { findUsuario } from '../controllers/authController';
import { createUserClient, supabaseAdmin } from '../config/supabase';
import { syncProcessosPdpj } from '../services/syncProcessosService';

const router: ExpressRouter = Router();

const INTIMACOES_SYNC_FUNCTION_NAME = process.env.INTIMACOES_SYNC_FUNCTION_NAME?.trim() || 'sync-intimacoes-oab';
const PROCESSOS_SYNC_FUNCTION_NAME = process.env.PROCESSOS_SYNC_FUNCTION_NAME?.trim() || 'sync-processos-pdpj';
const INTIMACOES_SYNC_LOCK_TTL_MS = 5 * 60 * 1000;
const intimacoesSyncLocks = new Map<number, number>();

const parseFunctionInvokeErrorReason = async (error: unknown): Promise<string> => {
    if (!error || typeof error !== 'object') {
        return 'Erro desconhecido ao invocar Edge Function.';
    }

    const typedError = error as { message?: unknown; context?: unknown };
    const context = typedError.context;

    // Supassojs function invoke error context is often the Response object
    if (context && typeof context === 'object') {
        // Detects Response-like objects (fetch API)
        if ('status' in context && 'statusText' in context) {
             const status = (context as { status: number }).status;
             const statusText = (context as { statusText: string }).statusText;
             
             let body = '';
             try {
                // Tenta extrair o body como texto ou JSON se possível, clone evitando burn do stream original se não for erro fatal
                const response = context as unknown as { json: () => Promise<unknown>, text: () => Promise<string>, clone: () => any };
                if (typeof response.clone === 'function') {
                    const cloned = response.clone();
                    try {
                        const json = await cloned.json();
                        if (json && typeof json === 'object') {
                            const errorMsg = (json as any).error || (json as any).message || (json as any).details;
                            if (errorMsg) body = typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg);
                            else body = JSON.stringify(json);
                        }
                    } catch {
                         // Fallback para text
                         body = await response.clone().text();
                    }
                }
             } catch (bodyError) {
                 // Falha ao ler body
             }

             const details = body ? ` - ${body.substring(0, 300)}` : '';
             return `HTTP ${status} ${statusText}${details}`;
        }
    }

    if (typeof context === 'string' && context.trim()) {
        try {
            const parsed = JSON.parse(context) as { error?: unknown; details?: unknown; message?: unknown };
            const details = [parsed.error, parsed.details, parsed.message]
                .map((value) => (typeof value === 'string' ? value.trim() : ''))
                .filter(Boolean);

            if (details.length > 0) {
                return details.join(' - ');
            }
        } catch (_parseError) {
            return context;
        }
    }

    if (typeof typedError.message === 'string' && typedError.message.trim()) {
        return typedError.message;
    }

    return 'Erro desconhecido ao invocar Edge Function.';
};

const DEFAULT_TEMPLATE_TAGS = [
    { id: 1, key: 'cliente.nome', label: 'Nome do cliente', example: 'Maria Oliveira', group_name: 'cliente' },
    { id: 2, key: 'processo.numero', label: 'Número do processo', example: '5001234-56.2024.8.26.0100', group_name: 'processo' },
    { id: 3, key: 'advogado.nome', label: 'Nome do advogado', example: 'Dr. João Silva', group_name: 'advogado' },
];

const TEMPLATE_FEATURE_UNAVAILABLE_STATUS = 503;
const TEMPLATE_FEATURE_UNAVAILABLE_MESSAGE = 'FEATURE_UNAVAILABLE: endpoint em fallback temporário para templates/documentos.';

type TemplateContentFallbackResponse = {
    status: 'fallback';
    message: string;
    content: string;
};

const buildTemplateFallbackResponse = (): TemplateContentFallbackResponse => ({
    status: 'fallback',
    message: TEMPLATE_FEATURE_UNAVAILABLE_MESSAGE,
    content: '',
});

const stringifyToContent = (value: unknown): string => {
    if (typeof value === 'string') {
        return value;
    }

    if (value === null || value === undefined) {
        return '';
    }

    return JSON.stringify(value);
};

const extractTemplateHtml = (template: Record<string, unknown>): string => {
    const rawContent = stringifyToContent(template.content);
    if (!rawContent.trim()) {
        return '<p></p>';
    }

    try {
        const parsed = JSON.parse(rawContent) as { content_html?: unknown };
        if (typeof parsed.content_html === 'string' && parsed.content_html.trim().length > 0) {
            return parsed.content_html;
        }
    } catch (_error) {
        // Conteúdo legado em HTML puro
    }

    return rawContent;
};

const applyTemplateValues = (templateHtml: string, values: Record<string, string>): string => {
    return templateHtml.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key: string) => {
        const normalizedKey = key.trim();
        const value = values[normalizedKey];
        return typeof value === 'string' ? value : '';
    });
};

const escapePdfText = (value: string): string => value.replace(/[\\()]/g, '\\$&').replace(/\r?\n/g, ' ');

const buildSimplePdfBuffer = (text: string): Buffer => {
    const safeText = escapePdfText(text || 'Template exportado com sucesso.');
    const pdf = `%PDF-1.1
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>
endobj
4 0 obj
<< /Length ${safeText.length + 30} >>
stream
BT /F1 12 Tf 72 720 Td (${safeText}) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000229 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
340
%%EOF`;

    return Buffer.from(pdf, 'utf-8');
};

// ─── Router público (sem autenticação) ──────────────────────────────────────
const publicRouter: ExpressRouter = Router();

// ─── Áreas de Atuação ────────────────────────────────────────────────────────
const areasController = createCrudController('area_atuacao', {
    filterByEmpresa: true,
    empresaColumn: 'idempresa',
    selectFields: '*',
    searchFields: ['nome'],
    orderBy: 'nome',
});

router.get('/areas', areasController.list);
router.get('/areas/:id', areasController.getById);
router.post('/areas', areasController.create);
router.put('/areas/:id', areasController.update);
router.delete('/areas/:id', areasController.remove);

// ─── Perfis ────────────────────────────────────────────────────────────────────
const perfisController = createCrudController('perfis', {
    filterByEmpresa: true,
    empresaColumn: 'idempresa',
    empresaColumns: ['idempresa', 'empresa_id'],
    selectFields: '*',
    searchFields: ['nome'],
    orderBy: 'nome',
});

router.get('/perfis', perfisController.list);
router.get('/perfis/modulos', async (req: Request, res: Response) => {
    const accessToken = req.accessToken;
    const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;

    const [modulesResult, profileModulesResult] = await Promise.all([
        client.from('modulos').select('*').order('nome', { ascending: true }),
        client.from('perfil_modulos').select('id, idperfil, idmodulo, ativo'),
    ]);

    if (modulesResult.error || profileModulesResult.error) {
        res.status(500).json({ error: 'Erro ao carregar módulos dos perfis.' });
        return;
    }

    res.json({
        modulos: modulesResult.data ?? [],
        perfilModulos: profileModulesResult.data ?? [],
    });
});
router.get('/perfis/:id', perfisController.getById);
router.post('/perfis', perfisController.create);
router.put('/perfis/:id', perfisController.update);
router.delete('/perfis/:id', perfisController.remove);

// ─── Planos ─────────────────────────────────────────────────────────────────
const planosController = createCrudController('planos', {
    filterByEmpresa: false,
    selectFields: '*',
    searchFields: ['nome'],
    orderBy: 'nome',
});

// Rotas de leitura de planos são públicas (usadas na página de registro)
publicRouter.get('/planos', planosController.list);
publicRouter.get('/planos/:id', planosController.getById);

// ─── Situação Clientes ──────────────────────────────────────────────────────
const situacaoClienteController = createCrudController('situacao_cliente', {
    filterByEmpresa: false, // tabela não tem coluna empresa
    selectFields: '*',
    searchFields: ['nome'],
    orderBy: 'nome',
});

router.get('/situacao-clientes', situacaoClienteController.list);
router.get('/situacao-clientes/:id', situacaoClienteController.getById);
router.post('/situacao-clientes', situacaoClienteController.create);
router.put('/situacao-clientes/:id', situacaoClienteController.update);
router.delete('/situacao-clientes/:id', situacaoClienteController.remove);

// ─── Situação Processos ──────────────────────────────────────────────────────
const situacaoProcessoController = createCrudController('situacao_processo', {
    filterByEmpresa: true,
    empresaColumn: 'idempresa',
    selectFields: '*',
    searchFields: ['nome'],
    orderBy: 'nome',
});

router.get('/situacao-processos', situacaoProcessoController.list);
router.get('/situacao-processos/:id', situacaoProcessoController.getById);
router.post('/situacao-processos', situacaoProcessoController.create);
router.put('/situacao-processos/:id', situacaoProcessoController.update);
router.delete('/situacao-processos/:id', situacaoProcessoController.remove);

// ─── Situação Propostas ──────────────────────────────────────────────────────
const situacaoPropostaController = createCrudController('situacao_proposta', {
    filterByEmpresa: true,
    empresaColumn: 'idempresa',
    selectFields: '*',
    searchFields: ['nome'],
    orderBy: 'nome',
});

router.get('/situacao-propostas', situacaoPropostaController.list);
router.get('/situacao-propostas/:id', situacaoPropostaController.getById);
router.post('/situacao-propostas', situacaoPropostaController.create);
router.put('/situacao-propostas/:id', situacaoPropostaController.update);
router.delete('/situacao-propostas/:id', situacaoPropostaController.remove);

// ─── Categorias ──────────────────────────────────────────────────────────────
const categoriasController = createCrudController('categorias', {
    filterByEmpresa: false, // tabela não tem coluna empresa
    selectFields: '*',
    searchFields: ['nome'],
    orderBy: 'nome',
});

router.get('/categorias', categoriasController.list);
router.get('/categorias/:id', categoriasController.getById);
router.post('/categorias', categoriasController.create);
router.put('/categorias/:id', categoriasController.update);
router.delete('/categorias/:id', categoriasController.remove);

// ─── Etiquetas ───────────────────────────────────────────────────────────────
const etiquetasController = createCrudController('etiquetas', {
    filterByEmpresa: true,
    empresaColumn: 'idempresa',
    selectFields: '*',
    searchFields: ['nome'],
    orderBy: 'ordem',
});

router.get('/etiquetas', etiquetasController.list);
router.get('/etiquetas/:id', etiquetasController.getById);
router.post('/etiquetas', etiquetasController.create);
router.put('/etiquetas/:id', etiquetasController.update);
router.delete('/etiquetas/:id', etiquetasController.remove);

// ─── Etiquetas por Fluxo ──────────────────────────────────────────────────────
router.get('/etiquetas/fluxos-trabalho/:fluxoId', async (req: Request, res: Response) => {
    // Redireciona para etiquetas filtradas por fluxo
    req.query.id_fluxo_trabalho = req.params.fluxoId;
    return etiquetasController.list(req, res);
});

// ─── Escritórios ─────────────────────────────────────────────────────────────
const escritoriosController = createCrudController('escritorios', {
    filterByEmpresa: true,
    empresaColumn: 'empresa',
    selectFields: '*',
    searchFields: ['nome'],
    orderBy: 'nome',
});

router.get('/escritorios', escritoriosController.list);
router.get('/escritorios/:id', escritoriosController.getById);
router.post('/escritorios', escritoriosController.create);
router.put('/escritorios/:id', escritoriosController.update);
router.delete('/escritorios/:id', escritoriosController.remove);

// ─── Tipo Processos ──────────────────────────────────────────────────────────
const tipoProcessosController = createCrudController('tipo_processo', {
    filterByEmpresa: true,
    empresaColumn: 'idempresa',
    selectFields: '*',
    searchFields: ['nome'],
    orderBy: 'nome',
    normalizeInput: (payload) => {
        const normalized = { ...payload };

        if ('area_atuacao_id' in normalized && !('idareaatuacao' in normalized)) {
            normalized.idareaatuacao = normalized.area_atuacao_id;
        }

        delete normalized.area_atuacao_id;

        return normalized;
    },
    normalizeOutput: (record) => {
        const normalized = { ...record };

        if (normalized.idareaatuacao !== undefined && normalized.area_atuacao_id === undefined) {
            normalized.area_atuacao_id = normalized.idareaatuacao;
        }

        return normalized;
    },
});

router.get('/tipo-processos', (req: Request, res: Response) => {
    if (req.query.area_atuacao_id !== undefined && req.query.idareaatuacao === undefined) {
        req.query.idareaatuacao = req.query.area_atuacao_id;
    }

    delete req.query.area_atuacao_id;

    return tipoProcessosController.list(req, res);
});
router.get('/tipo-processos/:id', tipoProcessosController.getById);
router.post('/tipo-processos', tipoProcessosController.create);
router.put('/tipo-processos/:id', tipoProcessosController.update);
router.delete('/tipo-processos/:id', tipoProcessosController.remove);

// ─── Tipo Eventos ────────────────────────────────────────────────────────────
const tipoEventosController = createCrudController('tipo_evento', {
    filterByEmpresa: true,
    empresaColumn: 'idempresa',
    selectFields: '*',
    searchFields: ['nome'],
    orderBy: 'nome',
});

router.get('/tipo-eventos', tipoEventosController.list);
router.get('/tipo-eventos/:id', tipoEventosController.getById);
router.post('/tipo-eventos', tipoEventosController.create);
router.put('/tipo-eventos/:id', tipoEventosController.update);
router.delete('/tipo-eventos/:id', tipoEventosController.remove);

// ─── Tipo Documentos ─────────────────────────────────────────────────────────
const tipoDocumentosController = createCrudController('tipo_documento', {
    filterByEmpresa: true,
    empresaColumn: 'idempresa',
    selectFields: '*',
    searchFields: ['nome'],
    orderBy: 'nome',
});

router.get('/tipo-documentos', tipoDocumentosController.list);
router.get('/tipo-documentos/:id', tipoDocumentosController.getById);
router.post('/tipo-documentos', tipoDocumentosController.create);
router.put('/tipo-documentos/:id', tipoDocumentosController.update);
router.delete('/tipo-documentos/:id', tipoDocumentosController.remove);

// Alias usado no frontend do chat (migração legado -> Supabase)
router.get('/clientes/atributos/tipos', tipoDocumentosController.list);

// ─── Tipo Envolvimento ──────────────────────────────────────────────────────
const tipoEnvolvimentoController = createCrudController('tipo_envolvimento', {
    filterByEmpresa: false, // tabela não tem coluna empresa
    selectFields: '*',
    searchFields: ['descricao'],
    orderBy: 'descricao',
});

router.get('/tipo-envolvimentos', tipoEnvolvimentoController.list);
router.get('/tipo-envolvimentos/:id', tipoEnvolvimentoController.getById);
router.post('/tipo-envolvimentos', tipoEnvolvimentoController.create);
router.put('/tipo-envolvimentos/:id', tipoEnvolvimentoController.update);
router.delete('/tipo-envolvimentos/:id', tipoEnvolvimentoController.remove);

// ─── Fornecedores ────────────────────────────────────────────────────────────
const fornecedoresController = createCrudController('fornecedores', {
    filterByEmpresa: true,
    empresaColumn: 'idempresa',
    selectFields: '*',
    searchFields: ['nome', 'email', 'documento'],
    orderBy: 'nome',
});

router.get('/fornecedores', fornecedoresController.list);
router.get('/fornecedores/:id', fornecedoresController.getById);
router.post('/fornecedores', fornecedoresController.create);
router.put('/fornecedores/:id', fornecedoresController.update);
router.delete('/fornecedores/:id', fornecedoresController.remove);

// ─── Fluxos de Trabalho ──────────────────────────────────────────────────────
const fluxosTrabalhoController = createCrudController('fluxo_trabalho', {
    filterByEmpresa: true,
    empresaColumn: 'idempresa',
    selectFields: '*',
    searchFields: ['nome'],
    orderBy: 'ordem',
});


// Rota customizada: Menus de fluxos
router.get('/fluxos-trabalho/menus', async (req: Request, res: Response) => {
    // Retorna todos os fluxos como menus
    // Pode personalizar se precisar retornar hierarquia
    return fluxosTrabalhoController.list(req, res);
});

router.get('/fluxos-trabalho', fluxosTrabalhoController.list);
router.get('/fluxos-trabalho/:id', fluxosTrabalhoController.getById);

router.post('/fluxos-trabalho', fluxosTrabalhoController.create);
router.put('/fluxos-trabalho/:id', fluxosTrabalhoController.update);
router.delete('/fluxos-trabalho/:id', fluxosTrabalhoController.remove);

// ─── Templates ────────────────────────────────────────────────────────────────
const templatesController = createCrudController('templates', {
    filterByEmpresa: true,
    empresaColumn: 'idempresa',
    selectFields: '*',
    searchFields: ['title'],
    orderBy: 'title',
});

router.get('/templates', templatesController.list);
router.get('/templates/:id', templatesController.getById);
router.post('/templates', templatesController.create);
router.put('/templates/:id', templatesController.update);
router.delete('/templates/:id', templatesController.remove);

router.get('/tags', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;
        const { data, error } = await client
            .from('template_tags')
            .select('id,key,label,example,group_name')
            .order('id', { ascending: true });

        if (error) {
            console.warn('[templates] Falha ao carregar tags do Supabase, usando fallback:', error.message);
            res.json(DEFAULT_TEMPLATE_TAGS);
            return;
        }

        if (!Array.isArray(data) || data.length === 0) {
            res.json(DEFAULT_TEMPLATE_TAGS);
            return;
        }

        res.json(data);
    } catch (error) {
        console.error('[templates] Erro ao carregar tags:', error);
        res.json(DEFAULT_TEMPLATE_TAGS);
    }
});

router.post('/templates/:id/generate', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;

        const { data, error } = await client
            .from('templates')
            .select('id,title,content')
            .eq('id', req.params.id)
            .single();

        if (error || !data) {
            res.status(404).json({ error: 'Template não encontrado.' });
            return;
        }

        const html = extractTemplateHtml(data as Record<string, unknown>);
        res.json({ content: html });
    } catch (error) {
        console.error('[templates] Erro ao gerar conteúdo por template:', error);
        res.status(TEMPLATE_FEATURE_UNAVAILABLE_STATUS).json(buildTemplateFallbackResponse());
    }
});

router.post('/documents/generate', async (req: Request, res: Response) => {
    try {
        const templateId = Number(req.body?.templateId);
        const values = (req.body?.values ?? {}) as Record<string, string>;

        if (!Number.isFinite(templateId)) {
            res.status(400).json({ error: 'templateId inválido.' });
            return;
        }

        const accessToken = req.accessToken;
        const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;
        const { data, error } = await client
            .from('templates')
            .select('id,title,content')
            .eq('id', templateId)
            .single();

        if (error || !data) {
            res.status(404).json({ error: 'Template não encontrado.' });
            return;
        }

        const html = extractTemplateHtml(data as Record<string, unknown>);
        const generated = applyTemplateValues(html, values);
        res.json({ content: generated });
    } catch (error) {
        console.error('[templates] Erro ao gerar documento:', error);
        res.status(TEMPLATE_FEATURE_UNAVAILABLE_STATUS).json(buildTemplateFallbackResponse());
    }
});

router.get('/templates/:id/export', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;

        const { data, error } = await client
            .from('templates')
            .select('id,title,content')
            .eq('id', req.params.id)
            .single();

        if (error || !data) {
            res.status(404).json({ error: 'Template não encontrado.' });
            return;
        }

        const title = typeof data.title === 'string' && data.title.trim().length > 0
            ? data.title.trim()
            : `template-${req.params.id}`;
        const html = extractTemplateHtml(data as Record<string, unknown>);
        const pdfBuffer = buildSimplePdfBuffer(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${title}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[templates] Erro ao exportar template:', error);
        res.status(TEMPLATE_FEATURE_UNAVAILABLE_STATUS).json({
            status: 'fallback',
            message: TEMPLATE_FEATURE_UNAVAILABLE_MESSAGE,
        });
    }
});

// ─── Tarefas ─────────────────────────────────────────────────────────────────
const tarefasController = createCrudController('tarefas', {
    filterByEmpresa: true,
    empresaColumn: 'idempresa',
    selectFields: '*',
    searchFields: ['titulo', 'descricao'],
    orderBy: 'criado_em',
    orderAscending: false,
});

router.get('/tarefas', tarefasController.list);
router.get('/tarefas/:id', tarefasController.getById);
const getTaskResponsavel = async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;
        const userId = req.supabaseUser?.id;
        const userEmail = req.supabaseUser?.email;

        if (!userId && !userEmail) {
            res.status(401).json({ error: 'Usuário não autenticado.' });
            return;
        }

        const user = await findUsuario(userId || '', userEmail);
        const empresaId = user?.empresa ?? (user as { empresa_id?: number | null } | null)?.empresa_id ?? null;

        if (empresaId == null) {
            res.status(403).json({ error: 'Usuário sem empresa vinculada.' });
            return;
        }

        const taskId = Number.parseInt(req.params.id, 10);
        if (!Number.isFinite(taskId)) {
            res.status(400).json({ error: 'ID de tarefa inválido.' });
            return;
        }

        const { data: tarefa, error: tarefaError } = await client
            .from('tarefas')
            .select('id, idusuario, idempresa')
            .eq('id', taskId)
            .eq('idempresa', empresaId)
            .maybeSingle();

        if (tarefaError) {
            console.error('[Tarefas] Erro ao consultar responsável da tarefa:', tarefaError);
            res.status(500).json({ error: 'Erro ao buscar responsável da tarefa.' });
            return;
        }

        if (!tarefa) {
            res.status(404).json({ error: 'Tarefa não encontrada.' });
            return;
        }

        const responsavelId = (tarefa as { idusuario?: number | null }).idusuario;
        if (!responsavelId) {
            res.json([]);
            return;
        }

        const { data: usuario, error: usuarioError } = await client
            .from('usuarios')
            .select('id, nome_completo')
            .eq('id', responsavelId)
            .maybeSingle();

        if (usuarioError) {
            console.error('[Tarefas] Erro ao carregar dados do responsável:', usuarioError);
            res.status(500).json({ error: 'Erro ao buscar responsável da tarefa.' });
            return;
        }

        if (!usuario) {
            res.json([]);
            return;
        }

        res.json([
            {
                id_usuario: (usuario as { id?: number }).id,
                nome_responsavel: (usuario as { nome_completo?: string }).nome_completo ?? 'Responsável',
            },
        ]);
    } catch (error) {
        console.error('[Tarefas] Erro interno ao buscar responsável:', error);
        res.status(500).json({ error: 'Erro interno ao buscar responsável da tarefa.' });
    }
};

router.get('/tarefas/:id/responsavel', getTaskResponsavel);
router.get('/tarefas/:id/responsaveis', getTaskResponsavel);

router.post('/tarefas/:id/concluir', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;
        const userId = req.supabaseUser?.id;
        const userEmail = req.supabaseUser?.email;

        if (!userId && !userEmail) {
            res.status(401).json({ error: 'Usuário não autenticado.' });
            return;
        }

        const user = await findUsuario(userId || '', userEmail);
        const empresaId = user?.empresa ?? (user as { empresa_id?: number | null } | null)?.empresa_id ?? null;

        if (empresaId == null) {
            res.status(403).json({ error: 'Usuário sem empresa vinculada.' });
            return;
        }

        const taskId = Number.parseInt(req.params.id, 10);
        if (!Number.isFinite(taskId)) {
            res.status(400).json({ error: 'ID de tarefa inválido.' });
            return;
        }

        const { data, error } = await client
            .from('tarefas')
            .update({ status: 'concluida' })
            .eq('id', taskId)
            .eq('idempresa', empresaId)
            .select('*')
            .maybeSingle();

        if (error) {
            console.error('[Tarefas] Erro ao concluir tarefa:', error);
            res.status(500).json({ error: 'Erro ao concluir tarefa.' });
            return;
        }

        if (!data) {
            res.status(404).json({ error: 'Tarefa não encontrada.' });
            return;
        }

        res.json(data);
    } catch (error) {
        console.error('[Tarefas] Erro interno ao concluir tarefa:', error);
        res.status(500).json({ error: 'Erro interno ao concluir tarefa.' });
    }
});

router.post('/tarefas', async (req: Request, res: Response) => {
    try {
        console.log('[Tarefas] Debugging Create. Body before:', JSON.stringify(req.body));
        const userId = req.supabaseUser?.id;
        const userEmail = req.supabaseUser?.email;
        console.log(`[Tarefas] Auth Info - ID: ${userId}, Email: ${userEmail}`);
        
        let foundUserId: number | null = null;
        
        if (req.body.idusuario) {
            console.log('[Tarefas] idusuario already present in body:', req.body.idusuario);
            foundUserId = Number(req.body.idusuario);
        } else if (userId || userEmail) {
            const user = await findUsuario(userId || '', userEmail);
            console.log('[Tarefas] findUsuario result:', user ? `Found (ID: ${user.id})` : 'Not Found');
            if (user?.id) {
                foundUserId = user.id;
            }
        }
        
        if (foundUserId) {
            req.body.idusuario = foundUserId;
            console.log('[Tarefas] Injected idusuario:', foundUserId);
        } else {
             console.warn('[Tarefas] Could not determine idusuario.');
        }
        
        console.log('[Tarefas] Body after injection:', JSON.stringify(req.body));

    } catch (error) {
        console.error('[Tarefas] Erro ao preparar criação de tarefa:', error);
    }
    return tarefasController.create(req, res);
});
router.put('/tarefas/:id', tarefasController.update);
router.delete('/tarefas/:id', tarefasController.remove);

// ─── Agenda ──────────────────────────────────────────────────────────────────
const agendaController = createCrudController('agenda', {
    filterByEmpresa: true,
    empresaColumn: 'idempresa',
    selectFields: '*',
    searchFields: ['titulo', 'descricao'],
    orderBy: 'data',
    orderAscending: true,
});

router.get('/agendamentos', agendaController.list);
router.get('/agendamentos/:id', agendaController.getById);
router.post('/agendamentos', agendaController.create);
router.put('/agendamentos/:id', agendaController.update);
router.delete('/agendamentos/:id', agendaController.remove);

// Alias compatível com o frontend atual (preferível) mantendo retrocompatibilidade
router.get('/agendas', agendaController.list);

// ── Agendas: pending-count (DEVE vir ANTES de /agendas/:id) ──────────────────
router.get('/agendas/pending-count', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        if (!accessToken || !req.supabaseUser) {
            res.json({ count: 0 });
            return;
        }

        const userClient = createUserClient(accessToken);
        const userData = await findUsuario(req.supabaseUser.id, req.supabaseUser.email);

        if (!userData) {
            res.json({ count: 0 });
            return;
        }

        // Conta agendamentos pendentes (futuros)
        const now = new Date().toISOString();
        let query = userClient
            .from('agenda')
            .select('id', { count: 'exact', head: true })
            .gte('data', now);

        const empresaId = userData.empresa ?? (userData as { empresa_id?: number | null }).empresa_id ?? null;

        if (empresaId) {
            query = query.eq('idempresa', empresaId);
        }

        const { count } = await query;

        res.json({ count: count ?? 0 });
    } catch (error) {
        console.error('Erro ao buscar pending-count de agendas:', error);
        res.json({ count: 0 });
    }
});

router.get('/agendas/:id', agendaController.getById);
router.post('/agendas', agendaController.create);
router.put('/agendas/:id', agendaController.update);
router.delete('/agendas/:id', agendaController.remove);

// ─── Notificações ────────────────────────────────────────────────────────────
const notificacoesController = createCrudController('notifications', {
    filterByEmpresa: false,
    selectFields: '*',
    searchFields: ['title', 'message'],
    orderBy: 'created_at',
    orderAscending: false,
});

router.get('/notifications', notificacoesController.list);

// ── Notifications: unread-count (DEVE vir ANTES de /notifications/:id) ───────
router.get('/notifications/unread-count', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        if (!accessToken || !req.supabaseUser) {
            res.json({ unread: 0 });
            return;
        }

        const userClient = createUserClient(accessToken);
        const category = req.query.category as string | undefined;

        let query = userClient
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('read', false);

        if (category) {
            query = query.eq('category', category);
        }

        const { count } = await query;

        res.json({ unread: count ?? 0 });
    } catch (error) {
        console.error('Erro ao buscar unread-count de notificações:', error);
        res.json({ unread: 0 });
    }
});

router.get('/notifications/:id', notificacoesController.getById);
router.put('/notifications/:id', notificacoesController.update);

// ─── Intimações ──────────────────────────────────────────────────────────────
const intimacoesController = createCrudController('intimacoes', {
    filterByEmpresa: true,
    empresaColumn: 'idempresa',
    selectFields: '*',
    searchFields: ['numero_processo', 'texto'],
    orderBy: 'created_at',
    orderAscending: false,
});

const normalizeOabValue = (value: unknown): string | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const digits = value.replace(/\D/g, '');
    return digits.length > 0 ? digits : null;
};

const normalizeUfValue = (value: unknown): string | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim().toUpperCase().replace(/[^A-Z]/g, '');
    return normalized.length === 2 ? normalized : null;
};

const getEmpresaIdFromRequest = async (req: Request): Promise<number | null> => {
    const userId = req.supabaseUser?.id;
    const userEmail = req.supabaseUser?.email;

    if (!userId && !userEmail) {
        return null;
    }

    const user = await findUsuario(userId || '', userEmail);
    return (user?.empresa ?? (user as { empresa_id?: number | null } | null)?.empresa_id ?? null) as number | null;
};

const getUsuarioIdFromRequest = async (req: Request): Promise<number | null> => {
    const userId = req.supabaseUser?.id;
    const userEmail = req.supabaseUser?.email;

    if (!userId && !userEmail) {
        return null;
    }

    const user = await findUsuario(userId || '', userEmail);
    return Number(user?.id) || null;
};

const acquireIntimacoesSyncLock = (empresaId: number): boolean => {
    const now = Date.now();
    const lockCreatedAt = intimacoesSyncLocks.get(empresaId);

    if (lockCreatedAt && (now - lockCreatedAt) < INTIMACOES_SYNC_LOCK_TTL_MS) {
        return false;
    }

    intimacoesSyncLocks.set(empresaId, now);
    return true;
};

const releaseIntimacoesSyncLock = (empresaId: number): void => {
    intimacoesSyncLocks.delete(empresaId);
};

router.get('/processos/oab-monitoradas', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        if (!accessToken) {
            res.status(401).json({ error: 'Não autorizado.' });
            return;
        }

        const client = createUserClient(accessToken);
        const empresaId = await getEmpresaIdFromRequest(req);

        if (empresaId == null) {
            res.json([]);
            return;
        }

        const { data, error } = await client
            .from('oab_monitoradas')
            .select('id, usuario_id, uf, numero, dias_semana, sync_from, created_at, updated_at')
            .eq('empresa_id', empresaId)
            .eq('tipo', 'processos')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[processos/oab-monitoradas] Erro ao listar OABs monitoradas:', error);
            res.status(500).json({ error: 'Não foi possível carregar as OABs monitoradas.' });
            return;
        }

        res.json(data ?? []);
    } catch (error) {
        console.error('[processos/oab-monitoradas] Erro inesperado ao listar OABs monitoradas:', error);
        res.status(500).json({ error: 'Não foi possível carregar as OABs monitoradas.' });
    }
});

router.post('/processos/oab-monitoradas', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        if (!accessToken) {
            res.status(401).json({ error: 'Não autorizado.' });
            return;
        }

        const empresaId = await getEmpresaIdFromRequest(req);
        if (empresaId == null) {
            res.status(400).json({ error: 'Empresa do usuário não encontrada.' });
            return;
        }

        const numero = normalizeOabValue(req.body?.numero);
        const uf = normalizeUfValue(req.body?.uf);
        const usuarioIdRaw = req.body?.usuarioId;
        const usuarioId = Number.isFinite(Number(usuarioIdRaw)) ? Number(usuarioIdRaw) : null;
        const syncFrom = typeof req.body?.syncFrom === 'string' && req.body.syncFrom.trim() ? req.body.syncFrom.trim() : null;
        const diasSemana = Array.isArray(req.body?.diasSemana)
            ? Array.from(new Set<number>(req.body.diasSemana
                .map((value: unknown) => (Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : null))
                .filter((value: number | null): value is number => value !== null && value >= 1 && value <= 7)))
                .sort((a: number, b: number) => a - b)
            : null;

        if (!numero || !uf) {
            res.status(400).json({ error: 'Informe UF e número da OAB válidos.' });
            return;
        }

        if (!usuarioId || usuarioId <= 0) {
            res.status(400).json({ error: 'Informe um usuário responsável válido.' });
            return;
        }

        const client = createUserClient(accessToken);

        const { data, error } = await client
            .from('oab_monitoradas')
            .upsert({
                empresa_id: empresaId,
                usuario_id: usuarioId,
                tipo: 'processos',
                uf,
                numero,
                dias_semana: diasSemana,
                sync_from: syncFrom,
            }, { onConflict: 'empresa_id,tipo,uf,numero' })
            .select('id, usuario_id, uf, numero, dias_semana, sync_from, created_at, updated_at')
            .single();

        if (error || !data) {
            console.error('[processos/oab-monitoradas] Erro ao cadastrar OAB monitorada:', error);
            res.status(400).json({ error: error?.message || 'Não foi possível cadastrar a OAB monitorada.' });
            return;
        }

        console.log('[processos/oab-monitoradas] Disparando sincronização via serviço:', {
            empresaId, usuarioId, uf, numero, syncFrom,
        });

        // Responde imediatamente, sync roda em background
        res.status(201).json({
            ...data,
            processosSync: { triggered: true, message: 'Sincronização iniciada em background.' },
        });

        // Sync em background (fire-and-forget)
        syncProcessosPdpj({ empresaId, usuarioId, uf, numero }).catch((err) => {
            console.error('[processos/oab-monitoradas] Erro na sincronização em background:', err);
        });

        return;

    } catch (error) {
        console.error('[processos/oab-monitoradas] Erro inesperado ao cadastrar OAB monitorada:', error);
        res.status(500).json({ error: 'Não foi possível cadastrar a OAB monitorada.' });
    }
});

router.delete('/processos/oab-monitoradas/:id', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        if (!accessToken) {
            res.status(401).json({ error: 'Não autorizado.' });
            return;
        }

        const empresaId = await getEmpresaIdFromRequest(req);
        if (empresaId == null) {
            res.status(400).json({ error: 'Empresa do usuário não encontrada.' });
            return;
        }

        const client = createUserClient(accessToken);
        const { error } = await client
            .from('oab_monitoradas')
            .delete()
            .eq('id', req.params.id)
            .eq('empresa_id', empresaId)
            .eq('tipo', 'processos');

        if (error) {
            console.error('[processos/oab-monitoradas] Erro ao remover OAB monitorada:', error);
            res.status(400).json({ error: error.message || 'Não foi possível remover a OAB monitorada.' });
            return;
        }

        res.status(204).send();
    } catch (error) {
        console.error('[processos/oab-monitoradas] Erro inesperado ao remover OAB monitorada:', error);
        res.status(500).json({ error: 'Não foi possível remover a OAB monitorada.' });
    }
});

router.get('/intimacoes/oab-monitoradas', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        if (!accessToken) {
            res.status(401).json({ error: 'Não autorizado.' });
            return;
        }

        const client = createUserClient(accessToken);
        const empresaId = await getEmpresaIdFromRequest(req);

        if (empresaId == null) {
            res.json([]);
            return;
        }

        const { data, error } = await client
            .from('oab_monitoradas')
            .select('id, usuario_id, uf, numero, dias_semana, sync_from, created_at, updated_at')
            .eq('empresa_id', empresaId)
            .eq('tipo', 'intimacoes')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[intimacoes/oab-monitoradas] Erro ao listar OABs monitoradas:', error);
            res.status(500).json({ error: 'Não foi possível carregar as OABs monitoradas.' });
            return;
        }

        res.json(data ?? []);
    } catch (error) {
        console.error('[intimacoes/oab-monitoradas] Erro inesperado ao listar OABs monitoradas:', error);
        res.status(500).json({ error: 'Não foi possível carregar as OABs monitoradas.' });
    }
});

router.post('/intimacoes/oab-monitoradas', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        if (!accessToken) {
            res.status(401).json({ error: 'Não autorizado.' });
            return;
        }

        const empresaId = await getEmpresaIdFromRequest(req);
        if (empresaId == null) {
            res.status(400).json({ error: 'Empresa do usuário não encontrada.' });
            return;
        }

        const numero = normalizeOabValue(req.body?.numero);
        const uf = normalizeUfValue(req.body?.uf);
        const usuarioIdRaw = req.body?.usuarioId;
        const usuarioId = Number.isFinite(Number(usuarioIdRaw)) ? Number(usuarioIdRaw) : null;
        const syncFrom = typeof req.body?.syncFrom === 'string' && req.body.syncFrom.trim() ? req.body.syncFrom.trim() : null;
        const diasSemana = Array.isArray(req.body?.diasSemana)
            ? Array.from(new Set<number>(req.body.diasSemana
                .map((value: unknown) => (Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : null))
                .filter((value: number | null): value is number => value !== null && value >= 1 && value <= 7)))
                .sort((a: number, b: number) => a - b)
            : null;

        if (!numero || !uf) {
            res.status(400).json({ error: 'Informe UF e número da OAB válidos.' });
            return;
        }

        if (!usuarioId || usuarioId <= 0) {
            res.status(400).json({ error: 'Informe um usuário responsável válido.' });
            return;
        }

        const client = createUserClient(accessToken);

        const { data, error } = await client
            .from('oab_monitoradas')
            .upsert({
                empresa_id: empresaId,
                usuario_id: usuarioId,
                tipo: 'intimacoes',
                uf,
                numero,
                dias_semana: diasSemana,
                sync_from: syncFrom,
            }, { onConflict: 'empresa_id,tipo,uf,numero' })
            .select('id, usuario_id, uf, numero, dias_semana, sync_from, created_at, updated_at')
            .single();

        if (error || !data) {
            console.error('[intimacoes/oab-monitoradas] Erro ao cadastrar OAB monitorada:', error);
            res.status(400).json({ error: error?.message || 'Não foi possível cadastrar a OAB monitorada.' });
            return;
        }

        // ── Verifica se é a primeira sincronização do usuário ──────────
        const { count: existingIntimacoes } = await supabaseAdmin
            .from('intimacoes')
            .select('id', { count: 'exact', head: true })
            .eq('idempresa', empresaId)
            .eq('idusuario', usuarioId);

        const isFirstSync = !existingIntimacoes || existingIntimacoes === 0;
        const hoje = new Date().toISOString().slice(0, 10);

        // Primeira sync: sem filtro de data (busca tudo)
        // Syncs posteriores: apenas o dia atual
        const syncDataInicio = isFirstSync ? undefined : hoje;
        const syncDataFim = isFirstSync ? undefined : hoje;

        const { data: syncResult, error: syncError } = await supabaseAdmin.functions.invoke(INTIMACOES_SYNC_FUNCTION_NAME, {
            body: {
                numeroOab: numero,
                ufOab: uf,
                empresaId,
                usuarioId,
                dataInicio: syncDataInicio,
                dataFim: syncDataFim,
            },
        });

        if (syncError) {
            console.error('[intimacoes/oab-monitoradas] Erro ao sincronizar via edge function:', syncError);
        }

        let intimacoesQuery = client
            .from('intimacoes')
            .select('*')
            .eq('idempresa', empresaId)
            .eq('idusuario', usuarioId)
            .order('created_at', { ascending: false })
            .limit(200);

        if (syncFrom) {
            intimacoesQuery = intimacoesQuery.gte('data_disponibilizacao', syncFrom);
        }

        const { data: intimacoesVinculadas, error: intimacoesError } = await intimacoesQuery;

        if (intimacoesError) {
            console.error('[intimacoes/oab-monitoradas] Erro ao carregar intimações vinculadas:', intimacoesError);
        }

        res.status(201).json({
            ...data,
            intimacoesSync: syncError
                ? {
                    triggered: false,
                    message: `Falha ao disparar sincronização após migração para Supabase: ${syncError.message}`,
                  }
                : syncResult ?? { triggered: true },
            intimacoesVinculadas: intimacoesVinculadas ?? [],
        });
    } catch (error) {
        console.error('[intimacoes/oab-monitoradas] Erro inesperado ao cadastrar OAB monitorada:', error);
        res.status(500).json({ error: 'Não foi possível cadastrar a OAB monitorada.' });
    }
});

router.delete('/intimacoes/oab-monitoradas/:id', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        if (!accessToken) {
            res.status(401).json({ error: 'Não autorizado.' });
            return;
        }

        const empresaId = await getEmpresaIdFromRequest(req);
        if (empresaId == null) {
            res.status(400).json({ error: 'Empresa do usuário não encontrada.' });
            return;
        }

        const client = createUserClient(accessToken);
        const { error } = await client
            .from('oab_monitoradas')
            .delete()
            .eq('id', req.params.id)
            .eq('empresa_id', empresaId)
            .eq('tipo', 'intimacoes');

        if (error) {
            console.error('[intimacoes/oab-monitoradas] Erro ao remover OAB monitorada:', error);
            res.status(400).json({ error: error.message || 'Não foi possível remover a OAB monitorada.' });
            return;
        }

        res.status(204).send();
    } catch (error) {
        console.error('[intimacoes/oab-monitoradas] Erro inesperado ao remover OAB monitorada:', error);
        res.status(500).json({ error: 'Não foi possível remover a OAB monitorada.' });
    }
});

router.post('/intimacoes/sync', async (req: Request, res: Response) => {
    const accessToken = req.accessToken;
    if (!accessToken) {
        res.status(401).json({ error: 'Não autorizado.' });
        return;
    }

    let empresaId: number | null = null;
    let lockAcquired = false;

    try {
        empresaId = await getEmpresaIdFromRequest(req);
        if (empresaId == null) {
            res.status(400).json({ error: 'Empresa do usuário não encontrada.' });
            return;
        }

        if (!acquireIntimacoesSyncLock(empresaId)) {
            res.status(202).json({
                triggered: false,
                message: 'Uma sincronização de intimações já está em andamento para esta empresa.',
            });
            return;
        }
        lockAcquired = true;

        const client = createUserClient(accessToken);
        const fallbackUsuarioId = await getUsuarioIdFromRequest(req);
        const { data: monitoredOabs, error: monitoredOabsError } = await client
            .from('oab_monitoradas')
            .select('id, uf, numero, usuario_id, sync_from')
            .eq('empresa_id', empresaId)
            .eq('tipo', 'intimacoes');

        if (monitoredOabsError) {
            console.error('[intimacoes/sync] Erro ao buscar OABs monitoradas:', monitoredOabsError);
            res.status(500).json({ error: 'Não foi possível carregar as OABs monitoradas para sincronização.' });
            return;
        }

        const requestedUsuarioIds = Array.from(new Set(
            monitoredOabs
                .map((oab) => Number(oab.usuario_id))
                .filter((usuarioId) => Number.isInteger(usuarioId) && usuarioId > 0)
        ));

        if (fallbackUsuarioId && fallbackUsuarioId > 0) {
            requestedUsuarioIds.push(fallbackUsuarioId);
        }

        const uniqueUsuarioIds = Array.from(new Set(requestedUsuarioIds));
        const validUsuarioIds = new Set<number>();

        if (uniqueUsuarioIds.length > 0) {
            const empresaColumnsToTry: Array<'empresa' | 'empresa_id' | 'idempresa'> = ['empresa', 'empresa_id', 'idempresa'];
            let usuariosAtivos: Array<{ id: number | string }> | null = null;
            let usuariosError: { message?: string } | null = null;

            for (const empresaColumn of empresaColumnsToTry) {
                const result = await client
                    .from('usuarios')
                    .select('id')
                    .in('id', uniqueUsuarioIds)
                    .eq(empresaColumn, empresaId);

                if (!result.error) {
                    usuariosAtivos = result.data;
                    usuariosError = null;
                    break;
                }

                usuariosError = result.error;

                const message = (result.error.message ?? '').toLowerCase();
                const isUndefinedColumn = message.includes('column') && message.includes('does not exist');
                if (!isUndefinedColumn) {
                    break;
                }
            }

            if (usuariosError) {
                console.error('[intimacoes/sync] Erro ao validar usuários vinculados às OABs monitoradas:', usuariosError);
                res.status(500).json({ error: 'Não foi possível validar os usuários vinculados às OABs monitoradas.' });
                return;
            }

            for (const usuario of usuariosAtivos ?? []) {
                const id = Number(usuario.id);
                if (Number.isInteger(id) && id > 0) {
                    validUsuarioIds.add(id);
                }
            }
        }

        if (!monitoredOabs?.length) {
            res.status(200).json({
                triggered: true,
                message: 'Sincronização concluída: nenhuma OAB monitorada para intimações foi encontrada.',
            });
            return;
        }

        const results = await Promise.all(monitoredOabs.map(async (oab) => {
            const monitoredUsuarioId = Number(oab.usuario_id);
            const usuarioId = validUsuarioIds.has(monitoredUsuarioId)
                ? monitoredUsuarioId
                : (fallbackUsuarioId && validUsuarioIds.has(fallbackUsuarioId) ? fallbackUsuarioId : null);

            if (!usuarioId || usuarioId <= 0) {
                return {
                    success: false,
                    oab: `${oab.numero}/${oab.uf}`,
                    reason: 'usuario_id da OAB monitorada não foi encontrado para esta empresa (possível divergência pós-migração).',
                };
            }

            const numeroOab = (oab.numero ?? '').replace(/\D/g, '');
            const ufOab = (oab.uf ?? '').toUpperCase().replace(/[^A-Z]/g, '');

            // ── Verifica se é a primeira sincronização do usuário ──────────
            // Se já existem intimações para este usuário+empresa, sincroniza
            // apenas o dia atual. Se não existem (primeira vez), busca TODAS.
            const { count: existingCount, error: countError } = await supabaseAdmin
                .from('intimacoes')
                .select('id', { count: 'exact', head: true })
                .eq('idempresa', empresaId)
                .eq('idusuario', usuarioId);

            if (countError) {
                console.error(`[intimacoes/sync] Erro ao verificar intimações existentes para usuario ${usuarioId}:`, countError);
            }

            const isFirstSync = !existingCount || existingCount === 0;
            const hoje = new Date().toISOString().slice(0, 10);

            // Primeira sync: sem filtro de data (busca tudo)
            // Syncs posteriores: apenas o dia atual
            const dataInicio = isFirstSync ? undefined : hoje;
            const dataFim = isFirstSync ? undefined : hoje;

            try {
                // ── Fetch all pages from ComunicaAPI ──────────────────────────
                type ComunicaApiItem = Record<string, unknown> & {
                    id?: string | number;
                    siglaTribunal?: string;
                    numeroProcesso?: string;
                    numero_processo?: string;
                };

                const fetchedItems: ComunicaApiItem[] = [];
                let pagina = 1;
                const itensPorPagina = 100;

                while (true) {
                    const query = new URLSearchParams({
                        numeroOab,
                        ufOab,
                        pagina: String(pagina),
                        itensPorPagina: String(itensPorPagina),
                    });

                    if (dataInicio) query.set('dataDisponibilizacaoInicio', dataInicio);
                    if (dataFim) query.set('dataDisponibilizacaoFim', dataFim);

                    let apiResponse: globalThis.Response | null = null;
                    for (let attempt = 0; attempt < 4; attempt++) {
                        if (attempt > 0) {
                            const delayMs = Math.min(5000 * Math.pow(2, attempt - 1), 30000);
                            console.log(`[intimacoes/sync] ${oab.numero}/${oab.uf} página ${pagina}: 429 retentativa ${attempt}/3, aguardando ${delayMs}ms...`);
                            await new Promise((resolve) => setTimeout(resolve, delayMs));
                        }

                        apiResponse = await fetch(`https://comunicaapi.pje.jus.br/api/v1/comunicacao?${query.toString()}`, {
                            method: 'GET',
                            headers: { Accept: 'application/json' },
                        });

                        if (apiResponse.status !== 429) break;
                    }

                    if (!apiResponse || !apiResponse.ok) {
                        const body = apiResponse ? await apiResponse.text() : 'No response';
                        const status = apiResponse?.status ?? 0;
                        const statusText = apiResponse?.statusText ?? 'Unknown';
                        return {
                            success: false,
                            oab: `${oab.numero}/${oab.uf}`,
                            reason: `ComunicaAPI HTTP ${status} ${statusText} - ${body.slice(0, 200)}`,
                        };
                    }

                    const result = await apiResponse.json() as unknown;
                    const items =
                        Array.isArray(result)
                            ? result
                            : result && typeof result === 'object' && Array.isArray((result as Record<string, unknown>).items)
                                ? (result as Record<string, unknown>).items as unknown[]
                                : result && typeof result === 'object' && Array.isArray((result as Record<string, unknown>).data)
                                    ? (result as Record<string, unknown>).data as unknown[]
                                    : [];

                    const pageItems = items as ComunicaApiItem[];
                    fetchedItems.push(...pageItems);

                    if (pageItems.length < itensPorPagina || pageItems.length === 0) {
                        break;
                    }

                    pagina += 1;
                    // Delay entre páginas para respeitar rate limit da ComunicaAPI
                    await new Promise((resolve) => setTimeout(resolve, 500));
                }

                // ── Map & upsert into Supabase ────────────────────────────────
                const toText = (v: unknown): string | null => {
                    if (v == null) return null;
                    if (typeof v === 'string') { const t = v.trim(); return t.length > 0 ? t : null; }
                    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
                    return null;
                };
                const toBoolean = (v: unknown, fb: boolean): boolean => {
                    if (typeof v === 'boolean') return v;
                    if (typeof v === 'string') { const n = v.trim().toLowerCase(); if (['true','1','yes','sim'].includes(n)) return true; if (['false','0','no','nao','não'].includes(n)) return false; }
                    if (typeof v === 'number') return v !== 0;
                    return fb;
                };
                const toIsoDate = (v: unknown): string | null => { const r = toText(v); if (!r) return null; const d = new Date(r); if (Number.isNaN(d.getTime())) return null; return d.toISOString().slice(0, 10); };
                const normalizeList = (v: unknown): string[] | null => {
                    if (!Array.isArray(v)) return null;
                    const n = v.map((item) => {
                        if (typeof item === 'string') return item.trim();
                        if (item && typeof item === 'object') {
                            const r = item as Record<string, unknown>;
                            return (toText(r.nome) ?? toText(r.nomeAdvogado) ?? toText(r.advogado) ?? toText(r.numeroOab) ?? JSON.stringify(item))?.trim() ?? '';
                        }
                        return toText(item) ?? '';
                    }).filter((i) => i.length > 0);
                    return n.length > 0 ? n : null;
                };

                const mappedRows = fetchedItems.map((item) => ({
                    external_id: toText(item.id),
                    siglaTribunal: toText(item.siglaTribunal ?? (item as Record<string, unknown>).sigla_tribunal) ?? 'projudi',
                    numero_processo: toText(item.numeroProcesso ?? item.numero_processo),
                    nomeOrgao: toText(item.nomeOrgao ?? (item as Record<string, unknown>).nome_orgao),
                    tipoComunicacao: toText(item.tipoComunicacao ?? (item as Record<string, unknown>).tipo_comunicacao),
                    texto: toText(item.texto),
                    data_disponibilizacao: toIsoDate((item as Record<string, unknown>).dataDisponibilizacao ?? (item as Record<string, unknown>).data_disponibilizacao),
                    meio: toText(item.meio),
                    link: toText(item.link),
                    tipodocumento: toText((item as Record<string, unknown>).tipoDocumento ?? item.tipodocumento),
                    nomeclasse: toText((item as Record<string, unknown>).nomeClasse ?? item.nomeclasse),
                    codigoclasse: toText((item as Record<string, unknown>).codigoClasse ?? item.codigoclasse),
                    numerocomunicacao: toText((item as Record<string, unknown>).numeroComunicacao ?? item.numerocomunicacao),
                    ativo: toBoolean(item.ativo, true),
                    hash: toText(item.hash),
                    status: toText(item.status),
                    motivo_cancelamento: toText((item as Record<string, unknown>).motivoCancelamento ?? (item as Record<string, unknown>).motivo_cancelamento),
                    data_cancelamento: toText((item as Record<string, unknown>).dataCancelamento ?? (item as Record<string, unknown>).data_cancelamento),
                    destinatarios: normalizeList(item.destinatarios),
                    destinatarios_advogados: normalizeList(
                        (item as Record<string, unknown>).destinatariosadvogados ?? (item as Record<string, unknown>).destinatarioadvogados ?? (item as Record<string, unknown>).destinatarios_advogados,
                    ),
                    idempresa: empresaId,
                    idusuario: usuarioId,
                    nao_lida: true,
                }));

                const validRows = mappedRows.filter((row) => row.external_id && row.numero_processo);

                if (validRows.length === 0) {
                    return { success: true, oab: `${oab.numero}/${oab.uf}` };
                }

                for (let idx = 0; idx < validRows.length; idx += 200) {
                    const chunk = validRows.slice(idx, idx + 200);
                    const { error: upsertError } = await supabaseAdmin
                        .from('intimacoes')
                        .upsert(chunk, { onConflict: 'numero_processo,external_id' });

                    if (upsertError) {
                        return {
                            success: false,
                            oab: `${oab.numero}/${oab.uf}`,
                            reason: `Upsert falhou: ${upsertError.message}`,
                        };
                    }
                }

                console.log(`[intimacoes/sync] ${oab.numero}/${oab.uf}: ${fetchedItems.length} buscadas, ${validRows.length} persistidas.`);
                return { success: true, oab: `${oab.numero}/${oab.uf}` };
            } catch (syncErr) {
                const reason = syncErr instanceof Error ? syncErr.message : 'Erro inesperado na sincronização direta.';
                return {
                    success: false,
                    oab: `${oab.numero}/${oab.uf}`,
                    reason,
                };
            }
        }));

        const successCount = results.filter((result) => result.success).length;
        const failureCount = results.length - successCount;

        if (failureCount === 0) {
            res.status(200).json({
                triggered: true,
                message: `Sincronização concluída para ${successCount} OAB(s).`,
            });
            return;
        }

        const failedOabs = results
            .filter((result): result is { success: false; oab: string; reason: string } => !result.success)
            .map((result) => `${result.oab} (${result.reason})`)
            .join('; ');

        res.status(200).json({
            triggered: true,
            message: `Sincronização finalizada com ${successCount} sucesso(s) e ${failureCount} falha(s): ${failedOabs}.`,
        });
    } catch (error) {
        console.error('[intimacoes/sync] Erro inesperado ao sincronizar intimações:', error);
        res.status(500).json({ error: 'Não foi possível sincronizar as intimações.' });
    } finally {
        if (lockAcquired && empresaId != null) {
            releaseIntimacoesSyncLock(empresaId);
        }
    }
});

router.get('/intimacoes', intimacoesController.list);

// ── Intimações: unread-count (DEVE vir ANTES de /intimacoes/:id) ─────────────
router.get('/intimacoes/unread-count', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        if (!accessToken || !req.supabaseUser) {
            res.json({ unread: 0 });
            return;
        }

        const userClient = createUserClient(accessToken);

        const { data: userData } = await userClient
            .from('usuarios')
            .select('empresa')
            .eq('email', req.supabaseUser.email ?? '')
            .single();

        let query = userClient
            .from('intimacoes')
            .select('id', { count: 'exact', head: true })
            .eq('nao_lida', true);

        if (userData?.empresa) {
            query = query.eq('idempresa', userData.empresa);
        }

        const { count } = await query;

        res.json({ unread: count ?? 0 });
    } catch (error) {
        console.error('Erro ao buscar unread-count de intimações:', error);
        res.json({ unread: 0 });
    }
});

// ── Intimações: marcar TODAS como lidas (DEVE vir ANTES de /intimacoes/:id) ──
router.patch('/intimacoes/mark-all-read', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        if (!accessToken || !req.supabaseUser) {
            res.status(401).json({ error: 'Não autenticado.' });
            return;
        }

        const userClient = createUserClient(accessToken);
        const { data: userData } = await userClient
            .from('usuarios')
            .select('empresa')
            .eq('email', req.supabaseUser.email ?? '')
            .single();

        const empresaId = userData?.empresa;

        if (!empresaId) {
            res.json({ success: true, count: 0 });
            return;
        }

        const { data, error } = await userClient
            .from('intimacoes')
            .update({ 
                nao_lida: false, 
                lida_em: new Date().toISOString() 
            })
            .eq('idempresa', empresaId)
            .eq('nao_lida', true)
            .select('id');

        if (error) {
            console.error('Erro ao marcar todas intimações como lidas:', error);
            res.status(400).json({ error: error.message });
            return;
        }

        res.json({ success: true, count: data?.length ?? 0 });
    } catch (error) {
        console.error('Erro interno ao marcar todas intimações como lidas:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar intimações.' });
    }
});

router.patch('/intimacoes/:id/read', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const accessToken = req.accessToken;

        if (!accessToken) {
            res.status(401).json({ error: 'Não autenticado.' });
            return;
        }

        const client = createUserClient(accessToken);
        const { data, error } = await client
            .from('intimacoes')
            .update({
                nao_lida: false,
                lida_em: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error(`Erro ao marcar intimação ${id} como lida:`, error);
            res.status(400).json({ error: error.message });
            return;
        }

        res.json(data);
    } catch (error) {
        console.error(`Erro interno ao marcar intimação ${req.params.id} como lida:`, error);
        res.status(500).json({ error: 'Erro interno ao atualizar intimação.' });
    }
});

router.patch('/intimacoes/:id/archive', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const accessToken = req.accessToken;

        if (!accessToken) {
            res.status(401).json({ error: 'Não autenticado.' });
            return;
        }

        const client = createUserClient(accessToken);
        const { data, error } = await client
            .from('intimacoes')
            .update({
                arquivada: true,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select('id, arquivada, updated_at')
            .single();

        if (error) {
            console.error(`Erro ao arquivar intimação ${id}:`, error);
            res.status(400).json({ error: error.message });
            return;
        }

        res.json(data);
    } catch (error) {
        console.error(`Erro interno ao arquivar intimação ${req.params.id}:`, error);
        res.status(500).json({ error: 'Erro interno ao arquivar intimação.' });
    }
});

router.get('/intimacoes/:id', intimacoesController.getById);

// ─── Suporte ─────────────────────────────────────────────────────────────────
const suporteController = createCrudController('support_requests', {
    filterByEmpresa: false,
    selectFields: '*',
    searchFields: ['subject', 'description'],
    orderBy: 'created_at',
    orderAscending: false,
});

router.get('/support', suporteController.list);
router.get('/support/:id', suporteController.getById);
router.post('/support', suporteController.create);
router.put('/support/:id', suporteController.update);

export { publicRouter as publicEntityRoutes };
export default router;
