import { Router, type Router as ExpressRouter, Request, Response } from 'express';
import { createUserClient } from '../config/supabase';
import { findUsuario } from '../controllers/authController';

const router: ExpressRouter = Router();

type UserProfileRow = {
    user_id: string;
    title: string | null;
    bio: string | null;
    office: string | null;
    oab_number: string | null;
    oab_uf: string | null;
    specialties: string[];
    hourly_rate: number | string | null;
    timezone: string | null;
    language: string | null;
    linkedin_url: string | null;
    website_url: string | null;
    address_street: string | null;
    address_city: string | null;
    address_state: string | null;
    address_zip: string | null;
    notifications_security_alerts: boolean;
    notifications_agenda_reminders: boolean;
    notifications_newsletter: boolean;
    security_two_factor: boolean;
    security_login_alerts: boolean;
    security_device_approval: boolean;
    avatar_url: string | null;
    member_since: string | null;
    updated_at: string;
};

const normalizeNullableString = (value: unknown): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return String(value);

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const normalizeBoolean = (value: unknown): boolean | undefined =>
    typeof value === 'boolean' ? value : undefined;

const normalizeNullableNumber = (value: unknown): number | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;

    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
};

const normalizeSpecialties = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;

    return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0);
};

const mapProfileResponse = (
    supabaseUser: NonNullable<Request['supabaseUser']>,
    userData: Awaited<ReturnType<typeof findUsuario>>,
    profile: UserProfileRow | null,
) => ({
    id: userData?.id ?? supabaseUser.id,
    name: userData?.nome_completo ?? supabaseUser.user_metadata?.nome ?? supabaseUser.email ?? 'Usuário',
    email: userData?.email ?? supabaseUser.email ?? '',
    cpf: userData?.cpf ?? null,
    title: profile?.title ?? null,
    phone: userData?.telefone ?? null,
    bio: profile?.bio ?? null,
    office: profile?.office ?? null,
    oabNumber: profile?.oab_number ?? userData?.oab ?? null,
    oabUf: profile?.oab_uf ?? null,
    specialties: profile?.specialties ?? [],
    hourlyRate: profile?.hourly_rate ?? null,
    timezone: profile?.timezone ?? null,
    language: profile?.language ?? 'pt-BR',
    linkedin: profile?.linkedin_url ?? null,
    website: profile?.website_url ?? null,
    address: {
        street: profile?.address_street ?? null,
        number: null,
        complement: null,
        neighborhood: null,
        city: profile?.address_city ?? null,
        state: profile?.address_state ?? null,
        zip: profile?.address_zip ?? null,
    },
    notifications: {
        securityAlerts: profile?.notifications_security_alerts ?? true,
        agendaReminders: profile?.notifications_agenda_reminders ?? true,
        newsletter: profile?.notifications_newsletter ?? false,
    },
    security: {
        twoFactor: profile?.security_two_factor ?? false,
        loginAlerts: profile?.security_login_alerts ?? false,
        deviceApproval: profile?.security_device_approval ?? false,
    },
    lastLogin: userData?.ultimo_login ?? null,
    memberSince: profile?.member_since ?? userData?.datacriacao ?? null,
    avatarUrl: profile?.avatar_url ?? null,
});

// ─── Conversations (stub) ────────────────────────────────────────────────────
// O frontend chama GET /api/conversations?limit=100 para contar mensagens.
// Até implementar chat no Supabase, retorna lista vazia.
router.get('/conversations', (_req: Request, res: Response) => {
    res.json({
        chats: [],
        total: 0,
        hasMore: false,
        limit: 100,
        offset: 0,
    });
});

// ─── UAZAPI QR Code (stub) ───────────────────────────────────────────────────
router.get('/conversations/providers/uaz/qr', (_req: Request, res: Response) => {
    res.json({
        qr: null,
        status: 'disconnected', // ou 'connected', 'qr_ready'
        message: 'Serviço de WhatsApp não conectado (Stub)'
    });
});

// NOTA: /agendas/pending-count movido para entityRoutes.ts (antes de /agendas/:id)

