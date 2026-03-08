import { Request, Response, Router, type Router as ExpressRouter } from 'express';
import { supabaseAdmin } from '../config/supabase';

const router: ExpressRouter = Router();

const BILLING_TYPE_MAP: Record<string, 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD'> = {
    pix: 'PIX',
    boleto: 'BOLETO',
    cartao: 'CREDIT_CARD',
    cartão: 'CREDIT_CARD',
    credit_card: 'CREDIT_CARD',
    debito: 'DEBIT_CARD',
    débito: 'DEBIT_CARD',
    debit_card: 'DEBIT_CARD',
    PIX: 'PIX',
    BOLETO: 'BOLETO',
    CREDIT_CARD: 'CREDIT_CARD',
    DEBIT_CARD: 'DEBIT_CARD',
};

const normalizeBillingType = (value: unknown): 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD' => {
    if (typeof value !== 'string') {
        return 'PIX';
    }

    const normalized = value.trim();
    if (!normalized) {
        return 'PIX';
    }

    return BILLING_TYPE_MAP[normalized] ?? BILLING_TYPE_MAP[normalized.toLowerCase()] ?? 'PIX';
};

const toPositiveInt = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return value;
    }

    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        if (Number.isInteger(parsed) && parsed > 0) {
            return parsed;
        }
    }

    return null;
};

const asNonEmptyString = (value: unknown): string | null => {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const toIsoDateOnly = (value: Date): string => value.toISOString().split('T')[0];

const resolveEmpresaId = async (req: Request): Promise<number | null> => {
    const directEmpresaId = toPositiveInt(
        req.body?.empresaId
        ?? req.body?.companyId
        ?? req.body?.idempresa
        ?? req.query?.empresaId
    );

    if (directEmpresaId !== null) {
        return directEmpresaId;
    }

    const userId = toPositiveInt(req.body?.userId ?? req.query?.userId);
    if (userId === null) {
        return null;
    }

    const { data, error } = await supabaseAdmin
        .from('usuarios')
        .select('empresa')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        console.error('[billing/site] erro ao resolver empresa por userId', { userId, error });
        return null;
    }

    return toPositiveInt(data?.empresa);
};

const buildPaymentFromSubscription = (
    subscriptionId: string,
    status: string,
    billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD',
    value: number,
    dueDate: string,
) => {
    const paymentStatus = status === 'active' ? 'RECEIVED' : status === 'inactive' ? 'OVERDUE' : 'PENDING';

    return {
        id: `${subscriptionId}-payment-1`,
        description: `Pagamento da assinatura ${subscriptionId}`,
        dueDate,
        value,
        status: paymentStatus,
        billingType,
        invoiceUrl: `https://sandbox.asaas.com/i/${subscriptionId}`,
    };
};

