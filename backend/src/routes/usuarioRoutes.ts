import { Router, type Router as ExpressRouter } from 'express';
import { createCrudController } from '../controllers/crudController';
import { findUsuario } from '../controllers/authController';
import { createUserClient, supabaseAdmin } from '../config/supabase';
import { Request, Response } from 'express';

const router: ExpressRouter = Router();
const migratedUsuarioColumnsEnabled = process.env.USUARIOS_MIGRATED_COLUMNS === 'true';

type UsuarioPayload = Record<string, unknown>;

const asNullableNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const asNullableBoolean = (value: unknown): boolean | null => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    if (value === 'true' || value === '1' || value === 1) {
        return true;
    }

    if (value === 'false' || value === '0' || value === 0) {
        return false;
    }

    return null;
};

const normalizeUsuarioPayload = (payload: UsuarioPayload): UsuarioPayload => {
    const body = { ...payload };

    const empresaNormalizada = asNullableNumber(body.empresa ?? body.empresa_id);
    if (empresaNormalizada !== null) {
        body.empresa = empresaNormalizada;
        if (migratedUsuarioColumnsEnabled) {
            body.empresa_id = empresaNormalizada;
        }
    }

    const perfilNormalizado = asNullableNumber(body.perfil ?? body.perfil_id);
    if (perfilNormalizado !== null) {
        body.perfil = perfilNormalizado;
        if (migratedUsuarioColumnsEnabled) {
            body.perfil_id = perfilNormalizado;
        }
    }

    const statusNormalizado = asNullableBoolean(body.status ?? body.ativo);
    if (statusNormalizado !== null) {
        body.status = statusNormalizado;
        if (migratedUsuarioColumnsEnabled) {
            body.ativo = statusNormalizado;
        }
    }

    return body;
};

const normalizeUsuarioResponse = <T extends UsuarioPayload | null>(record: T): T => {
    if (!record) {
        return record;
    }

    const normalizado = normalizeUsuarioPayload(record);
    const empresaNormalizada = asNullableNumber(normalizado.empresa ?? normalizado.empresa_id);
    const perfilNormalizado = asNullableNumber(normalizado.perfil ?? normalizado.perfil_id);
    const statusNormalizado = asNullableBoolean(normalizado.status ?? normalizado.ativo);

    if (empresaNormalizada !== null) {
        normalizado.empresa = empresaNormalizada;
        normalizado.empresa_id = empresaNormalizada;
    }

    if (perfilNormalizado !== null) {
        normalizado.perfil = perfilNormalizado;
        normalizado.perfil_id = perfilNormalizado;
    }

    if (statusNormalizado !== null) {
        normalizado.status = statusNormalizado;
        normalizado.ativo = statusNormalizado;
    }

    return normalizado as T;
};

const baseSelectFields = 'id, nome_completo, cpf, email, perfil, empresa, setor, status, telefone, ultimo_login, datacriacao, must_change_password';
const migratedSelectFields = `${baseSelectFields}, perfil_id, empresa_id, ativo, auth_user_id`;

const controller = createCrudController('usuarios', {
    filterByEmpresa: true,
    empresaColumn: 'empresa',
    empresaFilterColumns: migratedUsuarioColumnsEnabled ? ['empresa_id'] : [],
    selectFields: migratedUsuarioColumnsEnabled ? migratedSelectFields : baseSelectFields,
    searchFields: ['nome_completo', 'email'],
    orderBy: 'nome_completo',
    orderAscending: true,
    normalizeInput: normalizeUsuarioPayload,
    normalizeOutput: normalizeUsuarioResponse,
});

type UsuarioListRecord = UsuarioPayload & {
    auth_user_id?: string | null;
    oab?: string | null;
    oab_number?: string | null;
    oab_uf?: string | null;
};

type UserProfileOabRecord = {
    user_id: string;
    oab_number: string | null;
    oab_uf: string | null;
};

type UsuariosEmpresaQueryStrategy = {
    label: string;
    selectFields: string;
    filterExpression: string;
};

const shouldRetryUsuariosEmpresaQuery = (error: { code?: string; message?: string } | null): boolean => {
    if (!error) {
        return false;
    }

    const message = String(error.message ?? '').toLowerCase();
    return error.code === '42703' || error.code === 'PGRST204' || message.includes('column') || message.includes('does not exist');
};

