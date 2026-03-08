import { Request, Response, Router, type Router as ExpressRouter } from 'express';
import { PostgrestError } from '@supabase/supabase-js';
import { createCrudController } from '../controllers/crudController';
import { findUsuario } from '../controllers/authController';

const router: ExpressRouter = Router();
const controller = createCrudController('empresas', {
    filterByEmpresa: false, // isolamento para empresas é tratado por wrappers dedicados abaixo
    selectFields: '*',
    searchFields: ['nome_empresa', 'cnpj'],
    orderBy: 'nome_empresa',
    orderAscending: true,
});

type AccessContext = {
    requestedEmpresaId: number | null;
    authenticatedEmpresaId: number | null;
    accessTokenPresent: boolean;
    userId?: string;
    userEmail?: string;
};

const toEmpresaId = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isInteger(parsed) && parsed > 0) return parsed;
    }
    return null;
};

const getAuthenticatedEmpresaId = async (req: Request): Promise<number | null> => {
    const userId = req.supabaseUser?.id;
    const userEmail = req.supabaseUser?.email;

    if (userId || userEmail) {
        try {
            const usuario = await findUsuario(userId || '', userEmail);
            const empresaFromUsuario = toEmpresaId(usuario?.empresa ?? (usuario as { empresa_id?: number | null })?.empresa_id);
            if (empresaFromUsuario !== null) return empresaFromUsuario;
        } catch (error) {
            console.error('[EMPRESAS][tenant_check] erro ao resolver empresa via tabela usuarios', {
                userId,
                userEmail,
                error,
            });
        }
    }

    return toEmpresaId(
        req.supabaseUser?.user_metadata?.empresa_id
        ?? req.supabaseUser?.user_metadata?.empresa
    );
};

const logCrossTenantAttempt = (action: string, context: AccessContext, reason: string): void => {
    console.warn('[EMPRESAS][cross_tenant_attempt]', {
        action,
        reason,
        requestedEmpresaId: context.requestedEmpresaId,
        authenticatedEmpresaId: context.authenticatedEmpresaId,
        accessTokenPresent: context.accessTokenPresent,
        userId: context.userId,
        userEmail: context.userEmail,
        timestamp: new Date().toISOString(),
    });
};

const isNotFoundError = (error: PostgrestError | null): boolean =>
    Boolean(error?.code === 'PGRST116' || error?.code === 'PGRST301');

const getByIdCustom = async (req: Request, res: Response) => {
    try {
        const requestedEmpresaId = toEmpresaId(req.params.id);
        const authenticatedEmpresaId = await getAuthenticatedEmpresaId(req);

        if (requestedEmpresaId === null) {
            return res.status(400).json({ error: 'ID de empresa inválido.' });
        }

        const context: AccessContext = {
            requestedEmpresaId,
            authenticatedEmpresaId,
            accessTokenPresent: Boolean(req.accessToken),
            userId: req.supabaseUser?.id,
            userEmail: req.supabaseUser?.email,
        };

        // Antes de qualquer fallback admin, valida isolamento de tenant.
        if (authenticatedEmpresaId !== null && requestedEmpresaId !== authenticatedEmpresaId) {
            logCrossTenantAttempt('getById', context, 'requested_empresa_mismatch');
            return res.status(403).json({ error: 'Acesso negado para esta empresa.' });
        }

        if (authenticatedEmpresaId === null) {
            logCrossTenantAttempt('getById', context, 'missing_authenticated_empresa');
            return res.status(403).json({ error: 'Não foi possível determinar sua empresa.' });
        }

        const { createUserClient, supabaseAdmin } = await import('../config/supabase');
        const client = req.accessToken ? createUserClient(req.accessToken) : supabaseAdmin;

        const { data, error } = await client
            .from('empresas')
            .select('*')
            .eq('id', requestedEmpresaId)
            .single();

        if (!error && data) {
            return res.json(data);
        }

        // Service role apenas como fallback auditável para casos de RLS inconsistente.
        if (req.accessToken && isNotFoundError(error)) {
            const { data: adminData, error: adminError } = await supabaseAdmin
                .from('empresas')
                .select('*')
                .eq('id', requestedEmpresaId)
                .single();

            if (!adminError && adminData) {
                console.info('[EMPRESAS][admin_fallback]', {
                    action: 'getById',
                    requestedEmpresaId,
                    authenticatedEmpresaId,
                    reason: 'user_client_not_found_with_matching_tenant',
                    userId: req.supabaseUser?.id,
                    userEmail: req.supabaseUser?.email,
                    timestamp: new Date().toISOString(),
                });
                return res.json(adminData);
            }
        }

        if (isNotFoundError(error)) {
            return res.status(404).json({ error: 'Empresa não encontrada.' });
        }

        console.error('Erro no getById customizado de empresas:', error);
        return res.status(500).json({ error: 'Erro ao buscar empresa.' });
    } catch (err) {
        console.error('Erro no getById customizado de empresas:', err);
        return controller.getById(req, res);
    }
};

