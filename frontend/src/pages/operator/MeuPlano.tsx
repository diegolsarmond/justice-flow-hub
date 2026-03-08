import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { routes } from "@/config/routes";
import { useAuth } from "@/features/auth/AuthProvider";
import { PlanSelection } from "@/features/plans/PlanSelection";
import { parsePlanPaymentResult } from "@/features/plans/api";
import {
  clearPersistedManagePlanSelection,
  getPersistedManagePlanSelection,
  persistManagePlanSelection,
  type ManagePlanSelection,
  type PricingMode,
} from "@/features/plans/managePlanPaymentStorage";
import { evaluateSubscriptionAccess } from "@/features/auth/subscriptionStatus";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileText,
  Clock,
  Crown,
  Loader2,
  Sparkles,
  Zap,
  Users,
} from "lucide-react";

import { getApiBaseUrl, getApiUrl, joinUrl } from "@/lib/api";
import type { PixQRCode } from "@/types/subscription";
import {
  getAdditionalSubscriptionStorageKeys,
  getSubscriptionStorageKey,
} from "@/features/auth/subscriptionStorage";
import { resolveBoletoLink, resolvePixImageSrc } from "./planPaymentUtils";

type PlanoDetalhe = {
  id: number;
  slug: string | null;
  nome: string;
  ativo: boolean;
  descricao: string | null;
  recursos: string[];
  dataCadastro: Date | null;
  valorMensal: number | null;
  valorAnual: number | null;
  limiteUsuarios: number | null;
  limiteClientes: number | null;
  limiteProcessos: number | null;
  limitePropostas: number | null;
  precoMensal: string | null;
  precoAnual: string | null;
  descontoAnualPercentual: number | null;
  economiaAnual: number | null;
  economiaAnualFormatada: string | null;
};

type UsageMetrics = {
  usuariosAtivos: number | null;
  clientesAtivos: number | null;
  processosAtivos: number | null;
  propostasEmitidas: number | null;
};

type UsageItem = {
  label: string;
  current: number | null;
  limit?: number | null;
};

type PricingDisplay = {
  mainPrice: string;
  cadenceLabel: string;
  helper?: string | null;
  savingsLabel?: string | null;
  discountBadge?: string | null;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});
const countFormatter = new Intl.NumberFormat("pt-BR");
const PRICING_ON_REQUEST_LABEL = "Sob consulta";

const PAYMENT_METHOD_LABELS: Record<"PIX" | "BOLETO" | "CREDIT_CARD" | "DEBIT_CARD", string> = {
  PIX: "PIX",
  BOLETO: "Boleto bancário",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
};

type SubscriptionPaymentDetails = {
  id: string;
  status: string;
  billingType: string;
  dueDate: string | null;
  value: number | null;
  boletoLink: string | null;
};

function resolvePaymentStatusDetails(status: string | null | undefined) {
  if (!status) {
    return { isPending: false, isActive: false, statusLabel: null as string | null };
  }

  const normalized = status.toLowerCase();
  const isPending =
    normalized.includes("pend") || normalized.includes("aguard") || normalized.includes("await") || normalized.includes("waiting");
  const isActive =
    normalized.includes("receb") ||
    normalized.includes("paid") ||
    normalized.includes("confirm") ||
    normalized.includes("ativo") ||
    normalized.includes("ativa") ||
    normalized.includes("active") ||
    normalized.includes("receiv");

  return { isPending, isActive, statusLabel: status };
}

function parseSubscriptionPayment(row: unknown): SubscriptionPaymentDetails | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const record = row as Record<string, unknown>;
  const id = toStringOrNull(record.id ?? record.paymentId ?? record.subscriptionPaymentId ?? null);
  const status = toStringOrNull(record.status ?? record.paymentStatus ?? record.situacao ?? null);
  const billingTypeRaw = toStringOrNull(
    record.billingType ?? record.paymentMethod ?? record.method ?? record.formaPagamento ?? record.forma_pagamento ?? null,
  );

  if (!id || !status || !billingTypeRaw) {
    return null;
  }

  const dueDate =
    toStringOrNull(record.dueDate ?? record.due_date ?? record.dueAt ?? record.vencimento ?? record.vencimentoPrevisto ?? null) ??
    null;
  const amount =
    toNumber(
      record.value ??
      record.amount ??
      record.valor ??
      record.totalValue ??
      record.total_value ??
      record.valor_total ??
      record.valor_cobranca ??
      null,
    );
  const boletoLink = resolveBoletoLink({
    boletoUrl:
      toStringOrNull(
        record.boletoUrl ??
        record.boleto_url ??
        record.bankSlipUrl ??
        record.bank_slip_url ??
        record.bankSlipURL ??
        record.digitableLineUrl ??
        null,
      ) ?? undefined,
    invoiceUrl:
      toStringOrNull(
        record.invoiceUrl ??
        record.invoice_url ??
        record.duplicataUrl ??
        record.duplicata_url ??
        record.invoiceURL ??
        null,
      ) ?? undefined,
  });

  return {
    id,
    status,
    billingType: billingTypeRaw.toUpperCase(),
    dueDate,
    value: amount,
    boletoLink,
  } satisfies SubscriptionPaymentDetails;
}

function normalizeApiRows(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray((data as { rows?: unknown[] })?.rows)) {
    return (data as { rows: unknown[] }).rows;
  }

  const nestedData = (data as { data?: unknown })?.data;
  if (Array.isArray(nestedData)) {
    return nestedData;
  }

  if (Array.isArray((nestedData as { rows?: unknown[] })?.rows)) {
    return (nestedData as { rows: unknown[] }).rows;
  }

  return [];
}

