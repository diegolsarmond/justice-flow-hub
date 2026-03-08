import { getApiUrl } from "@/lib/api";
import { fetchFlows, type Flow } from "@/lib/flows";
import {
  evaluateCompanySubscription,
  type CompanySubscriptionSource,
} from "@/lib/companySubscription";
import type { Intimacao } from "@/services/intimacoes";

const JSON_HEADERS: HeadersInit = { Accept: "application/json" };

interface ApiProcesso {
  status?: unknown;
  tipo?: unknown;
  classe_judicial?: unknown;
  assunto?: unknown;
  data_distribuicao?: unknown;
  criado_em?: unknown;
}

interface ApiCliente {
  ativo?: unknown;
  status?: unknown;
  situacao?: unknown;
  situacao_cliente?: unknown;
  datacadastro?: unknown;
}

interface ApiOportunidade {
  status_id?: unknown;
}

interface ApiSituacaoProposta {
  id?: unknown;
  nome?: unknown;
}

interface ApiEmpresa extends CompanySubscriptionSource {
  id?: unknown;
  nome_empresa?: unknown;
  plano?: unknown;
  responsavel?: unknown;
  ativo?: unknown;
  datacadastro?: unknown;
  atualizacao?: unknown;
}

interface ApiPlano {
  id?: unknown;
  nome?: unknown;
  valor?: unknown;
  valor_mensal?: unknown;
}

interface ApiTarefa {
  data?: unknown;
  hora?: unknown;
  dia_inteiro?: unknown;
  concluido?: unknown;
}

interface ApiAgenda {
  data?: unknown;
  hora_inicio?: unknown;
  status?: unknown;
}

interface ApiNotification {
  id?: unknown;
  title?: unknown;
  message?: unknown;
  category?: unknown;
  type?: unknown;
  createdAt?: unknown;
  metadata?: unknown;
}

export interface ProcessCardMetric {
  id: string;
  label: string;
  value: number;
  helperText?: string | null;
  valueType?: "number" | "percentage";
  variation?: number | null;
  variationLabel?: string | null;
  variationType?: "positive" | "negative" | "neutral";
}

export interface ProcessClassificationMetric {
  id: string;
  label: string;
  count: number;
  percentage: number;
}

const DEFAULT_PROCESS_CLASSIFICATIONS: Array<{ id: string; label: string }> = [
  { id: "arquivamento", label: "Arquivamento/Baixa" },
  { id: "suspensao", label: "Suspensão/Sobrestamento" },
  { id: "recurso", label: "Recurso" },
  { id: "outros", label: "Outros movimentos" },
];

export interface ProcessPoloMetric {
  category: string;
  processCount: number;
  totalValue: number;
}

export interface DashboardDistributions {
  byStatus: DistributionSlice[];
  byBranch: DistributionSlice[];
  bySegment: DistributionSlice[];
  byInstance: DistributionSlice[];
  byYear: DistributionSlice[];
  byCourt: DistributionSlice[];
  byClaimValue: DistributionSlice[];
  bySentenceOutcome: DistributionSlice[];
  [key: string]: DistributionSlice[];
}

export interface RankingEntry {
  label: string;
  value: number;
  percentage: number;
  rawValue?: number;
}

export interface DashboardRankings {
  byStatus: RankingEntry[];
  byBranch: RankingEntry[];
  bySegment: RankingEntry[];
  byInstance: RankingEntry[];
  byState: RankingEntry[];
  bySubject: RankingEntry[];
  byClass: RankingEntry[];
  [key: string]: RankingEntry[];
}

export interface AverageTimeMetric {
  id: string;
  label: string;
  valueInDays: number;
  formattedValue: string;
}

export interface TimeHistogramBucket {
  label: string;
  count: number;
  percentage: number;
}

export interface TimeHistogram {
  id: string;
  label: string;
  buckets: TimeHistogramBucket[];
}

const EMPTY_DASHBOARD_ANALYTICS: DashboardAnalytics = {
  processMetrics: {
    total: 0,
    classifications: DEFAULT_PROCESS_CLASSIFICATIONS.map(({ id, label }) => ({
      id,
      label,
      count: 0,
      percentage: 0,
    })),
  },
  clientMetrics: { total: 0, active: 0, prospects: 0 },
  kpis: { conversionRate: 0, monthlyGrowth: 0 },
  monthlySeries: [],
  areaDistribution: [],
  opportunityStatusMetrics: [],
  processCards: [],
  processPoloMetrics: [],
  distributions: {
    byStatus: [],
    byBranch: [],
    bySegment: [],
    byInstance: [],
    byYear: [],
    byCourt: [],
    byClaimValue: [],
    bySentenceOutcome: [],
  },
  rankings: {
    byStatus: [],
    byBranch: [],
    bySegment: [],
    byInstance: [],
    byState: [],
    bySubject: [],
    byClass: [],
  },
  averageTimes: [],
  timeHistograms: [],
};

export interface DashboardAnalytics {
  processMetrics: {
    total: number;
    classifications: ProcessClassificationMetric[];
  };
  clientMetrics: {
    total: number;
    active: number;
    prospects: number;
  };
  kpis: {
    conversionRate: number;
    monthlyGrowth: number;
  };
  monthlySeries: MonthlySeriesPoint[];
  areaDistribution: DistributionSlice[];
  opportunityStatusMetrics: OpportunityStatusMetric[];
  processCards: ProcessCardMetric[];
  processPoloMetrics: ProcessPoloMetric[];
  distributions: DashboardDistributions;
  rankings: DashboardRankings;
  averageTimes: AverageTimeMetric[];
  timeHistograms: TimeHistogram[];
}

export interface ReportsAnalytics {
  overview: DashboardAnalytics;
  financialSeries: FinancialSeriesPoint[];
  cohort: CohortPoint[];
  funnel: FunnelStage[];
  financialSummary: {
    totalRevenue: number;
    totalExpenses: number;
    balance: number;
    revenueGrowth: number;
  };
  intimationSummary: {
    total: number;
    unread: number;
    active: number;
    upcoming: number;
  };
  taskSummary: {
    total: number;
    pending: number;
    overdue: number;
    completed: number;
  };
  agendaSummary: {
    total: number;
    upcoming: number;
    ongoing: number;
    concluded: number;
    cancelled: number;
  };
}

export interface AdminDashboardAnalytics {
  metrics: AdminMetrics;
  monthlySeries: AdminMonthlyPoint[];
  planDistribution: DistributionSlice[];
  revenueByPlan: RevenueByPlanSlice[];
}

export interface AdminAnalyticsOverview {
  dashboard: AdminDashboardAnalytics;
  revenueByPlan: RevenueByPlanSlice[];
  cohort: CohortPoint[];
  funnel: FunnelStage[];
  retention: {
    gross: number;
    net: number;
    logo: number;
  };
  revenueMetrics: {
    currentArpu: number;
    previousArpu: number;
    revenueGrowthRate: number;
    expansionRevenue: number;
    contractionRevenue: number;
  };
  customerMetrics: {
    cac: number;
    ltv: number;
    paybackPeriodMonths: number;
    trialConversion: number;
  };
}

export interface LogEvent {
  id: string;
  level: "info" | "warn" | "error";
  timestamp: string;
  message: string;
  source: string;
  metadata?: Record<string, unknown>;
  request?: {
    method?: string;
    uri?: string;
    status?: number;
    durationMs?: number;
    clientIp?: string;
    protocol?: string;
    host?: string;
    userAgent?: string;
  };
}

export interface MonthlySeriesPoint {
  key: string;
  month: string;
  processos: number;
  encerrados: number;
  clientes: number;
  clientesNovos: number;
  extraMetrics?: Record<string, number>;
}

export interface FinancialSeriesPoint {
  key: string;
  month: string;
  receita: number;
  despesas: number;
  extraMetrics?: Record<string, number>;
}

export interface CohortPoint {
  key: string;
  month: string;
  retained: number;
  churned: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
  conversion: number;
}

export interface RevenueByPlanSlice {
  id: string;
  name: string;
  revenue: number;
  customers: number;
}

export interface DistributionSlice {
  name: string;
  value: number;
  rawValue?: number;
}

export interface OpportunityStatusMetric {
  status: string;
  count: number;
}

export interface AdminMetrics {
  mrr: number;
  arr: number;
  churnRate: number;
  conversionRate: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  totalCompanies: number;
  monthlyGrowth: number;
}

export interface AdminMonthlyPoint {
  key: string;
  month: string;
  mrr: number;
  arr: number;
  churn: number;
  customers: number;
}

type UnknownRecord = Record<string, unknown>;