router.post('/site/asaas/customers', async (req: Request, res: Response) => {
    try {
        const empresaId = await resolveEmpresaId(req);

        const customerId = `cus_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

        if (empresaId !== null) {
            const { error } = await supabaseAdmin
                .from('empresas')
                .update({
                    asaas_customer_id: customerId,
                    email: asNonEmptyString(req.body?.email) ?? undefined,
                    telefone: asNonEmptyString(req.body?.phone) ?? undefined,
                })
                .eq('id', empresaId);

            if (error) {
                console.error('[billing/site] erro ao salvar asaas_customer_id', { empresaId, error });
                return res.status(500).json({ error: 'Não foi possível vincular o cliente à empresa.' });
            }
        }

        return res.status(201).json({
            id: customerId,
            empresaId,
            name: asNonEmptyString(req.body?.name),
            email: asNonEmptyString(req.body?.email),
        });
    } catch (error) {
        console.error('[billing/site] erro em /site/asaas/customers', error);
        return res.status(500).json({ error: 'Erro ao criar cliente.' });
    }
});

router.post('/site/asaas/subscriptions', async (req: Request, res: Response) => {
    try {
        const empresaId = await resolveEmpresaId(req);
        if (empresaId === null) {
            return res.status(400).json({ error: 'empresaId é obrigatório para criar assinatura.' });
        }

        const subscriptionId = `sub_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        const billingType = normalizeBillingType(req.body?.billingType);
        const now = new Date();
        const dueDate = asNonEmptyString(req.body?.nextDueDate) ?? toIsoDateOnly(now);
        const cycleRaw = asNonEmptyString(req.body?.cycle)?.toUpperCase();
        const cadence = cycleRaw === 'YEARLY' ? 'annual' : 'monthly';

        const value = typeof req.body?.value === 'number'
            ? req.body.value
            : Number.parseFloat(String(req.body?.value ?? '0'));

        const { error } = await supabaseAdmin
            .from('empresas')
            .update({
                asaas_subscription_id: subscriptionId,
                asaas_customer_id: asNonEmptyString(req.body?.customer) ?? undefined,
                subscription_status: 'pending',
                subscription_cadence: cadence,
                subscription_current_period_ends_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                current_period_start: now.toISOString(),
                current_period_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq('id', empresaId);

        if (error) {
            console.error('[billing/site] erro ao criar assinatura', { empresaId, error });
            return res.status(500).json({ error: 'Não foi possível criar a assinatura.' });
        }

        return res.status(201).json({
            id: subscriptionId,
            customer: asNonEmptyString(req.body?.customer),
            billingType,
            value: Number.isFinite(value) ? value : 0,
            nextDueDate: dueDate,
            cycle: cadence === 'annual' ? 'YEARLY' : 'MONTHLY',
            status: 'PENDING',
            dateCreated: now.toISOString(),
            externalReference: asNonEmptyString(req.body?.externalReference),
            localStatus: 'pending',
        });
    } catch (error) {
        console.error('[billing/site] erro em /site/asaas/subscriptions', error);
        return res.status(500).json({ error: 'Erro ao criar assinatura.' });
    }
});

router.get('/site/asaas/subscriptions/:id', async (req: Request, res: Response) => {
    try {
        const subscriptionId = req.params.id;
        const { data, error } = await supabaseAdmin
            .from('empresas')
            .select('id, asaas_customer_id, asaas_subscription_id, subscription_status, subscription_cadence, subscription_pending_plan, subscription_current_period_ends_at')
            .eq('asaas_subscription_id', subscriptionId)
            .maybeSingle();

        if (error) {
            console.error('[billing/site] erro ao buscar assinatura', { subscriptionId, error });
            return res.status(500).json({ error: 'Não foi possível carregar assinatura.' });
        }

        if (!data) {
            return res.status(404).json({ error: 'Assinatura não encontrada.' });
        }

        return res.json({
            id: subscriptionId,
            customer: data.asaas_customer_id ?? '',
            description: 'Assinatura Quantum',
            billingType: 'PIX',
            value: 0,
            cycle: data.subscription_cadence === 'annual' ? 'YEARLY' : 'MONTHLY',
            status: data.subscription_status?.toUpperCase() ?? 'PENDING',
            nextDueDate: data.subscription_current_period_ends_at ? toIsoDateOnly(new Date(data.subscription_current_period_ends_at)) : toIsoDateOnly(new Date()),
            dateCreated: new Date().toISOString(),
            externalReference: data.subscription_pending_plan ?? null,
            pendingPlanName: data.subscription_pending_plan ?? null,
            localStatus: data.subscription_status ?? null,
            localUpdatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[billing/site] erro em /site/asaas/subscriptions/:id', error);
        return res.status(500).json({ error: 'Erro ao carregar assinatura.' });
    }
});

router.get('/site/asaas/subscriptions/:id/payments', async (req: Request, res: Response) => {
    try {
        const subscriptionId = req.params.id;
        const { data, error } = await supabaseAdmin
            .from('empresas')
            .select('subscription_status, subscription_current_period_ends_at, subscription_cadence')
            .eq('asaas_subscription_id', subscriptionId)
            .maybeSingle();

        if (error) {
            console.error('[billing/site] erro ao buscar pagamentos', { subscriptionId, error });
            return res.status(500).json({ error: 'Não foi possível carregar pagamentos.' });
        }

        if (!data) {
            return res.status(404).json({ error: 'Assinatura não encontrada.' });
        }

        const dueDate = data.subscription_current_period_ends_at
            ? toIsoDateOnly(new Date(data.subscription_current_period_ends_at))
            : toIsoDateOnly(new Date());

        const payment = buildPaymentFromSubscription(
            subscriptionId,
            data.subscription_status ?? 'pending',
            'PIX',
            0,
            dueDate,
        );

        return res.json({ data: [payment] });
    } catch (error) {
        console.error('[billing/site] erro em /site/asaas/subscriptions/:id/payments', error);
        return res.status(500).json({ error: 'Erro ao carregar pagamentos.' });
    }
});

router.post('/site/asaas/subscriptions/:id/cancel', async (req: Request, res: Response) => {
    try {
        const subscriptionId = req.params.id;
        const { data, error } = await supabaseAdmin
            .from('empresas')
            .update({
                subscription_status: 'inactive',
                subscription_grace_period_ends_at: new Date().toISOString(),
            })
            .eq('asaas_subscription_id', subscriptionId)
            .select('asaas_customer_id, subscription_cadence, subscription_status, subscription_current_period_ends_at')
            .maybeSingle();

        if (error) {
            console.error('[billing/site] erro ao cancelar assinatura', { subscriptionId, error });
            return res.status(500).json({ error: 'Não foi possível cancelar a assinatura.' });
        }

        if (!data) {
            return res.status(404).json({ error: 'Assinatura não encontrada.' });
        }

        return res.json({
            id: subscriptionId,
            customer: data.asaas_customer_id ?? '',
            description: 'Assinatura Quantum',
            billingType: 'PIX',
            value: 0,
            cycle: data.subscription_cadence === 'annual' ? 'YEARLY' : 'MONTHLY',
            status: 'INACTIVE',
            nextDueDate: data.subscription_current_period_ends_at ? toIsoDateOnly(new Date(data.subscription_current_period_ends_at)) : toIsoDateOnly(new Date()),
            dateCreated: new Date().toISOString(),
            localStatus: data.subscription_status ?? 'inactive',
        });
    } catch (error) {
        console.error('[billing/site] erro em /site/asaas/subscriptions/:id/cancel', error);
        return res.status(500).json({ error: 'Erro ao cancelar assinatura.' });
    }
});

router.put('/site/asaas/subscriptions/:id/card', async (req: Request, res: Response) => {
    const subscriptionId = req.params.id;
    const creditCard = req.body?.creditCard ?? {};
    const number = typeof creditCard?.number === 'string' ? creditCard.number.replace(/\D/g, '') : '';

    return res.json({
        id: subscriptionId,
        cardLast4: number.length >= 4 ? number.slice(-4) : null,
        cardBrand: 'unknown',
        updatedAt: new Date().toISOString(),
    });
});

router.put('/site/asaas/subscriptions/:id', async (req: Request, res: Response) => {
    try {
        const subscriptionId = req.params.id;
        const planId = asNonEmptyString(req.body?.planId) ?? String(req.body?.planId ?? '');

        const { data, error } = await supabaseAdmin
            .from('empresas')
            .update({
                subscription_pending_plan: planId || null,
            })
            .eq('asaas_subscription_id', subscriptionId)
            .select('asaas_customer_id, subscription_cadence, subscription_status, subscription_current_period_ends_at, subscription_pending_plan')
            .maybeSingle();

        if (error) {
            console.error('[billing/site] erro ao atualizar assinatura', { subscriptionId, error });
            return res.status(500).json({ error: 'Não foi possível atualizar a assinatura.' });
        }

        if (!data) {
            return res.status(404).json({ error: 'Assinatura não encontrada.' });
        }

        return res.json({
            id: subscriptionId,
            customer: data.asaas_customer_id ?? '',
            description: 'Assinatura Quantum',
            billingType: 'PIX',
            value: 0,
            cycle: data.subscription_cadence === 'annual' ? 'YEARLY' : 'MONTHLY',
            status: data.subscription_status?.toUpperCase() ?? 'PENDING',
            nextDueDate: data.subscription_current_period_ends_at ? toIsoDateOnly(new Date(data.subscription_current_period_ends_at)) : toIsoDateOnly(new Date()),
            dateCreated: new Date().toISOString(),
            pendingPlanName: data.subscription_pending_plan ?? null,
            localStatus: data.subscription_status ?? null,
            localUpdatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[billing/site] erro em /site/asaas/subscriptions/:id', error);
        return res.status(500).json({ error: 'Erro ao atualizar assinatura.' });
    }
});

router.get('/site/asaas/payments/:id/pix', (req: Request, res: Response) => {
    const paymentId = req.params.id;
    return res.json({
        encodedImage: `data:image/png;base64,${Buffer.from(paymentId).toString('base64')}`,
        payload: `00020126580014BR.GOV.BCB.PIX0136${paymentId}52040000530398654040.005802BR5925QUANTUM TECNOLOGIA6009SAO PAULO62070503***6304ABCD`,
        expirationDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });
});

router.get('/site/asaas/payments/:id/boleto', (req: Request, res: Response) => {
    const paymentId = req.params.id;
    const digits = paymentId.replace(/\D/g, '').padEnd(47, '0').slice(0, 47);

    return res.json({
        identificationField: digits,
        nossoNumero: paymentId,
    });
});

router.post('/subscriptions', async (req: Request, res: Response) => {
    try {
        const empresaId = await resolveEmpresaId(req);
        const planId = toPositiveInt(req.body?.planId);

        if (empresaId === null || planId === null) {
            return res.status(400).json({ error: 'companyId/empresaId e planId são obrigatórios.' });
        }

        const { data: existing, error: findError } = await supabaseAdmin
            .from('empresas')
            .select('subscription_status')
            .eq('id', empresaId)
            .maybeSingle();

        if (findError) {
            console.error('[billing/site] erro ao validar assinatura existente', { empresaId, findError });
            return res.status(500).json({ error: 'Não foi possível validar assinatura existente.' });
        }

        if (existing?.subscription_status === 'active') {
            return res.status(409).json({ error: 'Já existe uma assinatura ativa para esta empresa.' });
        }

        const now = new Date();
        const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

        const { error } = await supabaseAdmin
            .from('empresas')
            .update({
                plano: planId,
                subscription_status: 'active',
                trial_started_at: now.toISOString(),
                trial_ends_at: trialEnd.toISOString(),
                current_period_start: now.toISOString(),
                current_period_end: trialEnd.toISOString(),
            })
            .eq('id', empresaId);

        if (error) {
            console.error('[billing/site] erro ao criar subscription local', { empresaId, error });
            return res.status(500).json({ error: 'Não foi possível ativar o plano.' });
        }

        return res.status(201).json({
            empresaId,
            planId,
            status: 'trialing',
            startDate: now.toISOString(),
            trialEndsAt: trialEnd.toISOString(),
        });
    } catch (error) {
        console.error('[billing/site] erro em /subscriptions', error);
        return res.status(500).json({ error: 'Erro ao ativar assinatura.' });
    }
});

router.post('/trials', async (req: Request, res: Response) => {
    try {
        const empresaId = await resolveEmpresaId(req);
        const planId = toPositiveInt(req.body?.planId);
        const duration = toPositiveInt(req.body?.duration) ?? 14;

        if (empresaId === null || planId === null) {
            return res.status(400).json({ error: 'empresaId e planId são obrigatórios.' });
        }

        const now = new Date();
        const trialEnd = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);

        const { error } = await supabaseAdmin
            .from('empresas')
            .update({
                plano: planId,
                subscription_status: 'active',
                trial_started_at: now.toISOString(),
                trial_ends_at: trialEnd.toISOString(),
                subscription_trial_ends_at: trialEnd.toISOString(),
                subscription_cadence: 'monthly',
            })
            .eq('id', empresaId);

        if (error) {
            console.error('[billing/site] erro ao iniciar trial', { empresaId, error });
            return res.status(500).json({ error: 'Não foi possível iniciar o período de teste.' });
        }

        return res.status(201).json({
            empresaId,
            planId,
            status: 'trialing',
            startedAt: now.toISOString(),
            endsAt: trialEnd.toISOString(),
            duration,
        });
    } catch (error) {
        console.error('[billing/site] erro em /trials', error);
        return res.status(500).json({ error: 'Erro ao iniciar trial.' });
    }
});

export default router;
