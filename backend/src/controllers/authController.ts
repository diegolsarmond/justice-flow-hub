import { Request, Response } from 'express';
import { supabaseAdmin, supabaseAnon, createUserClient } from '../config/supabase';
import { Empresa, Usuario } from '../types/schema';

const normalizeEmailLoose = (value: string | null | undefined): string => {
    if (!value) {
        return '';
    }

    return value
        .toLowerCase()
        .replace(/[​-‍﻿]/g, '')
        .replace(/\s+/g, '')
        .trim();
};

type UsuarioLegacyFields = Usuario & {
    perfil_id?: number | null;
    empresa_id?: number | null;
    ativo?: boolean | null;
    mustChangePassword?: boolean | null;
};

const pickBestUserByEmail = (users: UsuarioLegacyFields[] | null | undefined, email: string): UsuarioLegacyFields | null => {
    if (!users || users.length === 0) {
        return null;
    }

    const target = normalizeEmailLoose(email);

    const exact = users.find((user) => normalizeEmailLoose(user.email) === target);
    if (exact) {
        return exact;
    }

    return null;
};


export const findUsuario = async (userId: string, email?: string | null): Promise<Usuario | null> => {
    console.log(`[AUTH][findUsuario] Buscando usuário. UserId: '${userId}', Email: '${email}'`);
    console.log(`[AUTH][DEBUG] SUPABASE_URL prefix: ${process.env.SUPABASE_URL?.substring(0, 15)}...`);

    const selectUsuarioFields = '*';


    // 1. Tentar buscar pelo ID do Supabase Auth (mais seguro/correto)
    if (userId) {
        const { data: byIdData, error: errorId } = await supabaseAdmin
            .from('usuarios')
            .select(selectUsuarioFields)
            .eq('auth_user_id', userId)
            .limit(50);
        const pageSize = 1000;
        const maxRowsToScan = 50000;
        const authIdCandidates: UsuarioLegacyFields[] = [];

        for (let offset = 0; offset < maxRowsToScan; offset += pageSize) {
            const { data: authIdPage, error: errorId } = await supabaseAdmin
                .from('usuarios')
                .select(selectUsuarioFields)
                .eq('auth_user_id', userId)
                .range(offset, offset + pageSize - 1);

            if (errorId) {
                console.error(`[AUTH][findUsuario] Erro estrutural ao buscar por auth_user_id. UserId: ${userId}, offset: ${offset}`, errorId);
                throw new Error(`Erro ao buscar usuário por ID: ${errorId.message}`);
            }

            if (!authIdPage || authIdPage.length === 0) {
                break;
            }

            authIdCandidates.push(...(authIdPage as UsuarioLegacyFields[]));

            if (authIdPage.length < pageSize) {
                break;
            }
        }

        if (authIdCandidates.length === 1) {
            const onlyMatch = authIdCandidates[0];
            console.log(`[AUTH][findUsuario] Encontrado por auth_user_id. ID: ${onlyMatch.id}, perfil: ${onlyMatch.perfil}, empresa: ${onlyMatch.empresa}`);
            return onlyMatch as Usuario;
        }

        if (byIdData && byIdData.length > 0) {
            const matchesById = byIdData as UsuarioLegacyFields[];
            const normalizedEmail = email?.trim().toLowerCase();

            if (matchesById.length > 1) {
                console.warn(
                    `[AUTH][findUsuario] Encontrados ${matchesById.length} registros com o mesmo auth_user_id. UserId: ${userId}. Selecionando o melhor candidato sem bloquear o login.`,
                );
            }

            const preferredByEmail = normalizedEmail
                ? matchesById.find((row) => String(row.email ?? '').trim().toLowerCase() === normalizedEmail)
                : null;

            const selectedById = preferredByEmail ?? matchesById[0];
            console.log(`[AUTH][findUsuario] Encontrado por auth_user_id. ID: ${selectedById.id}`);
            return selectedById as Usuario;
        }

        if (authIdCandidates.length > 1) {
            const byAuthId = pickBestUserByEmail(authIdCandidates, email ?? '');

            if (byAuthId && email && normalizeEmailLoose(byAuthId.email) === normalizeEmailLoose(email)) {
                console.warn(`[AUTH][findUsuario] Detectadas ${authIdCandidates.length} linhas duplicadas para auth_user_id='${userId}'. Selecionando candidato com e-mail correspondente. ID: ${byAuthId.id}`);
                return byAuthId as Usuario;
            }
        }
    }

    // 2. Se não achou pelo ID, tentar pelo e-mail (legado/migração)
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) return null;
    const normalizedUserId = userId.trim().toLowerCase();

    let foundUser: Usuario | null = null;

    const { data: byEmailCandidates, error: byEmailError } = await supabaseAdmin
        .from('usuarios')
        .select(selectUsuarioFields)
        .ilike('email', `%${normalizedEmail}%`)
        .limit(25);

    if (byEmailError) {
        console.error(`[AUTH][findUsuario] Erro estrutural ao buscar candidatos por email. Email: ${normalizedEmail}`, byEmailError);
        throw new Error(`Erro ao buscar usuário por e-mail: ${byEmailError.message}`);
    }

    const byEmail = pickBestUserByEmail(byEmailCandidates as UsuarioLegacyFields[] | null, normalizedEmail);

    if (byEmail) {
        console.log(`[AUTH][findUsuario] Encontrado por email/candidatos. ID: ${byEmail.id}`);
        foundUser = byEmail;
    } else if ((byEmailCandidates?.length ?? 0) > 0) {
        console.warn(`[AUTH][findUsuario] Candidatos por email retornados, mas nenhum match exato normalizado foi encontrado. Seguindo para fallback seguro. Email: ${normalizedEmail}, candidatos: ${byEmailCandidates?.length ?? 0}`);
    }

    // 2b. Fallback extremo (pós-migração): varrer usuários por match normalizado em memória
    // Isso cobre casos de e-mail com espaços/caracteres invisíveis herdados da migração.
    if (!foundUser) {
        const normalizedTarget = normalizeEmailLoose(normalizedEmail);
        const normalizedUserId = userId.trim().toLowerCase();
        const pageSize = 1000;
        const maxRowsToScan = 50000;

        for (let offset = 0; offset < maxRowsToScan; offset += pageSize) {
            const { data: scanData, error: scanError } = await supabaseAdmin
                .from('usuarios')
                .select(selectUsuarioFields)
                .range(offset, offset + pageSize - 1);

            if (scanError) {
                console.warn(`[AUTH][findUsuario] Falha no fallback por varredura. Email: ${normalizedEmail}, offset: ${offset}`, scanError);
                break;
            }

            if (!scanData || scanData.length === 0) {
                break;
            }

            const byScan = (scanData as UsuarioLegacyFields[]).find((u) => {
                const normalizedDbEmail = normalizeEmailLoose(String(u.email ?? ''));
                const normalizedDbAuthId = String(u.auth_user_id ?? '').trim().toLowerCase();
                return normalizedDbEmail === normalizedTarget || (normalizedUserId.length > 0 && normalizedDbAuthId === normalizedUserId);
            });

            if (byScan) {
                console.log(`[AUTH][findUsuario] Encontrado por fallback de varredura. ID: ${byScan.id}`);
                foundUser = byScan as Usuario;
                break;
            }

            if (scanData.length < pageSize) {
                break;
            }
        }
    }

    if (!foundUser) {
        console.warn(`[AUTH][findUsuario] Usuário não encontrado após todos os fallbacks. Email: ${normalizedEmail}, UserId: ${userId}`);
    }

    // 3. Self-healing: Se achou pelo e-mail mas não tinha o ID vinculado, vincular agora
    if (foundUser && !foundUser.auth_user_id && userId) {
        console.log(`[AUTH] Vinculando usuário ${foundUser.id} ao auth_user_id ${userId}`);
        const { error: updateError } = await supabaseAdmin
            .from('usuarios')
            .update({ auth_user_id: userId })
            .eq('id', foundUser.id);

        if (updateError) {
            console.warn(`[AUTH] Erro no self-healing (vínculo de ID). UsuarioID: ${foundUser.id}`, updateError);
            // Não lançamos erro aqui para não bloquear o login de um usuário encontrado, 
            // mas registramos o problema.
        } else {
            foundUser.auth_user_id = userId;
        }
    }

    return foundUser;
};