const listOwnEmpresa = async (req: Request, res: Response) => {
    const authenticatedEmpresaId = await getAuthenticatedEmpresaId(req);
    if (authenticatedEmpresaId === null) {
        logCrossTenantAttempt('list', {
            requestedEmpresaId: null,
            authenticatedEmpresaId,
            accessTokenPresent: Boolean(req.accessToken),
            userId: req.supabaseUser?.id,
            userEmail: req.supabaseUser?.email,
        }, 'missing_authenticated_empresa');
        return res.status(403).json({ error: 'Não foi possível determinar sua empresa.' });
    }

    req.query.id = String(authenticatedEmpresaId);
    return controller.list(req, res);
};

const createOwnEmpresaBlocked = async (req: Request, res: Response) => {
    const authenticatedEmpresaId = await getAuthenticatedEmpresaId(req);
    logCrossTenantAttempt('create', {
        requestedEmpresaId: toEmpresaId(req.body?.id),
        authenticatedEmpresaId,
        accessTokenPresent: Boolean(req.accessToken),
        userId: req.supabaseUser?.id,
        userEmail: req.supabaseUser?.email,
    }, 'tenant_creation_blocked_for_authenticated_route');

    return res.status(403).json({
        error: 'A criação de novas empresas não é permitida nesta rota autenticada.',
    });
};

const updateOwnEmpresa = async (req: Request, res: Response) => {
    const authenticatedEmpresaId = await getAuthenticatedEmpresaId(req);
    const requestedEmpresaId = toEmpresaId(req.params.id);

    if (requestedEmpresaId === null || authenticatedEmpresaId === null) {
        return res.status(403).json({ error: 'Acesso negado para esta empresa.' });
    }

    if (requestedEmpresaId !== authenticatedEmpresaId) {
        logCrossTenantAttempt('update', {
            requestedEmpresaId,
            authenticatedEmpresaId,
            accessTokenPresent: Boolean(req.accessToken),
            userId: req.supabaseUser?.id,
            userEmail: req.supabaseUser?.email,
        }, 'requested_empresa_mismatch');
        return res.status(403).json({ error: 'Acesso negado para esta empresa.' });
    }

    return controller.update(req, res);
};

const deleteOwnEmpresa = async (req: Request, res: Response) => {
    const authenticatedEmpresaId = await getAuthenticatedEmpresaId(req);
    const requestedEmpresaId = toEmpresaId(req.params.id);

    if (requestedEmpresaId === null || authenticatedEmpresaId === null) {
        return res.status(403).json({ error: 'Acesso negado para esta empresa.' });
    }

    if (requestedEmpresaId !== authenticatedEmpresaId) {
        logCrossTenantAttempt('delete', {
            requestedEmpresaId,
            authenticatedEmpresaId,
            accessTokenPresent: Boolean(req.accessToken),
            userId: req.supabaseUser?.id,
            userEmail: req.supabaseUser?.email,
        }, 'requested_empresa_mismatch');
        return res.status(403).json({ error: 'Acesso negado para esta empresa.' });
    }

    return controller.remove(req, res);
};

router.get('/empresas', listOwnEmpresa);
router.get('/empresas/:id', getByIdCustom);
router.post('/empresas', createOwnEmpresaBlocked);
router.put('/empresas/:id', updateOwnEmpresa);
router.delete('/empresas/:id', deleteOwnEmpresa);

export default router;
