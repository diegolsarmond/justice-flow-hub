import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, CreditCard, TrendingUp, Calendar, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { routes } from "@/config/routes";
import { getApiUrl } from "@/lib/api";
import {
  evaluateCompanySubscription,
  resolveCompanySubscriptionCadence,
  type CompanySubscriptionSource,
} from "@/lib/companySubscription";

type SubscriptionStatus = "active" | "trial" | "inactive" | "pending" | "grace" | "overdue";
type PlanRecurrence = "mensal" | "anual" | "nenhuma" | null;

interface ApiCompany extends CompanySubscriptionSource {
  id: number;
  nome_empresa?: string | null;
  email?: string | null;
  plano?: number | string | null;
  ativo?: boolean | string | number | null;
  datacadastro?: string | Date | null;
  recorrencia?: string | null;
  plano_recorrencia?: string | null;
  plano_periodicidade?: string | null;
}

type ApiPlanLimits = {
  usuarios?: number | string | null;
  processos?: number | string | null;
  propostas?: number | string | null;
  clientes?: number | string | null;
};

interface ApiPlan {
  id?: number;
  nome?: string | null;
  valor?: number | string | null;
  valor_mensal?: number | string | null;
  valorMensal?: number | string | null;
  valor_anual?: number | string | null;
  valorAnual?: number | string | null;
  preco_mensal?: number | string | null;
  precoMensal?: number | string | null;
  preco_anual?: number | string | null;
  precoAnual?: number | string | null;
  recorrencia?: string | null;
  limites?: ApiPlanLimits | null;
  limite_usuarios?: number | string | null;
  limite_processos?: number | string | null;
  limite_propostas?: number | string | null;
  qtde_usuarios?: number | string | null;
  max_casos?: number | string | null;
  max_propostas?: number | string | null;
  limite_clientes?: number | string | null;
}

type PlanLimits = {
  users: number | null;
  processes: number | null;
  proposals: number | null;
  clients: number | null;
};

interface Subscription {
  id: string;
  companyId: number;
  companyName: string;
  companyEmail: string;
  planId: string | null;
  planName: string;
  planPrice: number | null;
  planMonthlyPrice: number | null;
  planAnnualPrice: number | null;
  planRecurrence: PlanRecurrence;
  planLimits: PlanLimits;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextCharge: string | null;
  trialEnd: string | null;
  mrr: number;
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Ativa",
  trial: "Trial",
  inactive: "Inativa",
  pending: "Pendente",
  grace: "Carência",
  overdue: "Atrasada",
};

const parseDataArray = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object") {
    const rows = (payload as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows as T[];
    }

    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data as T[];
    }

    if (data && typeof data === "object") {
      const nestedRows = (data as { rows?: unknown }).rows;
      if (Array.isArray(nestedRows)) {
        return nestedRows as T[];
      }
    }
  }

  return [];
};

const toIsoString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
};

const parseRecurrence = (value: unknown): PlanRecurrence => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "mensal" || normalized === "anual" || normalized === "nenhuma") {
    return normalized;
  }

  return null;
};

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const sanitized = trimmed.replace(/[^\d.,-]+/g, "").replace(/\.(?=.*\.)/g, "");
    const normalized = sanitized.replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const parseInteger = (value: unknown): number | null => {
  const numeric = parseNumber(value);
  if (numeric == null) {
    return null;
  }

  return Math.trunc(numeric);
};

const addDuration = (start: string | null, recurrence: PlanRecurrence): string | null => {
  if (!start || !recurrence || recurrence === "nenhuma") {
    return null;
  }

  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const endDate = new Date(startDate);
  if (recurrence === "anual") {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  return endDate.toISOString();
};

const TRIAL_DURATION_DAYS = 14;

const calculateTrialEnd = (start: string | null): string | null => {
  if (!start) {
    return null;
  }

  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + TRIAL_DURATION_DAYS);
  return endDate.toISOString();
};

const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