const normalizeUsuarioRecord = (record: UsuarioLegacyFields | null | undefined) => {
    if (!record) {
        return null;
    }

    const perfilNormalizado = (record.perfil ?? record.perfil_id ?? null) as number | null;
    const empresaNormalizada = (record.empresa ?? record.empresa_id ?? null) as number | null;
    const statusNormalizado = (record.status ?? record.ativo ?? true) as boolean;
    const mustChangePasswordNormalizado = (record.must_change_password ?? record.mustChangePassword ?? false) as boolean;

    return {
        ...record,
        perfil: perfilNormalizado,
        empresa: empresaNormalizada,
        status: statusNormalizado,
        must_change_password: mustChangePasswordNormalizado,
        perfilNormalizado,
        empresaNormalizada,
        statusNormalizado,
        mustChangePasswordNormalizado,
    };
};

/**
 * POST /api/auth/register
 * Cria novo usuário via Supabase Auth + registros na tabela empresas e usuarios.
 *
 * Payload esperado:
 *   { name: string, email: string, company: string, password: string, phone?: string, planId: number }
 */
export const register = async (req: Request, res: Response): Promise<void> => {
    const { name, email, company, password, phone, planId } = req.body;

    // ── Validações ────────────────────────────────────────────────────────
    if (!name || !email || !password || !company) {
        res.status(400).json({ error: 'Nome, e-mail, senha e empresa são obrigatórios.' });
        return;
    }

    if (typeof password !== 'string' || password.length < 6) {
        res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
        return;
    }

    const parsedPlanId = typeof planId === 'number' && Number.isFinite(planId) ? planId : null;

    try {
        // 1) Criar usuário no Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: false,          // O usuário precisa confirmar e-mail
            user_metadata: { nome: name },
        });

        if (authError) {
            // Traduz mensagens comuns do Supabase
            const msg = authError.message?.toLowerCase() ?? '';
            if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('duplicate')) {
                res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
                return;
            }
            console.error('Erro ao criar usuário no Supabase Auth:', authError);
            res.status(400).json({ error: authError.message || 'Não foi possível criar a conta.' });
            return;
        }

        if (!authData.user) {
            res.status(500).json({ error: 'Erro inesperado ao criar a conta.' });
            return;
        }

        const now = new Date();
        const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 dias

        // 2) Criar empresa
        const { data: empresaData, error: empresaError } = await supabaseAdmin
            .from('empresas')
            .insert({
                nome_empresa: company.trim(),
                plano: parsedPlanId,
                subscription_status: 'active', // 'trialing' not in constraints
                trial_started_at: now.toISOString(),
                trial_ends_at: trialEnd.toISOString(),
                subscription_cadence: 'monthly',
            })
            .select('id')
            .single();

        if (empresaError) {
            console.error('Erro ao criar empresa:', empresaError);
            // Tentar remover usuário do Auth para não ficar órfão
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => { });
            res.status(500).json({ error: 'Erro ao criar a empresa. Tente novamente.' });
            return;
        }

        const empresaId = empresaData?.id;
        console.log('Empresa criada com ID:', empresaId);

        if (!empresaId) {
            console.error('ID da empresa não retornado após criação.');
            // Rollback user
            try { await supabaseAdmin.auth.admin.deleteUser(authData.user.id); } catch { /* rollback best-effort */ }
            res.status(500).json({ error: 'Erro interno: ID da empresa inválido.' });
            return;
        }

        // 3) Criar perfil 'Administrador' para a nova empresa
        const perfilInsert = await supabaseAdmin
            .from('perfis')
            .insert({
                nome: 'Administrador',
                idempresa: empresaId,
                empresa_id: empresaId,
                ver_todas_conversas: true,
                ativo: true
            })
            .select('id')
            .single();

        const { data: perfilData, error: perfilError } = perfilInsert;

        console.log('Resultado criação perfil:', { data: perfilData, error: perfilError });

        if (perfilError || !perfilData) {
            console.error('Erro ao criar perfil de administrador:', perfilError);
            // Rollback
            try { await supabaseAdmin.from('empresas').delete().eq('id', empresaId); } catch { /* rollback best-effort */ }
            try { await supabaseAdmin.auth.admin.deleteUser(authData.user.id); } catch { /* rollback best-effort */ }

            // Retornar a mensagem de erro específica para o frontend
            const errorMessage = perfilError?.message || 'Dados do perfil não retornados.';
            res.status(500).json({ error: `Erro ao criar perfil administrativo: ${errorMessage}` });
            return;
        }

        const perfilId = perfilData?.id;

        if (!perfilId) {
            console.error('ID do perfil é nulo/indefinido após criação.');
            res.status(500).json({ error: 'Erro interno: ID do perfil inválido.' });
            return;
        }

        // 4) Criar registro na tabela usuarios
        const { error: usuarioError } = await supabaseAdmin
            .from('usuarios')
            .insert({
                nome_completo: name.trim(),
                email: email.trim().toLowerCase(),
                telefone: phone ?? null,
                empresa: empresaId,
                status: true,
                perfil: perfilId,
                auth_user_id: authData.user.id,
            });

        if (usuarioError) {
            console.error('Erro ao criar registro de usuário:', usuarioError);
            // Rollback: remover empresa e auth user
            if (empresaId) {
                try { await supabaseAdmin.from('empresas').delete().eq('id', empresaId); } catch { /* rollback best-effort */ }
            }
            try { await supabaseAdmin.auth.admin.deleteUser(authData.user.id); } catch { /* rollback best-effort */ }
            res.status(500).json({ error: 'Erro ao finalizar o cadastro. Tente novamente.' });
            return;
        }

        res.status(201).json({
            message: 'Cadastro realizado com sucesso! Verifique seu e-mail para confirmar a conta.',
        });
    } catch (error) {
        console.error('Erro no registro:', error);
        res.status(500).json({ error: 'Erro interno ao processar o cadastro.' });
    }
};