interface ApiDashboardAnalyticsPayload extends UnknownRecord {
  processMetrics?: UnknownRecord;
  process_metrics?: UnknownRecord;
  process?: UnknownRecord;
  clientMetrics?: UnknownRecord;
  client_metrics?: UnknownRecord;
  client?: UnknownRecord;
  metrics?: UnknownRecord;
  summary?: UnknownRecord;
  kpis?: UnknownRecord;
  kpi?: UnknownRecord;
  indicators?: UnknownRecord;
  monthlySeries?: unknown;
  monthly_series?: unknown;
  series?: unknown;
  areaDistribution?: unknown;
  area_distribution?: unknown;
  opportunityStatusMetrics?: unknown;
  opportunity_status_metrics?: unknown;
  opportunityMetrics?: unknown;
  processCards?: unknown;
  process_cards?: unknown;
  cards?: unknown;
  cardMetrics?: unknown;
  distributions?: unknown;
  rankings?: unknown;
  averageTimes?: unknown;
  average_times?: unknown;
  averages?: unknown;
  dashboard?: unknown;
  data?: unknown;
}

const CLOSED_STATUS_KEYWORDS = [
  "encerrado",
  "concluido",
  "concluído",
  "finalizado",
  "arquivado",
  "baixado",
  "baixa",
];

const POSITIVE_FLAGS = new Set([
  "true",
  "1",
  "sim",
  "s",
  "yes",
  "y",
  "ativo",
  "ativa",
  "habilitado",
  "habilitada",
]);

const NEGATIVE_FLAGS = new Set([
  "false",
  "0",
  "nao",
  "n",
  "não",
  "no",
  "inativo",
  "inativa",
  "desativado",
  "desativada",
  "desabilitado",
  "desabilitada",
]);

const LEVEL_MAP: Record<string, LogEvent["level"]> = {
  info: "info",
  success: "info",
  warning: "warn",
  warn: "warn",
  error: "error",
  danger: "error",
};

const MONTHS_WINDOW = 6;

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
});

const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "2-digit",
});

function normalizeString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (value != null && typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function normalizeDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }

    const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      const formatted = `${year}-${month}-${day}`;
      const date = new Date(formatted);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  return null;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.replace(/[\sR$]/g, "");
    if (!trimmed) {
      return null;
    }

    const normalized = Number.parseFloat(trimmed.replace(",", "."));
    return Number.isFinite(normalized) ? normalized : null;
  }

  return null;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 0 ? false : true;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (POSITIVE_FLAGS.has(normalized)) {
      return true;
    }

    if (NEGATIVE_FLAGS.has(normalized)) {
      return false;
    }
  }

  return null;
}

function normalizeStatus(value: unknown): string | null {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  return normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isConcludedStatus(status: unknown): boolean {
  const normalized = normalizeStatus(status);
  if (!normalized) {
    return false;
  }

  return CLOSED_STATUS_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isClienteAtivo(cliente: ApiCliente): boolean {
  const ativoFlag = normalizeBoolean(cliente.ativo);
  if (ativoFlag !== null) {
    return ativoFlag;
  }

  const candidates = [cliente.status, cliente.situacao, cliente.situacao_cliente];
  for (const candidate of candidates) {
    const normalized = normalizeStatus(candidate);
    if (!normalized) {
      continue;
    }

    if (normalized.includes("prospec")) {
      return false;
    }

    if (normalized.includes("inativ") || normalized.includes("desativ")) {
      return false;
    }

    if (normalized.startsWith("ativo")) {
      return true;
    }
  }

  return false;
}

function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthKey(key: string, includeYear = false): string {
  const [year, month] = key.split("-");
  if (!year || !month) {
    return key;
  }

  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) {
    return key;
  }

  const label = includeYear
    ? monthLabelFormatter.format(date)
    : monthFormatter.format(date);

  // Remover ponto final comum em abreviações (ex.: "jan.")
  const sanitized = label.replace(/\.$/, "");
  return sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
}

function buildMonthSequence(limit: number, referenceDate = new Date()): string[] {
  const months: string[] = [];
  const base = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);

  for (let index = limit - 1; index >= 0; index -= 1) {
    const current = new Date(base);
    current.setMonth(base.getMonth() - index);
    months.push(getMonthKey(current));
  }

  return months;
}

function collectMonthKeys(maps: Array<Map<string, unknown>>, limit: number): string[] {
  const keys = new Set<string>();
  maps.forEach((map) => {
    map.forEach((_value, key) => {
      keys.add(key);
    });
  });

  if (keys.size === 0) {
    return buildMonthSequence(limit);
  }

  return Array.from(keys)
    .sort()
    .slice(-limit);
}

function ensureArray<T>(payload: unknown): T[] {
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

      const nestedData = (data as { data?: unknown }).data;
      if (Array.isArray(nestedData)) {
        return nestedData as T[];
      }

      if (nestedData && typeof nestedData === "object") {
        const innerRows = (nestedData as { rows?: unknown }).rows;
        if (Array.isArray(innerRows)) {
          return innerRows as T[];
        }
      }
    }
  }

  return [];
}