// ─── Me/Profile ──────────────────────────────────────────────────────────────
// O frontend chama GET /api/me/profile para o componente HeaderActions.
router.get('/me/profile', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        const supabaseUser = req.supabaseUser;

        if (!accessToken || !supabaseUser) {
            res.status(401).json({ error: 'Não autenticado.' });
            return;
        }

        const userData = await findUsuario(supabaseUser.id, supabaseUser.email);

        const userClient = createUserClient(accessToken);
        const { data: profileData, error: profileError } = await userClient
            .from('user_profiles')
            .select('*')
            .eq('user_id', supabaseUser.id)
            .maybeSingle<UserProfileRow>();

        if (profileError) {
            console.error('Erro ao consultar user_profiles:', profileError);
            res.status(400).json({ error: profileError.message });
            return;
        }

        res.json(mapProfileResponse(supabaseUser, userData, profileData ?? null));
    } catch (error) {
        console.error('Erro ao buscar perfil do usuário:', error);
        res.status(500).json({ error: 'Erro interno ao buscar perfil.' });
    }
});

// PATCH /api/me/profile — atualiza dados do perfil
router.patch('/me/profile', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        const supabaseUser = req.supabaseUser;

        if (!accessToken || !supabaseUser) {
            res.status(401).json({ error: 'Não autenticado.' });
            return;
        }

        const userClient = createUserClient(accessToken);

        let userData: { id: number } | null = null;

        const { data: userByAuthId, error: byAuthIdError } = await userClient
            .from('usuarios')
            .select('id')
            .eq('auth_user_id', supabaseUser.id)
            .maybeSingle();

        if (byAuthIdError) {
            res.status(400).json({ error: byAuthIdError.message });
            return;
        }

        if (userByAuthId?.id) {
            userData = { id: userByAuthId.id };
        }

        if (!userData && supabaseUser.email) {
            const normalizedEmail = supabaseUser.email.trim().toLowerCase();
            const { data: usersByEmail, error: byEmailError } = await userClient
                .from('usuarios')
                .select('id,email')
                .ilike('email', normalizedEmail);

            if (byEmailError) {
                res.status(400).json({ error: byEmailError.message });
                return;
            }

            const deterministicEmailMatches = (usersByEmail ?? []).filter((usuario) =>
                typeof usuario.email === 'string' && usuario.email.trim().toLowerCase() === normalizedEmail
            );

            if (deterministicEmailMatches.length > 1) {
                res.status(409).json({ error: 'Mais de um usuário encontrado para este e-mail.' });
                return;
            }

            if (deterministicEmailMatches.length === 1) {
                userData = { id: deterministicEmailMatches[0].id };
            }
        }

        const usuarioUpdates: Record<string, unknown> = {};
        const profileUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };

        // Map frontend field names to database column names
        const normalizedName = normalizeNullableString(req.body.name);
        if (normalizedName !== undefined) usuarioUpdates.nome_completo = normalizedName;

        const normalizedPhone = normalizeNullableString(req.body.phone);
        if (normalizedPhone !== undefined) usuarioUpdates.telefone = normalizedPhone;

        const normalizedCpf = normalizeNullableString(req.body.cpf);
        if (normalizedCpf !== undefined) usuarioUpdates.cpf = normalizedCpf;

        const normalizedOab = normalizeNullableString(req.body.oabNumber);
        if (normalizedOab !== undefined) {
            profileUpdates.oab_number = normalizedOab;
            usuarioUpdates.oab = normalizedOab;
        }

        const normalizedTitle = normalizeNullableString(req.body.title);
        if (normalizedTitle !== undefined) profileUpdates.title = normalizedTitle;

        const normalizedBio = normalizeNullableString(req.body.bio);
        if (normalizedBio !== undefined) profileUpdates.bio = normalizedBio;

        const normalizedOffice = normalizeNullableString(req.body.office);
        if (normalizedOffice !== undefined) profileUpdates.office = normalizedOffice;

        const normalizedOabUf = normalizeNullableString(req.body.oabUf);
        if (normalizedOabUf !== undefined) profileUpdates.oab_uf = normalizedOabUf;

        const specialties = normalizeSpecialties(req.body.specialties);
        if (specialties !== undefined) profileUpdates.specialties = specialties;

        const hourlyRate = normalizeNullableNumber(req.body.hourlyRate);
        if (hourlyRate !== undefined) profileUpdates.hourly_rate = hourlyRate;

        const timezone = normalizeNullableString(req.body.timezone);
        if (timezone !== undefined) profileUpdates.timezone = timezone;

        const language = normalizeNullableString(req.body.language);
        if (language !== undefined) profileUpdates.language = language;

        const linkedin = normalizeNullableString(req.body.linkedin);
        if (linkedin !== undefined) profileUpdates.linkedin_url = linkedin;

        const website = normalizeNullableString(req.body.website);
        if (website !== undefined) profileUpdates.website_url = website;

        const avatarUrl = normalizeNullableString(req.body.avatarUrl);
        if (avatarUrl !== undefined) profileUpdates.avatar_url = avatarUrl;

        const memberSince = normalizeNullableString(req.body.memberSince);
        if (memberSince !== undefined) profileUpdates.member_since = memberSince;

        const address = typeof req.body.address === 'object' && req.body.address ? req.body.address as Record<string, unknown> : null;
        if (address) {
            const street = normalizeNullableString(address.street);
            if (street !== undefined) profileUpdates.address_street = street;

            const city = normalizeNullableString(address.city);
            if (city !== undefined) profileUpdates.address_city = city;

            const state = normalizeNullableString(address.state);
            if (state !== undefined) profileUpdates.address_state = state;

            const zip = normalizeNullableString(address.zip);
            if (zip !== undefined) profileUpdates.address_zip = zip;
        }

        const notifications = typeof req.body.notifications === 'object' && req.body.notifications
            ? req.body.notifications as Record<string, unknown>
            : null;
        if (notifications) {
            const securityAlerts = normalizeBoolean(notifications.securityAlerts);
            if (securityAlerts !== undefined) profileUpdates.notifications_security_alerts = securityAlerts;

            const agendaReminders = normalizeBoolean(notifications.agendaReminders);
            if (agendaReminders !== undefined) profileUpdates.notifications_agenda_reminders = agendaReminders;

            const newsletter = normalizeBoolean(notifications.newsletter);
            if (newsletter !== undefined) profileUpdates.notifications_newsletter = newsletter;
        }

        const security = typeof req.body.security === 'object' && req.body.security
            ? req.body.security as Record<string, unknown>
            : null;
        if (security) {
            const twoFactor = normalizeBoolean(security.twoFactor);
            if (twoFactor !== undefined) profileUpdates.security_two_factor = twoFactor;

            const loginAlerts = normalizeBoolean(security.loginAlerts);
            if (loginAlerts !== undefined) profileUpdates.security_login_alerts = loginAlerts;

            const deviceApproval = normalizeBoolean(security.deviceApproval);
            if (deviceApproval !== undefined) profileUpdates.security_device_approval = deviceApproval;
        }

        if (Object.keys(usuarioUpdates).length > 0) {
            if (!userData?.id) {
                res.status(404).json({ error: 'Usuário não encontrado para atualizar dados básicos.' });
                return;
            }

            const { error: usuarioUpdateError } = await userClient
                .from('usuarios')
                .update(usuarioUpdates)
                .eq('id', userData.id);

            if (usuarioUpdateError) {
                res.status(400).json({ error: usuarioUpdateError.message });
                return;
            }
        }

        if (Object.keys(profileUpdates).length > 1) {
            const { error: upsertProfileError } = await userClient
                .from('user_profiles')
                .upsert({
                    user_id: supabaseUser.id,
                    ...profileUpdates,
                }, { onConflict: 'user_id' });

            if (upsertProfileError) {
                res.status(400).json({ error: upsertProfileError.message });
                return;
            }
        }

        const refreshedUserData = await findUsuario(supabaseUser.id, supabaseUser.email);
        const { data: refreshedProfile, error: refreshedProfileError } = await userClient
            .from('user_profiles')
            .select('*')
            .eq('user_id', supabaseUser.id)
            .maybeSingle<UserProfileRow>();

        if (refreshedProfileError) {
            res.status(400).json({ error: refreshedProfileError.message });
            return;
        }

        res.json(mapProfileResponse(supabaseUser, refreshedUserData, refreshedProfile ?? null));
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar perfil.' });
    }
});