/**
 * POST /api/auth/login
 * Autentica o usuário via Supabase Auth e retorna token + dados do usuário.
 */
export const login = async (req: Request, res: Response): Promise<void> => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
        return;
    }

    try {
        // IMPORTANTE: usar supabaseAnon para login, NÃO supabaseAdmin.
        // signInWithPassword no client admin polui o estado interno de auth do client,
        // fazendo com que queries subsequentes (ex: findUsuario) rodem sob RLS do
        // usuário autenticado em vez do service_role, retornando 0 linhas.
        const { data, error } = await supabaseAnon.auth.signInWithPassword({
            email,
            password: senha,
        });

        if (error) {
            console.warn('Falha no login:', error.message);
            res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
            return;
        }

        if (!data.session || !data.user) {
            res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
            return;
        }

        // Buscar dados adicionais do usuário na tabela usuarios
        // Usa supabaseAdmin pois RLS nas tabelas migradas impede queries via userClient
        // (auth.uid() retorna UUID mas id da tabela é numérico)
        const usuarioData = await findUsuario(data.user.id, email);

        const usuarioNormalizado = normalizeUsuarioRecord(usuarioData);

        // Buscar módulos do perfil do usuário (tabela perfil_modulos)
        let modulos: string[] = [];
        if (usuarioNormalizado?.perfilNormalizado) {
            const { data: modulosData } = await supabaseAdmin
                .from('perfil_modulos')
                .select('modulo')
                .eq('perfil_id', usuarioNormalizado.perfilNormalizado);

            if (modulosData && modulosData.length > 0) {
                modulos = modulosData.map((m: { modulo: string }) => m.modulo);
            }
        }

        // Buscar dados da empresa (subscription)
        let subscription = null;
        if (usuarioNormalizado?.empresaNormalizada) {
            const { data: empresaData } = await supabaseAdmin
                .from('empresas')
                .select('*')
                .eq('id', usuarioNormalizado.empresaNormalizada)
                .single<Empresa>();

            if (empresaData) {
                subscription = {
                    planId: empresaData.plano,
                    status: empresaData.subscription_status || 'active',
                    startedAt: empresaData.trial_started_at,
                    trialEndsAt: empresaData.trial_ends_at,
                    currentPeriodEnd: empresaData.subscription_current_period_ends_at,
                    graceEndsAt: empresaData.subscription_grace_period_ends_at,
                    // Novos campos
                    cadence: empresaData.subscription_cadence,
                    asaasSubscriptionId: empresaData.asaas_subscription_id,
                    asaasCustomerId: empresaData.asaas_customer_id,
                    pendingPlan: empresaData.subscription_pending_plan,
                };
            }
        }

        if (usuarioData?.id) {
            await supabaseAdmin
                .from('usuarios')
                .update({ ultimo_login: new Date().toISOString() })
                .eq('id', usuarioData.id);
        }

        const perfilId = usuarioNormalizado?.perfilNormalizado ?? null;
        const empresaId = usuarioNormalizado?.empresaNormalizada ?? null;

        const user = {
            id: usuarioNormalizado?.id ?? data.user.id,
            nome_completo: usuarioNormalizado?.nome_completo ?? data.user.user_metadata?.nome ?? '',
            email: data.user.email ?? email,
            perfil: perfilId,
            perfil_id: perfilId,
            empresa: empresaId,
            empresa_id: empresaId,
            ativo: usuarioNormalizado?.statusNormalizado ?? true,
            modulos,
            subscription,
            mustChangePassword: usuarioNormalizado?.mustChangePasswordNormalizado ?? false,
        };

        res.json({
            token: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresIn: data.session.expires_in,
            user,
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno ao processar login.' });
    }
};

/**
 * GET /api/auth/me
 * Retorna os dados do usuário autenticado.
 */
export const me = async (req: Request, res: Response): Promise<void> => {
    const supabaseUser = req.supabaseUser;
    const accessToken = req.accessToken;

    if (!supabaseUser || !accessToken) {
        res.status(401).json({ error: 'Não autenticado.' });
        return;
    }

    try {
        const usuarioData = await findUsuario(supabaseUser.id, supabaseUser.email);

        console.log('[DEBUG] me() - email:', supabaseUser.email);
        console.log('[DEBUG] me() - usuarioData:', usuarioData ? 'Found' : 'Not Found');
        if (!usuarioData) {
            // Retorna perfil mínimo baseado nos dados do Supabase Auth quando o
            // registro na tabela usuarios ainda não existe (e.g. pré-confirmação de e-mail).
            res.json({
                id: 0,
                nome_completo: supabaseUser.user_metadata?.nome ?? supabaseUser.email ?? '',
                email: supabaseUser.email ?? '',
                perfil: null,
                perfil_id: null,
                empresa: null,
                empresa_id: null,
                ativo: true,
                modulos: [],
                subscription: null,
                mustChangePassword: false,
            });
            return;
        }

        const userResponse = await buildUserResponse(usuarioData, supabaseUser);
        res.json(userResponse);
    } catch (error) {
        console.error('Erro ao buscar dados do usuário:', error);
        res.status(500).json({ error: 'Erro interno ao buscar dados do usuário.' });
    }
};

/**
 * POST /api/auth/refresh
 * Renova o token de acesso usando o refresh token.
 */
export const refresh = async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        res.status(401).json({ error: 'Refresh token é obrigatório para renovação.' });
        return;
    }

    try {
        const { data, error } = await supabaseAdmin.auth.refreshSession({
            refresh_token: refreshToken,
        });

        if (error || !data.session) {
            res.status(401).json({ error: 'Token de renovação inválido ou expirado.' });
            return;
        }

        res.json({
            token: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresIn: data.session.expires_in,
        });
    } catch (error) {
        console.error('Erro ao renovar token:', error);
        res.status(500).json({ error: 'Erro interno ao renovar token.' });
    }
};

