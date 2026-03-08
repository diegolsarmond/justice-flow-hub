import { Router, type Router as ExpressRouter, Request, Response } from 'express';
import { createUserClient, supabaseAdmin } from '../config/supabase';
import { findUsuario } from '../controllers/authController';

const router: ExpressRouter = Router();

type PlanPaymentMethod = 'pix' | 'boleto' | 'cartao' | 'debito';

type PlanPaymentPayload = {
    planId?: number;
    pricingMode?: 'mensal' | 'anual';
    paymentMethod?: PlanPaymentMethod;
    billing?: {
        companyName?: string;
        document?: string;
        email?: string;
        notes?: string;
    };
    cardToken?: string;
    cardMetadata?: Record<string, unknown>;
};

const normalizePaymentMethod = (paymentMethod: PlanPaymentPayload['paymentMethod']): 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD' => {
    if (paymentMethod === 'boleto') {
        return 'BOLETO';
    }

    if (paymentMethod === 'cartao') {
        return 'CREDIT_CARD';
    }

    if (paymentMethod === 'debito') {
        return 'DEBIT_CARD';
    }

    return 'PIX';
};

const buildPlanPaymentResponse = (payload: PlanPaymentPayload) => {
    const amount = payload.pricingMode === 'anual' ? 1999.9 : 199.9;
    const billingType = normalizePaymentMethod(payload.paymentMethod);
    const now = new Date();
    const dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    return {
        plan: {
            id: payload.planId ?? null,
            nome: payload.planId ? `Plano ${payload.planId}` : null,
            pricingMode: payload.pricingMode === 'anual' ? 'anual' : 'mensal',
            price: amount,
        },
        paymentMethod: billingType,
        charge: {
            id: null,
            financialFlowId: null,
            asaasChargeId: null,
            billingType,
            status: 'PENDING',
            dueDate,
            amount,
            invoiceUrl: null,
            boletoUrl: null,
            pixPayload: null,
            pixQrCode: null,
            cardLast4: null,
            cardBrand: null,
        },
        flow: {
            id: null,
            description: payload.billing?.notes ?? 'Cobrança de plano',
            value: amount,
            dueDate,
            status: 'pending',
            tipo: 'receita',
        },
        subscription: {
            id: null,
            status: 'pending',
            cadence: payload.pricingMode === 'anual' ? 'yearly' : 'monthly',
            planId: payload.planId ?? null,
        },
    };
};

const toPositiveInt = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return value;
    }

    if (typeof value === 'string' && value.trim()) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isInteger(parsed) && parsed > 0) {
            return parsed;
        }
    }

    return null;
};

const resolveEmpresaId = async (req: Request): Promise<number | null> => {
    const userId = req.supabaseUser?.id;
    const userEmail = req.supabaseUser?.email;

    if (userId || userEmail) {
        try {
            const usuario = await findUsuario(userId || '', userEmail);
            const empresaId = toPositiveInt(usuario?.empresa ?? (usuario as { empresa_id?: unknown } | null)?.empresa_id);
            if (empresaId !== null) {
                return empresaId;
            }
        } catch (error) {
            console.error('[dashboard] erro ao resolver empresa via tabela usuarios', {
                userId,
                userEmail,
                error,
            });
        }
    }

    return toPositiveInt(
        req.supabaseUser?.user_metadata?.empresa_id
        ?? req.supabaseUser?.user_metadata?.empresa,
    );
};