// GET /api/me/profile/audit-logs — fallback durante migração para Supabase
router.get('/me/profile/audit-logs', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        const supabaseUser = req.supabaseUser;

        if (!accessToken || !supabaseUser) {
            res.status(401).json({ error: 'Não autenticado.' });
            return;
        }

        const limitParam = Number.parseInt(String(req.query.limit ?? '20'), 10);
        const offsetParam = Number.parseInt(String(req.query.offset ?? '0'), 10);
        const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20;
        const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

        const userClient = createUserClient(accessToken);
        const { data, error } = await userClient
            .from('user_profile_audit_logs')
            .select('id, user_id, action, description, performed_by, created_at')
            .eq('user_id', supabaseUser.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.warn('Tabela user_profile_audit_logs indisponível, retornando fallback vazio:', error.message);
            res.json([]);
            return;
        }

        const rows = (data ?? []).map((item) => ({
            id: item.id,
            userId: item.user_id,
            action: item.action,
            description: item.description,
            performedBy: item.performed_by,
            performedByName: 'Sistema',
            createdAt: item.created_at,
        }));

        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar audit logs do perfil:', error);
        res.json([]);
    }
});

// GET /api/me/profile/sessions — fallback durante migração para Supabase
router.get('/me/profile/sessions', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        const supabaseUser = req.supabaseUser;

        if (!accessToken || !supabaseUser) {
            res.status(401).json({ error: 'Não autenticado.' });
            return;
        }

        const userClient = createUserClient(accessToken);
        const { data, error } = await userClient
            .from('user_profile_sessions')
            .select('id, user_id, device, location, last_activity, is_active, is_approved, approved_at, created_at, revoked_at')
            .eq('user_id', supabaseUser.id)
            .order('last_activity', { ascending: false });

        if (error) {
            console.warn('Tabela user_profile_sessions indisponível, retornando fallback da sessão atual:', error.message);
            res.json([
                {
                    id: `current-${supabaseUser.id}`,
                    userId: supabaseUser.id,
                    device: 'Sessão atual',
                    location: null,
                    lastActivity: new Date().toISOString(),
                    isActive: true,
                    isApproved: true,
                    approvedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    revokedAt: null,
                },
            ]);
            return;
        }

        const rows = (data ?? []).map((item) => ({
            id: item.id,
            userId: item.user_id,
            device: item.device,
            location: item.location,
            lastActivity: item.last_activity,
            isActive: item.is_active,
            isApproved: item.is_approved,
            approvedAt: item.approved_at,
            createdAt: item.created_at,
            revokedAt: item.revoked_at,
        }));

        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar sessões do perfil:', error);
        res.json([]);
    }
});