/**
 * POST /api/auth/logout
 * Invalida a sessão do usuário.
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
    const accessToken = req.accessToken;

    if (!accessToken) {
        res.status(200).json({ message: 'Logout realizado com sucesso.' });
        return;
    }

    try {
        // Usa o admin para invalidar a sessão
        await supabaseAdmin.auth.admin.signOut(accessToken);
    } catch (error) {
        console.warn('Erro ao invalidar sessão no Supabase:', error);
    }

    res.json({ message: 'Logout realizado com sucesso.' });
};

/**
 * POST /api/auth/request-password-reset
 * Envia e-mail de redefinição de senha.
 */
export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;

    if (!email) {
        res.status(400).json({ error: 'E-mail é obrigatório.' });
        return;
    }

    try {
        const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email);

        if (error) {
            console.warn('Erro ao solicitar reset de senha:', error.message);
        }

        // Sempre retorna sucesso para não vazar informações sobre existência de contas
        res.json({
            message: 'Se o e-mail informado estiver cadastrado, enviaremos as instruções para redefinir a senha.',
        });
    } catch (error) {
        console.error('Erro ao solicitar reset de senha:', error);
        res.json({
            message: 'Se o e-mail informado estiver cadastrado, enviaremos as instruções para redefinir a senha.',
        });
    }
};