const toMonthKey = (value: unknown): string | null => {
    if (typeof value !== 'string' || !value.trim()) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (monthKey: string): string => {
    const [year, month] = monthKey.split('-').map((part) => Number.parseInt(part, 10));
    const date = new Date(Date.UTC(year, month - 1, 1));

    return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(date);
};

const buildMonthWindow = (limit = 6): string[] => {
    const result: string[] = [];
    const now = new Date();

    for (let offset = limit - 1; offset >= 0; offset -= 1) {
        const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
        result.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`);
    }

    return result;
};

const parseNumericId = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
};

// ─── Dashboard Analytics ─────────────────────────────────────────────────────
router.get(['/analytics/dashboard', '/dashboard/analytics', '/dashboard'], async (req: Request, res: Response) => {
    try {
        const accessToken = req.accessToken;
        const client = accessToken ? createUserClient(accessToken) : supabaseAdmin;
        const empresaId = await resolveEmpresaId(req);

        if (empresaId === null) {
            return res.status(403).json({ error: 'Não foi possível determinar a empresa do usuário.' });
        }

        // 1) Diagnóstico de migração: prioriza novas tabelas Supabase (pje_processos).
        const { count: pjeCount, error: pjeCountError } = await client
            .from('pje_processos')
            .select('id', { count: 'exact', head: true })
            .eq('idempresa', empresaId);

        const useLegacyProcessTable = Boolean(pjeCountError);

        const processTotal = useLegacyProcessTable
            ? (
                await client
                    .from('processos')
                    .select('id', { count: 'exact', head: true })
                    .eq('idempresa', empresaId)
            ).count ?? 0
            : pjeCount ?? 0;

        const processDateRows = useLegacyProcessTable
            ? (
                await client
                    .from('processos')
                    .select('datacadastro, data_distribuicao, dataencerramento')
                    .eq('idempresa', empresaId)
                    .limit(5000)
            ).data ?? []
            : (
                await client
                    .from('pje_processos')
                    .select('created_at, data_ajuizamento, ultimo_movimento_data, ultimo_movimento, classe, assunto, sigla_tribunal, orgao_julgador, valor_acao, grau')
                    .eq('idempresa', empresaId)
                    .limit(5000)
            ).data ?? [];

        const monthWindow = buildMonthWindow(6);
        const processByMonth = new Map<string, number>();
        const closedByMonth = new Map<string, number>();

        const courtCounts = new Map<string, number>();
        const classCounts = new Map<string, number>();
        const subjectCounts = new Map<string, number>();
        const instanceCounts = new Map<string, number>();

        monthWindow.forEach((key) => {
            processByMonth.set(key, 0);
            closedByMonth.set(key, 0);
        });

        const isClosedMovement = (mov: any) => {
            if (!mov) return false;
            let desc = '';
            if (typeof mov === 'string') desc = mov;
            else if (typeof mov === 'object') desc = mov.descricao || mov.nome || '';
            
            desc = desc.toLowerCase();
            return desc.includes('arquiv') || desc.includes('baix') || desc.includes('encerr') || desc.includes('finaliz');
        };

        const resolveNome = (val: any) => {
            if (typeof val === 'string') return val;
            if (typeof val === 'object' && val) return val.nome || val.descricao || null;
            return null;
        };
        const getFirstNome = (arr: any) => {
            if (Array.isArray(arr) && arr.length > 0) {
                 const first = arr[0];
                 return first?.nome || first?.descricao || null;
            }
            return null;
        };

        processDateRows.forEach((row) => {
            const createdMonth = toMonthKey(
                (row as { created_at?: unknown; data_ajuizamento?: unknown; datacadastro?: unknown; data_distribuicao?: unknown }).created_at
                ?? (row as { created_at?: unknown; data_ajuizamento?: unknown; datacadastro?: unknown; data_distribuicao?: unknown }).data_ajuizamento
                ?? (row as { created_at?: unknown; data_ajuizamento?: unknown; datacadastro?: unknown; data_distribuicao?: unknown }).datacadastro
                ?? (row as { created_at?: unknown; data_ajuizamento?: unknown; datacadastro?: unknown; data_distribuicao?: unknown }).data_distribuicao,
            );

            if (createdMonth && processByMonth.has(createdMonth)) {
                processByMonth.set(createdMonth, (processByMonth.get(createdMonth) ?? 0) + 1);
            }

            let closedDate = (row as { dataencerramento?: unknown }).dataencerramento;
            if (!closedDate && (row as { ultimo_movimento?: unknown }).ultimo_movimento) {
                 if (isClosedMovement((row as { ultimo_movimento?: unknown }).ultimo_movimento)) {
                     closedDate = (row as { ultimo_movimento_data?: unknown }).ultimo_movimento_data;
                 }
            }

            const closedMonth = toMonthKey(closedDate);
            if (closedMonth && closedByMonth.has(closedMonth)) {
                closedByMonth.set(closedMonth, (closedByMonth.get(closedMonth) ?? 0) + 1);
            }

            const court = resolveNome((row as any).sigla_tribunal || (row as any).jurisdicao);
            if (court) courtCounts.set(court, (courtCounts.get(court) || 0) + 1);

            const classe = resolveNome((row as any).classe || (row as any).classe_judicial);
            if (classe) classCounts.set(classe, (classCounts.get(classe) || 0) + 1);

            const assuntoData = (row as any).assunto;
            const assunto = resolveNome(assuntoData) || (Array.isArray(assuntoData) ? getFirstNome(assuntoData) : null);
            if (assunto) subjectCounts.set(assunto, (subjectCounts.get(assunto) || 0) + 1);

            const grau = resolveNome((row as any).grau);
            if (grau) instanceCounts.set(grau, (instanceCounts.get(grau) || 0) + 1);
        });

        const toPercentage = (val: number, total: number) => total > 0 ? Number(((val / total) * 100).toFixed(1)) : 0;
        
        const buildDistribution = (map: Map<string, number>) => {
            const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
            return Array.from(map.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => ({
                    name,
                    value: toPercentage(count, total),
                    rawValue: count,
                }));
        };

        const buildRanking = (map: Map<string, number>) => {
            const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
            return Array.from(map.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([label, count]) => ({
                    label,
                    value: count,
                    percentage: toPercentage(count, total),
                }));
        };

        const { count: clientesTotal } = await client
            .from('clientes')
            .select('id', { count: 'exact', head: true })
            .eq('idempresa', empresaId);

        const { count: clientesAtivos } = await client
            .from('clientes')
            .select('id', { count: 'exact', head: true })
            .eq('idempresa', empresaId)
            .eq('ativo', true);

        const { data: oportunidadesRows } = await client
            .from('oportunidades')
            .select('status_id')
            .eq('idempresa', empresaId)
            .limit(1000);

        const opportunityCounts = new Map<number, number>();
        (oportunidadesRows ?? []).forEach((row) => {
            const key = parseNumericId((row as { status_id?: unknown }).status_id);
            if (key === null) {
                return;
            }

            opportunityCounts.set(key, (opportunityCounts.get(key) ?? 0) + 1);
        });

        const { data: statusRows } = await client
            .from('situacao_proposta')
            .select('id,nome')
            .or(`idempresa.eq.${empresaId},idempresa.is.null`)
            .limit(100);

        const opportunityStatusMetrics = (statusRows ?? []).map((row) => {
            const id = parseNumericId((row as { id?: unknown }).id);
            const nome = (row as { nome?: unknown }).nome;

            return {
                status: typeof nome === 'string' && nome.trim() ? nome : `Status ${id ?? '-'}`,
                count: id === null ? 0 : (opportunityCounts.get(id) ?? 0),
            };
        });

        const todayIso = new Date().toISOString();

        const { count: intimacoesTotal } = await client
            .from('intimacoes')
            .select('id', { count: 'exact', head: true })
            .eq('idempresa', empresaId);

        const { count: intimacoesUnread } = await client
            .from('intimacoes')
            .select('id', { count: 'exact', head: true })
            .eq('idempresa', empresaId)
            .eq('nao_lida', true);

        const { count: intimacoesAtivas } = await client
            .from('intimacoes')
            .select('id', { count: 'exact', head: true })
            .eq('idempresa', empresaId)
            .eq('arquivada', false);

        const { count: intimacoesPrazoFuturo } = await client
            .from('intimacoes')
            .select('id', { count: 'exact', head: true })
            .eq('idempresa', empresaId)
            .eq('arquivada', false)
            .gte('prazo', todayIso);

        const closedProcesses = closedByMonth.get(monthWindow[monthWindow.length - 1]) ?? 0;
        const activeProcesses = Math.max(processTotal - closedProcesses, 0);

        const monthlySeries = monthWindow.map((monthKey) => ({
            key: monthKey,
            month: formatMonthLabel(monthKey),
            processos: processByMonth.get(monthKey) ?? 0,
            encerrados: closedByMonth.get(monthKey) ?? 0,
            clientes: clientesTotal ?? 0,
            clientesNovos: 0,
        }));

        return res.json({
            processMetrics: {
                total: processTotal,
                classifications: [
                    { id: 'arquivamento', label: 'Arquivamento/Baixa', count: closedProcesses },
                    { id: 'outros', label: 'Outros movimentos', count: Math.max(processTotal - closedProcesses, 0) },
                ],
            },
            clientMetrics: {
                total: clientesTotal ?? 0,
                active: clientesAtivos ?? 0,
                prospects: Math.max((clientesTotal ?? 0) - (clientesAtivos ?? 0), 0),
            },
            kpis: {
                conversionRate: (clientesTotal ?? 0) > 0
                    ? Number((((clientesAtivos ?? 0) / (clientesTotal ?? 1)) * 100).toFixed(1))
                    : 0,
                monthlyGrowth: 0,
            },
            monthlySeries,
            opportunityStatusMetrics,
            processCards: [
                { id: 'total', label: 'Total de processos', value: processTotal },
                { id: 'ativos', label: 'Processos ativos', value: activeProcesses },
                { id: 'intimacoes', label: 'Intimações', value: intimacoesTotal ?? 0 },
                { id: 'intimacoes_pendentes', label: 'Intimações não lidas', value: intimacoesUnread ?? 0 },
                { id: 'intimacoes_prazo', label: 'Intimações com prazo', value: intimacoesPrazoFuturo ?? 0 },
            ],
            distributions: {
                byStatus: [],
                byBranch: [],
                bySegment: [],
                byInstance: buildDistribution(instanceCounts),
                byYear: [],
                byCourt: buildDistribution(courtCounts),
                byClaimValue: [],
                bySentenceOutcome: [],
            },
            rankings: {
                byStatus: [],
                byBranch: [],
                bySegment: [],
                byInstance: buildRanking(instanceCounts),
                byState: [],
                bySubject: buildRanking(subjectCounts),
                byClass: buildRanking(classCounts),
            },
            reports: {
                intimationSummary: {
                    total: intimacoesTotal ?? 0,
                    unread: intimacoesUnread ?? 0,
                    active: intimacoesAtivas ?? 0,
                    upcoming: intimacoesPrazoFuturo ?? 0,
                },
            },
            migration: {
                source: useLegacyProcessTable ? 'processos' : 'pje_processos',
                legacyFallback: useLegacyProcessTable,
                legacyFallbackReason: pjeCountError?.message ?? null,
            },
        });
    } catch (error) {
        console.error('[dashboard] erro ao montar analytics', error);
        return res.status(500).json({ error: 'Não foi possível carregar as métricas do dashboard.' });
    }
});

// ─── Plan Payments ───────────────────────────────────────────────────────────
router.get('/plan-payments/current', async (req: Request, res: Response) => {
    res.json(buildPlanPaymentResponse({
        planId: 1,
        pricingMode: 'mensal',
        paymentMethod: 'pix',
        billing: { notes: 'Cobrança de plano atual' },
    }));
});

router.post('/plan-payments', async (req: Request, res: Response) => {
    const payload = (req.body ?? {}) as PlanPaymentPayload;

    if (!payload.planId || typeof payload.planId !== 'number') {
        res.status(400).json({ error: 'planId é obrigatório e deve ser numérico.' });
        return;
    }

    if (payload.pricingMode !== 'mensal' && payload.pricingMode !== 'anual') {
        res.status(400).json({ error: 'pricingMode inválido. Use "mensal" ou "anual".' });
        return;
    }

    if (!payload.paymentMethod || !['pix', 'boleto', 'cartao', 'debito'].includes(payload.paymentMethod)) {
        res.status(400).json({ error: 'paymentMethod inválido. Use pix, boleto, cartao ou debito.' });
        return;
    }

    if (!payload.billing?.companyName || !payload.billing?.document || !payload.billing?.email) {
        res.status(400).json({
            error: 'Dados de faturamento incompletos. Informe companyName, document e email.',
        });
        return;
    }

    res.status(201).json(buildPlanPaymentResponse(payload));
});

export default router;