// ─── Integrações (fallback durante migração Supabase) ───────────────────────
router.get('/integrations/webhooks', (_req: Request, res: Response) => {
    res.json([]);
});

router.post('/integrations/webhooks', (req: Request, res: Response) => {
    const now = new Date().toISOString();
    const payload = req.body ?? {};

    res.status(201).json({
        id: Date.now(),
        name: payload.name ?? 'Webhook',
        url: payload.url ?? '',
        events: Array.isArray(payload.events) ? payload.events : [],
        secret: payload.secret ?? '',
        active: payload.active ?? true,
        lastDelivery: null,
        empresaId: null,
        createdAt: now,
        updatedAt: now,
    });
});

router.patch('/integrations/webhooks/:id', (req: Request, res: Response) => {
    const now = new Date().toISOString();
    const payload = req.body ?? {};

    res.json({
        id: Number(req.params.id),
        name: payload.name ?? 'Webhook',
        url: payload.url ?? '',
        events: Array.isArray(payload.events) ? payload.events : [],
        secret: payload.secret ?? '',
        active: payload.active ?? true,
        lastDelivery: null,
        empresaId: null,
        createdAt: now,
        updatedAt: now,
    });
});

router.put('/integrations/webhooks/:id', (req: Request, res: Response) => {
    const now = new Date().toISOString();
    const payload = req.body ?? {};

    res.json({
        id: Number(req.params.id),
        name: payload.name ?? 'Webhook',
        url: payload.url ?? '',
        events: Array.isArray(payload.events) ? payload.events : [],
        secret: payload.secret ?? '',
        active: payload.active ?? true,
        lastDelivery: null,
        empresaId: null,
        createdAt: now,
        updatedAt: now,
    });
});