/**
 * POST /api/auth/change-password
 * Altera a senha do usuário autenticado.
 */
export const changePassword = async (req: Request, res: Response): Promise<void> => {
    const { newPassword, confirmPassword } = req.body;
    const accessToken = req.accessToken;

    if (!accessToken) {
        res.status(401).json({ error: 'Não autenticado.' });
        return;
    }

    if (!newPassword || !confirmPassword) {
        res.status(400).json({ error: 'Nova senha e confirmação são obrigatórias.' });
        return;
    }

    if (newPassword !== confirmPassword) {
        res.status(400).json({ error: 'As senhas não conferem.' });
        return;
    }

    try {
        const userClient = createUserClient(accessToken);
        const { error } = await userClient.auth.updateUser({
            password: newPassword,
        });

        if (error) {
            res.status(400).json({ error: error.message || 'Não foi possível alterar a senha.' });
            return;
        }

        // Atualizar flag must_change_password na tabela usuarios
        if (req.supabaseUser?.email) {
            await supabaseAdmin
                .from('usuarios')
                .update({ must_change_password: false })
                .eq('email', req.supabaseUser.email);
        }

        res.json({ message: 'Senha atualizada com sucesso.' });
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({ error: 'Erro interno ao alterar senha.' });
    }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buildUserResponse(
    usuarioData: Usuario,
    supabaseUser: { id: string; email?: string },
) {
    const usuarioNormalizado = normalizeUsuarioRecord(usuarioData);

    // Buscar módulos do perfil (tabela perfil_modulos)
    let modulos: string[] = [];
    if (usuarioNormalizado?.perfilNormalizado) {
        const { data: modulosData } = await supabaseAdmin
            .from('perfil_modulos')
            .select('modulo')
            .eq('perfil_id', usuarioNormalizado.perfilNormalizado);

        if (modulosData && modulosData.length > 0) {
            modulos = modulosData.map((m: { modulo: string }) => m.modulo);
        }
    }

    // Buscar dados da empresa (subscription)
    let subscription = null;
    if (usuarioNormalizado?.empresaNormalizada) {
        const { data: empresaData } = await supabaseAdmin
            .from('empresas')
            .select('*')
            .eq('id', usuarioNormalizado.empresaNormalizada)
            .single<Empresa>();

        if (empresaData) {
            subscription = {
                planId: empresaData.plano,
                status: empresaData.subscription_status || 'active',
                startedAt: empresaData.trial_started_at,
                trialEndsAt: empresaData.trial_ends_at,
                currentPeriodEnd: empresaData.subscription_current_period_ends_at,
                graceEndsAt: empresaData.subscription_grace_period_ends_at,
                // New fields
                cadence: empresaData.subscription_cadence,
                asaasSubscriptionId: empresaData.asaas_subscription_id,
                asaasCustomerId: empresaData.asaas_customer_id,
                pendingPlan: empresaData.subscription_pending_plan,
            };
        }
    }

    const perfilId = usuarioNormalizado?.perfilNormalizado ?? null;
    const empresaId = usuarioNormalizado?.empresaNormalizada ?? null;

    return {
        id: usuarioNormalizado?.id ?? usuarioData.id,
        nome_completo: usuarioNormalizado?.nome_completo ?? '',
        email: supabaseUser.email ?? usuarioNormalizado?.email ?? '',
        perfil: perfilId,
        perfil_id: perfilId,
        empresa: empresaId,
        empresa_id: empresaId,
        ativo: usuarioNormalizado?.statusNormalizado ?? true,
        modulos,
        subscription,
        mustChangePassword: usuarioNormalizado?.mustChangePasswordNormalizado ?? false,
    };
}