const listEmpresaWithProfileOab = async (req: Request, res: Response): Promise<void> => {
    try {
        const loggedUser = await findUsuario(req.supabaseUser?.id ?? '', req.supabaseUser?.email ?? null);
        const empresaId = loggedUser?.empresa ?? (loggedUser as { empresa_id?: number | null } | null)?.empresa_id ?? null;

        if (empresaId === null || empresaId === undefined) {
            res.status(403).json({ error: 'Usuário sem empresa vinculada.' });
            return;
        }

        const accessToken = req.accessToken;
        const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;

        const page = Math.max(1, Number.parseInt(req.query.page as string, 10) || 1);
        const requestedLimit =
            Number.parseInt(req.query.limit as string, 10)
            || Number.parseInt(req.query.pageSize as string, 10)
            || 20;
        const limit = Math.min(100, Math.max(1, requestedLimit));
        const offset = (page - 1) * limit;
        const search = (req.query.search as string || '').trim();
        const sortField = (req.query.order as string) || 'nome_completo';
        const sortAsc = req.query.orderDirection === 'desc' ? false : true;

        const queryStrategies: UsuariosEmpresaQueryStrategy[] = migratedUsuarioColumnsEnabled
            ? [
                {
                    label: 'migrated_columns',
                    selectFields: 'id, nome_completo, cpf, email, perfil, perfil_id, empresa, empresa_id, setor, status, ativo, telefone, ultimo_login, datacriacao, auth_user_id, must_change_password',
                    filterExpression: `empresa_id.eq.${empresaId}`,
                },
                {
                    label: 'legacy_columns_fallback',
                    selectFields: 'id, nome_completo, cpf, email, perfil, empresa, setor, status, telefone, ultimo_login, datacriacao, auth_user_id, must_change_password',
                    filterExpression: `empresa.eq.${empresaId}`,
                },
            ]
            : [
                {
                    label: 'legacy_columns',
                    selectFields: 'id, nome_completo, cpf, email, perfil, empresa, setor, status, telefone, ultimo_login, datacriacao, auth_user_id, must_change_password',
                    filterExpression: `empresa.eq.${empresaId}`,
                },
                {
                    label: 'migrated_columns_fallback',
                    selectFields: 'id, nome_completo, cpf, email, perfil, perfil_id, empresa, empresa_id, setor, status, ativo, telefone, ultimo_login, datacriacao, auth_user_id, must_change_password',
                    filterExpression: `empresa_id.eq.${empresaId}`,
                },
            ];

        let usuariosData: UsuarioListRecord[] | null = null;
        let usuariosError: { code?: string; message?: string } | null = null;
        let count: number | null = null;

        for (const strategy of queryStrategies) {
            let usuariosQuery = client
                .from('usuarios')
                .select(strategy.selectFields, { count: 'exact' })
                .or(strategy.filterExpression);

            if (search) {
                usuariosQuery = usuariosQuery.or(`nome_completo.ilike.%${search}%,email.ilike.%${search}%`);
            }

            for (const [key, value] of Object.entries(req.query)) {
                if (['page', 'limit', 'pageSize', 'search', 'order', 'orderDirection'].includes(key)) continue;
                if (typeof value === 'string' && value.trim()) {
                    usuariosQuery = usuariosQuery.eq(key, value);
                }
            }

            const queryResult = await usuariosQuery
                .order(sortField, { ascending: sortAsc })
                .range(offset, offset + limit - 1);

            usuariosData = (queryResult.data ?? null) as UsuarioListRecord[] | null;
            usuariosError = queryResult.error ? { code: queryResult.error.code, message: queryResult.error.message } : null;
            count = queryResult.count ?? null;

            if (!usuariosError) {
                break;
            }

            if (!shouldRetryUsuariosEmpresaQuery(usuariosError)) {
                break;
            }

            console.warn(`[usuarios/empresa] Estratégia '${strategy.label}' falhou, tentando fallback de esquema.`, usuariosError);
        }

        if (usuariosError) {
            console.error('Erro ao listar usuários da empresa:', usuariosError);
            res.status(500).json({ error: 'Erro ao listar usuários da empresa.' });
            return;
        }

        const usuarios = (usuariosData ?? []) as UsuarioListRecord[];
        const authUserIds = Array.from(
            new Set(
                usuarios
                    .map((usuario) => (typeof usuario.auth_user_id === 'string' ? usuario.auth_user_id.trim() : ''))
                    .filter((value) => value.length > 0),
            ),
        );

        let profileMap = new Map<string, UserProfileOabRecord>();

        if (authUserIds.length > 0) {
            const { data: profileData, error: profileError } = await client
                .from('user_profiles')
                .select('user_id, oab_number, oab_uf')
                .in('user_id', authUserIds);

            if (profileError) {
                console.error('Erro ao carregar OAB em user_profiles:', profileError);
            } else {
                profileMap = new Map(
                    ((profileData ?? []) as UserProfileOabRecord[])
                        .filter((profile) => typeof profile.user_id === 'string' && profile.user_id.trim().length > 0)
                        .map((profile) => [profile.user_id, profile]),
                );
            }
        }

        const normalized = usuarios.map((usuario) => {
            const authUserId = typeof usuario.auth_user_id === 'string' ? usuario.auth_user_id.trim() : '';
            const profile = authUserId ? profileMap.get(authUserId) : undefined;

            const oabNumber = profile?.oab_number?.trim() || usuario.oab_number || null;
            const oabUf = profile?.oab_uf?.trim() || usuario.oab_uf || null;
            const combined = oabNumber ? `${oabNumber}${oabUf ? `/${oabUf}` : ''}` : (usuario.oab ?? null);

            return normalizeUsuarioResponse({
                ...usuario,
                oab: combined,
                oab_number: oabNumber,
                oab_uf: oabUf,
            });
        });

        res.json({
            data: normalized,
            total: count ?? normalized.length,
            page,
            limit,
            totalPages: count ? Math.ceil(count / limit) : 0,
        });
    } catch (error) {
        console.error('Erro interno ao listar usuários da empresa com OAB de perfil:', error);
        res.status(500).json({ error: 'Erro interno ao listar usuários da empresa.' });
    }
};

router.get('/usuarios', controller.list);
router.get('/usuarios/empresa', listEmpresaWithProfileOab); // alias compatível com frontend
router.get('/get_api_usuarios_empresa', listEmpresaWithProfileOab); // alias para endpoint legado
router.get('/usuarios/:id', controller.getById);
router.post('/usuarios', controller.create);
router.put('/usuarios/:id', controller.update);
router.delete('/usuarios/:id', controller.remove);

export default router;