export default function MeuPlano() {
  const { user } = useAuth();
  const { hasAccess } = evaluateSubscriptionAccess(user?.subscription ?? null);

  if (!hasAccess) {
    return <PlanSelection />;
  }

  return <MeuPlanoContent />;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const sanitized = trimmed.replace(/[^\d,.-]/g, "").replace(/\.(?=.*\.)/g, "");
    const normalized = sanitized.replace(",", ".");
    const result = Number(normalized);
    return Number.isFinite(result) ? result : null;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return null;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }

    return String(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickString(
  source: Record<string, unknown>,
  candidates: string[],
): string | null {
  for (const key of candidates) {
    if (key in source) {
      const result = toStringOrNull(source[key]);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

function resolveSubscriptionId(source: unknown, candidates: string[]): string | null {
  if (!source || typeof source !== "object") {
    return null;
  }

  return pickString(source as Record<string, unknown>, candidates);
}

function normalizeForComparison(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function requestJson<T>(input: RequestInfo, init: RequestInit = {}): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  let payload: unknown = null;

  if (response.status !== 204) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && (payload as { error?: unknown }).error
        ? String((payload as { error?: unknown }).error)
        : response.statusText || "Falha ao comunicar com o servidor.";
    throw new Error(message);
  }

  return payload as T;
}

function slugify(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeForComparison(value)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : null;
}

function parseRecursos(value: unknown): string[] {
  const seen = new Set<string>();
  const seenObjects = new Set<object>();
  const result: string[] = [];

  const add = (entry: string) => {
    const normalized = entry.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  };

  const handleString = (input: string) => {
    input
      .split(/[\n;,]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach(add);
  };

  const visit = (input: unknown): void => {
    if (input == null) {
      return;
    }

    if (typeof input === "string") {
      handleString(input);
      return;
    }

    if (typeof input === "number" || typeof input === "boolean") {
      add(String(input));
      return;
    }

    if (Array.isArray(input)) {
      input.forEach(visit);
      return;
    }

    if (typeof input === "object") {
      if (seenObjects.has(input as object)) {
        return;
      }

      seenObjects.add(input as object);

      const record = input as Record<string, unknown>;
      const candidateKeys = [
        "disponiveis",
        "disponiveisPersonalizados",
        "available",
        "availableFeatures",
        "inclusos",
        "incluidos",
        "lista",
        "items",
        "features",
        "recursosDisponiveis",
        "recursos_disponiveis",
        "recursos",
        "modulos",
        "modules",
        "rows",
        "data",
        "values",
        "value",
      ];

      const excludedPattern = /(indispon|unavailable|exclu|negad)/i;
      let matchedCandidate = false;

      for (const key of candidateKeys) {
        if (key in record) {
          matchedCandidate = true;
          visit(record[key]);
        }
      }

      if (!matchedCandidate) {
        for (const [key, entry] of Object.entries(record)) {
          if (excludedPattern.test(key)) {
            continue;
          }

          if (/^\d+$/.test(key)) {
            visit(entry);
          }
        }
      }
    }
  };

  visit(value);

  return result;
}

function parseDate(value: unknown): Date | null {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  return null;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function computePricingDetails(valorMensal: number | null, valorAnual: number | null) {
  const precoMensal = valorMensal !== null ? currencyFormatter.format(valorMensal) : null;
  const precoAnual = valorAnual !== null ? currencyFormatter.format(valorAnual) : null;

  if (valorMensal === null || valorAnual === null) {
    return {
      precoMensal,
      precoAnual,
      descontoPercentual: null,
      economiaAnual: null,
      economiaAnualFormatada: null,
    } as const;
  }

  const totalMensal = valorMensal * 12;
  const economiaBruta = roundCurrency(Math.max(0, totalMensal - valorAnual));
  const descontoPercentual =
    totalMensal > 0 && economiaBruta > 0 ? Math.round((economiaBruta / totalMensal) * 100) : null;

  return {
    precoMensal,
    precoAnual,
    descontoPercentual,
    economiaAnual: economiaBruta > 0 ? economiaBruta : null,
    economiaAnualFormatada: economiaBruta > 0 ? currencyFormatter.format(economiaBruta) : null,
  } as const;
}

function hasMensalPricing(plan: PlanoDetalhe | null): boolean {
  if (!plan) {
    return false;
  }

  return Boolean(
    (typeof plan.valorMensal === "number" && Number.isFinite(plan.valorMensal)) ||
    (typeof plan.precoMensal === "string" && plan.precoMensal.trim()),
  );
}

function hasAnualPricing(plan: PlanoDetalhe | null): boolean {
  if (!plan) {
    return false;
  }

  return Boolean(
    (typeof plan.valorAnual === "number" && Number.isFinite(plan.valorAnual)) ||
    (typeof plan.precoAnual === "string" && plan.precoAnual.trim()),
  );
}

function resolvePricingModeForPlan(current: PricingMode, plan: PlanoDetalhe): PricingMode {
  if (current === "anual" && !hasAnualPricing(plan)) {
    return hasMensalPricing(plan) ? "mensal" : "anual";
  }

  if (current === "mensal" && !hasMensalPricing(plan)) {
    return hasAnualPricing(plan) ? "anual" : "mensal";
  }

  return current;
}

function getDefaultPricingMode(plan: PlanoDetalhe | null): PricingMode {
  if (hasMensalPricing(plan)) {
    return "mensal";
  }

  if (hasAnualPricing(plan)) {
    return "anual";
  }

  return "mensal";
}

function formatAvailableModes(plan: PlanoDetalhe | null): string | null {
  if (!plan) {
    return null;
  }

  const modes: string[] = [];
  if (hasMensalPricing(plan)) {
    modes.push("Mensal");
  }
  if (hasAnualPricing(plan)) {
    modes.push("Anual");
  }

  if (modes.length === 0) {
    return null;
  }

  return modes.length === 2 ? `${modes[0]} ou ${modes[1]}` : modes[0];
}

function resolveSubscriptionStatusLabel(status: string | null): string | null {
  switch (status) {
    case "active":
      return "Assinatura ativa";
    case "trialing":
      return "Período de avaliação";
    case "grace":
    case "grace_period":
      return "Pagamento atrasado";
    case "pending":
    case "past_due":
      return "Pagamento pendente";
    case "overdue":
      return "Pagamento atrasado";
    case "inactive":
      return "Assinatura inativa";
    case "expired":
      return "Assinatura expirada";
    default:
      return null;
  }
}

function formatLimitValue(value: number | null, singular: string, plural: string): string {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return "Ilimitado";
  }

  const formatted = countFormatter.format(value);
  return `${formatted} ${value === 1 ? singular : plural}`;
}

function buildPricingDisplay(plan: PlanoDetalhe | null, mode: PricingMode): PricingDisplay {
  const fallback = PRICING_ON_REQUEST_LABEL;

  if (!plan) {
    return {
      mainPrice: fallback,
      cadenceLabel: mode === "anual" ? "por ano" : "por mês",
      helper: null,
      savingsLabel: null,
      discountBadge: null,
    };
  }

  if (mode === "anual") {
    const mainPrice = plan.precoAnual ?? plan.precoMensal ?? fallback;
    const helper =
      plan.valorAnual !== null && plan.valorMensal !== null
        ? `Equivalente a ${currencyFormatter.format(plan.valorAnual / 12)}/mês`
        : plan.precoMensal
          ? `Modalidade mensal: ${plan.precoMensal}`
          : null;

    const savingsLabel = plan.economiaAnualFormatada
      ? `Economize ${plan.economiaAnualFormatada} em relação à contratação mensal`
      : null;

    const discountBadge =
      plan.descontoAnualPercentual !== null ? `-${plan.descontoAnualPercentual}%` : null;

    return {
      mainPrice,
      cadenceLabel: "por ano",
      helper,
      savingsLabel,
      discountBadge,
    };
  }

  const derivedMensal =
    plan.precoMensal ??
    (plan.valorAnual !== null ? currencyFormatter.format(plan.valorAnual / 12) : null) ??
    null;
  const mainPrice = derivedMensal ?? fallback;
  const helper = plan.precoAnual
    ? `Plano anual: ${plan.precoAnual}${plan.descontoAnualPercentual !== null ? ` (${plan.descontoAnualPercentual}% de economia)` : ""
    }`
    : plan.valorMensal !== null
      ? `Cobrança mensal em ${currencyFormatter.format(plan.valorMensal)}`
      : "Consulte condições comerciais";

  const savingsLabel =
    plan.precoAnual && plan.economiaAnualFormatada
      ? `Economize ${plan.economiaAnualFormatada} escolhendo a modalidade anual`
      : null;

  const discountBadge =
    plan.precoAnual && plan.descontoAnualPercentual !== null
      ? `-${plan.descontoAnualPercentual}%`
      : null;

  return {
    mainPrice,
    cadenceLabel: "por mês",
    helper,
    savingsLabel,
    discountBadge,
  };
}

function estimateNextBilling(plan: PlanoDetalhe | null): { nextBilling: string | null; cadenceLabel: string } {
  if (!plan) {
    return { nextBilling: null, cadenceLabel: PRICING_ON_REQUEST_LABEL };
  }

  const hasMensal = plan.valorMensal !== null;
  const hasAnual = plan.valorAnual !== null;

  const cadenceLabel = hasMensal && hasAnual
    ? "Mensal ou anual"
    : hasMensal
      ? "Mensal"
      : hasAnual
        ? "Anual"
        : PRICING_ON_REQUEST_LABEL;

  if (!plan.dataCadastro || Number.isNaN(plan.dataCadastro.getTime())) {
    return { nextBilling: null, cadenceLabel };
  }

  const baseDate = plan.dataCadastro;
  const now = new Date();
  const next = new Date(baseDate.getTime());

  const incrementMonths = hasMensal && !hasAnual ? 1 : !hasMensal && hasAnual ? 12 : null;
  if (!incrementMonths) {
    return { nextBilling: null, cadenceLabel };
  }

  let iterations = 0;
  const maxIterations = 1000;

  if (next <= now) {
    while (next <= now && iterations < maxIterations) {
      next.setMonth(next.getMonth() + incrementMonths);
      iterations += 1;
    }
  }

  if (iterations >= maxIterations) {
    return { nextBilling: null, cadenceLabel };
  }

  return { nextBilling: next.toLocaleDateString("pt-BR"), cadenceLabel };
}

function formatDate(value: Date | null): string | null {
  if (!value) {
    return null;
  }

  return value.toLocaleDateString("pt-BR");
}

type ApiEmpresa = { plano?: unknown; plano_id?: unknown };

const extractBillingFromEmpresa = (
  record: Record<string, unknown>,
): ManagePlanSelection["billing"] | null => {
  const companyName = pickString(record, [
    "razao_social",
    "razaoSocial",
    "nome_empresa",
    "nomeEmpresa",
    "nome",
  ]);
  const documentRaw = pickString(record, [
    "cnpj",
    "documento",
    "document",
    "cnpj_cpf",
    "cpf_cnpj",
  ]);
  const email = pickString(record, [
    "email_cobranca",
    "emailCobranca",
    "billingEmail",
    "email_billing",
    "email_financeiro",
    "emailFinanceiro",
    "email",
  ]);

  const documentDigits = documentRaw ? documentRaw.replace(/\D+/g, "") : null;

  if (!companyName && !documentDigits && !email) {
    return null;
  }

  return {
    ...(companyName ? { companyName } : {}),
    ...(documentDigits ? { document: documentDigits } : {}),
    ...(email ? { email } : {}),
  };
};

const extractSubscriptionIdFromEmpresa = (record: Record<string, unknown>): string | null => {
  return (
    resolveSubscriptionId(record, [
      "asaas_subscription_id",
      "asaasSubscriptionId",
      "subscriptionId",
      "subscription_id",
      "asaas_subscription",
      "asaasSubscription",
    ]) ?? null
  );
};

const mergeBillingDetails = (
  primary: ManagePlanSelection["billing"] | null,
  secondary: ManagePlanSelection["billing"] | null,
): ManagePlanSelection["billing"] | null => {
  const companyName = primary?.companyName ?? secondary?.companyName ?? null;
  const document = primary?.document ?? secondary?.document ?? null;
  const email = primary?.email ?? secondary?.email ?? null;

  if (!companyName && !document && !email) {
    return null;
  }

  return {
    ...(companyName ? { companyName } : {}),
    ...(document ? { document } : {}),
    ...(email ? { email } : {}),
  };
};

function findPlanFromEmpresa(planos: PlanoDetalhe[], empresasRows: unknown[]): PlanoDetalhe | null {
  if (planos.length === 0) {
    return null;
  }

  const identifiers = empresasRows
    .map((row) => row as ApiEmpresa)
    .flatMap((empresa) => {
      const results: { id: number | null; name: string | null }[] = [];
      const idFromPlano = toNumber(empresa.plano);
      if (idFromPlano !== null) {
        results.push({ id: idFromPlano, name: null });
      } else if (typeof empresa.plano === "string" && empresa.plano.trim()) {
        results.push({ id: null, name: empresa.plano.trim() });
      }

      const idFromPlanoId = toNumber(empresa.plano_id);
      if (idFromPlanoId !== null) {
        results.push({ id: idFromPlanoId, name: null });
      }

      return results;
    });

  for (const identifier of identifiers) {
    if (identifier.id !== null) {
      const match = planos.find((plano) => plano.id === identifier.id);
      if (match) {
        return match;
      }
    }

    if (identifier.name) {
      const normalized = identifier.name.toLowerCase();
      const match = planos.find((plano) => plano.nome.toLowerCase() === normalized);
      if (match) {
        return match;
      }
    }
  }

  return null;
}

function MeuPlanoContent() {
  const apiBaseUrl = getApiBaseUrl();
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [subscriptionStatusOverride, setSubscriptionStatusOverride] = useState<string | null>(null);
  const rawSubscriptionStatus = user?.subscription?.status ?? null;
  const subscriptionStatus = subscriptionStatusOverride ?? rawSubscriptionStatus;
  const subscriptionPlanId = toNumber(user?.subscription?.planId ?? null);
  const isTrialing = subscriptionStatus === "trialing";
  const subscriptionStatusLabel = useMemo(
    () => resolveSubscriptionStatusLabel(subscriptionStatus),
    [subscriptionStatus],
  );
  const isPaymentPending =
    subscriptionStatus === "past_due" ||
    subscriptionStatus === "grace_period" ||
    subscriptionStatus === "pending" ||
    subscriptionStatus === "grace" ||
    subscriptionStatus === "overdue";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planoAtual, setPlanoAtual] = useState<PlanoDetalhe | null>(null);
  const [previewPlano, setPreviewPlano] = useState<PlanoDetalhe | null>(null);
  const [planosDisponiveis, setPlanosDisponiveis] = useState<PlanoDetalhe[]>([]);
  const [pricingMode, setPricingMode] = useState<PricingMode>("mensal");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const subscriptionStorageKey = useMemo(
    () => getSubscriptionStorageKey(user),
    [user?.empresa_id, user?.id],
  );
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellationSuccessMessage, setCancellationSuccessMessage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<UsageMetrics>({
    usuariosAtivos: null,
    clientesAtivos: null,
    processosAtivos: null,
    propostasEmitidas: null,
  });
  const [billingDetails, setBillingDetails] = useState<ManagePlanSelection["billing"] | null>(null);
  const [persistedSelection, setPersistedSelection] = useState<ManagePlanSelection>(() =>
    getPersistedManagePlanSelection(),
  );
  const [latestPayment, setLatestPayment] = useState<SubscriptionPaymentDetails | null>(null);
  const [pendingPixDetails, setPendingPixDetails] = useState<{ payload: string | null; image: string | null } | null>(null);
  const [pendingBoletoCode, setPendingBoletoCode] = useState<string | null>(null);
  const navigationState = (location.state ?? {}) as {
    paymentSummary?: ManagePlanSelection["paymentSummary"];
  };
  const isSubscriptionActive = subscriptionStatus === "active";

  useEffect(() => {
    if (rawSubscriptionStatus !== "active" && subscriptionStatusOverride !== null) {
      setSubscriptionStatusOverride(null);
    }

    if (rawSubscriptionStatus === "active" && subscriptionStatusOverride === null) {
      setCancellationSuccessMessage(null);
    }
  }, [rawSubscriptionStatus, subscriptionStatusOverride]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const additionalKeys = getAdditionalSubscriptionStorageKeys(user, subscriptionStorageKey);
    for (const key of additionalKeys) {
      window.localStorage.removeItem(key);
    }

    const storedId = window.localStorage.getItem(subscriptionStorageKey);
    setSubscriptionId(storedId && storedId.trim().length > 0 ? storedId.trim() : null);
  }, [subscriptionStorageKey, user?.empresa_id, user?.id]);

  useEffect(() => {
    let disposed = false;

    async function loadLatestSubscriptionPayment() {
      if (!subscriptionId) {
        if (!disposed) {
          setLatestPayment(null);
          setPendingPixDetails(null);
          setPendingBoletoCode(null);
        }
        return;
      }

      try {
        const paymentsPayload = await requestJson<unknown>(
          getApiUrl(`site/asaas/subscriptions/${encodeURIComponent(subscriptionId)}/payments`),
        );
        const paymentsRows = normalizeApiRows(paymentsPayload);
        const parsedPayments = paymentsRows
          .map((row) => parseSubscriptionPayment(row))
          .filter((item): item is SubscriptionPaymentDetails => item !== null)
          .sort((a, b) => {
            const aTime = a.dueDate ? Date.parse(a.dueDate) : 0;
            const bTime = b.dueDate ? Date.parse(b.dueDate) : 0;
            return bTime - aTime;
          });

        const latest = parsedPayments[0] ?? null;

        if (disposed) {
          return;
        }

        setLatestPayment(latest);

        if (!latest) {
          setPendingPixDetails(null);
          setPendingBoletoCode(null);
          return;
        }

        const statusDetails = resolvePaymentStatusDetails(latest.status);

        if (!statusDetails.isPending) {
          setPendingPixDetails(null);
          setPendingBoletoCode(null);
          return;
        }

        if (latest.billingType === "PIX") {
          setPendingBoletoCode(null);
          try {
            const pixData = await requestJson<PixQRCode>(
              getApiUrl(`site/asaas/payments/${encodeURIComponent(latest.id)}/pix`),
            );
            if (!disposed) {
              setPendingPixDetails({
                payload: pixData?.payload ?? null,
                image: resolvePixImageSrc(pixData?.encodedImage ?? null),
              });
            }
          } catch {
            if (!disposed) {
              setPendingPixDetails(null);
              setPendingBoletoCode(null);
            }
          }
        } else if (latest.billingType === "BOLETO") {
          setPendingPixDetails(null);
          try {
            const boletoData = await requestJson<{ identificationField?: string | null }>(
              getApiUrl(`site/asaas/payments/${encodeURIComponent(latest.id)}/boleto`),
            );
            if (!disposed) {
              setPendingBoletoCode(boletoData?.identificationField ?? null);
            }
          } catch {
            if (!disposed) {
              setPendingBoletoCode(null);
            }
          }
        } else {
          setPendingPixDetails(null);
          setPendingBoletoCode(null);
        }
      } catch (err) {
        console.warn("Falha ao carregar pagamentos da assinatura", err);
        if (!disposed) {
          setLatestPayment(null);
          setPendingPixDetails(null);
          setPendingBoletoCode(null);
        }
      }
    }

    void loadLatestSubscriptionPayment();

    return () => {
      disposed = true;
    };
  }, [subscriptionId, subscriptionStatus]);

  const handleCancelSubscription = useCallback(async () => {
    if (!subscriptionId || !isSubscriptionActive) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    setIsCancelling(true);
    setCancellationSuccessMessage(null);

    try {
      await requestJson<unknown>(
        getApiUrl(`site/asaas/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`),
        { method: "POST" },
      );

      clearPersistedManagePlanSelection();
      setPersistedSelection({});
      window.localStorage.removeItem(subscriptionStorageKey);
      const additionalKeys = getAdditionalSubscriptionStorageKeys(user, subscriptionStorageKey);
      for (const key of additionalKeys) {
        window.localStorage.removeItem(key);
      }
      setSubscriptionId(null);
      setSubscriptionStatusOverride("inactive");
      setCancellationSuccessMessage("Sua assinatura foi cancelada com sucesso.");
      await refreshUser();

      toast({
        title: "Assinatura cancelada",
        description: "As próximas cobranças foram interrompidas e os dados foram atualizados.",
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Não foi possível cancelar a assinatura.";

      toast({
        title: "Falha ao cancelar assinatura",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  }, [
    isSubscriptionActive,
    refreshUser,
    subscriptionId,
    subscriptionStorageKey,
    toast,
    user?.empresa_id,
    user?.id,
  ]);

  useEffect(() => {
    let disposed = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      const planosUrl = joinUrl(apiBaseUrl, "/api/planos");
      const empresasUrl = joinUrl(apiBaseUrl, "/api/empresas");
      const usuariosUrl = joinUrl(apiBaseUrl, "/api/usuarios/empresa");
      const clientesUrl = joinUrl(apiBaseUrl, "/api/clientes/ativos/total");

      try {
        const [planosJson, empresasJson, usuariosJson, clientesJson] = await Promise.all([
          fetch(planosUrl, { headers: { Accept: "application/json" } }).then((res) => {
            if (!res.ok) {
              throw new Error(`Falha ao carregar planos (HTTP ${res.status})`);
            }
            return res.json();
          }),
          fetch(empresasUrl, { headers: { Accept: "application/json" } })
            .then((res) => {
              if (!res.ok) {
                throw new Error(`Falha ao carregar empresas (HTTP ${res.status})`);
              }
              return res.json();
            })
            .catch((err) => {
              console.warn(err);
              return null;
            }),
          fetch(usuariosUrl, { headers: { Accept: "application/json" } })
            .then((res) => {
              if (!res.ok) {
                throw new Error(`Falha ao carregar usuários (HTTP ${res.status})`);
              }
              return res.json();
            })
            .catch((err) => {
              console.warn(err);
              return null;
            }),
          fetch(clientesUrl, { headers: { Accept: "application/json" } })
            .then((res) => {
              if (!res.ok) {
                throw new Error(`Falha ao carregar clientes (HTTP ${res.status})`);
              }
              return res.json();
            })
            .catch((err) => {
              console.warn(err);
              return null;
            }),
        ]);

        const planosRows = normalizeApiRows(planosJson);
        const parsedPlanos = planosRows
          .map((row) => {
            const raw = row as Record<string, unknown>;
            const idNumber = toNumber(raw.id);
            if (idNumber === null) {
              return null;
            }

            const nome = typeof raw.nome === "string" ? raw.nome.trim() : String(raw.nome ?? `Plano ${idNumber}`);
            const ativo = typeof raw.ativo === "boolean" ? raw.ativo : true;
            const descricaoRaw =
              typeof raw.descricao === "string"
                ? raw.descricao.trim()
                : typeof raw.detalhes === "string"
                  ? raw.detalhes.trim()
                  : null;
            const recursos = parseRecursos([
              raw.recursos,
              raw.recursosDisponiveis,
              raw.recursos_disponiveis,
              raw.features,
              raw.items,
              raw.lista,
              raw.modules,
              raw.modulos,
              raw.recursos_personalizados,
              raw.recursosPersonalizados,
              raw.customResources,
              raw.personalizados,
            ]);
            const dataCadastro = parseDate((raw.datacadastro ?? raw.data_cadastro) as unknown);

            const rawValorMensal = (raw.valor_mensal ?? raw.valorMensal ?? raw.preco_mensal ?? raw.precoMensal) as unknown;
            const rawValorAnual = (raw.valor_anual ?? raw.valorAnual ?? raw.preco_anual ?? raw.precoAnual) as unknown;

            const valorMensal = toNumber(rawValorMensal);
            const valorAnual = toNumber(rawValorAnual);

            const pricingDetails = computePricingDetails(valorMensal, valorAnual);
            const precoMensal =
              pricingDetails.precoMensal ??
              (typeof rawValorMensal === "string" && rawValorMensal.trim() ? rawValorMensal.trim() : null);
            const precoAnual =
              pricingDetails.precoAnual ??
              (typeof rawValorAnual === "string" && rawValorAnual.trim() ? rawValorAnual.trim() : null);

            const limiteUsuarios = toNumber(raw.limite_usuarios ?? raw.limiteUsuarios);
            const limiteClientes = toNumber(raw.limite_clientes ?? raw.limiteClientes);
            const limiteProcessos = toNumber(raw.limite_processos ?? raw.limiteProcessos);
            const limitePropostas = toNumber(raw.limite_propostas ?? raw.limitePropostas);

            const slug =
              pickString(raw, [
                "slug",
                "identificador",
                "codigo",
                "cod",
                "chave",
                "key",
                "planSlug",
              ]) ?? slugify(typeof raw.nome === "string" ? raw.nome : null);

            return {
              id: idNumber,
              slug,
              nome,
              ativo,
              descricao: descricaoRaw && descricaoRaw.length > 0 ? descricaoRaw : null,
              recursos,
              dataCadastro,
              valorMensal,
              valorAnual,
              limiteUsuarios: limiteUsuarios ?? null,
              limiteClientes: limiteClientes ?? null,
              limiteProcessos: limiteProcessos ?? null,
              limitePropostas: limitePropostas ?? null,
              precoMensal,
              precoAnual,
              descontoAnualPercentual: pricingDetails.descontoPercentual,
              economiaAnual: pricingDetails.economiaAnual,
              economiaAnualFormatada: pricingDetails.economiaAnualFormatada,
            } satisfies PlanoDetalhe;
          })
          .filter((item): item is PlanoDetalhe => item !== null);

        let endpointPlan: PlanoDetalhe | null = null;
        let endpointPricingMode: PricingMode | null = null;

        try {
          const planPaymentResponse = await fetch(getApiUrl("plan-payments/current"), {
            headers: { Accept: "application/json" },
            credentials: "include",
          });

          if (planPaymentResponse.ok) {
            const planPaymentPayload = await planPaymentResponse.json();
            const planPaymentData = parsePlanPaymentResult(planPaymentPayload);
            const endpointPlanId = toNumber(planPaymentData.plan?.id ?? null);

            if (endpointPlanId !== null) {
              const matchedPlan = parsedPlanos.find((item) => item.id === endpointPlanId) ?? null;

              if (matchedPlan) {
                endpointPlan = matchedPlan;
                const pricingModeValue = planPaymentData.plan?.pricingMode;

                if (pricingModeValue === "mensal" || pricingModeValue === "anual") {
                  endpointPricingMode = pricingModeValue;
                }
              }
            }
          }
        } catch (planPaymentError) {
          console.warn("Falha ao carregar a cobrança atual do plano", planPaymentError);
        }

        if (parsedPlanos.length === 0) {
          throw new Error("Nenhum plano cadastrado.");
        }

        const empresasRows = empresasJson ? normalizeApiRows(empresasJson) : [];
        const planoSelecionado =
          endpointPlan ??
          (subscriptionPlanId !== null
            ? parsedPlanos.find((item) => item.id === subscriptionPlanId) ?? null
            : null) ??
          findPlanFromEmpresa(parsedPlanos, empresasRows) ??
          parsedPlanos.find((item) => item.ativo) ??
          parsedPlanos[0];
        const empresaRecord = empresasRows.find(
          (entry): entry is Record<string, unknown> => entry !== null && typeof entry === "object",
        );
        const empresaBilling = empresaRecord ? extractBillingFromEmpresa(empresaRecord) : null;
        const userSubscriptionId = resolveSubscriptionId(user?.subscription ?? null, [
          "subscriptionId",
          "id",
          "asaasSubscriptionId",
          "asaas_subscription_id",
          "asaas_subscription",
          "asaasSubscription",
        ]) ?? resolveSubscriptionId(user, [
          "subscriptionId",
          "subscription_id",
          "asaasSubscriptionId",
          "asaas_subscription_id",
        ]);
        const empresaSubscriptionId = empresaRecord
          ? extractSubscriptionIdFromEmpresa(empresaRecord)
          : null;
        const resolvedSubscriptionId = userSubscriptionId ?? empresaSubscriptionId ?? null;
        const userBilling = (() => {
          const name = toStringOrNull(user?.empresa_nome ?? null);
          const email = toStringOrNull(user?.email ?? null);
          if (!name && !email) {
            return null;
          }
          return {
            ...(name ? { companyName: name } : {}),
            ...(email ? { email } : {}),
          } satisfies ManagePlanSelection["billing"];
        })();
        const combinedBilling = mergeBillingDetails(empresaBilling, userBilling);

        const usuariosCount = usuariosJson ? normalizeApiRows(usuariosJson).length : null;

        let clientesAtivos: number | null = null;
        if (clientesJson && typeof clientesJson === "object" && clientesJson !== null) {
          const maybeDirect = (clientesJson as { total_clientes_ativos?: unknown }).total_clientes_ativos;
          const maybeNested = (clientesJson as { data?: { total_clientes_ativos?: unknown } }).data?.total_clientes_ativos;
          const maybeTotal = (clientesJson as { total?: unknown }).total;
          clientesAtivos = toNumber(maybeDirect) ?? toNumber(maybeNested) ?? toNumber(maybeTotal);
        }

        if (!disposed) {
          if (resolvedSubscriptionId) {
            setSubscriptionId((current) => (current === resolvedSubscriptionId ? current : resolvedSubscriptionId));
            if (typeof window !== "undefined") {
              try {
                window.localStorage.setItem(subscriptionStorageKey, resolvedSubscriptionId);
                const additionalKeys = getAdditionalSubscriptionStorageKeys(
                  user,
                  subscriptionStorageKey,
                );
                for (const key of additionalKeys) {
                  window.localStorage.removeItem(key);
                }
              } catch (storageError) {
                console.warn("Falha ao salvar subscriptionId no storage", storageError);
              }
            }
          }
          setPlanosDisponiveis(parsedPlanos);
          setPlanoAtual(planoSelecionado);
          setPreviewPlano(null);
          setPricingMode(endpointPricingMode ?? getDefaultPricingMode(planoSelecionado));
          setBillingDetails(combinedBilling);
          setMetrics({
            usuariosAtivos: usuariosCount,
            clientesAtivos,
            processosAtivos: null,
            propostasEmitidas: null,
          });
        }
      } catch (err) {
        console.error(err);
        if (!disposed) {
          setError(err instanceof Error ? err.message : "Não foi possível carregar os dados do plano.");
          setPlanosDisponiveis([]);
          setPlanoAtual(null);
          setPreviewPlano(null);
          setBillingDetails(null);
          setMetrics({ usuariosAtivos: null, clientesAtivos: null, processosAtivos: null, propostasEmitidas: null });
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      disposed = true;
    };
  }, [
    apiBaseUrl,
    subscriptionPlanId,
    subscriptionStorageKey,
    user?.email,
    user?.empresa_nome,
    user?.subscription,
  ]);

  useEffect(() => {
    const summary = navigationState.paymentSummary;
    if (!summary) {
      return;
    }

    setPersistedSelection((previous) => {
      const current = previous.paymentSummary ?? null;
      if (
        current?.status === (summary.status ?? null) &&
        current?.paymentMethod === (summary.paymentMethod ?? null) &&
        current?.dueDate === (summary.dueDate ?? null) &&
        current?.amount === (summary.amount ?? null)
      ) {
        return previous;
      }

      return { ...previous, paymentSummary: summary };
    });
  }, [navigationState.paymentSummary]);

  useEffect(() => {
    setPersistedSelection((previous) => {
      if (!billingDetails) {
        if (!previous.billing) {
          return previous;
        }
        const { billing: _ignored, ...rest } = previous;
        return { ...rest };
      }

      const current = previous.billing ?? null;
      if (
        current?.companyName === (billingDetails.companyName ?? null) &&
        current?.document === (billingDetails.document ?? null) &&
        current?.email === (billingDetails.email ?? null)
      ) {
        return previous;
      }

      return { ...previous, billing: billingDetails };
    });
  }, [billingDetails]);

  const planoExibido = previewPlano ?? planoAtual;

  useEffect(() => {
    if (!planoExibido) {
      return;
    }

    if (pricingMode === "anual" && !hasAnualPricing(planoExibido)) {
      setPricingMode(hasMensalPricing(planoExibido) ? "mensal" : "anual");
      return;
    }

    if (pricingMode === "mensal" && !hasMensalPricing(planoExibido)) {
      setPricingMode(hasAnualPricing(planoExibido) ? "anual" : "mensal");
    }
  }, [pricingMode, planoExibido]);

  const pricingDisplay = useMemo(() => buildPricingDisplay(planoExibido, pricingMode), [planoExibido, pricingMode]);

  const cobrancaInfo = useMemo(() => estimateNextBilling(planoAtual), [planoAtual]);

  const availableModesLabel = useMemo(() => formatAvailableModes(planoExibido), [planoExibido]);
  const paymentSummary = persistedSelection.paymentSummary ?? null;
  const currentPaymentSummary = useMemo<ManagePlanSelection["paymentSummary"] | null>(() => {
    if (latestPayment) {
      return {
        status: latestPayment.status,
        paymentMethod: latestPayment.billingType,
        ...(latestPayment.dueDate ? { dueDate: latestPayment.dueDate } : {}),
        ...(latestPayment.value !== null ? { amount: latestPayment.value } : {}),
      };
    }

    if (paymentSummary) {
      return paymentSummary;
    }

    if (isSubscriptionActive) {
      return {
        status: "active",
        paymentMethod: "Assinatura",
      };
    }

    return null;
  }, [latestPayment, paymentSummary, isSubscriptionActive]);
  const currentPaymentMethodKey = currentPaymentSummary?.paymentMethod
    ? currentPaymentSummary.paymentMethod.toUpperCase()
    : null;
  const paymentStatusDetails = useMemo(
    () => resolvePaymentStatusDetails(currentPaymentSummary?.status ?? null),
    [currentPaymentSummary?.status],
  );
  const paymentStatusBadge = useMemo(() => {
    if (!paymentStatusDetails.statusLabel) {
      return null;
    }

    if (paymentStatusDetails.isPending) {
      return {
        label: "Pagamento pendente",
        className: "border-amber-400/60 bg-amber-500/15 text-amber-900",
      };
    }

    if (paymentStatusDetails.isActive) {
      return {
        label: "Cobrança ativa",
        className: "border-blue-400/60 bg-blue-500/15 text-blue-900",
      };
    }

    return {
      label: paymentStatusDetails.statusLabel,
      className: "border-primary/40 bg-primary/10 text-primary",
    };
  }, [paymentStatusDetails]);
  const currentPaymentMethodLabel = useMemo(() => {
    if (!currentPaymentMethodKey) {
      return currentPaymentSummary?.paymentMethod ?? null;
    }

    if (currentPaymentMethodKey in PAYMENT_METHOD_LABELS) {
      return PAYMENT_METHOD_LABELS[currentPaymentMethodKey as keyof typeof PAYMENT_METHOD_LABELS];
    }

    return currentPaymentSummary?.paymentMethod ?? currentPaymentMethodKey;
  }, [currentPaymentMethodKey, currentPaymentSummary?.paymentMethod]);
  const pendingBoletoLink = latestPayment?.boletoLink ?? null;
  const pendingCheckoutNotice = useMemo(() => {
    if (!paymentStatusDetails.isPending) {
      return null;
    }

    const amountLabel =
      currentPaymentSummary?.amount && Number.isFinite(currentPaymentSummary.amount)
        ? currencyFormatter.format(currentPaymentSummary.amount)
        : pricingDisplay.mainPrice;
    const methodKey = currentPaymentSummary?.paymentMethod ?? null;
    const methodLabel =
      methodKey && methodKey in PAYMENT_METHOD_LABELS
        ? PAYMENT_METHOD_LABELS[methodKey as keyof typeof PAYMENT_METHOD_LABELS]
        : methodKey;

    let dueDateLabel: string | null = null;
    if (currentPaymentSummary?.dueDate) {
      const parsed = new Date(currentPaymentSummary.dueDate);
      dueDateLabel = Number.isNaN(parsed.getTime())
        ? currentPaymentSummary.dueDate
        : new Intl.DateTimeFormat("pt-BR").format(parsed);
    }

    const methodSegment = methodLabel ? ` via ${methodLabel}` : "";
    const dueDateSegment = dueDateLabel ? ` com vencimento em ${dueDateLabel}` : "";
    const amountSegment = amountLabel ?? "seu plano";

    return `O pagamento de ${amountSegment}${methodSegment} está pendente${dueDateSegment}. Assim que confirmarmos o recebimento, atualizaremos automaticamente o seu plano e enviaremos a confirmação por e-mail.`;
  }, [
    paymentStatusDetails.isPending,
    currentPaymentSummary?.amount,
    currentPaymentSummary?.dueDate,
    currentPaymentSummary?.paymentMethod,
    pricingDisplay.mainPrice,
  ]);
  const checkoutSelection = useMemo<ManagePlanSelection | null>(() => {
    if (!planoExibido) {
      return null;
    }

    const mode = resolvePricingModeForPlan(pricingMode, planoExibido);

    const selection: ManagePlanSelection = {
      plan: {
        id: planoExibido.id,
        nome: planoExibido.nome,
        descricao: planoExibido.descricao,
        recursos: planoExibido.recursos,
        valorMensal: planoExibido.valorMensal,
        valorAnual: planoExibido.valorAnual,
        precoMensal: planoExibido.precoMensal,
        precoAnual: planoExibido.precoAnual,
        descontoAnualPercentual: planoExibido.descontoAnualPercentual,
        economiaAnual: planoExibido.economiaAnual,
        economiaAnualFormatada: planoExibido.economiaAnualFormatada,
      },
      pricingMode: mode,
    };
    if (billingDetails) {
      selection.billing = billingDetails;
    }
    return selection;
  }, [billingDetails, planoExibido, pricingMode]);

  const handleNavigateToCheckout = useCallback(() => {
    if (!checkoutSelection?.plan) {
      return;
    }

    if (!subscriptionId) {
      toast({
        title: "Assinatura não disponível",
        description: "Aguarde o carregamento da assinatura antes de prosseguir para o checkout.",
      });
      return;
    }

    persistManagePlanSelection(checkoutSelection);
    setPersistedSelection((previous) => {
      const shouldKeepPaymentSummary =
        previous?.plan?.id === checkoutSelection.plan?.id &&
        previous?.pricingMode === checkoutSelection.pricingMode;

      if (shouldKeepPaymentSummary && previous.paymentSummary) {
        return { ...checkoutSelection, paymentSummary: previous.paymentSummary };
      }

      return checkoutSelection;
    });
    navigate(routes.meuPlanoPayment, { state: checkoutSelection });
  }, [
    checkoutSelection,
    navigate,
    persistManagePlanSelection,
    setPersistedSelection,
    subscriptionId,
    toast,
  ]);

  const pendingNoticeMessage = useMemo(() => {
    if (!isPaymentPending) {
      return null;
    }

    const amount = pricingDisplay.mainPrice;
    const cadence = pricingDisplay.cadenceLabel;
    const nextBilling = cobrancaInfo.nextBilling;
    const paymentStatusDescription =
      subscriptionStatusLabel?.replace(/^Pagamento\s+/i, "").toLowerCase() ?? "pendente";

    if (nextBilling) {
      return `O pagamento de ${amount} ${cadence} está ${paymentStatusDescription}. Próxima cobrança estimada em ${nextBilling}.`;
    }

    return `O pagamento de ${amount} ${cadence} está ${paymentStatusDescription}. Consulte o time financeiro para confirmar a próxima cobrança.`;
  }, [
    cobrancaInfo.nextBilling,
    isPaymentPending,
    pricingDisplay.cadenceLabel,
    pricingDisplay.mainPrice,
    subscriptionStatusLabel,
  ]);

  const usageItems = useMemo<UsageItem[]>(() => {
    if (!planoExibido) {
      return [];
    }

    const items: UsageItem[] = [];
    if (planoExibido.limiteUsuarios !== null || metrics.usuariosAtivos !== null) {
      items.push({
        label: "Usuários ativos",
        current: metrics.usuariosAtivos,
        limit: planoExibido.limiteUsuarios,
      });
    }
    if (planoExibido.limiteClientes !== null || metrics.clientesAtivos !== null) {
      items.push({
        label: "Clientes ativos",
        current: metrics.clientesAtivos,
        limit: planoExibido.limiteClientes,
      });
    }
    if (planoExibido.limiteProcessos !== null || metrics.processosAtivos !== null) {
      items.push({
        label: "Processos cadastrados",
        current: metrics.processosAtivos,
        limit: planoExibido.limiteProcessos,
      });
    }
    if (planoExibido.limitePropostas !== null || metrics.propostasEmitidas !== null) {
      items.push({
        label: "Propostas enviadas",
        current: metrics.propostasEmitidas,
        limit: planoExibido.limitePropostas,
      });
    }

    return items;
  }, [
    metrics.processosAtivos,
    metrics.propostasEmitidas,
    metrics.usuariosAtivos,
    metrics.clientesAtivos,
    planoExibido,
  ]);

  const beneficios = planoExibido?.recursos ?? [];

  const planosElegiveis = useMemo(() => {
    const currentPlanId = planoAtual?.id ?? null;
    return planosDisponiveis.filter((plan) => plan.ativo || plan.id === currentPlanId);
  }, [planoAtual?.id, planosDisponiveis]);

  const destaquePlanoId = useMemo(() => {
    if (planosElegiveis.length === 0) {
      return null;
    }

    const sorted = [...planosElegiveis]
      .map((item) => {
        const monthlyEquivalent =
          item.valorMensal !== null
            ? item.valorMensal
            : item.valorAnual !== null
              ? item.valorAnual / 12
              : null;
        return { item, monthlyEquivalent };
      })
      .filter((entry) => entry.monthlyEquivalent !== null)
      .sort((a, b) => (b.monthlyEquivalent ?? 0) - (a.monthlyEquivalent ?? 0));

    return sorted[0]?.item.id ?? null;
  }, [planosElegiveis]);

  const anyMensalPlan = useMemo(() => planosElegiveis.some((plan) => hasMensalPricing(plan)), [planosElegiveis]);
  const anyAnualPlan = useMemo(() => planosElegiveis.some((plan) => hasAnualPricing(plan)), [planosElegiveis]);

  const planosOrdenados = useMemo(() => {
    if (planosElegiveis.length === 0) {
      return [];
    }

    const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

    const getComparablePrice = (plan: PlanoDetalhe): number | null => {
      const hasMensalPrice = typeof plan.valorMensal === "number" && Number.isFinite(plan.valorMensal);
      const hasAnualPrice = typeof plan.valorAnual === "number" && Number.isFinite(plan.valorAnual);

      if (pricingMode === "anual") {
        if (hasAnualPrice) {
          return plan.valorAnual as number;
        }
        if (hasMensalPrice) {
          return (plan.valorMensal as number) * 12;
        }
        return null;
      }

      if (hasMensalPrice) {
        return plan.valorMensal as number;
      }
      if (hasAnualPrice) {
        return (plan.valorAnual as number) / 12;
      }
      return null;
    };

    return [...planosElegiveis].sort((a, b) => {
      const priceA = getComparablePrice(a);
      const priceB = getComparablePrice(b);

      if (priceA === null && priceB === null) {
        return collator.compare(a.nome, b.nome);
      }
      if (priceA === null) {
        return 1;
      }
      if (priceB === null) {
        return -1;
      }
      if (priceA !== priceB) {
        return priceA - priceB;
      }
      return collator.compare(a.nome, b.nome);
    });
  }, [planosElegiveis, pricingMode]);

  const handlePlanSelection = useCallback(
    (plan: PlanoDetalhe) => {
      const hasMensal = hasMensalPricing(plan);
      const hasAnual = hasAnualPricing(plan);

      if (!hasMensal && !hasAnual) {
        toast({
          title: `Plano ${plan.nome} ${PRICING_ON_REQUEST_LABEL.toLowerCase()}`,
          description: `Os valores deste plano estão ${PRICING_ON_REQUEST_LABEL.toLowerCase()} no momento.`,
        });
        return;
      }

      setPreviewPlano(plan);
      setDialogOpen(false);
      const nextPricingMode = resolvePricingModeForPlan(pricingMode, plan);
      setPricingMode(nextPricingMode);
      toast({
        title: `Plano ${plan.nome} selecionado`,
        description: isTrialing
          ? "Revise as opções de pagamento para concluir a contratação do plano escolhido."
          : "Revise as opções de pagamento para confirmar a alteração do seu plano.",
      });
      const selection: ManagePlanSelection = {
        plan: {
          id: plan.id,
          nome: plan.nome,
          descricao: plan.descricao,
          recursos: plan.recursos,
          valorMensal: plan.valorMensal,
          valorAnual: plan.valorAnual,
          precoMensal: plan.precoMensal,
          precoAnual: plan.precoAnual,
          descontoAnualPercentual: plan.descontoAnualPercentual,
          economiaAnual: plan.economiaAnual,
          economiaAnualFormatada: plan.economiaAnualFormatada,
        },
        pricingMode: nextPricingMode,
      };

      if (billingDetails) {
        selection.billing = billingDetails;
      }

      persistManagePlanSelection(selection);
      setPersistedSelection((previous) => {
        const shouldKeepPaymentSummary =
          previous?.plan?.id === selection.plan?.id && previous?.pricingMode === selection.pricingMode;

        if (shouldKeepPaymentSummary && previous.paymentSummary) {
          return { ...selection, paymentSummary: previous.paymentSummary };
        }

        return selection;
      });
      navigate(routes.meuPlanoPayment, { state: selection });
    },
    [billingDetails, isTrialing, navigate, persistManagePlanSelection, pricingMode, setPersistedSelection, toast],
  );

  const resetPreview = useCallback(() => {
    setPreviewPlano(null);
    if (planoAtual) {
      setPricingMode(getDefaultPricingMode(planoAtual));
    }
    toast({
      title: "Plano atual restabelecido",
      description: "Você voltou a visualizar o plano contratado atualmente.",
    });
  }, [planoAtual, toast]);

  const hasAnnualPricing = hasAnualPricing(planoExibido);
  const hasMensalPricingAvailable = hasMensalPricing(planoExibido);

  return (
    <div className="space-y-8 p-6 md:p-8 lg:p-10 max-w-[1600px] mx-auto">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary/5 via-background to-background border border-primary/10 p-8 md:p-12 shadow-sm">
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-foreground">
              Meu Plano
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
              {isTrialing
                ? "Você está em período de avaliação. Aproveite para explorar todos os recursos premium."
                : "Gerencie sua assinatura e acompanhe o crescimento do seu escritório."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {isTrialing && planoAtual && (
              <Button
                onClick={() => handlePlanSelection(planoAtual)}
                className="rounded-full shadow-lg bg-green-600 hover:bg-green-700 text-white shadow-green-900/20 transition-all hover:scale-105"
              >
                Assinar plano atual
              </Button>
            )}
            <Button onClick={() => setDialogOpen(true)} className="rounded-full shadow-lg shadow-primary/20 transition-all hover:scale-105 hover:shadow-primary/30">
              Ver planos disponíveis
            </Button>
            <Button
              variant="secondary"
              className="rounded-full shadow-sm"
              onClick={() => {
                if (subscriptionId) {
                  navigate(routes.subscription(subscriptionId));
                  return;
                }
                toast({
                  title: "Aguarde um instante",
                  description: "Ainda estamos carregando os dados da sua assinatura.",
                });
              }}
            >
              Histórico de pagamentos
            </Button>
            <Button
              variant="secondary"
              disabled={!checkoutSelection || !subscriptionId}
              onClick={handleNavigateToCheckout}
              className="rounded-full"
            >
              Ir para checkout
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl opacity-50" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl opacity-50" />
      </div>

      {loading ? (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-3 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Carregando informações do plano…</span>
          </CardContent>
        </Card>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Não foi possível carregar o plano</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !planoAtual ? (
        <Alert>
          <AlertTitle>Nenhum plano encontrado</AlertTitle>
          <AlertDescription>
            Cadastre um plano em <strong>Configurações &gt; Planos</strong> para visualizar os detalhes aqui.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {previewPlano && (
            <Alert>
              <Sparkles className="h-4 w-4 text-primary" />
              <AlertTitle>Pré-visualizando o plano {previewPlano.nome}</AlertTitle>
              <AlertDescription>
                Os limites e valores abaixo refletem uma simulação. O plano atual permanece <strong>{planoAtual.nome}</strong>.
                Para contratar definitivamente, acesse <strong>Configurações &gt; Planos</strong>.
              </AlertDescription>
            </Alert>
          )}

          {cancellationSuccessMessage && (
            <Alert className="border-blue-300/60 bg-blue-50">
              <Check className="h-4 w-4 text-blue-600" />
              <AlertTitle>Assinatura cancelada</AlertTitle>
              <AlertDescription>{cancellationSuccessMessage}</AlertDescription>
            </Alert>
          )}

          {pendingNoticeMessage && (
            <Alert>
              <AlertTitle>Assinatura com pagamento pendente</AlertTitle>
              <AlertDescription>{pendingNoticeMessage}</AlertDescription>
            </Alert>
          )}

          {pendingCheckoutNotice && (
            <Alert className="border-amber-400/40 bg-amber-50">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertTitle>Pagamento em processamento</AlertTitle>
              <AlertDescription>{pendingCheckoutNotice}</AlertDescription>
            </Alert>
          )}

          <Card className="relative overflow-hidden border-none bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-50 shadow-2xl rounded-[2.5rem]">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-32 -top-32 h-[600px] w-[600px] rounded-full bg-primary/20 blur-[120px] opacity-40 dark:opacity-20 mix-blend-multiply dark:mix-blend-screen animate-pulse-slow" />
              <div className="absolute -bottom-32 -left-20 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[120px] opacity-40 dark:opacity-20 mix-blend-multiply dark:mix-blend-screen" />
            </div>
            <CardContent className="relative z-10 space-y-10 p-8 md:p-12">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary dark:text-primary-foreground/90 px-3 py-1 rounded-full">
                      {previewPlano ? "Modo de Pré-visualização" : "Plano Ativo"}
                    </Badge>
                    <Badge variant={planoExibido?.ativo ? "secondary" : "outline"} className="rounded-full px-3 py-1">
                      {planoExibido?.ativo ? "Disponível" : "Indisponível"}
                    </Badge>
                    {availableModesLabel && <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1">{availableModesLabel}</Badge>}
                    {subscriptionStatusLabel && (
                      <Badge variant="outline" className="border-blue-400/30 bg-blue-500/10 text-blue-300 rounded-full px-3 py-1">
                        {subscriptionStatusLabel}
                      </Badge>
                    )}
                    {paymentStatusBadge && (
                      <Badge className={cn("rounded-full px-3 py-1", paymentStatusBadge.className)}>
                        {paymentStatusBadge.label}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-slate-100 border border-slate-200 dark:bg-white/5 dark:border-white/10 backdrop-blur-sm">
                        <Sparkles className="h-8 w-8 text-primary" />
                      </div>
                      <span className="text-4xl font-bold tracking-tight md:text-5xl text-slate-900 dark:text-white">{planoExibido?.nome}</span>
                    </div>
                    <p className="max-w-xl text-lg text-slate-500 dark:text-slate-400 leading-relaxed">
                      {planoExibido?.descricao ||
                        "Uma combinação equilibrada de recursos para manter a operação do seu time em alta performance."}
                    </p>
                  </div>

                  {currentPaymentSummary && (
                    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/50 dark:border-white/10 dark:bg-white/5 p-6 transition-all hover:bg-white/60 dark:hover:bg-white/10">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-100 dark:via-white/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      <div className="relative space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            {latestPayment ? "Última Fatura" : "Status da Assinatura"}
                          </p>
                          {currentPaymentMethodLabel && (
                            <Badge variant="outline" className="border-slate-200 bg-white/50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                              {currentPaymentMethodLabel}
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          {paymentStatusBadge ? (
                            <Badge className={cn("rounded-full px-3 py-1 text-sm", paymentStatusBadge.className)}>
                              {paymentStatusBadge.label}
                            </Badge>
                          ) : (
                            <span className="text-sm text-slate-500 dark:text-slate-400">Status indisponível</span>
                          )}
                        </div>

                        {paymentStatusDetails.isPending && currentPaymentMethodKey === "PIX" && (
                          <div className="mt-4 space-y-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
                            <div className="flex items-center gap-2 text-primary">
                              <Clock className="h-4 w-4" />
                              <p className="text-sm font-semibold">Aguardando pagamento via PIX</p>
                            </div>
                            {pendingPixDetails?.image && (
                              <div className="flex justify-center rounded-lg bg-white p-2 w-fit mx-auto">
                                <img src={pendingPixDetails.image} alt="QR Code PIX" className="h-40 w-40" />
                              </div>
                            )}
                            {pendingPixDetails?.payload && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-primary/70">Código copia e cola</p>
                                <div className="rounded-lg bg-black/20 p-3">
                                  <p className="break-all text-xs font-mono text-slate-600 dark:text-slate-300">{pendingPixDetails.payload}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {paymentStatusDetails.isPending && currentPaymentMethodKey === "BOLETO" && (
                          <div className="mt-4 space-y-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
                            <div className="flex items-center gap-2 text-primary">
                              <Clock className="h-4 w-4" />
                              <p className="text-sm font-semibold">Aguardando pagamento do boleto</p>
                            </div>
                            {pendingBoletoCode && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-primary/70">Linha digitável</p>
                                <div className="rounded-lg bg-black/20 p-3">
                                  <p className="break-all text-xs font-mono text-slate-600 dark:text-slate-300">{pendingBoletoCode}</p>
                                </div>
                              </div>
                            )}
                            {pendingBoletoLink && (
                              <Button asChild className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                                <a href={pendingBoletoLink} target="_blank" rel="noreferrer">
                                  Abrir boleto bancário
                                </a>
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-start gap-6 lg:items-end">
                  <ToggleGroup
                    type="single"
                    value={pricingMode}
                    onValueChange={(value) => value && setPricingMode(value as PricingMode)}
                    className="rounded-full border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/5 p-1.5 backdrop-blur-md"
                  >
                    <ToggleGroupItem
                      value="mensal"
                      className="rounded-full px-6 py-2 text-sm transition-all data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-lg"
                      disabled={!hasMensalPricingAvailable}
                    >
                      Mensal
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="anual"
                      className="rounded-full px-6 py-2 text-sm transition-all data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-lg"
                      disabled={!hasAnnualPricing}
                    >
                      Anual
                    </ToggleGroupItem>
                  </ToggleGroup>

                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold tracking-tight md:text-6xl text-slate-900 dark:text-white">{pricingDisplay.mainPrice}</span>
                      <span className="text-lg font-medium text-slate-500 dark:text-slate-400">{pricingDisplay.cadenceLabel}</span>
                    </div>
                    {pricingDisplay.discountBadge && (
                      <Badge variant="secondary" className="rounded-full bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/20">
                        {pricingDisplay.discountBadge} OFF no anual
                      </Badge>
                    )}
                    {pricingDisplay.savingsLabel && (
                      <p className="text-sm font-medium text-blue-400">{pricingDisplay.savingsLabel}</p>
                    )}
                    {pricingDisplay.helper && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">{pricingDisplay.helper}</p>
                    )}
                  </div>
                </div>
              </div>

              <Separator className="bg-slate-200 dark:bg-slate-800/50" />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <div className="group relative overflow-hidden rounded-3xl border border-white/50 bg-white/40 p-5 dark:border-white/5 dark:bg-white/5 backdrop-blur-md transition-all hover:bg-white/60 dark:hover:bg-white/10 hover:-translate-y-1 hover:shadow-lg">
                  <div className="absolute -right-4 -top-4 h-16 w-16 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all" />
                  <p className="relative text-xs font-bold uppercase tracking-wider text-primary mb-2">Plano atual</p>
                  <p className="relative text-lg font-bold text-slate-900 dark:text-white truncate">{planoAtual.nome}</p>
                  {previewPlano && (
                    <p className="relative text-xs text-primary/70 mt-1 font-medium">Visualizando {planoExibido?.nome}</p>
                  )}
                </div>

                <div className="group relative overflow-hidden rounded-3xl border border-white/50 bg-white/40 p-5 dark:border-white/5 dark:bg-white/5 backdrop-blur-md transition-all hover:bg-white/60 dark:hover:bg-white/10 hover:-translate-y-1 hover:shadow-lg">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Cobrança</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{cobrancaInfo.cadenceLabel}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate font-medium">
                    {cobrancaInfo.nextBilling
                      ? `Próxima: ${cobrancaInfo.nextBilling}`
                      : "Consulte financeiro"}
                  </p>
                </div>

                <div className="group relative overflow-hidden rounded-3xl border border-white/50 bg-white/40 p-5 dark:border-white/5 dark:bg-white/5 backdrop-blur-md transition-all hover:bg-white/60 dark:hover:bg-white/10 hover:-translate-y-1 hover:shadow-lg">
                  <div className="absolute right-2 top-2 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Users className="h-3 w-3" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Usuários</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {formatLimitValue(planoExibido?.limiteUsuarios ?? null, "", "")}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Contas ativas</p>
                </div>

                <div className="group relative overflow-hidden rounded-3xl border border-white/50 bg-white/40 p-5 dark:border-white/5 dark:bg-white/5 backdrop-blur-md transition-all hover:bg-white/60 dark:hover:bg-white/10 hover:-translate-y-1 hover:shadow-lg">
                  <div className="absolute right-2 top-2 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Users className="h-3 w-3" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Clientes</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {formatLimitValue(planoExibido?.limiteClientes ?? null, "", "")}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Cadastrados</p>
                </div>

                <div className="group relative overflow-hidden rounded-3xl border border-white/50 bg-white/40 p-5 dark:border-white/5 dark:bg-white/5 backdrop-blur-md transition-all hover:bg-white/60 dark:hover:bg-white/10 hover:-translate-y-1 hover:shadow-lg">
                  <div className="absolute right-2 top-2 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <FileText className="h-3 w-3" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Processos</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {formatLimitValue(planoExibido?.limiteProcessos ?? null, "", "")}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Monitorados</p>
                </div>

                <div className="group relative overflow-hidden rounded-3xl border border-white/50 bg-white/40 p-5 dark:border-white/5 dark:bg-white/5 backdrop-blur-md transition-all hover:bg-white/60 dark:hover:bg-white/10 hover:-translate-y-1 hover:shadow-lg">
                  <div className="absolute right-2 top-2 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <FileText className="h-3 w-3" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Propostas</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {formatLimitValue(planoExibido?.limitePropostas ?? null, "", "")}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Mensais</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="rounded-full shadow-lg shadow-primary/20">
                      {isTrialing ? "Contratar plano" : "Fazer upgrade"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl">
                    <DialogHeader>
                      <DialogTitle>{isTrialing ? "Escolha seu plano" : "Faça upgrade do seu plano"}</DialogTitle>
                      <DialogDescription>
                        {isTrialing
                          ? "Selecione o plano que deseja contratar ao final do período de avaliação e prossiga para o pagamento."
                          : "Compare as opções disponíveis e avance para a etapa de pagamento do upgrade desejado."}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6">
                      <ToggleGroup
                        type="single"
                        value={pricingMode}
                        onValueChange={(value) => value && setPricingMode(value as PricingMode)}
                        variant="outline"
                        className="mx-auto w-fit rounded-full bg-secondary/50 p-1.5 ring-1 ring-inset ring-border/40 backdrop-blur-sm"
                      >
                        <ToggleGroupItem
                          value="mensal"
                          className="rounded-full px-6 py-2 text-sm font-medium data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm transition-all"
                          disabled={!anyMensalPlan}
                        >
                          Mensal
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="anual"
                          className="rounded-full px-4 py-2 text-sm"
                          disabled={!anyAnualPlan}
                        >
                          Anual
                        </ToggleGroupItem>
                      </ToggleGroup>
                      <Carousel className="relative">
                        <CarouselContent>
                          {planosOrdenados.map((plano) => {
                            const carouselPricing = buildPricingDisplay(plano, pricingMode);
                            const isAtual = planoAtual.id === plano.id;
                            const isPreviewing = previewPlano?.id === plano.id;
                            const isSelecionado = previewPlano ? isPreviewing : isAtual;
                            const isDestaque = destaquePlanoId === plano.id;

                            return (
                              <CarouselItem
                                key={plano.id}
                                className="md:basis-1/2 lg:basis-1/3 xl:basis-1/4"
                              >

                                <Card
                                  className={cn(
                                    "relative flex h-full flex-col overflow-hidden rounded-3xl border transition-all duration-300",
                                    "bg-white dark:bg-zinc-950",
                                    "hover:-translate-y-2 hover:shadow-2xl",
                                    // Light mode base
                                    "border-zinc-200 shadow-xl shadow-zinc-200/50",
                                    // Dark mode base
                                    "dark:border-zinc-800 dark:shadow-black/50",

                                    isSelecionado
                                      ? "border-primary ring-2 ring-primary/10 shadow-primary/20"
                                      : "hover:border-zinc-300 dark:hover:border-zinc-700",

                                    isAtual && !isSelecionado && "border-blue-500/50 ring-1 ring-blue-500/20"
                                  )}
                                >
                                  {/* Glassy overlay effect */}
                                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-50/30 to-zinc-100/50 dark:via-white/5 dark:to-white/5 pointer-events-none" />

                                  {/* Modernized blurred blobs */}
                                  <div className="pointer-events-none absolute -top-32 -right-32 h-64 w-64 rounded-full bg-primary/10 blur-[80px] dark:bg-primary/20" />
                                  <div className="pointer-events-none absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-blue-500/10 blur-[80px] dark:bg-blue-500/20" />

                                  <CardHeader className="relative z-10 space-y-6 pb-0 text-left pt-8 px-8">

                                    <div className="flex flex-wrap items-center gap-2">
                                      {isAtual && (
                                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                                          <Sparkles className="mr-1 h-3 w-3" /> Atual
                                        </Badge>
                                      )}
                                      {isPreviewing && (
                                        <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary">
                                          Visualizando
                                        </Badge>
                                      )}
                                      {isDestaque && (
                                        <Badge className="bg-amber-500 text-white hover:bg-amber-600 border-none shadow-sm">
                                          <Crown className="mr-1 h-3 w-3" /> Recomendado
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="space-y-6">
                                      <div className="space-y-2">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                                          Plano
                                        </span>
                                        <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
                                          {plano.nome}
                                        </CardTitle>
                                        {plano.descricao && (
                                          <CardDescription className="text-base leading-relaxed text-muted-foreground">
                                            {plano.descricao}
                                          </CardDescription>
                                        )}
                                      </div>

                                      <div className="space-y-2 rounded-2xl bg-secondary/30 p-4 border border-border/50">
                                        <div className="flex items-baseline gap-1">
                                          <span className="text-3xl font-bold text-foreground">
                                            {carouselPricing.mainPrice}
                                          </span>
                                          <span className="text-sm font-medium text-muted-foreground">
                                            {carouselPricing.cadenceLabel}
                                          </span>
                                        </div>

                                        {(carouselPricing.discountBadge || carouselPricing.savingsLabel) && (
                                          <div className="flex flex-col gap-1">
                                            {carouselPricing.discountBadge && (
                                              <span className="w-fit rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-bold text-green-600 dark:text-green-400">
                                                {carouselPricing.discountBadge} OFF
                                              </span>
                                            )}
                                            {carouselPricing.savingsLabel && (
                                              <p className="text-xs font-medium text-green-600 dark:text-green-400">
                                                {carouselPricing.savingsLabel}
                                              </p>
                                            )}
                                          </div>
                                        )}

                                        {carouselPricing.helper && (
                                          <p className="text-xs text-muted-foreground/80">{carouselPricing.helper}</p>
                                        )}
                                      </div>
                                    </div>
                                  </CardHeader>

                                  <CardContent className="relative z-10 flex flex-1 flex-col gap-6 p-8">
                                    <div className="space-y-4">
                                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
                                        O que está incluso
                                      </p>
                                      <ul className="space-y-3">
                                        {plano.recursos.length > 0 ? (
                                          plano.recursos.slice(0, 6).map((recurso) => (
                                            <li key={recurso} className="flex items-start gap-3">
                                              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                <Check className="h-3 w-3" />
                                              </div>
                                              <span className="text-sm text-foreground/80 leading-tight font-medium">{recurso}</span>
                                            </li>
                                          ))
                                        ) : (
                                          <li className="text-sm text-muted-foreground italic">
                                            Sem recursos listados.
                                          </li>
                                        )}
                                      </ul>
                                    </div>
                                  </CardContent>

                                  <CardFooter className="mt-auto p-8 pt-0">
                                    <Button
                                      className={cn(
                                        "w-full h-11 font-semibold rounded-xl text-sm transition-all shadow-sm",
                                        isSelecionado
                                          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5"
                                          : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",

                                        isAtual && !isSelecionado && "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:text-blue-400 dark:hover:bg-blue-500/20 shadow-none border border-blue-200/50 dark:border-blue-800/50"
                                      )}
                                      onClick={() => handlePlanSelection(plano)}
                                      disabled={isAtual && !previewPlano && !isTrialing}
                                    >
                                      {isTrialing ? (
                                        "Contratar este plano"
                                      ) : isAtual && !previewPlano ? (
                                        <span className="flex items-center gap-2"><Check className="h-4 w-4" /> Plano Atual</span>
                                      ) : (
                                        "Selecionar Plano"
                                      )}
                                    </Button>
                                  </CardFooter>
                                </Card>
                              </CarouselItem>
                            );
                          })}
                        </CarouselContent>
                        <CarouselPrevious className="hidden md:flex" />
                        <CarouselNext className="hidden md:flex" />
                      </Carousel>
                    </div>
                  </DialogContent>
                </Dialog>
                {previewPlano && (
                  <Button size="lg" variant="outline" className="rounded-full" onClick={resetPreview}>
                    Voltar ao plano atual
                  </Button>
                )}
                {isSubscriptionActive && subscriptionId && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="lg"
                        variant="outline"
                        className="rounded-full"
                        disabled={isCancelling}
                      >
                        {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cancelar assinatura
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar assinatura</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza de que deseja cancelar sua assinatura? Você continuará com acesso ao
                          conteúdo até o fim do ciclo vigente e nenhuma nova cobrança será gerada.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isCancelling}>Manter assinatura</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancelSubscription} disabled={isCancelling}>
                          {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar cancelamento
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardContent>
          </Card>

          {isTrialing && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <Card className="rounded-[2rem] border border-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 pb-8">
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    Utilização dos recursos
                  </CardTitle>
                  <CardDescription>
                    {previewPlano
                      ? "Confira como os seus dados atuais se encaixam nos limites do plano pré-visualizado."
                      : "Acompanhe o consumo dos principais limites do plano."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-8">
                  {usageItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                      <div className="p-4 rounded-full bg-muted mb-4">
                        <Sparkles className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <p>Ainda não há métricas disponíveis para este plano.</p>
                    </div>
                  ) : (
                    usageItems.map((item) => {
                      const limit = item.limit ?? null;
                      const hasLimit = limit !== null && Number.isFinite(limit) && limit > 0;
                      const hasCurrent = typeof item.current === "number" && Number.isFinite(item.current);
                      const progress = hasLimit && hasCurrent ? Math.min(100, Math.round((item.current / limit) * 100)) : 0;
                      const limitFormatted = hasLimit ? countFormatter.format(limit) : null;
                      const currentFormatted = hasCurrent ? countFormatter.format(item.current ?? 0) : "—";

                      const isCritical = progress >= 90;
                      const isWarning = progress >= 70 && progress < 90;

                      return (
                        <div key={item.label} className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-foreground">{item.label}</span>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "font-bold",
                                isCritical ? "text-destructive" : isWarning ? "text-amber-500" : "text-primary"
                              )}>
                                {hasCurrent ? currentFormatted : "—"}
                              </span>
                              <span className="text-muted-foreground">/ {hasLimit ? limitFormatted : "∞"}</span>
                            </div>
                          </div>
                          {hasLimit ? (
                            hasCurrent ? (
                              <div className="h-3 w-full overflow-hidden rounded-full bg-secondary/50">
                                <div
                                  className={cn(
                                    "h-full transition-all duration-500 ease-in-out rounded-full",
                                    isCritical ? "bg-destructive" : isWarning ? "bg-amber-500" : "bg-primary"
                                  )}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Dados indisponíveis para este recurso no momento.
                              </p>
                            )
                          ) : (
                            <div className="h-3 w-full rounded-full bg-blue-500/20 relative overflow-hidden">
                              <div className="absolute inset-0 bg-blue-500/10 animate-pulse" />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] border border-border/50 shadow-sm overflow-hidden h-fit">
                <CardHeader className="bg-muted/30 pb-8">
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Check className="h-5 w-5 text-blue-600" />
                    </div>
                    Benefícios inclusos
                  </CardTitle>
                  <CardDescription>
                    {previewPlano
                      ? "Principais recursos contemplados no plano selecionado."
                      : "Recursos disponíveis no plano contratado."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  {beneficios.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Este plano não possui benefícios listados.
                    </p>
                  ) : (
                    <ul className="space-y-4">
                      {beneficios.map((beneficio) => (
                        <li
                          key={beneficio}
                          className="flex items-start gap-3 text-sm group"
                        >
                          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition-colors">
                            <Check className="h-3 w-3" />
                          </div>
                          <span className="text-foreground/80 group-hover:text-foreground transition-colors">{beneficio}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )
      }
    </div >
  );
}