const calculateMrr = (price: number | null, recurrence: PlanRecurrence): number => {
  if (typeof price !== "number" || Number.isNaN(price)) {
    return 0;
  }

  if (recurrence === "anual") {
    return roundToTwo(price / 12);
  }

  return roundToTwo(price);
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDate = (value: string | null): string => {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleDateString("pt-BR");
};

const formatPeriodRange = (start: string | null, end: string | null): string => {
  const startLabel = formatDate(start);
  const endLabel = formatDate(end);

  if (startLabel === "--" && endLabel === "--") {
    return "--";
  }

  if (endLabel === "--") {
    return startLabel;
  }

  if (startLabel === "--") {
    return endLabel;
  }

  return `${startLabel} - ${endLabel}`;
};

const RECURRENCE_LABELS: Record<Exclude<PlanRecurrence, null>, string> = {
  mensal: "Mensal",
  anual: "Anual",
  nenhuma: "Sem recorrência",
};

const formatLimitValue = (value: number | null): string => {
  if (value == null) {
    return "Ilimitado";
  }

  if (Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("pt-BR").format(value);
};

const resolvePlanRecurrence = (
  company: ApiCompany,
  plan: ApiPlan | undefined,
  monthlyPrice: number | null,
  annualPrice: number | null,
): PlanRecurrence => {
  const cadence = resolveCompanySubscriptionCadence(company);
  if (cadence) {
    return cadence;
  }

  const recurrenceCandidates: unknown[] = [plan?.recorrencia];

  for (const candidate of recurrenceCandidates) {
    const parsed = parseRecurrence(candidate);
    if (parsed) {
      return parsed;
    }
  }

  if (monthlyPrice != null && annualPrice == null) {
    return "mensal";
  }

  if (monthlyPrice == null && annualPrice != null) {
    return "anual";
  }

  return null;
};

const extractPlanLimits = (plan: ApiPlan | undefined): PlanLimits => {
  const rawLimits = (plan?.limites && typeof plan.limites === "object") ? plan.limites : null;
  const limitsRecord = rawLimits as Record<string, unknown> | null;

  const users =
    parseInteger(limitsRecord?.usuarios) ??
    parseInteger(limitsRecord?.users) ??
    parseInteger(plan?.limite_usuarios) ??
    parseInteger(plan?.qtde_usuarios);

  const processes =
    parseInteger(limitsRecord?.processos) ??
    parseInteger(limitsRecord?.cases) ??
    parseInteger(limitsRecord?.casos) ??
    parseInteger(plan?.limite_processos) ??
    parseInteger(plan?.max_casos);

  const proposals =
    parseInteger(limitsRecord?.propostas) ??
    parseInteger(limitsRecord?.proposals) ??
    parseInteger(plan?.limite_propostas) ??
    parseInteger(plan?.max_propostas);

  const clients =
    parseInteger(limitsRecord?.clientes) ??
    parseInteger(limitsRecord?.clients) ??
    parseInteger(plan?.limite_clientes) ??
    parseInteger((plan as { max_clientes?: unknown })?.max_clientes);

  return {
    users: users ?? null,
    processes: processes ?? null,
    proposals: proposals ?? null,
    clients: clients ?? null,
  };
};

const getPlanMonthlyPrice = (plan: ApiPlan | undefined): number | null =>
  parseNumber(plan?.valor_mensal ?? plan?.valorMensal ?? plan?.preco_mensal ?? plan?.precoMensal ?? plan?.valor ?? null);

const getPlanAnnualPrice = (plan: ApiPlan | undefined): number | null =>
  parseNumber(plan?.valor_anual ?? plan?.valorAnual ?? plan?.preco_anual ?? plan?.precoAnual ?? null);

const formatPlanPrice = (price: number | null, recurrence: PlanRecurrence): string => {
  if (typeof price !== "number" || Number.isNaN(price)) {
    return "Sem valor definido";
  }

  const suffix = recurrence === "anual" ? "/ano" : recurrence === "mensal" ? "/mês" : "";
  return `${formatCurrency(price)}${suffix}`;
};

const buildPlanPricingLines = (subscription: Subscription): string[] => {
  if (!subscription.planId) {
    return [];
  }

  const lines: string[] = [];

  if (subscription.planMonthlyPrice != null) {
    lines.push(`Mensal: ${formatCurrency(subscription.planMonthlyPrice)}`);
  }

  if (subscription.planAnnualPrice != null) {
    lines.push(`Anual: ${formatCurrency(subscription.planAnnualPrice)}`);
  }

  if (subscription.planRecurrence) {
    const label = RECURRENCE_LABELS[subscription.planRecurrence];
    if (label) {
      lines.push(
        subscription.planRecurrence === "nenhuma"
          ? `Recorrência: ${label}`
          : `Recorrência atual: ${label}`,
      );
    }
  }

  if (lines.length === 0 && subscription.planPrice != null) {
    lines.push(formatPlanPrice(subscription.planPrice, subscription.planRecurrence));
  }

  if (lines.length === 0) {
    lines.push("Sem valor definido");
  }

  return lines;
};

const formatTrialInfo = (trialEnd: string | null): string => {
  if (!trialEnd) {
    return "--";
  }

  const label = formatDate(trialEnd);
  return label === "--" ? "--" : `Trial até ${label}`;
};

const mapApiCompanyToSubscription = (company: ApiCompany, plansIndex: Map<string, ApiPlan>): Subscription => {
  const evaluation = evaluateCompanySubscription(company);
  const { planId, status } = evaluation;
  const plan = planId ? plansIndex.get(planId) : undefined;

  const planName = plan?.nome?.trim() || (planId ? `Plano ${planId}` : "Sem plano");
  const planMonthlyPrice = getPlanMonthlyPrice(plan);
  const planAnnualPrice = getPlanAnnualPrice(plan);
  const recurrence = resolvePlanRecurrence(company, plan, planMonthlyPrice, planAnnualPrice);
  const effectivePrice =
    recurrence === "anual"
      ? planAnnualPrice ?? (planMonthlyPrice != null ? roundToTwo(planMonthlyPrice * 12) : null)
      : recurrence === "mensal"
        ? planMonthlyPrice ?? (planAnnualPrice != null ? roundToTwo(planAnnualPrice / 12) : null)
        : planMonthlyPrice ?? planAnnualPrice ?? parseNumber(plan?.valor ?? null);

  const currentPeriodStart = evaluation.currentPeriodStart ?? toIsoString(company.datacadastro);
  const derivedPeriodEnd = addDuration(currentPeriodStart, recurrence);
  const currentPeriodEnd = evaluation.currentPeriodEnd ?? derivedPeriodEnd;
  const trialEnd =
    evaluation.trialEndsAt ?? (status === "trial" ? calculateTrialEnd(evaluation.trialStartedAt ?? currentPeriodStart) : null);
  const planLimits = extractPlanLimits(plan);

  const nextCharge = status === "trial"
    ? trialEnd
    : recurrence && recurrence !== "nenhuma"
      ? currentPeriodEnd ?? evaluation.gracePeriodEndsAt
      : null;

  return {
    id: `subscription-${company.id}`,
    companyId: company.id,
    companyName: company.nome_empresa?.trim() || `Empresa #${company.id}`,
    companyEmail: company.email?.trim() || "",
    planId,
    planName,
    planPrice: effectivePrice ?? null,
    planMonthlyPrice,
    planAnnualPrice,
    planRecurrence: recurrence,
    planLimits,
    status,
    currentPeriodStart,
    currentPeriodEnd,
    nextCharge,
    trialEnd,
    mrr: calculateMrr(effectivePrice ?? null, recurrence),
  };
};

const getStatusBadge = (status: SubscriptionStatus) => {
  const variants: Record<SubscriptionStatus, ComponentProps<typeof Badge>["variant"]> = {
    active: "default",
    trial: "secondary",
    inactive: "destructive",
    pending: "outline",
    grace: "secondary",
    overdue: "destructive",
  };

  return (
    <Badge variant={variants[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
};

export default function Subscriptions() {
  const [searchTerm, setSearchTerm] = useState("");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const loadSubscriptions = async () => {
      setIsLoading(true);
      try {
        const companiesResponse = await fetch(getApiUrl("empresas"), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!companiesResponse.ok) {
          throw new Error(`Falha ao carregar empresas: ${companiesResponse.status}`);
        }

        const companiesPayload = await companiesResponse.json();
        const apiCompanies = parseDataArray<ApiCompany>(companiesPayload);

        const plansIndex = new Map<string, ApiPlan>();
        try {
          const plansResponse = await fetch(getApiUrl("planos"), {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });

          if (plansResponse.ok) {
            const plansPayload = await plansResponse.json();
            const apiPlans = parseDataArray<ApiPlan>(plansPayload);
            apiPlans.forEach((plan) => {
              if (plan?.id != null) {
                plansIndex.set(String(plan.id), plan);
              }
            });
          } else {
            console.warn("Falha ao carregar planos:", plansResponse.status);
          }
        } catch (planError) {
          if (planError instanceof DOMException && planError.name === "AbortError") {
            return;
          }
          console.warn("Erro ao carregar planos:", planError);
        }

        if (!isMounted) {
          return;
        }

        setSubscriptions(apiCompanies.map((company) => mapApiCompanyToSubscription(company, plansIndex)));
        setError(null);
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }

        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        console.error("Erro ao carregar assinaturas:", fetchError);
        setSubscriptions([]);
        setError("Não foi possível carregar as assinaturas.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadSubscriptions();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const filteredSubscriptions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return subscriptions;
    }

    return subscriptions.filter((subscription) => {
      const values = [
        subscription.companyName,
        subscription.companyEmail,
        subscription.planName,
        STATUS_LABELS[subscription.status],
      ];

      return values.some((value) => value && value.toLowerCase().includes(query));
    });
  }, [subscriptions, searchTerm]);

  const metrics = useMemo(() => {
    return subscriptions.reduce(
      (acc, subscription) => {
        acc.totalMRR += subscription.mrr;

        if (subscription.status === "active") {
          acc.activeSubscriptions += 1;
        }

        if (subscription.status === "trial") {
          acc.trialSubscriptions += 1;
        }

        return acc;
      },
      { totalMRR: 0, activeSubscriptions: 0, trialSubscriptions: 0 },
    );
  }, [subscriptions]);

  const { totalMRR, activeSubscriptions, trialSubscriptions } = metrics;
  const arpu = activeSubscriptions > 0 ? totalMRR / activeSubscriptions : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Assinaturas
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie assinaturas, renovações e métricas de receita recorrente.
          </p>
        </div>
        <Button
          asChild
          className="w-full md:w-auto shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
        >
          <Link to={routes.admin.newSubscription}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Assinatura
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-md border-muted/60 hover:border-primary/20 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MRR Total</CardTitle>
            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <div className="h-4 w-4 text-green-600 dark:text-green-400 font-bold">$</div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalMRR)}</div>
            <p className="text-xs text-muted-foreground mt-1">Receita mensal recorrente</p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-muted/60 hover:border-primary/20 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assinaturas Ativas</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground mt-1">Clientes pagantes ativos</p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-muted/60 hover:border-primary/20 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Trial</CardTitle>
            <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trialSubscriptions}</div>
            <p className="text-xs text-muted-foreground mt-1">Potenciais conversões</p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-muted/60 hover:border-primary/20 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ARPU</CardTitle>
            <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(arpu)}</div>
            <p className="text-xs text-muted-foreground mt-1">Receita média por usuário</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions Table */}
      <Card className="shadow-md border-muted/60">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Base de Assinantes</CardTitle>
              <CardDescription>Visão detalhada de todas as assinaturas gerenciadas pelo sistema.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa, email ou plano..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 max-w-sm"
            />
          </div>

          <div className="rounded-lg border bg-background/50 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="pl-4">Empresa / Cliente</TableHead>
                  <TableHead>Plano & Valor</TableHead>
                  <TableHead className="hidden xl:table-cell">Limites Contratados</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>MRR</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Próxima Cobrança</TableHead>
                  <TableHead className="text-right pr-4">Gerenciar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        <p className="text-sm">Carregando assinaturas...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-destructive font-medium bg-destructive/5">
                      {error}
                    </TableCell>
                  </TableRow>
                ) : filteredSubscriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <Search className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p>Nenhuma assinatura encontrada para os filtros atuais.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubscriptions.map((subscription) => (
                    <TableRow key={subscription.id} className="group hover:bg-muted/50 transition-colors">
                      <TableCell className="pl-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">{subscription.companyName}</span>
                          <span className="text-xs text-muted-foreground">{subscription.companyEmail || "Email não informado"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="w-fit font-normal">
                            {subscription.planName}
                          </Badge>
                          {subscription.planId && (
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {buildPlanPricingLines(subscription).map((line, index) => (
                                <div key={`${subscription.id}-pricing-${index}`} className="flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                                  {line}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell align-top">
                        {subscription.planId ? (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Usuários:</span>
                              <span className="font-medium">{formatLimitValue(subscription.planLimits.users)}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Clientes:</span>
                              <span className="font-medium">{formatLimitValue(subscription.planLimits.clients)}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Proc.:</span>
                              <span className="font-medium">{formatLimitValue(subscription.planLimits.processes)}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Prop.:</span>
                              <span className="font-medium">{formatLimitValue(subscription.planLimits.proposals)}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                      <TableCell>
                        <div className="font-mono font-medium text-foreground">{formatCurrency(subscription.mrr)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">{formatPeriodRange(subscription.currentPeriodStart, subscription.currentPeriodEnd)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {subscription.status === "trial" ? (
                            <span className="text-amber-600 dark:text-amber-400">{formatTrialInfo(subscription.trialEnd)}</span>
                          ) : (
                            formatDate(subscription.nextCharge)
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" disabled className="h-8">
                            Detalhes
                          </Button>
                          <Button variant="outline" size="sm" disabled className="h-8">
                            Mudar Plano
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions & Metrics */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-md border-muted/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-md bg-primary/10">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              Ações Rápidas
            </CardTitle>
            <CardDescription>Operações frequentes para gestão financeira.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild className="w-full justify-start shadow-sm" variant="outline">
              <Link to={routes.admin.newSubscription}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Nova Assinatura Manualmente
              </Link>
            </Button>
            <Button className="w-full justify-start shadow-sm" variant="outline">
              <CreditCard className="h-4 w-4 mr-2" />
              Processar Cobranças Pendentes (Lote)
            </Button>
            <Button className="w-full justify-start shadow-sm" variant="outline">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Verificar Trials Expirando em 48h
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md border-muted/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-md bg-primary/10">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              Saúde Financeira
            </CardTitle>
            <CardDescription>Indicadores de performance de conversão e retenção.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
                <span className="text-sm font-medium text-muted-foreground">Taxa de Conversão Trial</span>
                <Badge variant="secondary" className="font-mono text-green-600 dark:text-green-400">78.5%</Badge>
              </div>
              <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
                <span className="text-sm font-medium text-muted-foreground">Taxa de Upgrade</span>
                <Badge variant="outline" className="font-mono">23.1%</Badge>
              </div>
              <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
                <span className="text-sm font-medium text-muted-foreground">Taxa de Downgrade</span>
                <Badge variant="outline" className="font-mono">4.2%</Badge>
              </div>
              <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
                <span className="text-sm font-medium text-muted-foreground">Taxa de Churn</span>
                <Badge variant="destructive" className="font-mono bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20">5.2%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}