router.delete('/integrations/webhooks/:id', (_req: Request, res: Response) => {
    res.status(204).send();
});

router.get('/integrations/api-keys', (_req: Request, res: Response) => {
    res.json([]);
});

router.post('/integrations/api-keys', (req: Request, res: Response) => {
    const now = new Date().toISOString();
    const payload = req.body ?? {};

    res.status(201).json({
        id: Date.now(),
        provider: payload.provider ?? '',
        apiUrl: payload.apiUrl ?? null,
        key: payload.key ?? '',
        environment: payload.environment ?? 'producao',
        active: payload.active ?? true,
        lastUsed: payload.lastUsed ?? null,
        empresaId: null,
        global: payload.global ?? false,
        createdAt: now,
        updatedAt: now,
    });
});

router.patch('/integrations/api-keys/:id', (req: Request, res: Response) => {
    const now = new Date().toISOString();
    const payload = req.body ?? {};

    res.json({
        id: Number(req.params.id),
        provider: payload.provider ?? '',
        apiUrl: payload.apiUrl ?? null,
        key: payload.key ?? '',
        environment: payload.environment ?? 'producao',
        active: payload.active ?? true,
        lastUsed: payload.lastUsed ?? null,
        empresaId: null,
        global: payload.global ?? false,
        createdAt: now,
        updatedAt: now,
    });
});

router.delete('/integrations/api-keys/:id', (_req: Request, res: Response) => {
    res.status(204).send();
});

router.post('/integrations/providers/asaas/validate', (_req: Request, res: Response) => {
    res.json({ success: true, message: 'Validação indisponível em modo fallback.' });
});

router.post('/integrations/ai/generate', (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Geração de IA ainda não disponível nesta migração.' });
});

// NOTA: /notifications/unread-count movido para entityRoutes.ts (antes de /notifications/:id)

// NOTA: /intimacoes/unread-count movido para entityRoutes.ts (antes de /intimacoes/:id)

// ─── Processos unread-count ──────────────────────────────────────────────────
// O frontend chama GET /api/processos/unread-count
router.get('/processos/unread-count', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        const supabaseUser = req.supabaseUser;

        if (!accessToken || !supabaseUser) {
            res.json({ unread: 0 });
            return;
        }

        const userData = await findUsuario(supabaseUser.id, supabaseUser.email);
        const empresaId = userData?.empresa ?? null;

        // Fallback seguro para usuários sem vínculo de empresa.
        if (!empresaId) {
            res.json({ unread: 0 });
            return;
        }

        const userClient = createUserClient(accessToken);
        const { count } = await userClient
            .schema('public')
            .from('processos')
            .select('id', { count: 'exact', head: true })
            .eq('idempresa', empresaId)
            .eq('nao_lido', true);

        res.json({ unread: count ?? 0 });
    } catch (error) {
        console.error('Erro ao buscar unread-count de processos:', error);
        res.json({ unread: 0 });
    }
});

// ─── Sistemas CNJ (stub) ─────────────────────────────────────────────────────
router.get('/sistemas-cnj', (_req: Request, res: Response) => {
    res.json([]);
});

// ─── Conversations Providers (stub) ──────────────────────────────────────────
router.get('/conversations/providers/uaz/qr', (_req: Request, res: Response) => {
    res.json({ qr: 'mock-qr-code' });
});

router.post('/conversations/providers/uaz/provision', (_req: Request, res: Response) => {
    res.json({ success: true, message: 'Provisioning started (mock)' });
});

// Endpoint chamado no logout/desconexão do provedor no frontend.
router.post('/conversations/providers/uaz/disconnect', (_req: Request, res: Response) => {
    res.json({ success: true, status: 'disconnected' });
});