async function fetchCollection<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const response = await fetch(getApiUrl(path), {
    headers: JSON_HEADERS,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar '${path}' (HTTP ${response.status}).`);
  }

  try {
    const data = await response.json();
    return ensureArray<T>(data);
  } catch (error) {
    throw new Error(`Resposta inválida do endpoint '${path}'.`);
  }
}

function getPlanMonthlyValue(plan: ApiPlano): number {
  const directValue = normalizeNumber(plan.valor);
  if (directValue !== null) {
    return directValue;
  }

  const monthly = normalizeNumber(plan.valor_mensal);
  return monthly ?? 0;
}

function getPlanName(plan: ApiPlano | undefined, planId: string | null): string {
  if (plan && typeof plan.nome === "string" && plan.nome.trim()) {
    return plan.nome.trim();
  }

  if (planId) {
    return `Plano ${planId}`;
  }

  return "Sem plano";
}

function sum(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
}

function calculatePercentage(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return Number(((part / total) * 100).toFixed(1));
}

function buildDistribution(map: Map<string, number>): DistributionSlice[] {
  const total = sum(map.values());
  if (total === 0) {
    return [];
  }

  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      value: calculatePercentage(count, total),
      rawValue: count,
    }));
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function formatLabel(value: unknown, fallback = "Não informado"): string {
  const normalized = normalizeString(value);
  if (!normalized) {
    return fallback;
  }

  const trimmed = normalized.trim();
  if (!trimmed) {
    return fallback;
  }

  const normalizedLower = trimmed.toLocaleLowerCase("pt-BR");
  return normalizedLower
    .split(/\s+/)
    .map((word) =>
      word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1),
    )
    .join(" ");
}

function incrementDistribution(
  map: Map<string, number>,
  value: unknown,
  fallback?: string,
): void {
  const label = formatLabel(value, fallback ?? "Não informado");
  map.set(label, (map.get(label) ?? 0) + 1);
}

function buildRankingFromMap(map: Map<string, number>, limit = 5): RankingEntry[] {
  const total = sum(map.values());
  if (total === 0) {
    return [];
  }

  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({
      label,
      value: count,
      percentage: calculatePercentage(count, total),
      rawValue: count,
    }));
}

function calculateAverage(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((accumulator, value) => accumulator + value, 0);
  return Number((total / values.length).toFixed(1));
}

function formatDurationInDays(days: number): string {
  if (!Number.isFinite(days) || days <= 0) {
    return "—";
  }

  if (days < 1) {
    const hours = Math.round(days * 24);
    return `${Math.max(hours, 1)} h`;
  }

  return `${days.toFixed(days >= 10 ? 0 : 1)} dias`;
}

function buildAverageTimeMetrics(metrics: {
  distribution: number[];
  active: number[];
  concluded: number[];
}): AverageTimeMetric[] {
  const distributionAverage = calculateAverage(metrics.distribution);
  const activeAverage = calculateAverage(metrics.active);
  const concludedAverage = calculateAverage(metrics.concluded);

  return [
    {
      id: "distribution",
      label: "Tempo até distribuição",
      valueInDays: distributionAverage,
      formattedValue: formatDurationInDays(distributionAverage),
    },
    {
      id: "active",
      label: "Tempo médio em andamento",
      valueInDays: activeAverage,
      formattedValue: formatDurationInDays(activeAverage),
    },
    {
      id: "conclusion",
      label: "Tempo médio até conclusão",
      valueInDays: concludedAverage,
      formattedValue: formatDurationInDays(concludedAverage),
    },
  ];
}

function buildProcessCards(metrics: {
  total: number;
  classifications: ProcessClassificationMetric[];
  monthlyGrowth: number;
}): ProcessCardMetric[] {
  const growthType: ProcessCardMetric["variationType"] =
    metrics.monthlyGrowth > 0
      ? "positive"
      : metrics.monthlyGrowth < 0
        ? "negative"
        : "neutral";

  const baseCards: ProcessCardMetric[] = [
    {
      id: "total",
      label: "Processos encontrados",
      value: metrics.total,
      helperText: "Total identificados na base",
    },
  ];

  const classificationCards = metrics.classifications.map<ProcessCardMetric>((classification) => ({
    id: classification.id,
    label: classification.label,
    value: classification.count,
    helperText: `${classification.percentage.toFixed(1)}% do total`,
  }));

  const growthCard: ProcessCardMetric = {
    id: "monthlyGrowth",
    label: "Variação mensal",
    value: metrics.monthlyGrowth,
    helperText: "Comparativo com o mês anterior",
    variation: metrics.monthlyGrowth,
    variationLabel: "vs mês anterior",
    variationType: growthType,
    valueType: "percentage",
  };

  return [...baseCards, ...classificationCards, growthCard];
}

function buildRevenueByPlan(
  map: Map<string, { name: string; revenue: number; customers: number }>,
): RevenueByPlanSlice[] {
  return Array.from(map.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      revenue: Number(data.revenue.toFixed(2)),
      customers: data.customers,
    }))
    .filter((slice) => slice.revenue > 0 || slice.customers > 0)
    .sort((a, b) => b.revenue - a.revenue);
}

function buildCohortFromCounts(
  months: string[],
  newCounts: Map<string, number>,
  activeCounts: Map<string, number>,
): CohortPoint[] {
  return months.map((key) => {
    const created = newCounts.get(key) ?? 0;
    const active = activeCounts.get(key) ?? 0;
    const retained = created > 0 ? calculatePercentage(active, created) : 0;
    return {
      key,
      month: formatMonthKey(key),
      retained,
      churned: Number((100 - retained).toFixed(1)),
    };
  });
}

function buildFunnelStages(stages: Array<{ stage: string; count: number }>): FunnelStage[] {
  const first = stages[0]?.count ?? 0;
  return stages.map(({ stage, count }) => ({
    stage,
    count,
    conversion: first > 0 ? Number(((count / first) * 100).toFixed(1)) : 0,
  }));
}

function buildMonthlySeries(
  months: string[],
  processCounts: Map<string, { total: number; concluded: number }>,
  clientNewCounts: Map<string, number>,
  clientCumulative: Map<string, number>,
): MonthlySeriesPoint[] {
  return months.map((key) => ({
    key,
    month: formatMonthKey(key),
    processos: processCounts.get(key)?.total ?? 0,
    encerrados: processCounts.get(key)?.concluded ?? 0,
    clientes: clientCumulative.get(key) ?? 0,
    clientesNovos: clientNewCounts.get(key) ?? 0,
  }));
}

function buildFinancialSeries(months: string[], revenue: Map<string, number>, expenses: Map<string, number>): FinancialSeriesPoint[] {
  return months.map((key) => ({
    key,
    month: formatMonthKey(key),
    receita: revenue.get(key) ?? 0,
    despesas: expenses.get(key) ?? 0,
  }));
}

function parseDateWithTime(
  dateValue: unknown,
  timeValue: unknown,
  allDayValue: unknown,
): Date | null {
  const date = normalizeDate(dateValue);
  if (!date) {
    return null;
  }

  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const allDay = normalizeBoolean(allDayValue);
  const time = typeof timeValue === "string" ? timeValue.trim() : null;

  if (time && allDay !== true) {
    const match = time.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      const [, hours, minutes] = match;
      result.setHours(Number(hours), Number(minutes));
      return result;
    }
  }

  return result;
}

const UPCOMING_WINDOW_DAYS = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function buildIntimationSummary(intimacoes: Intimacao[]): ReportsAnalytics["intimationSummary"] {
  const now = Date.now();
  const upcomingThreshold = now + UPCOMING_WINDOW_DAYS * DAY_IN_MS;

  let total = 0;
  let unread = 0;
  let active = 0;
  let upcoming = 0;

  intimacoes.forEach((intimacao) => {
    total += 1;

    const isArchived = normalizeBoolean(intimacao.arquivada) === true;
    if (!isArchived) {
      active += 1;
    }

    if (normalizeBoolean(intimacao.nao_lida) !== false) {
      unread += 1;
    }

    if (isArchived) {
      return;
    }

    const prazo = normalizeDate(intimacao.prazo) ?? normalizeDate(intimacao.data_disponibilizacao);
    if (!prazo) {
      return;
    }

    const time = prazo.getTime();
    if (time >= now && time <= upcomingThreshold) {
      upcoming += 1;
    }
  });

  return {
    total,
    unread,
    active,
    upcoming,
  };
}

function buildTaskSummary(tarefas: ApiTarefa[]): ReportsAnalytics["taskSummary"] {
  const now = Date.now();

  let total = 0;
  let pending = 0;
  let overdue = 0;
  let completed = 0;

  tarefas.forEach((tarefa) => {
    total += 1;

    const isCompleted = normalizeBoolean(tarefa.concluido) === true;
    if (isCompleted) {
      completed += 1;
      return;
    }

    const dueDate = parseDateWithTime(tarefa.data, tarefa.hora, tarefa.dia_inteiro);
    if (dueDate && dueDate.getTime() < now) {
      overdue += 1;
      return;
    }

    pending += 1;
  });

  return {
    total,
    pending,
    overdue,
    completed,
  };
}

function mapAgendaStatus(value: unknown): "agendado" | "em_curso" | "concluido" | "cancelado" {
  const numeric = normalizeNumber(value);
  if (numeric !== null) {
    const normalized = Math.trunc(numeric);
    if (normalized === 0) {
      return "cancelado";
    }
    if (normalized === 1) {
      return "agendado";
    }
    if (normalized === 2) {
      return "em_curso";
    }
    if (normalized === 3) {
      return "concluido";
    }
  }

  const text = normalizeString(value);
  if (text) {
    const normalized = text.toLowerCase();
    if (normalized.includes("cancel")) {
      return "cancelado";
    }
    if (normalized.includes("concl")) {
      return "concluido";
    }
    if (normalized.includes("curso") || normalized.includes("andament")) {
      return "em_curso";
    }
  }

  return "agendado";
}

function buildAgendaSummary(agendas: ApiAgenda[]): ReportsAnalytics["agendaSummary"] {
  const now = Date.now();

  let total = 0;
  let upcoming = 0;
  let ongoing = 0;
  let concluded = 0;
  let cancelled = 0;

  agendas.forEach((agenda) => {
    total += 1;
    const status = mapAgendaStatus(agenda.status);

    if (status === "cancelado") {
      cancelled += 1;
      return;
    }

    if (status === "concluido") {
      concluded += 1;
      return;
    }

    if (status === "em_curso") {
      ongoing += 1;
      return;
    }

    const start = parseDateWithTime(agenda.data, agenda.hora_inicio, false);
    if (start && start.getTime() < now) {
      ongoing += 1;
    } else {
      upcoming += 1;
    }
  });

  return {
    total,
    upcoming,
    ongoing,
    concluded,
    cancelled,
  };
}

function buildAdminMonthlySeries(
  months: string[],
  revenue: Map<string, number>,
  churnRate: Map<string, number>,
  customers: Map<string, number>,
): AdminMonthlyPoint[] {
  return months.map((key) => {
    const mrr = revenue.get(key) ?? 0;
    return {
      key,
      month: formatMonthKey(key, true),
      mrr,
      arr: Number((mrr * 12).toFixed(2)),
      churn: churnRate.get(key) ?? 0,
      customers: customers.get(key) ?? 0,
    };
  });
}

function computeGrowth(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return 0;
  }

  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

const DASHBOARD_ANALYTICS_ENDPOINT_CANDIDATES = [
  "analytics/dashboard",
  "dashboard/analytics",
  "dashboard",
];

function asRecord(value: unknown): UnknownRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as UnknownRecord;
  }

  return null;
}

function extractByPath(source: unknown, path: string[]): unknown {
  let current = source;

  for (const key of path) {
    const record = asRecord(current);
    if (!record) {
      return undefined;
    }

    current = record[key];
  }

  return current;
}

const DASHBOARD_PAYLOAD_PATHS: string[][] = [
  ["dashboard"],
  ["data", "dashboard"],
  ["analytics", "dashboard"],
  ["result", "dashboard"],
  ["payload", "dashboard"],
  ["response", "data", "dashboard"],
  ["data"],
  ["analytics"],
  ["result"],
  ["payload"],
  ["response", "data"],
  [],
];

function extractDashboardAnalyticsPayload(payload: unknown): ApiDashboardAnalyticsPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  for (const path of DASHBOARD_PAYLOAD_PATHS) {
    const candidate = path.length > 0 ? extractByPath(payload, path) : payload;
    const record = asRecord(candidate);
    if (!record) {
      continue;
    }

    const nested = asRecord(record.dashboard);
    if (nested) {
      return nested as ApiDashboardAnalyticsPayload;
    }

    return record as ApiDashboardAnalyticsPayload;
  }

  return null;
}

function extractSection(payload: ApiDashboardAnalyticsPayload, keys: string[]): UnknownRecord | null {
  const sources: Array<UnknownRecord | null> = [
    payload,
    asRecord(payload.metrics),
    asRecord(payload.summary),
    asRecord(payload.data),
  ];

  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const key of keys) {
      const section = asRecord(source[key]);
      if (section) {
        return section;
      }
    }
  }

  return null;
}

function normalizeVariationType(
  value: string | null | undefined,
  variation: number | null | undefined,
): ProcessCardMetric["variationType"] | undefined {
  const normalized = value?.toLowerCase();

  if (normalized === "positive" || normalized === "negative" || normalized === "neutral") {
    return normalized;
  }

  if (variation == null) {
    return undefined;
  }

  if (variation > 0) {
    return "positive";
  }

  if (variation < 0) {
    return "negative";
  }

  return "neutral";
}

const MONTHLY_SERIES_IGNORED_FIELDS = new Set([
  "key",
  "month",
  "mes",
  "ano",
  "year",
  "label",
  "processos",
  "processes",
  "total_processos",
  "process_count",
  "encerrados",
  "concluidos",
  "finalizados",
  "closed",
  "clientes",
  "customers",
  "client_count",
  "total_clientes",
  "accounts",
  "clientesNovos",
  "clientes_novos",
  "novosClientes",
  "newCustomers",
  "new_customers",
  "prospects",
  "ativos",
  "active",
  "ativos_count",
  "active_customers",
]);

function mapDistributionSlicesFromPayload(payload: unknown): DistributionSlice[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }

      const nameCandidate =
        normalizeString(
          record.name ??
            record.label ??
            record.title ??
            record.key ??
            record.id ??
            record.status ??
            record.segment ??
            record.instance ??
            record.area,
        ) ?? null;

      const name =
        nameCandidate ??
        formatLabel(
          record.name ??
            record.label ??
            record.title ??
            record.key ??
            record.id ??
            record.status ??
            record.area,
        );

      const percentageCandidate = normalizeNumber(
        record.percentage ??
          record.percent ??
          record.share ??
          record.rate ??
          record.value ??
          record.participation ??
          record.representatividade,
      );

      const rawCandidate = normalizeNumber(
        record.count ??
          record.total ??
          record.quantity ??
          record.amount ??
          record.raw ??
          record.absolute ??
          record.numero ??
          record.ocorrencias,
      );

      const slice: DistributionSlice = {
        name,
        value: percentageCandidate ?? rawCandidate ?? 0,
      };

      if (rawCandidate !== null) {
        slice.rawValue = rawCandidate;
      }

      return slice;
    })
    .filter((slice): slice is DistributionSlice => Boolean(slice));
}

function mapDashboardDistributions(payload: unknown): DashboardDistributions {
  const result: DashboardDistributions = {
    byStatus: [],
    byBranch: [],
    bySegment: [],
    byInstance: [],
    byYear: [],
    byCourt: [],
    byClaimValue: [],
    bySentenceOutcome: [],
  };

  const record = asRecord(payload);
  if (!record) {
    return result;
  }

  Object.entries(record).forEach(([key, value]) => {
    result[key] = mapDistributionSlicesFromPayload(value);
  });

  result.byStatus = result.byStatus ?? [];
  result.byBranch = result.byBranch ?? [];
  result.bySegment = result.bySegment ?? [];
  result.byInstance = result.byInstance ?? [];
  result.byYear = result.byYear ?? [];
  result.byCourt = result.byCourt ?? [];
  result.byClaimValue = result.byClaimValue ?? [];
  result.bySentenceOutcome = result.bySentenceOutcome ?? [];

  return result;
}

function mapRankingEntriesFromPayload(payload: unknown): RankingEntry[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }

      const label =
        normalizeString(record.label ?? record.name ?? record.title ?? record.key ?? record.id ?? record.status) ??
        formatLabel(record.label ?? record.name ?? record.title ?? record.key ?? record.id ?? record.status);

      const rawCandidate = normalizeNumber(
        record.count ?? record.total ?? record.quantity ?? record.amount ?? record.raw ?? record.value,
      );

      const percentageCandidate = normalizeNumber(
        record.percentage ?? record.percent ?? record.share ?? record.rate ?? record.representatividade,
      );

      const value = rawCandidate ?? percentageCandidate ?? 0;
      const percentage = percentageCandidate ?? (rawCandidate ?? 0);

      const ranking: RankingEntry = {
        label,
        value,
        percentage,
      };

      if (rawCandidate !== null) {
        ranking.rawValue = rawCandidate;
      }

      return ranking;
    })
    .filter((entry): entry is RankingEntry => Boolean(entry));
}

function mapDashboardRankings(payload: unknown): DashboardRankings {
  const result: DashboardRankings = {
    byStatus: [],
    byBranch: [],
    bySegment: [],
    byInstance: [],
    byState: [],
    bySubject: [],
    byClass: [],
  };

  const record = asRecord(payload);
  if (!record) {
    return result;
  }

  Object.entries(record).forEach(([key, value]) => {
    result[key] = mapRankingEntriesFromPayload(value);
  });

  result.byStatus = result.byStatus ?? [];
  result.byBranch = result.byBranch ?? [];
  result.bySegment = result.bySegment ?? [];
  result.byInstance = result.byInstance ?? [];
  result.byState = result.byState ?? [];
  result.bySubject = result.bySubject ?? [];
  result.byClass = result.byClass ?? [];

  return result;
}

function mapAverageTimesFromPayload(payload: unknown): AverageTimeMetric[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }

      const idCandidate = normalizeString(record.id ?? record.key ?? record.metric ?? record.identifier) ?? null;
      const label =
        normalizeString(record.label ?? record.name ?? record.title) ??
        (idCandidate ? formatLabel(idCandidate) : "Indicador");
      const valueInDays =
        normalizeNumber(
          record.valueInDays ??
            record.value_in_days ??
            record.days ??
            record.value ??
            record.duration ??
            record.average ??
            record.medio,
        ) ?? 0;
      const formattedValue =
        normalizeString(record.formattedValue ?? record.formatted_value ?? record.display ?? record.texto) ??
        formatDurationInDays(valueInDays);

      return {
        id:
          idCandidate ??
          (label
            .toLowerCase()
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/(^-|-$)/g, "") ||
            "metric"),
        label,
        valueInDays,
        formattedValue,
      };
    })
    .filter((metric): metric is AverageTimeMetric => Boolean(metric));
}

function mapTimeHistogramBucketsFromPayload(payload: unknown): TimeHistogramBucket[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }

      const label = formatLabel(
        record.label ?? record.name ?? record.title ?? record.bucket ?? record.range ?? record.faixa,
      );

      const count =
        normalizeNumber(
          record.count ??
            record.total ??
            record.quantity ??
            record.value ??
            record.processes ??
            record.qtd ??
            record.amount,
        ) ?? 0;

      const percentage =
        normalizeNumber(
          record.percentage ??
            record.percent ??
            record.rate ??
            record.share ??
            record.representatividade ??
            record.participacao,
        ) ?? 0;

      return {
        label,
        count,
        percentage,
      } satisfies TimeHistogramBucket;
    })
    .filter((bucket): bucket is TimeHistogramBucket => Boolean(bucket));
}

function mapTimeHistogramsFromPayload(payload: unknown): TimeHistogram[] {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => {
        const record = asRecord(entry);
        if (!record) {
          return null;
        }

        const idCandidate =
          normalizeString(record.id ?? record.key ?? record.identifier ?? record.metric ?? record.type) ?? null;
        const labelCandidate =
          normalizeString(record.label ?? record.name ?? record.title) ??
          (idCandidate ? formatLabel(idCandidate) : null);
        const buckets = mapTimeHistogramBucketsFromPayload(
          record.buckets ?? record.values ?? record.data ?? record.histogram,
        );

        if (buckets.length === 0) {
          return null;
        }

        const label = labelCandidate ?? 'Indicador de tempo';
        const id =
          idCandidate ??
          (
            label
              .toLowerCase()
              .replace(/[^a-z0-9]+/gi, '-')
              .replace(/(^-|-$)/g, '') ||
            'time-indicator'
          );

        return {
          id,
          label,
          buckets,
        } satisfies TimeHistogram;
      })
      .filter((entry): entry is TimeHistogram => Boolean(entry));
  }

  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  return Object.entries(record)
    .map(([key, value]) => {
      const entryRecord = asRecord(value);
      const buckets = mapTimeHistogramBucketsFromPayload(
        entryRecord?.buckets ?? entryRecord?.values ?? entryRecord?.data ?? entryRecord?.histogram ?? value,
      );

      if (buckets.length === 0) {
        return null;
      }

      const id = normalizeString(key) ?? key;
      const label =
        normalizeString(entryRecord?.label ?? entryRecord?.name ?? entryRecord?.title) ?? formatLabel(key, 'Indicador');

      return {
        id,
        label,
        buckets,
      } satisfies TimeHistogram;
    })
    .filter((entry): entry is TimeHistogram => Boolean(entry));
}

function mapMonthlySeriesFromPayload(payload: unknown): MonthlySeriesPoint[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }

      const keyCandidate = normalizeString(record.key ?? record.codigo ?? record.identifier);
      const year = normalizeNumber(record.year ?? record.ano);
      const monthIndex = normalizeNumber(record.month ?? record.mes);
      const computedKey =
        keyCandidate ??
        (year !== null && monthIndex !== null
          ? `${year}-${String(Math.max(1, Math.min(12, Math.trunc(monthIndex)))).padStart(2, "0")}`
          : null);

      const monthLabel =
        normalizeString(record.monthLabel ?? record.month ?? record.label ?? record.nome ?? record.nome_mes) ??
        (computedKey ? formatMonthKey(computedKey) : "");

      const processos =
        normalizeNumber(
          record.processos ?? record.processes ?? record.total_processos ?? record.process_count ?? record.process,
        ) ?? 0;

      const encerrados =
        normalizeNumber(
          record.encerrados ?? record.concluidos ?? record.finalizados ?? record.closed ?? record.closed_processes,
        ) ?? 0;

      const clientes =
        normalizeNumber(
          record.clientes ?? record.customers ?? record.total_clientes ?? record.client_count ?? record.accounts,
        ) ?? 0;

      const clientesNovos =
        normalizeNumber(
          record.clientesNovos ??
            record.clientes_novos ??
            record.novosClientes ??
            record.newCustomers ??
            record.new_customers ??
            record.prospects,
        ) ?? 0;

      const extraMetrics: Record<string, number> = {};

      Object.entries(record).forEach(([field, value]) => {
        const normalizedField = field.toLowerCase();
        if (
          MONTHLY_SERIES_IGNORED_FIELDS.has(field) ||
          MONTHLY_SERIES_IGNORED_FIELDS.has(normalizedField) ||
          field === "monthLabel"
        ) {
          return;
        }

        const normalized = normalizeNumber(value);
        if (normalized !== null) {
          extraMetrics[field] = normalized;
        }
      });

      const point: MonthlySeriesPoint = {
        key: computedKey ?? monthLabel ?? "periodo",
        month: monthLabel || (computedKey ? formatMonthKey(computedKey) : ""),
        processos,
        encerrados,
        clientes,
        clientesNovos,
      };

      if (Object.keys(extraMetrics).length > 0) {
        point.extraMetrics = extraMetrics;
      }

      return point;
    })
    .filter((point): point is MonthlySeriesPoint => Boolean(point));
}

function mapOpportunityStatusMetricsFromPayload(payload: unknown): OpportunityStatusMetric[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }

      const status =
        normalizeString(record.status ?? record.label ?? record.name ?? record.title ?? record.key) ??
        formatLabel(record.status ?? record.label ?? record.name ?? record.title ?? record.key);
      const count =
        normalizeNumber(record.count ?? record.total ?? record.quantity ?? record.value ?? record.amount) ?? 0;

      return { status, count };
    })
    .filter((metric): metric is OpportunityStatusMetric => Boolean(metric));
}

function mapProcessPoloMetricsFromPayload(payload: unknown): ProcessPoloMetric[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }

      const category =
        normalizeString(
          record.category ?? record.polo ?? record.label ?? record.name ?? record.title ?? record.key,
        ) ?? "Outro";
      const processCount =
        normalizeNumber(
          record.processCount ??
            record.process_count ??
            record.count ??
            record.total ??
            record.quantidade ??
            record.qtd,
        ) ?? 0;
      const totalValue =
        normalizeNumber(
          record.totalValue ??
            record.total_value ??
            record.value ??
            record.amount ??
            record.sum ??
            record.totalAmount ??
            record.total_amount,
        ) ?? 0;

      return {
        category,
        processCount,
        totalValue,
      };
    })
    .filter((metric): metric is ProcessPoloMetric => Boolean(metric));
}

function collectProcessCardEntries(payload: ApiDashboardAnalyticsPayload): unknown[] {
  const direct = payload.processCards ?? payload.process_cards;
  if (Array.isArray(direct)) {
    return direct;
  }

  if (Array.isArray(payload.cards)) {
    return payload.cards as unknown[];
  }

  const cardsRecord =
    asRecord(payload.cards) ??
    extractSection(payload, ["cards", "cardMetrics", "processCards", "process_cards", "process"]);

  if (Array.isArray(cardsRecord)) {
    return cardsRecord as unknown[];
  }

  if (cardsRecord) {
    const candidateKeys = [
      "process",
      "processes",
      "dashboard",
      "metrics",
      "items",
      "cards",
      "values",
      "lista",
    ];

    for (const key of candidateKeys) {
      const value = (cardsRecord as UnknownRecord)[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
  }

  return [];
}

function mapProcessCardEntry(entry: unknown): ProcessCardMetric | null {
  const record = asRecord(entry);
  if (!record) {
    return null;
  }

  const idCandidate = normalizeString(
    record.id ?? record.key ?? record.metric ?? record.slug ?? record.identifier ?? record.type,
  );
  const label =
    normalizeString(record.label ?? record.title ?? record.name ?? record.metricName ?? record.descricao) ??
    (idCandidate ? formatLabel(idCandidate) : "Indicador");
  const value =
    normalizeNumber(
      record.value ?? record.total ?? record.amount ?? record.count ?? record.metricValue ?? record.quantidade,
    ) ?? 0;
  const helperText =
    normalizeString(record.helperText ?? record.helper_text ?? record.description ?? record.subtitle ?? record.context) ??
    null;
  const valueTypeCandidate = normalizeString(
    record.valueType ?? record.value_type ?? record.kind ?? record.metricType ?? record.tipo,
  );
  const valueType: ProcessCardMetric["valueType"] | undefined =
    valueTypeCandidate === "percentage"
      ? "percentage"
      : valueTypeCandidate === "number" || valueTypeCandidate === "numeric"
        ? "number"
        : undefined;
  const variation =
    normalizeNumber(
      record.variation ??
        record.delta ??
        record.change ??
        record.difference ??
        record.growth ??
        record.variation_value ??
        record.variacao,
    );
  const variationLabel =
    normalizeString(record.variationLabel ?? record.variation_label ?? record.period ?? record.reference) ?? null;
  const variationTypeString = normalizeString(
    record.variationType ?? record.variation_type ?? record.trend ?? record.direction ?? record.movimento,
  );

  const card: ProcessCardMetric = {
    id:
      idCandidate ??
      (label
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/(^-|-$)/g, "") ||
        "metric"),
    label,
    value,
  };

  if (helperText !== null) {
    card.helperText = helperText;
  }

  if (valueType) {
    card.valueType = valueType;
  }

  if (variation !== null) {
    card.variation = variation;
  }

  if (variationLabel !== null) {
    card.variationLabel = variationLabel;
  }

  const variationType = normalizeVariationType(variationTypeString, variation ?? null);
  if (variationType) {
    card.variationType = variationType;
  }

  return card;
}

function mapProcessCardsFromPayload(
  payload: ApiDashboardAnalyticsPayload,
  metrics: DashboardAnalytics["processMetrics"],
  monthlyGrowth: number,
  kpis: DashboardAnalytics["kpis"],
): ProcessCardMetric[] {
  const entries = collectProcessCardEntries(payload)
    .map(mapProcessCardEntry)
    .filter((card): card is ProcessCardMetric => Boolean(card));

  if (entries.length > 0) {
    return entries;
  }

  return buildProcessCards({
    total: metrics.total,
    classifications: metrics.classifications,
    monthlyGrowth: kpis.monthlyGrowth ?? monthlyGrowth,
  });
}

type ProcessMetricsResult = {
  metrics: DashboardAnalytics["processMetrics"];
  monthlyGrowth: number;
};

function mapProcessMetricsFromPayload(payload: ApiDashboardAnalyticsPayload): ProcessMetricsResult {
  const section = extractSection(payload, ["processMetrics", "process_metrics", "process"]) ?? {};
  const record = section as UnknownRecord;
  const total =
    normalizeNumber(
      record.total ??
        record.processos ??
        record.total_processos ??
        record.count ??
        record.total ??
        record.qtd ??
        record.quantidade,
    ) ?? 0;

  const classificationsSource =
    record.classifications ??
    record.classification ??
    record.breakdown ??
    record.categories ??
    record.status ??
    record.labels ??
    record.metricas ??
    null;

  const classificationMap = new Map<
    string,
    { label: string; count: number; percentage?: number }
  >();

  if (Array.isArray(classificationsSource)) {
    classificationsSource.forEach((item, index) => {
      if (!item) {
        return;
      }

      const entry = item as UnknownRecord;
      const labelCandidate =
        normalizeString(
          entry.label ??
            entry.nome ??
            entry.name ??
            entry.titulo ??
            entry.category ??
            entry.categoria ??
            entry.status ??
            entry.tipo,
        ) ?? `Categoria ${index + 1}`;
      const idCandidate =
        normalizeString(
          entry.id ??
            entry.identificador ??
            entry.slug ??
            entry.key ??
            entry.codigo ??
            entry.code ??
            entry.alias ??
            labelCandidate,
        ) ?? labelCandidate;
      const normalizedId = idCandidate
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const id = normalizedId || `categoria-${index + 1}`;
      const count = Math.max(
        normalizeNumber(
          entry.count ?? entry.total ?? entry.value ?? entry.quantidade ?? entry.qtd ?? entry.amount,
        ) ?? 0,
        0,
      );
      const percentageCandidate = normalizeNumber(
        entry.percentage ?? entry.percentual ?? entry.percent ?? entry.porcentagem,
      );

      const current = classificationMap.get(id);
      const aggregatedCount = (current?.count ?? 0) + count;
      const aggregatedLabel = current?.label ?? labelCandidate;
      const aggregatedPercentage = percentageCandidate ?? current?.percentage;

      classificationMap.set(id, {
        label: aggregatedLabel,
        count: aggregatedCount,
        percentage: aggregatedPercentage ?? undefined,
      });
    });
  }

  const derivedTotal = Array.from(classificationMap.values()).reduce((sum, entry) => sum + entry.count, 0);
  const baseTotal = total > 0 ? total : derivedTotal;

  const orderedClassifications = DEFAULT_PROCESS_CLASSIFICATIONS.map(({ id, label }) => {
    const entry = classificationMap.get(id);
    if (entry) {
      classificationMap.delete(id);
    }
    return {
      id,
      label: entry?.label ?? label,
      count: entry?.count ?? 0,
      percentage: entry?.percentage,
    };
  });

  const remainingClassifications = Array.from(classificationMap.entries()).map(([id, entry]) => ({
    id,
    label: entry.label,
    count: entry.count,
    percentage: entry.percentage,
  }));

  let classifications = [...orderedClassifications, ...remainingClassifications];
  if (classifications.length === 0) {
    classifications = DEFAULT_PROCESS_CLASSIFICATIONS.map(({ id, label }) => ({
      id,
      label,
      count: 0,
      percentage: 0,
    }));
  }

  const computedTotal = classifications.reduce((sum, entry) => sum + entry.count, 0);
  const finalTotal = computedTotal > 0 ? computedTotal : baseTotal;

  const normalizedClassifications = classifications.map((entry) => ({
    id: entry.id,
    label: entry.label,
    count: entry.count,
    percentage: entry.percentage ?? null,
  }));

  const classificationTotal = normalizedClassifications.reduce((sum, entry) => sum + entry.count, 0);
  const resolvedTotal = classificationTotal > 0 ? classificationTotal : finalTotal > 0 ? finalTotal : 0;

  const classificationsWithPercentages: ProcessClassificationMetric[] = normalizedClassifications.map((entry) => ({
    id: entry.id,
    label: entry.label,
    count: entry.count,
    percentage:
      entry.percentage != null
        ? entry.percentage
        : resolvedTotal > 0
          ? Number(((entry.count / resolvedTotal) * 100).toFixed(1))
          : 0,
  }));

  const monthlyGrowth =
    normalizeNumber(
      record.monthlyGrowth ??
        record.monthly_growth ??
        record.growth ??
        record.growthRate ??
        record.variation ??
        record.trend ??
        record.crescimento,
    ) ?? 0;

  return {
    metrics: {
      total: resolvedTotal,
      classifications: classificationsWithPercentages,
    },
    monthlyGrowth,
  };
}

type ClientMetricsResult = {
  metrics: DashboardAnalytics["clientMetrics"];
  conversionRate: number;
};

function mapClientMetricsFromPayload(payload: ApiDashboardAnalyticsPayload): ClientMetricsResult {
  const section = extractSection(payload, ["clientMetrics", "client_metrics", "client"]) ?? {};
  const record = section as UnknownRecord;
  const total =
    normalizeNumber(
      record.total ??
        record.clientes ??
        record.total_clientes ??
        record.count ??
        record.total ??
        record.quantidade ??
        record.customers,
    ) ?? 0;
  const active =
    normalizeNumber(
      record.active ??
        record.ativos ??
        record.clientesAtivos ??
        record.customersActive ??
        record.open ??
        record.ativos_count,
    ) ?? 0;
  const prospectsCandidate = normalizeNumber(
    record.prospects ??
      record.leads ??
      record.inativos ??
      record.potenciais ??
      record.opportunities ??
      record.pending,
  );
  const prospects = prospectsCandidate ?? Math.max(total - active, 0);
  const conversionRateCandidate = normalizeNumber(
    record.conversionRate ??
      record.conversion_rate ??
      record.conversion ??
      record.successRate ??
      record.taxa_conversao ??
      record.activationRate,
  );
  const conversionRate =
    conversionRateCandidate ?? (total > 0 ? Number(((active / total) * 100).toFixed(1)) : 0);

  return {
    metrics: {
      total,
      active,
      prospects,
    },
    conversionRate,
  };
}

function mapKpisFromPayload(
  payload: ApiDashboardAnalyticsPayload,
  processInfo: ProcessMetricsResult,
  clientInfo: ClientMetricsResult,
): DashboardAnalytics["kpis"] {
  const section =
    extractSection(payload, ["kpis", "kpi", "indicators"]) ??
    asRecord(payload.kpis) ??
    asRecord(payload.kpi) ??
    asRecord(payload.indicators) ??
    {};
  const record = section as UnknownRecord;
  const conversionRateCandidate = normalizeNumber(
    record.conversionRate ??
      record.conversion_rate ??
      record.conversion ??
      record.successRate ??
      record.taxa_conversao,
  );
  const monthlyGrowthCandidate = normalizeNumber(
    record.monthlyGrowth ??
      record.monthly_growth ??
      record.growth ??
      record.growthRate ??
      record.variation ??
      record.trend ??
      record.crescimento,
  );

  return {
    conversionRate: conversionRateCandidate ?? clientInfo.conversionRate,
    monthlyGrowth: monthlyGrowthCandidate ?? processInfo.monthlyGrowth,
  };
}

function mapDashboardAnalyticsPayloadToModel(
  payload: ApiDashboardAnalyticsPayload,
): DashboardAnalytics {
  const processInfo = mapProcessMetricsFromPayload(payload);
  const clientInfo = mapClientMetricsFromPayload(payload);
  const kpis = mapKpisFromPayload(payload, processInfo, clientInfo);
  const monthlySeriesSource =
    payload.monthlySeries ??
    payload.monthly_series ??
    payload.series ??
    extractSection(payload, ["monthlySeries", "monthly_series", "series"]);
  const distributionsSource =
    payload.distributions ??
    extractSection(payload, ["distributions"]) ??
    (asRecord(payload.summary)?.distributions ?? null);
  const rankingsSource = payload.rankings ?? extractSection(payload, ["rankings"]);
  const areaDistributionSource =
    payload.areaDistribution ??
    payload.area_distribution ??
    extractSection(payload, ["areaDistribution", "area_distribution"]);
  const opportunityStatusSource =
    payload.opportunityStatusMetrics ??
    payload.opportunity_status_metrics ??
    payload.opportunityMetrics ??
    extractSection(payload, ["opportunityStatusMetrics", "opportunity_status_metrics", "opportunityMetrics"]);
  const averageTimesSource =
    payload.averageTimes ??
    payload.average_times ??
    payload.averages ??
    extractSection(payload, ["averageTimes", "average_times", "averages"]);
  const timeHistogramsSource =
    payload.timeHistograms ??
    payload.time_histograms ??
    payload.timeDistributions ??
    payload.time_distributions ??
    extractSection(payload, ["timeHistograms", "time_histograms", "timeDistributions", "time_distributions"]);
  const processPoloSource =
    payload.processPoloMetrics ??
    payload.process_polo_metrics ??
    payload.processSides ??
    extractSection(payload, ["processPoloMetrics", "process_polo_metrics", "processSides", "process_sides"]);

  return {
    processMetrics: processInfo.metrics,
    clientMetrics: clientInfo.metrics,
    kpis,
    monthlySeries: mapMonthlySeriesFromPayload(monthlySeriesSource),
    areaDistribution: mapDistributionSlicesFromPayload(areaDistributionSource),
    opportunityStatusMetrics: mapOpportunityStatusMetricsFromPayload(opportunityStatusSource),
    processCards: mapProcessCardsFromPayload(payload, processInfo.metrics, processInfo.monthlyGrowth, kpis),
    processPoloMetrics: mapProcessPoloMetricsFromPayload(processPoloSource),
    distributions: mapDashboardDistributions(distributionsSource),
    rankings: mapDashboardRankings(rankingsSource),
    averageTimes: mapAverageTimesFromPayload(averageTimesSource),
    timeHistograms: mapTimeHistogramsFromPayload(timeHistogramsSource),
  };
}

async function requestDashboardAnalyticsPayload(
  signal?: AbortSignal,
): Promise<ApiDashboardAnalyticsPayload> {
  const errors: string[] = [];

  for (const endpoint of DASHBOARD_ANALYTICS_ENDPOINT_CANDIDATES) {
    try {
      const response = await fetch(getApiUrl(endpoint), {
        headers: JSON_HEADERS,
        signal,
      });

      if (!response.ok) {
        errors.push(`${endpoint}: HTTP ${response.status}`);
        continue;
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        errors.push(`${endpoint}: resposta inválida`);
        continue;
      }

      const payload = extractDashboardAnalyticsPayload(data);
      if (payload) {
        return payload;
      }

      errors.push(`${endpoint}: payload não reconhecido`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      errors.push(
        `${endpoint}: ${error instanceof Error ? error.message : "falha inesperada"}`,
      );
    }
  }

  const detail = errors.length > 0 ? ` (${errors.join('; ')})` : '';
  throw new Error(`Falha ao carregar analytics do dashboard${detail}.`);
}

export async function loadDashboardAnalytics(signal?: AbortSignal): Promise<DashboardAnalytics> {
  try {
    const payload = await requestDashboardAnalyticsPayload(signal);
    return mapDashboardAnalyticsPayloadToModel(payload);
  } catch (error) {
    if (error instanceof Error) {
      const matches = Array.from(error.message.matchAll(/HTTP (\d{3})/g));
      if (
        matches.length === DASHBOARD_ANALYTICS_ENDPOINT_CANDIDATES.length &&
        matches.every(([, code]) => code === "404")
      ) {
        return EMPTY_DASHBOARD_ANALYTICS;
      }
    }

    throw error;
  }
}

export async function loadReportsAnalytics(signal?: AbortSignal): Promise<ReportsAnalytics> {
  const agendaEndpoint = getApiUrl("agendas");
  const loadAgendas = (async (): Promise<ApiAgenda[]> => {
    const response = await fetch(agendaEndpoint, {
      headers: JSON_HEADERS,
      signal,
    });

    if (!response.ok) {
      throw new Error(`Falha ao carregar 'agendas' (HTTP ${response.status}).`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("Resposta inválida do endpoint 'agendas'.");
    }

    if (
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      ("error" in payload || "message" in payload)
    ) {
      throw new Error(
        `[agendas] payload de erro recebido: ${JSON.stringify(payload).slice(0, 240)}`,
      );
    }

    const agendas = ensureArray<ApiAgenda>(payload);

    if (
      agendas.length === 0 &&
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload)
    ) {
      console.warn(
        `[reports] Endpoint de agendas respondeu sem coleção reconhecida (${agendaEndpoint}).`,
        payload,
      );
    }

    return agendas;
  })().catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const statusMatch = message.match(/HTTP\s+(\d{3})/);

    if (statusMatch?.[1] === "404") {
      console.error(
        `[reports] Endpoint de agendas não encontrado (${agendaEndpoint}). Verifique o alias /api/agendas no backend.`,
        error,
      );
    } else {
      console.warn(
        `[reports] Falha ao carregar agendas em ${agendaEndpoint}. O resumo pode ficar incompleto.`,
        error,
      );
    }

    return [];
  });

  const [overview, intimacoes, tarefas, agendas, flows] = await Promise.all([
    loadDashboardAnalytics(signal).catch((error) => {
      console.warn("Falha ao carregar dashboard para relatórios", error);
      return EMPTY_DASHBOARD_ANALYTICS;
    }),
    fetchCollection<Intimacao>("intimacoes", signal).catch(() => []),
    fetchCollection<ApiTarefa>("tarefas", signal).catch(() => []),
    loadAgendas,
    fetchFlows().catch<Flow[]>(() => []),
  ]);

  const revenueSeries = new Map<string, number>();
  const expenseSeries = new Map<string, number>();

  flows.forEach((flow) => {
    const dueDate = normalizeDate(flow.vencimento ?? flow.pagamento);
    if (!dueDate) {
      return;
    }
    const key = getMonthKey(dueDate);
    if (flow.tipo === "receita") {
      revenueSeries.set(key, (revenueSeries.get(key) ?? 0) + flow.valor);
    } else if (flow.tipo === "despesa") {
      expenseSeries.set(key, (expenseSeries.get(key) ?? 0) + flow.valor);
    }
  });

  const months = collectMonthKeys([
    new Map(overview.monthlySeries.map((point) => [point.key, point])),
    revenueSeries,
    expenseSeries,
  ], MONTHS_WINDOW);

  const financialSeries = buildFinancialSeries(months, revenueSeries, expenseSeries);
  const totalRevenue = sum(financialSeries.map((point) => point.receita));
  const totalExpenses = sum(financialSeries.map((point) => point.despesas));
  const balance = totalRevenue - totalExpenses;

  const lastRevenue = financialSeries.at(-1)?.receita ?? 0;
  const previousRevenue = financialSeries.at(-2)?.receita ?? 0;
  const revenueGrowth = computeGrowth(lastRevenue, previousRevenue);

  const cohort = buildCohortFromCounts(
    months,
    new Map(overview.monthlySeries.map((point) => [point.key, point.clientesNovos])),
    new Map(overview.monthlySeries.map((point) => [point.key, point.clientes])),
  );

  const funnel = buildFunnelStages([
    { stage: "Prospects", count: overview.clientMetrics.prospects },
    { stage: "Clientes", count: overview.clientMetrics.total },
    { stage: "Clientes ativos", count: overview.clientMetrics.active },
  ]);

  return {
    overview,
    financialSeries,
    cohort,
    funnel,
    financialSummary: {
      totalRevenue,
      totalExpenses,
      balance,
      revenueGrowth,
    },
    intimationSummary: buildIntimationSummary(intimacoes),
    taskSummary: buildTaskSummary(tarefas),
    agendaSummary: buildAgendaSummary(agendas),
  };
}

export async function loadAdminDashboardAnalytics(signal?: AbortSignal): Promise<AdminDashboardAnalytics> {
  const [empresas, planos, flows] = await Promise.all([
    fetchCollection<ApiEmpresa>("empresas", signal).catch(() => []),
    fetchCollection<ApiPlano>("planos", signal).catch(() => []),
    fetchFlows().catch<Flow[]>(() => []),
  ]);

  const planIndex = new Map<string, ApiPlano>();
  planos.forEach((plan) => {
    const id = normalizeString(plan.id);
    if (id) {
      planIndex.set(id, plan);
    }
  });

  let activeSubscriptions = 0;
  let trialSubscriptions = 0;
  let inactiveSubscriptions = 0;
  let totalMRR = 0;

  const planDistributionMap = new Map<string, number>();
  const planRevenueMap = new Map<string, { name: string; revenue: number; customers: number }>();
  const customersPerMonth = new Map<string, number>();
  const churnPerMonth = new Map<string, number>();
  const revenuePerMonth = new Map<string, number>();

  empresas.forEach((empresa) => {
    const evaluation = evaluateCompanySubscription(empresa);
    const planId = evaluation.planId ?? normalizeString(empresa.plano);
    const plan = planId ? planIndex.get(planId) : undefined;
    const planName = getPlanName(plan, planId);
    const monthlyValue = plan ? getPlanMonthlyValue(plan) : 0;
    const status = evaluation.status;

    if (status === "active") {
      activeSubscriptions += 1;
      totalMRR += monthlyValue;
    } else if (status === "trial") {
      trialSubscriptions += 1;
    } else {
      inactiveSubscriptions += 1;
    }

    if (planId) {
      planDistributionMap.set(planName, (planDistributionMap.get(planName) ?? 0) + 1);
      const revenueEntry = planRevenueMap.get(planId) ?? { name: planName, revenue: 0, customers: 0 };
      revenueEntry.name = planName;
      if (status === "active") {
        revenueEntry.revenue += monthlyValue;
        revenueEntry.customers += 1;
      }
      planRevenueMap.set(planId, revenueEntry);
    }

    const createdAt = normalizeDate(empresa.datacadastro);
    if (createdAt) {
      const key = getMonthKey(createdAt);
      customersPerMonth.set(key, (customersPerMonth.get(key) ?? 0) + 1);
      if (status === "inactive") {
        churnPerMonth.set(key, (churnPerMonth.get(key) ?? 0) + 1);
      }
      if (status === "active") {
        revenuePerMonth.set(key, (revenuePerMonth.get(key) ?? 0) + monthlyValue);
      }
    }
  });

  const months = collectMonthKeys([customersPerMonth, revenuePerMonth], MONTHS_WINDOW);
  let runningCustomers = 0;
  const cumulativeCustomers = new Map<string, number>();
  const churnRate = new Map<string, number>();

  months.forEach((key) => {
    const newCustomers = customersPerMonth.get(key) ?? 0;
    runningCustomers += newCustomers;
    cumulativeCustomers.set(key, runningCustomers);
    const churned = churnPerMonth.get(key) ?? 0;
    const rate = newCustomers > 0 ? Number(((churned / newCustomers) * 100).toFixed(1)) : 0;
    churnRate.set(key, rate);
  });

  const lastMrr = revenuePerMonth.get(months.at(-1) ?? "") ?? totalMRR;
  const previousMrr = revenuePerMonth.get(months.at(-2) ?? "") ?? lastMrr;
  const monthlyGrowth = computeGrowth(lastMrr, previousMrr);

  const totalCompanies = empresas.length;
  const conversionRate = totalCompanies > 0
    ? Number(((activeSubscriptions / totalCompanies) * 100).toFixed(1))
    : 0;

  return {
    metrics: {
      mrr: Number(totalMRR.toFixed(2)),
      arr: Number((totalMRR * 12).toFixed(2)),
      churnRate: Number(((inactiveSubscriptions / Math.max(totalCompanies, 1)) * 100).toFixed(1)),
      conversionRate,
      activeSubscriptions,
      trialSubscriptions,
      totalCompanies,
      monthlyGrowth,
    },
    monthlySeries: buildAdminMonthlySeries(months, revenuePerMonth, churnRate, cumulativeCustomers),
    planDistribution: buildDistribution(planDistributionMap),
    revenueByPlan: buildRevenueByPlan(planRevenueMap),
  };
}

export async function loadAdminAnalyticsOverview(signal?: AbortSignal): Promise<AdminAnalyticsOverview> {
  const [dashboard, reports, flows] = await Promise.all([
    loadAdminDashboardAnalytics(signal),
    loadReportsAnalytics(signal),
    fetchFlows().catch<Flow[]>(() => []),
  ]);

  const revenueSeries = new Map<string, number>();
  const expenseSeries = new Map<string, number>();

  flows.forEach((flow) => {
    const dueDate = normalizeDate(flow.vencimento ?? flow.pagamento);
    if (!dueDate) {
      return;
    }
    const key = getMonthKey(dueDate);
    if (flow.tipo === "receita") {
      revenueSeries.set(key, (revenueSeries.get(key) ?? 0) + flow.valor);
    } else if (flow.tipo === "despesa") {
      expenseSeries.set(key, (expenseSeries.get(key) ?? 0) + flow.valor);
    }
  });

  const months = collectMonthKeys([revenueSeries, expenseSeries], MONTHS_WINDOW);
  const revenuePoints = buildFinancialSeries(months, revenueSeries, expenseSeries);
  const lastRevenue = revenuePoints.at(-1)?.receita ?? dashboard.metrics.mrr;
  const previousRevenue = revenuePoints.at(-2)?.receita ?? lastRevenue;
  const grossRetention = previousRevenue > 0 ? Number(((lastRevenue / previousRevenue) * 100).toFixed(1)) : 100;
  const netRetention = Number((grossRetention + Math.max(dashboard.metrics.monthlyGrowth, 0)).toFixed(1));
  const logoRetention = dashboard.metrics.totalCompanies > 0
    ? Number(((dashboard.metrics.totalCompanies - dashboard.metrics.trialSubscriptions) /
        dashboard.metrics.totalCompanies) * 100).toFixed(1)
    : 0;

  const currentArpu = dashboard.metrics.activeSubscriptions > 0
    ? Number((dashboard.metrics.mrr / dashboard.metrics.activeSubscriptions).toFixed(2))
    : 0;
  const previousArpu = previousRevenue > 0 && dashboard.metrics.activeSubscriptions > 0
    ? Number((previousRevenue / dashboard.metrics.activeSubscriptions).toFixed(2))
    : currentArpu;

  const revenueGrowthRate = computeGrowth(lastRevenue, previousRevenue);
  const revenueDelta = lastRevenue - previousRevenue;
  const expansionRevenue = revenueDelta > 0 ? Number(revenueDelta.toFixed(2)) : 0;
  const contractionRevenue = revenueDelta < 0 ? Number(Math.abs(revenueDelta).toFixed(2)) : 0;

  const marketingExpenses = expenseSeries.get(months.at(-1) ?? "") ?? 0;
  const newCustomers = dashboard.monthlySeries.at(-1)?.customers ?? dashboard.metrics.totalCompanies;
  const cac = newCustomers > 0 ? Number((marketingExpenses / newCustomers).toFixed(2)) : 0;
  const churnRate = dashboard.metrics.churnRate > 0 ? dashboard.metrics.churnRate / 100 : 0;
  const ltv = churnRate > 0 ? Number((currentArpu / churnRate).toFixed(2)) : currentArpu * 12;
  const paybackPeriodMonths = currentArpu > 0 ? Number((cac / currentArpu).toFixed(1)) : 0;
  const trialConversion = dashboard.metrics.totalCompanies > 0
    ? Number(((dashboard.metrics.totalCompanies - dashboard.metrics.trialSubscriptions) /
        dashboard.metrics.totalCompanies) * 100).toFixed(1)
    : 0;

  return {
    dashboard,
    revenueByPlan: dashboard.revenueByPlan,
    cohort: reports.cohort,
    funnel: reports.funnel,
    retention: {
      gross: grossRetention,
      net: netRetention,
      logo: Number(logoRetention),
    },
    revenueMetrics: {
      currentArpu,
      previousArpu,
      revenueGrowthRate,
      expansionRevenue,
      contractionRevenue,
    },
    customerMetrics: {
      cac,
      ltv,
      paybackPeriodMonths,
      trialConversion: Number(trialConversion),
    },
  };
}

export async function loadAdminLogs(signal?: AbortSignal): Promise<LogEvent[]> {
  const notifications = await fetchCollection<ApiNotification>("notifications", signal).catch(() => []);

  const events: LogEvent[] = notifications.map((notification, index) => {
    const id = normalizeString(notification.id) ?? `notification-${index}`;
    const type = normalizeString(notification.type)?.toLowerCase() ?? "info";
    const level = LEVEL_MAP[type] ?? "info";
    const message =
      normalizeString(notification.message) ??
      normalizeString(notification.title) ??
      "Evento sem mensagem";
    const timestamp = normalizeString(notification.createdAt) ?? new Date().toISOString();
    const category = normalizeString(notification.category) ?? "Sistema";

    const metadata = ((): Record<string, unknown> | undefined => {
      if (notification.metadata && typeof notification.metadata === "object") {
        return { ...(notification.metadata as Record<string, unknown>) };
      }
      return undefined;
    })();

    const request = (() => {
      if (!metadata) {
        return undefined;
      }

      const extractNumber = (key: string): number | undefined => {
        const value = metadata?.[key];
        const normalized = normalizeNumber(value);
        return normalized ?? undefined;
      };

      const method = normalizeString(metadata.httpMethod ?? metadata.method ?? metadata.requestMethod);
      const uri = normalizeString(metadata.httpPath ?? metadata.uri ?? metadata.path);
      const status = extractNumber("httpStatus") ?? extractNumber("status");
      const durationMs = extractNumber("durationMs") ?? extractNumber("duration");
      const clientIp = normalizeString(metadata.clientIp ?? metadata.ip ?? metadata.remoteAddress);
      const protocol = normalizeString(metadata.protocol);
      const host = normalizeString(metadata.host);
      const userAgent = normalizeString(metadata.userAgent ?? metadata.ua);

      if (!method && !uri && !status && !durationMs && !clientIp && !protocol && !host && !userAgent) {
        return undefined;
      }

      return {
        method: method ?? undefined,
        uri: uri ?? undefined,
        status: status ?? undefined,
        durationMs: durationMs ?? undefined,
        clientIp: clientIp ?? undefined,
        protocol: protocol ?? undefined,
        host: host ?? undefined,
        userAgent: userAgent ?? undefined,
      };
    })();

    return {
      id,
      level,
      timestamp,
      message,
      source: category,
      metadata,
      request,
    };
  });

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