// ─── Compat: módulos de perfis ───────────────────────────────────────────────
router.get('/perfis/modulos', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        if (!accessToken) {
            res.status(401).json({ error: 'Não autenticado.' });
            return;
        }

        const userClient = createUserClient(accessToken);
        const { data, error } = await userClient
            .from('perfil_modulos')
            .select('modulo')
            .order('modulo', { ascending: true });

        if (error) {
            console.error('Erro ao listar módulos de perfis:', error);
            res.status(500).json({ error: 'Erro ao listar módulos de perfis.' });
            return;
        }

        const modules = Array.from(new Set((data ?? []).map((item) => item.modulo)))
            .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
            .map((id) => ({ id, nome: id }));

        res.json({ data: modules });
    } catch (error) {
        console.error('Erro interno ao listar módulos de perfis:', error);
        res.status(500).json({ error: 'Erro interno ao listar módulos de perfis.' });
    }
});

// ─── Compat: setores (migrado para tabela escritorios) ──────────────────────
router.get('/setores', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        const supabaseUser = req.supabaseUser;
        if (!accessToken || !supabaseUser) {
            res.status(401).json({ error: 'Não autenticado.' });
            return;
        }

        const userData = await findUsuario(supabaseUser.id, supabaseUser.email);
        const empresaId = userData?.empresa ?? (userData as { empresa_id?: number | null } | null)?.empresa_id ?? null;

        // Fallback seguro para migração: sem vínculo de empresa não pode listar dados multi-tenant.
        if (empresaId === null) {
            res.status(403).json({ error: 'Usuário sem vínculo de empresa.' });
            return;
        }

        const userClient = createUserClient(accessToken);
        const query = userClient
            .from('escritorios')
            .select('id, nome, empresa, ativo, datacriacao')
            .eq('empresa', empresaId)
            .order('nome', { ascending: true });

        const { data, error } = await query;
        if (error) {
            console.error('Erro ao listar setores (escritorios):', error);
            res.status(500).json({ error: 'Erro ao listar setores.' });
            return;
        }

        res.json({ data: data ?? [] });
    } catch (error) {
        console.error('Erro interno ao listar setores:', error);
        res.status(500).json({ error: 'Erro interno ao listar setores.' });
    }
});


router.post('/setores', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        if (!accessToken) {
            res.status(401).json({ error: 'Não autenticado.' });
            return;
        }

        const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
        if (!nome) {
            res.status(400).json({ error: 'Nome é obrigatório.' });
            return;
        }

        const empresa = Number(req.body?.empresa);
        if (!Number.isFinite(empresa)) {
            res.status(400).json({ error: 'Empresa inválida.' });
            return;
        }

        const payload = {
            nome,
            empresa,
            ativo: req.body?.ativo !== false,
        };

        const userClient = createUserClient(accessToken);
        const { data, error } = await userClient
            .from('escritorios')
            .insert(payload)
            .select('id, nome, empresa, ativo, datacriacao')
            .single();

        if (error) {
            console.error('Erro ao criar setor:', error);
            res.status(500).json({ error: 'Erro ao criar setor.' });
            return;
        }

        res.status(201).json(data);
    } catch (error) {
        console.error('Erro interno ao criar setor:', error);
        res.status(500).json({ error: 'Erro interno ao criar setor.' });
    }
});

router.put('/setores/:id', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        if (!accessToken) {
            res.status(401).json({ error: 'Não autenticado.' });
            return;
        }

        const id = Number.parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            res.status(400).json({ error: 'ID inválido.' });
            return;
        }

        const updates: Record<string, unknown> = {};
        if (typeof req.body?.nome === 'string') {
            const nome = req.body.nome.trim();
            if (!nome) {
                res.status(400).json({ error: 'Nome é obrigatório.' });
                return;
            }
            updates.nome = nome;
        }

        if (req.body?.empresa !== undefined) {
            const empresa = Number(req.body.empresa);
            if (!Number.isFinite(empresa)) {
                res.status(400).json({ error: 'Empresa inválida.' });
                return;
            }
            updates.empresa = empresa;
        }

        if (req.body?.ativo !== undefined) {
            updates.ativo = Boolean(req.body.ativo);
        }

        const userClient = createUserClient(accessToken);
        const { data, error } = await userClient
            .from('escritorios')
            .update(updates)
            .eq('id', id)
            .select('id, nome, empresa, ativo, datacriacao')
            .single();

        if (error) {
            console.error('Erro ao atualizar setor:', error);
            res.status(500).json({ error: 'Erro ao atualizar setor.' });
            return;
        }

        res.json(data);
    } catch (error) {
        console.error('Erro interno ao atualizar setor:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar setor.' });
    }
});

router.delete('/setores/:id', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        if (!accessToken) {
            res.status(401).json({ error: 'Não autenticado.' });
            return;
        }

        const id = Number.parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            res.status(400).json({ error: 'ID inválido.' });
            return;
        }

        const userClient = createUserClient(accessToken);
        const { error } = await userClient
            .from('escritorios')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Erro ao remover setor:', error);
            res.status(500).json({ error: 'Erro ao remover setor.' });
            return;
        }

        res.status(204).send();
    } catch (error) {
        console.error('Erro interno ao remover setor:', error);
        res.status(500).json({ error: 'Erro interno ao remover setor.' });
    }
});

// ─── Compat: oportunidades por fase ──────────────────────────────────────────
router.get('/oportunidades/fase/:faseId', async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        const supabaseUser = req.supabaseUser;
        if (!accessToken || !supabaseUser) {
            res.status(401).json({ error: 'Não autenticado.' });
            return;
        }

        const faseId = Number.parseInt(req.params.faseId, 10);
        if (Number.isNaN(faseId)) {
            res.status(400).json({ error: 'Fase inválida.' });
            return;
        }

        const userData = await findUsuario(supabaseUser.id, supabaseUser.email);
        const empresaId = userData?.empresa ?? (userData as { empresa_id?: number | null } | null)?.empresa_id ?? null;

        // Fallback seguro para migração: sem vínculo de empresa não pode consultar oportunidades por fase.
        if (empresaId === null) {
            res.status(403).json({ error: 'Usuário sem vínculo de empresa.' });
            return;
        }

        const userClient = createUserClient(accessToken);
        const query = userClient
            .from('oportunidades')
            .select('*')
            .eq('fase_id', faseId)
            .eq('idempresa', empresaId)
            .order('data_criacao', { ascending: false });

        const { data, error } = await query;
        if (error) {
            console.error('Erro ao listar oportunidades por fase:', error);
            res.status(500).json({ error: 'Erro ao listar oportunidades por fase.' });
            return;
        }

        res.json(data ?? []);
    } catch (error) {
        console.error('Erro interno ao listar oportunidades por fase:', error);
        res.status(500).json({ error: 'Erro interno ao listar oportunidades por fase.' });
    }
});

// ─── Conversations Stream (SSE stub) ──────────────────────────────────────────
router.get('/conversations/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Envia um evento de keep-alive
    res.write('data: {"type": "connected"}\n\n');

    req.on('close', () => {
        res.end();
    });
});

// ─── Oportunidades (list stub if needed) ─────────────────────────────────────
// Já temos oportunidadeRoutes, mas se houver algum path específico que falte...
// O frontend chamou GET /api/oportunidades 404.
// Agora que registramos oportunidadeRoutes em index.ts, isso deve sumir.

// ─── Alias para get_api_usuarios_empresa ─────────────────────────────────────
router.get('/get_api_usuarios_empresa', async (req: Request, res: Response) => {
    try {
        const supabaseUser = req.supabaseUser;
        const accessToken = req.accessToken;

        if (!supabaseUser || !accessToken) {
            res.status(401).json({ error: 'Não autenticado.' });
            return;
        }

        const userData = await findUsuario(supabaseUser.id, supabaseUser.email);
        const empresaId = userData?.empresa ?? (userData as { empresa_id?: number | null } | null)?.empresa_id ?? null;

        if (empresaId === null || empresaId === undefined) {
            res.status(403).json({ error: 'Usuário sem vínculo de empresa.' });
            return;
        }

        const page = Math.max(1, Number.parseInt(req.query.page as string, 10) || 1);
        const requestedLimit =
            Number.parseInt(req.query.limit as string, 10)
            || Number.parseInt(req.query.pageSize as string, 10)
            || 20;
        const limit = Math.min(100, Math.max(1, requestedLimit));
        const offset = (page - 1) * limit;
        const search = (req.query.search as string || '').trim();

        const userClient = createUserClient(accessToken);
        const strategies = [
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

        let usuariosData: Array<Record<string, unknown>> | null = null;
        let usuariosError: { code?: string; message?: string } | null = null;
        let count: number | null = null;

        for (const strategy of strategies) {
            let usuariosQuery = userClient
                .from('usuarios')
                .select(strategy.selectFields, { count: 'exact' })
                .or(strategy.filterExpression)
                .order('nome_completo', { ascending: true })
                .range(offset, offset + limit - 1);

            if (search) {
                usuariosQuery = usuariosQuery.or(`nome_completo.ilike.%${search}%,email.ilike.%${search}%`);
            }

            const result = await usuariosQuery;
            usuariosData = result.data as Array<Record<string, unknown>> | null;
            usuariosError = result.error ? { code: result.error.code, message: result.error.message } : null;
            count = result.count ?? null;

            if (!usuariosError) {
                break;
            }

            const message = String(usuariosError.message ?? '').toLowerCase();
            const isSchemaError = usuariosError.code === '42703' || usuariosError.code === 'PGRST204' || message.includes('column') || message.includes('does not exist');
            if (!isSchemaError) {
                break;
            }

            console.warn(`[stub/get_api_usuarios_empresa] Estratégia '${strategy.label}' falhou, tentando fallback de esquema.`, usuariosError);
        }

        if (usuariosError) {
            console.error('Erro ao listar get_api_usuarios_empresa:', usuariosError);
            res.status(500).json({ error: 'Erro ao listar usuários da empresa.' });
            return;
        }

        const usuarios = Array.isArray(usuariosData)
            ? usuariosData as Array<Record<string, unknown> & { auth_user_id?: string | null; oab?: string | null; oab_number?: string | null; oab_uf?: string | null }>
            : [];

        const authUserIds = Array.from(new Set(
            usuarios
                .map((item) => typeof item.auth_user_id === 'string' ? item.auth_user_id.trim() : '')
                .filter((item) => item.length > 0),
        ));

        let profileMap = new Map<string, { oab_number: string | null; oab_uf: string | null }>();

        if (authUserIds.length > 0) {
            const { data: profiles, error: profilesError } = await userClient
                .from('user_profiles')
                .select('user_id, oab_number, oab_uf')
                .in('user_id', authUserIds);

            if (profilesError) {
                console.error('Erro ao buscar OAB em user_profiles (get_api_usuarios_empresa):', profilesError);
            } else {
                profileMap = new Map(
                    ((profiles ?? []) as Array<{ user_id: string; oab_number: string | null; oab_uf: string | null }>)
                        .filter((profile) => typeof profile.user_id === 'string' && profile.user_id.trim().length > 0)
                        .map((profile) => [profile.user_id, { oab_number: profile.oab_number, oab_uf: profile.oab_uf }]),
                );
            }
        }

        const normalized = usuarios.map((item) => {
            const authUserId = typeof item.auth_user_id === 'string' ? item.auth_user_id.trim() : '';
            const profile = authUserId ? profileMap.get(authUserId) : undefined;

            const profileNumber = typeof profile?.oab_number === 'string' ? profile.oab_number.trim() : '';
            const profileUf = typeof profile?.oab_uf === 'string' ? profile.oab_uf.trim().toUpperCase() : '';
            const legacyNumber = typeof item.oab_number === 'string' ? item.oab_number.trim() : '';
            const legacyUf = typeof item.oab_uf === 'string' ? item.oab_uf.trim().toUpperCase() : '';

            const oabNumber = profileNumber || legacyNumber || null;
            const oabUf = profileUf || legacyUf || null;

            return {
                ...item,
                oab_number: oabNumber,
                oab_uf: oabUf,
                oab: oabNumber ? `${oabNumber}${oabUf ? `/${oabUf}` : ''}` : (typeof item.oab === 'string' ? item.oab : null),
            };
        });

        res.json({
            data: normalized,
            total: count ?? normalized.length,
            page,
            limit,
            totalPages: count ? Math.ceil(count / limit) : 0,
        });
    } catch (error) {
        console.error('Erro interno em get_api_usuarios_empresa:', error);
        res.status(500).json({ error: 'Erro interno ao listar usuários da empresa.' });
    }
});

export default router;
