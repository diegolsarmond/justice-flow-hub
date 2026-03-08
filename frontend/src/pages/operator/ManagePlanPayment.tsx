import { useMemo, useState, useCallback, useEffect, useRef, type ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, CheckCircle2, CreditCard, Copy, Loader2, QrCode, Receipt, ShieldCheck, Wallet } from "lucide-react";

import { routes } from "@/config/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import {
  createPlanPayment,
  parsePlanPaymentResult,
  PlanPaymentMethod,
  PlanPaymentResult,
} from "@/features/plans/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { getApiUrl } from "@/lib/api";
import { tokenizeCard, type CardTokenPayload } from "@/lib/flows";
import {
  clearPersistedManagePlanSelection,
  getPersistedManagePlanSelection,
  persistManagePlanSelection,
  type ManagePlanSelection,
  type PricingMode,
} from "@/features/plans/managePlanPaymentStorage";
import { resolveBoletoLink, resolvePixImageSrc } from "./planPaymentUtils";
import {
  getAdditionalSubscriptionStorageKeys,
  getSubscriptionStorageKey,
} from "@/features/auth/subscriptionStorage";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

const formatDisplayDate = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return dateFormatter.format(parsed);
};

const getFormattedPrice = (display: string | null, numeric: number | null) => {
  if (typeof display === "string" && display.trim().length > 0) {
    return display;
  }

  if (typeof numeric === "number" && Number.isFinite(numeric)) {
    return currencyFormatter.format(numeric);
  }

  return null;
};

const sanitizeDigits = (value: string): string => value.replace(/\D+/g, "");

const formatCpfCnpj = (value: string): string => {
  const digits = sanitizeDigits(value).slice(0, 14);

  if (digits.length <= 11) {
    if (digits.length <= 3) {
      return digits;
    }

    if (digits.length <= 6) {
      return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    }

    if (digits.length <= 9) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    }

    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }

  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }

  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

type CardFormState = {
  holderName: string;
  holderEmail: string;
  document: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  phone: string;
  postalCode: string;
  addressNumber: string;
  addressComplement: string;
};

type CardFormErrors = Partial<Record<keyof CardFormState, string>>;

const initialCardFormState: CardFormState = {
  holderName: "",
  holderEmail: "",
  document: "",
  number: "",
  expiryMonth: "",
  expiryYear: "",
  cvv: "",
  phone: "",
  postalCode: "",
  addressNumber: "",
  addressComplement: "",
};

const isValidCardNumber = (digits: string): boolean => {
  let sum = 0;
  let shouldDouble = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number.parseInt(digits.charAt(index), 10);
    if (Number.isNaN(value)) {
      return false;
    }

    if (shouldDouble) {
      value *= 2;
      if (value > 9) {
        value -= 9;
      }
    }

    sum += value;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
};

const parseExpiryYear = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{2}$/.test(trimmed)) {
    return 2000 + Number.parseInt(trimmed, 10);
  }

  if (/^\d{4}$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  return null;
};

const validateCardForm = (form: CardFormState): CardFormErrors => {
  const errors: CardFormErrors = {};

  if (!form.holderName.trim()) {
    errors.holderName = "Informe o nome impresso no cartão.";
  }

  if (!form.holderEmail.trim() || !form.holderEmail.includes("@")) {
    errors.holderEmail = "Informe um e-mail válido.";
  }

  if (sanitizeDigits(form.document).length < 11) {
    errors.document = "Informe um CPF ou CNPJ válido.";
  }

  const cardDigits = sanitizeDigits(form.number);
  if (cardDigits.length < 13 || !isValidCardNumber(cardDigits)) {
    errors.number = "Informe um número de cartão válido.";
  }

  const month = Number.parseInt(form.expiryMonth, 10);
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    errors.expiryMonth = "Mês inválido.";
  }

  const parsedYear = parseExpiryYear(form.expiryYear);
  if (parsedYear === null) {
    errors.expiryYear = "Ano inválido.";
  }

  if (!errors.expiryMonth && !errors.expiryYear && Number.isFinite(month) && parsedYear !== null) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (parsedYear < currentYear || (parsedYear === currentYear && month < currentMonth)) {
      errors.expiryMonth = "Validade expirada.";
      errors.expiryYear = "Validade expirada.";
    }
  }

  const cvvLength = sanitizeDigits(form.cvv).length;
  if (cvvLength < 3 || cvvLength > 4) {
    errors.cvv = "Código de segurança inválido.";
  }

  if (sanitizeDigits(form.phone).length < 8) {
    errors.phone = "Informe um telefone válido.";
  }

  if (sanitizeDigits(form.postalCode).length < 8) {
    errors.postalCode = "Informe um CEP válido.";
  }

  if (!form.addressNumber.trim()) {
    errors.addressNumber = "Informe o número do endereço.";
  }

  return errors;
};

const extractCompanyRecord = (input: unknown): Record<string, unknown> | null => {
  if (Array.isArray(input)) {
    const candidate = input.find((item) => item && typeof item === "object");
    return (candidate as Record<string, unknown> | undefined) ?? null;
  }

  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    const rows = (record as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      const candidate = rows.find((item) => item && typeof item === "object");
      if (candidate) {
        return candidate as Record<string, unknown>;
      }
    }

    const data = (record as { data?: unknown }).data;
    if (Array.isArray(data)) {
      const candidate = data.find((item) => item && typeof item === "object");
      if (candidate) {
        return candidate as Record<string, unknown>;
      }
    }

    if (data && typeof data === "object") {
      const nestedRows = (data as { rows?: unknown }).rows;
      if (Array.isArray(nestedRows)) {
        const candidate = nestedRows.find((item) => item && typeof item === "object");
        if (candidate) {
          return candidate as Record<string, unknown>;
        }
      }
    }

    return record;
  }

  return null;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getFirstString = (record: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = normalizeString(record[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const PAYMENT_METHOD_LABELS: Record<"PIX" | "BOLETO" | "CREDIT_CARD" | "DEBIT_CARD", string> = {
  PIX: "PIX empresarial",
  BOLETO: "Boleto bancário",
  CREDIT_CARD: "Cartão corporativo",
  DEBIT_CARD: "Cartão corporativo (débito)",
};

const normalizeBillingType = (
  value: string | null | undefined,
): keyof typeof PAYMENT_METHOD_LABELS | null => {
  if (!value) {
    return null;
  }

  const normalized = value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  if (normalized.includes("PIX")) {
    return "PIX";
  }

  if (normalized.includes("BOLETO") || normalized.includes("BANKSLIP") || normalized.includes("BANK_SLIP")) {
    return "BOLETO";
  }

  if (normalized.includes("DEBIT")) {
    return "DEBIT_CARD";
  }

  if (normalized.includes("CREDIT") || normalized.includes("CARTAO")) {
    return "CREDIT_CARD";
  }

  return null;
};

const formatStatusLabel = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "paid":
    case "received":
    case "confirmado":
      return "Pago";
    case "pending":
    case "pending_payment":
    case "awaiting":
      return "Pendente";
    case "processing":
      return "Processando";
    case "overdue":
    case "vencido":
      return "Vencido";
    case "canceled":
    case "cancelado":
      return "Cancelado";
    default:
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
};

const ManagePlanPayment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const selectionFromLocation = (location.state ?? {}) as ManagePlanSelection;
  const [cachedSelection, setCachedSelection] = useState<ManagePlanSelection>(() =>
    getPersistedManagePlanSelection(),
  );
  const lastPersistedRef = useRef<{
    planId: number | null;
    pricingMode?: PricingMode;
    companyName?: string | null;
    companyDocument?: string | null;
    billingEmail?: string | null;
    paymentStatus?: string | null;
    paymentMethod?: string | null;
    paymentDueDate?: string | null;
    paymentAmount?: number | null;
  }>({
    planId: null,
    pricingMode: undefined,
    companyName: null,
    companyDocument: null,
    billingEmail: null,
    paymentStatus: null,
    paymentMethod: null,
    paymentDueDate: null,
    paymentAmount: null,
  });
  const locationPlanId = selectionFromLocation.plan?.id ?? null;
  const locationPricingMode = selectionFromLocation.pricingMode;

  useEffect(() => {
    if (!selectionFromLocation.plan) {
      return;
    }

    const hasChanged =
      lastPersistedRef.current.planId !== locationPlanId ||
      lastPersistedRef.current.pricingMode !== locationPricingMode ||
      lastPersistedRef.current.companyName !== (selectionFromLocation.billing?.companyName ?? null) ||
      lastPersistedRef.current.companyDocument !== (selectionFromLocation.billing?.document ?? null) ||
      lastPersistedRef.current.billingEmail !== (selectionFromLocation.billing?.email ?? null) ||
      lastPersistedRef.current.paymentStatus !== (selectionFromLocation.paymentSummary?.status ?? null) ||
      lastPersistedRef.current.paymentMethod !== (selectionFromLocation.paymentSummary?.paymentMethod ?? null) ||
      lastPersistedRef.current.paymentDueDate !== (selectionFromLocation.paymentSummary?.dueDate ?? null) ||
      lastPersistedRef.current.paymentAmount !== (selectionFromLocation.paymentSummary?.amount ?? null);

    if (!hasChanged) {
      return;
    }

    const nextSelection: ManagePlanSelection = {
      plan: selectionFromLocation.plan,
      pricingMode: selectionFromLocation.pricingMode,
      ...(selectionFromLocation.billing ? { billing: selectionFromLocation.billing } : {}),
      ...(selectionFromLocation.paymentSummary
        ? { paymentSummary: selectionFromLocation.paymentSummary }
        : {}),
    };

    lastPersistedRef.current = {
      planId: locationPlanId,
      pricingMode: locationPricingMode,
      companyName: selectionFromLocation.billing?.companyName ?? null,
      companyDocument: selectionFromLocation.billing?.document ?? null,
      billingEmail: selectionFromLocation.billing?.email ?? null,
      paymentStatus: selectionFromLocation.paymentSummary?.status ?? null,
      paymentMethod: selectionFromLocation.paymentSummary?.paymentMethod ?? null,
      paymentDueDate: selectionFromLocation.paymentSummary?.dueDate ?? null,
      paymentAmount: selectionFromLocation.paymentSummary?.amount ?? null,
    };

    setCachedSelection(nextSelection);
    persistManagePlanSelection(nextSelection);
  }, [
    locationPlanId,
    locationPricingMode,
    selectionFromLocation.billing,
    selectionFromLocation.plan,
    selectionFromLocation.paymentSummary,
  ]);

  const selection = selectionFromLocation.plan ? selectionFromLocation : cachedSelection;
  const selectedPlan = selection.plan ?? null;
  const selectedPlanId = selectedPlan?.id ?? null;
  const pricingMode: PricingMode = selection.pricingMode ?? "mensal";
  const billingFromSelection = selection.billing ?? null;
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<PlanPaymentMethod>("pix");
  const [companyName, setCompanyName] = useState(() => billingFromSelection?.companyName ?? "");
  const [companyDocument, setCompanyDocument] = useState(() =>
    billingFromSelection?.document ? formatCpfCnpj(billingFromSelection.document) : "",
  );
  const [billingEmail, setBillingEmail] = useState(() => billingFromSelection?.email ?? "");
  const [billingNotes, setBillingNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTokenizingCard, setIsTokenizingCard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<PlanPaymentResult | null>(null);
  const [isPaymentStatusLoading, setIsPaymentStatusLoading] = useState(false);
  const [paymentStatusError, setPaymentStatusError] = useState<string | null>(null);
  const [cardForm, setCardForm] = useState<CardFormState>(() => ({ ...initialCardFormState }));
  const [cardErrors, setCardErrors] = useState<CardFormErrors>({});
  const [autoChargeConfirmed, setAutoChargeConfirmed] = useState(false);
  const [billingDataStatus, setBillingDataStatus] = useState<{ companyId: number | null; loaded: boolean }>(() => ({
    companyId: user?.empresa_id ?? null,
    loaded: !user?.empresa_id,
  }));
  const userPrefillRef = useRef<{ companyName?: string; billingEmail?: string }>({});
  const companyPrefillRef = useRef<{ name?: string; document?: string; email?: string }>({});
  const billingSelectionRef = useRef<{ name: string | null; document: string | null; email: string | null }>({
    name: billingFromSelection?.companyName ?? null,
    document: billingFromSelection?.document ?? null,
    email: billingFromSelection?.email ?? null,
  });

  useEffect(() => {
    billingSelectionRef.current = {
      name: billingFromSelection?.companyName ?? null,
      document: billingFromSelection?.document ?? null,
      email: billingFromSelection?.email ?? null,
    };
  }, [billingFromSelection?.companyName, billingFromSelection?.document, billingFromSelection?.email]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const id = paymentResult?.subscriptionId;
    if (!id) {
      return;
    }

    try {
      const storageKey = getSubscriptionStorageKey(user);
      window.localStorage.setItem(storageKey, id);
      const additionalKeys = getAdditionalSubscriptionStorageKeys(user, storageKey);
      for (const key of additionalKeys) {
        window.localStorage.removeItem(key);
      }
    } catch { }
  }, [paymentResult?.subscriptionId, user?.empresa_id, user?.id]);

  const sanitizeSelectionBilling = useCallback((): ManagePlanSelection["billing"] | undefined => {
    const trimmedName = companyName.trim();
    const digits = sanitizeDigits(companyDocument);
    const trimmedEmail = billingEmail.trim();

    if (!trimmedName && digits.length === 0 && !trimmedEmail) {
      return undefined;
    }

    return {
      ...(trimmedName ? { companyName: trimmedName } : {}),
      ...(digits.length > 0 ? { document: digits } : {}),
      ...(trimmedEmail ? { email: trimmedEmail } : {}),
    };
  }, [billingEmail, companyDocument, companyName]);

  const resolveSelectionPaymentSummary = useCallback(
    (): ManagePlanSelection["paymentSummary"] | undefined => {
      if (paymentResult) {
        const rawStatus = typeof paymentResult.charge.status === "string" ? paymentResult.charge.status.trim() : "";
        const status = rawStatus.length > 0 ? rawStatus : null;
        const paymentMethod = paymentResult.paymentMethod ?? null;
        const rawDueDate = typeof paymentResult.charge.dueDate === "string" ? paymentResult.charge.dueDate.trim() : "";
        const dueDate = rawDueDate.length > 0 ? rawDueDate : null;
        const amount =
          typeof paymentResult.charge.amount === "number" && Number.isFinite(paymentResult.charge.amount)
            ? paymentResult.charge.amount
            : null;

        return {
          ...(status ? { status } : {}),
          ...(paymentMethod ? { paymentMethod } : {}),
          ...(dueDate ? { dueDate } : {}),
          ...(amount !== null ? { amount } : {}),
        };
      }

      return selection.paymentSummary;
    },
    [paymentResult, selection.paymentSummary],
  );

  const clearPaymentSummary = useCallback(() => {
    lastPersistedRef.current = {
      ...lastPersistedRef.current,
      paymentStatus: null,
      paymentMethod: null,
      paymentDueDate: null,
      paymentAmount: null,
    };

    setCachedSelection((previous) => {
      if (!previous.paymentSummary) {
        return previous;
      }

      const { paymentSummary: _ignored, ...rest } = previous;
      const nextSelection: ManagePlanSelection = { ...rest };
      persistManagePlanSelection(nextSelection);
      return nextSelection;
    });
  }, [persistManagePlanSelection, setCachedSelection]);

  const paymentStatus = paymentResult?.charge.status ?? null;

  useEffect(() => {
    const billing = selection.billing;
    if (!billing) {
      return;
    }

    if (billing.companyName) {
      setCompanyName((previous) => (previous.trim().length > 0 ? previous : billing.companyName ?? previous));
    }

    if (billing.document) {
      setCompanyDocument((previous) =>
        previous.trim().length > 0 ? previous : formatCpfCnpj(billing.document),
      );
    }

    if (billing.email) {
      setBillingEmail((previous) => (previous.trim().length > 0 ? previous : billing.email ?? previous));
    }
  }, [selection.billing]);

  useEffect(() => {
    if (!selectedPlan) {
      return;
    }

    const billing = sanitizeSelectionBilling();
    const paymentSummary = resolveSelectionPaymentSummary();

    const billingName = billing?.companyName ?? null;
    const billingDocument = billing?.document ?? null;
    const billingEmailValue = billing?.email ?? null;
    const summaryStatus = paymentSummary?.status ?? null;
    const summaryMethod = paymentSummary?.paymentMethod ?? null;
    const summaryDueDate = paymentSummary?.dueDate ?? null;
    const summaryAmount = paymentSummary?.amount ?? null;

    const hasChanged =
      lastPersistedRef.current.planId !== selectedPlan.id ||
      lastPersistedRef.current.pricingMode !== pricingMode ||
      lastPersistedRef.current.companyName !== billingName ||
      lastPersistedRef.current.companyDocument !== billingDocument ||
      lastPersistedRef.current.billingEmail !== billingEmailValue ||
      lastPersistedRef.current.paymentStatus !== summaryStatus ||
      lastPersistedRef.current.paymentMethod !== summaryMethod ||
      lastPersistedRef.current.paymentDueDate !== summaryDueDate ||
      lastPersistedRef.current.paymentAmount !== summaryAmount;

    if (!hasChanged) {
      return;
    }

    const nextSelection: ManagePlanSelection = {
      plan: selectedPlan,
      pricingMode,
      ...(billing ? { billing } : {}),
      ...(paymentSummary ? { paymentSummary } : {}),
    };

    lastPersistedRef.current = {
      planId: selectedPlan.id,
      pricingMode,
      companyName: billingName,
      companyDocument: billingDocument,
      billingEmail: billingEmailValue,
      paymentStatus: summaryStatus,
      paymentMethod: summaryMethod,
      paymentDueDate: summaryDueDate,
      paymentAmount: summaryAmount,
    };

    setCachedSelection(nextSelection);
    persistManagePlanSelection(nextSelection);
  }, [
    pricingMode,
    resolveSelectionPaymentSummary,
    sanitizeSelectionBilling,
    selectedPlan,
    setCachedSelection,
    persistManagePlanSelection,
  ]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const resolvedName = user.nome_completo?.trim() ?? "";
    const resolvedEmail = user.email?.trim() ?? "";
    const resolvedCompany = user.empresa_nome?.trim() ?? "";

    setCardForm((previous) => {
      let changed = false;
      const next = { ...previous };

      if (resolvedName && !previous.holderName.trim()) {
        next.holderName = resolvedName;
        changed = true;
      }

      if (resolvedEmail && !previous.holderEmail.trim()) {
        next.holderEmail = resolvedEmail;
        changed = true;
      }

      return changed ? next : previous;
    });

    const companyId = user.empresa_id ?? null;
    const isBillingDataLoadedForCompany =
      billingDataStatus.companyId === companyId && billingDataStatus.loaded;

    if (companyId && !isBillingDataLoadedForCompany) {
      return;
    }

    if (resolvedCompany) {
      setCompanyName((previous) => {
        if (previous.trim().length > 0) {
          return previous;
        }

        userPrefillRef.current.companyName = resolvedCompany;
        return resolvedCompany;
      });
    }

    if (resolvedEmail) {
      setBillingEmail((previous) => {
        if (previous.trim().length > 0) {
          return previous;
        }

        userPrefillRef.current.billingEmail = resolvedEmail;
        return resolvedEmail;
      });
    }
  }, [billingDataStatus.companyId, billingDataStatus.loaded, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (!user.empresa_id) {
      setBillingDataStatus((previous) => {
        if (previous.companyId === null && previous.loaded) {
          return previous;
        }

        return { companyId: null, loaded: true };
      });
      return;
    }

    setBillingDataStatus((previous) => {
      if (previous.companyId === user.empresa_id && !previous.loaded) {
        return previous;
      }

      return { companyId: user.empresa_id ?? null, loaded: false };
    });
  }, [user?.empresa_id]);

  useEffect(() => {
    if (!selectedPlanId) {
      return;
    }

    const normalizeStatus = (value: string | null | undefined) => {
      if (!value) {
        return "";
      }

      return value.trim().toLowerCase();
    };

    const normalizedStatus = normalizeStatus(paymentStatus);
    if (normalizedStatus === "paid" || normalizedStatus === "received") {
      return;
    }

    let isMounted = true;
    let isFetching = false;
    let intervalId: number | null = null;
    let currentController: AbortController | null = null;

    setIsPaymentStatusLoading(true);
    setPaymentStatusError(null);

    const clearTimer = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const stopPolling = async () => {
      clearTimer();
      if (!isMounted) {
        return;
      }

      setIsPaymentStatusLoading(false);
      try {
        await refreshUser();
      } catch { }
    };

    const fetchCurrentPayment = async () => {
      if (isFetching) {
        return;
      }

      setIsPaymentStatusLoading(true);
      setPaymentStatusError(null);
      const controller = new AbortController();
      currentController = controller;
      isFetching = true;

      try {
        const response = await fetch(getApiUrl("plan-payments/current"), {
          headers: { Accept: "application/json" },
          credentials: "include",
          signal: controller.signal,
        });

        if (response.status === 404) {
          if (isMounted) {
            // We only clear if we previously thought we had one, to avoid ui flicker on initial load
            if (paymentResult) {
              clearPaymentSummary();
              setPaymentResult(null);
            }
            setPaymentStatusError(null);
          }

          await stopPolling();
          return;
        }

        let payload: unknown = null;
        try {
          payload = await response.json();
        } catch {
          // Ignora erro de parse se o corpo estiver vazio ou inválido
        }

        if (!response.ok) {
          const errorMessage =
            payload && typeof payload === "object"
              ? (payload as { error?: string }).error
              : null;

          if (errorMessage === "Nenhuma cobrança pendente encontrada para o plano atual.") {
            if (isMounted) {
              if (paymentResult) {
                clearPaymentSummary();
                setPaymentResult(null);
              }
              setPaymentStatusError(null);
              setIsPaymentStatusLoading(false);
            }
            await stopPolling();
            return;
          }

          throw new Error(
            errorMessage || `Falha ao atualizar cobrança (HTTP ${response.status})`,
          );
        }

        if (!isMounted) {
          return;
        }

        if (!payload || typeof payload !== "object") {
          setPaymentStatusError("Resposta inválida ao consultar a cobrança atual.");
          setIsPaymentStatusLoading(false);
          clearTimer();
          return;
        }

        const data = parsePlanPaymentResult(payload, selectedPlanId ?? undefined);
        const planData = data.plan ?? null;
        if (planData && planData.id !== null && planData.id !== selectedPlanId) {
          setIsPaymentStatusLoading(false);
          clearTimer();
          return;
        }

        setPaymentStatusError(null);
        setPaymentResult(data);
        setIsPaymentStatusLoading(false);

        const statusValue = normalizeStatus(
          typeof data.charge.status === "string" ? data.charge.status : null,
        );

        if (statusValue === "paid" || statusValue === "received") {
          await refreshUser();
          toast({
            title: "Pagamento confirmado",
            description: "Sua assinatura foi atualizada com sucesso.",
          });
          await stopPolling();
          return;
        }
      } catch (error) {
        if (!isMounted || controller.signal.aborted) {
          return;
        }

        setPaymentStatusError(
          error instanceof Error
            ? error.message
            : "Falha ao atualizar status do pagamento.",
        );
        setIsPaymentStatusLoading(false);
      } finally {
        if (currentController === controller) {
          currentController = null;
        }

        isFetching = false;
      }
    };

    intervalId = window.setInterval(() => {
      void fetchCurrentPayment();
    }, 12000); // Increased to 12s to reduce load

    void fetchCurrentPayment();

    return () => {
      isMounted = false;
      clearTimer();
      if (currentController) {
        currentController.abort();
      }
    };
  }, [clearPaymentSummary, paymentStatus, refreshUser, selectedPlanId]);

  useEffect(() => {
    if (!user?.empresa_id) {
      return;
    }

    const controller = new AbortController();
    let isMounted = true;
    const companyId = user.empresa_id ?? null;
    setBillingDataStatus((previous) => {
      if (previous.companyId === companyId && !previous.loaded) {
        return previous;
      }

      return { companyId, loaded: false };
    });

    const loadBillingData = async () => {
      try {
        const response = await fetch(getApiUrl(`empresas/${user.empresa_id}`), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Falha ao carregar empresa (HTTP ${response.status})`);
        }

        const payload = await response.json();
        if (!isMounted) {
          return;
        }

        const record = extractCompanyRecord(payload);
        if (!record) {
          return;
        }

        const resolvedName = getFirstString(record, [
          "razao_social",
          "razaoSocial",
          "nome_empresa",
          "nomeEmpresa",
          "nome",
        ]);
        if (resolvedName) {
          setCompanyName((previous) => {
            const trimmedPrevious = previous.trim();
            const persistedNameSource =
              billingSelectionRef.current.name ?? lastPersistedRef.current.companyName ?? "";
            const persistedName = persistedNameSource.trim();
            const prefilledName = companyPrefillRef.current.name?.trim() ?? "";
            const shouldOverride =
              trimmedPrevious.length === 0 ||
              (persistedName && trimmedPrevious === persistedName) ||
              (prefilledName && trimmedPrevious === prefilledName);

            if (shouldOverride) {
              companyPrefillRef.current.name = resolvedName;
              userPrefillRef.current.companyName = undefined;
              return resolvedName;
            }

            return previous;
          });
        }

        const resolvedDocument = getFirstString(record, [
          "cnpj",
          "documento",
          "document",
          "cnpj_cpf",
          "cpf_cnpj",
        ]);
        if (resolvedDocument) {
          const formattedResolvedDocument = formatCpfCnpj(resolvedDocument);
          const persistedDocumentDigits =
            billingSelectionRef.current.document ?? lastPersistedRef.current.companyDocument ?? "";
          const persistedDocument =
            typeof persistedDocumentDigits === "string" && persistedDocumentDigits.trim().length > 0
              ? formatCpfCnpj(persistedDocumentDigits)
              : "";
          const prefilledDocument = companyPrefillRef.current.document?.trim() ?? "";

          setCompanyDocument((previous) => {
            const trimmedPrevious = previous.trim();
            const shouldOverride =
              trimmedPrevious.length === 0 ||
              (persistedDocument && trimmedPrevious === persistedDocument) ||
              (prefilledDocument && trimmedPrevious === prefilledDocument);

            if (shouldOverride) {
              companyPrefillRef.current.document = formattedResolvedDocument;
              return formattedResolvedDocument;
            }

            return previous;
          });
        }

        const resolvedEmail = getFirstString(record, [
          "email_cobranca",
          "emailCobranca",
          "billingEmail",
          "email_billing",
          "email_financeiro",
          "emailFinanceiro",
          "email",
        ]);
        if (resolvedEmail) {
          setBillingEmail((previous) => {
            const trimmedPrevious = previous.trim();
            const persistedEmailSource =
              billingSelectionRef.current.email ?? lastPersistedRef.current.billingEmail ?? "";
            const persistedEmail = persistedEmailSource.trim();
            const prefilledEmail = companyPrefillRef.current.email?.trim() ?? "";
            const shouldOverride =
              trimmedPrevious.length === 0 ||
              (persistedEmail && trimmedPrevious === persistedEmail) ||
              (prefilledEmail && trimmedPrevious === prefilledEmail);

            if (shouldOverride) {
              companyPrefillRef.current.email = resolvedEmail;
              userPrefillRef.current.billingEmail = undefined;
              return resolvedEmail;
            }

            return previous;
          });
        }
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Erro ao carregar dados de faturamento da empresa", loadError);
        toast({
          title: "Não foi possível carregar os dados da empresa",
          description: "Preencha manualmente os campos de faturamento para continuar.",
          variant: "destructive",
        });
      } finally {
        if (isMounted) {
          setBillingDataStatus((previous) => {
            if (previous.companyId === companyId && previous.loaded) {
              return previous;
            }

            return { companyId, loaded: true };
          });
        }
      }
    };

    void loadBillingData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [toast, user?.empresa_id]);

  useEffect(() => {
    if (paymentMethod !== "cartao") {
      setAutoChargeConfirmed(false);
    }
  }, [paymentMethod]);

  const formattedPrice = useMemo(() => {
    if (!selectedPlan) {
      return null;
    }

    return pricingMode === "anual"
      ? getFormattedPrice(selectedPlan.precoAnual, selectedPlan.valorAnual)
      : getFormattedPrice(selectedPlan.precoMensal, selectedPlan.valorMensal);
  }, [pricingMode, selectedPlan]);

  const alternatePrice = useMemo(() => {
    if (!selectedPlan) {
      return null;
    }

    return pricingMode === "anual"
      ? getFormattedPrice(selectedPlan.precoMensal, selectedPlan.valorMensal)
      : getFormattedPrice(selectedPlan.precoAnual, selectedPlan.valorAnual);
  }, [pricingMode, selectedPlan]);

  const cadenceLabel = pricingMode === "anual" ? "ano" : "mês";
  const alternateCadence = pricingMode === "anual" ? "mês" : "ano";
  const features = selectedPlan?.recursos ?? [];

  const handleResetCardForm = useCallback(() => {
    setCardForm({ ...initialCardFormState });
    setCardErrors({});
    setAutoChargeConfirmed(false);
  }, []);

  const handlePaymentMethodChange = useCallback((value: string) => {
    if (value === "pix" || value === "boleto" || value === "cartao" || value === "debito") {
      setPaymentMethod(value as PlanPaymentMethod);
      setError(null);
      setCardErrors({});
    }
  }, []);

  const handleCardFormChange = useCallback((field: keyof CardFormState, transform?: (value: string) => string) => {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const rawValue = event.target.value;
      const nextValue = transform ? transform(rawValue) : rawValue;
      setCardForm((previous) => ({ ...previous, [field]: nextValue }));
      setCardErrors((previous) => {
        if (!previous[field]) {
          return previous;
        }
        const { [field]: _removed, ...rest } = previous;
        return rest;
      });
    };
  }, []);

  const handleEditCard = useCallback(() => {
    setPaymentMethod("cartao");
    handleResetCardForm();
    setPaymentResult(null);
    setError(null);
  }, [handleResetCardForm]);

  const pixPayload = paymentResult?.charge.pixPayload ?? null;
  const pixQrCodeRaw = paymentResult?.charge.pixQrCode ?? null;
  const boletoLink = resolveBoletoLink(paymentResult?.charge);

  const pixImageSrc = useMemo(() => resolvePixImageSrc(pixQrCodeRaw), [pixQrCodeRaw]);

  const chargeAmountLabel = useMemo(() => {
    if (paymentResult?.charge.amount && Number.isFinite(paymentResult.charge.amount)) {
      return currencyFormatter.format(paymentResult.charge.amount);
    }
    return formattedPrice;
  }, [formattedPrice, paymentResult?.charge.amount]);

  const dueDateLabel = useMemo(() => {
    if (!paymentResult?.charge.dueDate) {
      return null;
    }
    const parsed = new Date(paymentResult.charge.dueDate);
    if (Number.isNaN(parsed.getTime())) {
      return paymentResult.charge.dueDate;
    }
    return new Intl.DateTimeFormat("pt-BR").format(parsed);
  }, [paymentResult?.charge.dueDate]);

  const handleCopy = useCallback(
    async (value: string | null) => {
      if (!value) {
        toast({
          title: "Conteúdo indisponível",
          description: "O Asaas ainda não retornou o código para copiar.",
          variant: "destructive",
        });
        return;
      }

      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        toast({
          title: "Copiar não suportado",
          description: "Seu navegador não permite copiar automaticamente.",
          variant: "destructive",
        });
        return;
      }

      try {
        await navigator.clipboard.writeText(value);
        toast({
          title: "Conteúdo copiado",
          description: "Cole o código no aplicativo do seu banco para pagar.",
        });
      } catch (copyError) {
        toast({
          title: "Erro ao copiar",
          description:
            copyError instanceof Error ? copyError.message : "Não foi possível copiar o conteúdo para a área de transferência.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleOpenLink = useCallback(
    (url: string | null, options?: { title?: string; description?: string }) => {
      if (!url) {
        toast({
          title: options?.title ?? "Documento indisponível",
          description:
            options?.description ?? "O Asaas ainda não disponibilizou o documento para download.",
          variant: "destructive",
        });
        return;
      }

      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    [toast],
  );

  const handleOpenBoleto = useCallback(() => {
    handleOpenLink(boletoLink, {
      title: "Boleto indisponível",
      description: "O Asaas ainda não disponibilizou o boleto para download.",
    });
  }, [boletoLink, handleOpenLink]);

  const handleSubmit = useCallback(async () => {
    if (!selectedPlan) {
      return;
    }

    if (paymentResult) {
      return;
    }

    if (!companyName.trim() || !companyDocument.trim() || !billingEmail.trim()) {
      const message = "Preencha razão social, documento e e-mail para gerar a cobrança.";
      setError(message);
      toast({
        title: "Dados obrigatórios",
        description: message,
        variant: "destructive",
      });
      return;
    }

    if (paymentMethod === "cartao" && !autoChargeConfirmed) {
      const message = "Confirme a cobrança automática no cartão para continuar.";
      setError(message);
      toast({
        title: "Confirmação obrigatória",
        description: message,
        variant: "destructive",
      });
      return;
    }

    let cardTokenDetails: { token: string; metadata: Record<string, unknown> } | null = null;

    if (paymentMethod === "cartao") {
      const validation = validateCardForm(cardForm);
      setCardErrors(validation);
      if (Object.values(validation).some(Boolean)) {
        const message = "Verifique os dados do cartão para continuar.";
        toast({
          title: "Dados do cartão incompletos",
          description: message,
          variant: "destructive",
        });
        return;
      }

      const payload: CardTokenPayload = {
        holderName: cardForm.holderName.trim(),
        number: sanitizeDigits(cardForm.number),
        expiryMonth: cardForm.expiryMonth.trim(),
        expiryYear: cardForm.expiryYear.trim(),
        cvv: sanitizeDigits(cardForm.cvv),
        document: sanitizeDigits(cardForm.document),
        email: cardForm.holderEmail.trim(),
        phone: sanitizeDigits(cardForm.phone),
        postalCode: sanitizeDigits(cardForm.postalCode),
        addressNumber: cardForm.addressNumber.trim(),
        addressComplement: cardForm.addressComplement.trim() || undefined,
      };

      try {
        setIsTokenizingCard(true);
        const tokenized = await tokenizeCard(payload);
        cardTokenDetails = {
          token: tokenized.token,
          metadata: {
            brand: tokenized.brand ?? undefined,
            last4Digits: tokenized.last4Digits ?? undefined,
            holderName: payload.holderName,
            holderEmail: payload.email,
            document: payload.document,
            phone: payload.phone,
            postalCode: payload.postalCode,
            addressNumber: payload.addressNumber,
            addressComplement: payload.addressComplement,
          },
        };
      } catch (tokenError) {
        const message =
          tokenError instanceof Error
            ? tokenError.message
            : "Não foi possível validar o cartão informado.";
        setError(message);
        toast({
          title: "Falha ao processar cartão",
          description: message,
          variant: "destructive",
        });
        return;
      } finally {
        setIsTokenizingCard(false);
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        planId: selectedPlan.id,
        pricingMode,
        paymentMethod,
        billing: {
          companyName: companyName.trim(),
          document: sanitizeDigits(companyDocument),
          email: billingEmail.trim(),
          notes: billingNotes.trim() ? billingNotes.trim() : undefined,
        },
        cardToken: cardTokenDetails?.token,
        cardMetadata: cardTokenDetails?.metadata,
      } as const;

      const result = await createPlanPayment(payload);

      setPaymentResult(result);
      toast({
        title: "Cobrança gerada com sucesso",
        description: "Utilize as informações abaixo para concluir o pagamento do plano.",
      });

      await refreshUser();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Não foi possível criar a cobrança no Asaas.";
      setError(message);
      toast({
        title: "Falha ao gerar cobrança",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    billingEmail,
    billingNotes,
    cardForm,
    companyDocument,
    companyName,
    autoChargeConfirmed,
    paymentMethod,
    paymentResult,
    pricingMode,
    selectedPlan,
    refreshUser,
    toast,
  ]);

  const isCardMethod = paymentMethod === "cartao";
  const isCardFormComplete = !isCardMethod
    ? true
    : Boolean(
      cardForm.holderName.trim() &&
      cardForm.holderEmail.trim() &&
      sanitizeDigits(cardForm.document).length >= 11 &&
      sanitizeDigits(cardForm.number).length >= 13 &&
      cardForm.expiryMonth.trim() &&
      cardForm.expiryYear.trim() &&
      sanitizeDigits(cardForm.cvv).length >= 3 &&
      sanitizeDigits(cardForm.phone).length >= 8 &&
      sanitizeDigits(cardForm.postalCode).length >= 8 &&
      cardForm.addressNumber.trim(),
    );

  const isConfirmDisabled =
    isSubmitting ||
    isTokenizingCard ||
    Boolean(paymentResult) ||
    !companyName.trim() ||
    !companyDocument.trim() ||
    !billingEmail.trim() ||
    !isCardFormComplete ||
    (paymentMethod === "cartao" && !autoChargeConfirmed);

  const handleReturnToPlanSelection = useCallback(() => {
    const paymentSummary = resolveSelectionPaymentSummary();
    const navigationState = paymentSummary ? { paymentSummary } : undefined;

    if (!selectedPlan) {
      clearPersistedManagePlanSelection();
      if (navigationState) {
        navigate(routes.meuPlano, { state: navigationState });
      } else {
        navigate(routes.meuPlano);
      }
      return;
    }

    const billing = sanitizeSelectionBilling();
    const nextSelection: ManagePlanSelection = {
      plan: selectedPlan,
      pricingMode,
      ...(billing ? { billing } : {}),
      ...(paymentSummary ? { paymentSummary } : {}),
    };

    lastPersistedRef.current = {
      planId: selectedPlan.id,
      pricingMode,
      companyName: billing?.companyName ?? null,
      companyDocument: billing?.document ?? null,
      billingEmail: billing?.email ?? null,
      paymentStatus: paymentSummary?.status ?? null,
      paymentMethod: paymentSummary?.paymentMethod ?? null,
      paymentDueDate: paymentSummary?.dueDate ?? null,
      paymentAmount: paymentSummary?.amount ?? null,
    };

    setCachedSelection(nextSelection);
    persistManagePlanSelection(nextSelection);

    if (navigationState) {
      navigate(routes.meuPlano, { state: navigationState });
    } else {
      navigate(routes.meuPlano);
    }
  }, [
    clearPersistedManagePlanSelection,
    navigate,
    pricingMode,
    persistManagePlanSelection,
    resolveSelectionPaymentSummary,
    sanitizeSelectionBilling,
    selectedPlan,
  ]);

  const selectionPaymentSummary = useMemo(
    () => resolveSelectionPaymentSummary(),
    [resolveSelectionPaymentSummary],
  );

  const hasPaymentResult = Boolean(paymentResult);

  const normalizedBillingType = useMemo(() => {
    if (paymentResult) {
      return (
        normalizeBillingType(paymentResult.charge.billingType) ?? normalizeBillingType(paymentResult.paymentMethod)
      );
    }

    return normalizeBillingType(selectionPaymentSummary?.paymentMethod);
  }, [paymentResult, selectionPaymentSummary?.paymentMethod]);

  const paymentMethodLabel = normalizedBillingType ? PAYMENT_METHOD_LABELS[normalizedBillingType] : null;

  const summaryStatusLabel = useMemo(() => {
    const status = paymentResult?.charge.status ?? selectionPaymentSummary?.status ?? null;
    return formatStatusLabel(status);
  }, [paymentResult?.charge.status, selectionPaymentSummary?.status]);

  const summaryDueDateLabel = useMemo(() => {
    if (paymentResult?.charge.dueDate) {
      return dueDateLabel;
    }

    return formatDisplayDate(selectionPaymentSummary?.dueDate);
  }, [dueDateLabel, paymentResult?.charge.dueDate, selectionPaymentSummary?.dueDate]);

  const renderPlanSelectionFallback = () => (
    <div className="space-y-6">

      <Alert className="border-destructive/40 bg-destructive/10">
        <AlertTitle>Nenhum plano selecionado</AlertTitle>
        <AlertDescription>
          Acesse a tela de planos e selecione a opção desejada para revisar os detalhes de pagamento.
        </AlertDescription>
      </Alert>

      <Button className="rounded-full" onClick={handleReturnToPlanSelection}>
        Escolher um plano
      </Button>
    </div>
  );

  if (!selectedPlan) {
    return renderPlanSelectionFallback();
  }

  const renderCheckoutSections = () => (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="space-y-6">
        <Card className="border-border/60 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
          <CardHeader className="bg-muted/30 pb-6 border-b border-border/40">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl">{selectedPlan.nome}</CardTitle>
                <CardDescription>
                  Resumo do plano selecionado e recursos inclusos.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="uppercase text-xs font-medium tracking-wider bg-background border-border/60 shadow-sm">
                Plano {pricingMode}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex flex-col gap-1 rounded-xl bg-primary/5 p-4 border border-primary/10">
              <p className="text-sm text-muted-foreground font-medium">Investimento</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-foreground">{formattedPrice ?? "Sob consulta"}</p>
                <span className="text-sm text-muted-foreground font-medium">/{cadenceLabel}</span>
              </div>
              {alternatePrice && (
                <p className="text-xs text-muted-foreground mt-1">
                  Ou equivalente a {alternatePrice}/{alternateCadence}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> O que está incluso:
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {features.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">Nenhum recurso listado.</p>
                )}
                {features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" /> Método de pagamento
            </CardTitle>
            <CardDescription>Selecione como deseja realizar o pagamento.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={paymentMethod}
              onValueChange={handlePaymentMethodChange}
              className="grid gap-4 md:grid-cols-2"
            >
              {[
                { id: "pix", icon: QrCode, label: "PIX", desc: "Aprovação imediata" },
                { id: "boleto", icon: Wallet, label: "Boleto bancário", desc: "Até 2 dias úteis" },
                { id: "cartao", icon: CreditCard, label: "Cartão de Crédito", desc: "Renovação automática" },
                // { id: "debito", icon: ShieldCheck, label: "Débito", desc: "Débito automático" } 
              ].map((item) => (
                <Label
                  key={item.id}
                  htmlFor={`method-${item.id}`}
                  className={`
                      relative flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-all duration-200
                      hover:bg-muted/50 hover:border-primary/50
                      ${paymentMethod === item.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm"
                      : "border-border/60 bg-card"}
                    `}
                >
                  <RadioGroupItem id={`method-${item.id}`} value={item.id} className="absolute right-4 top-4 opacity-0" />
                  <div className="flex items-center gap-2 font-semibold">
                    <item.icon className={`h-4 w-4 ${paymentMethod === item.id ? "text-primary" : "text-muted-foreground"}`} />
                    {item.label}
                  </div>
                  <p className="text-xs text-muted-foreground font-medium pl-6">
                    {item.desc}
                  </p>
                </Label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm overflow-hidden bg-white dark:bg-zinc-900/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> Dados de faturamento
            </CardTitle>
            <CardDescription>Informe os dados da empresa responsável pela cobrança.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!billingDataStatus.loaded && (
              <div className="flex items-center gap-3 p-3 text-sm text-primary bg-primary/5 rounded-lg border border-primary/10">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Buscando dados da empresa cadastrada...</span>
              </div>
            )}
            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="billing-name" className="text-xs font-medium uppercase text-muted-foreground">Razão social</Label>
                <Input
                  id="billing-name"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Nome da empresa"
                  className="h-10 bg-background/50"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="billing-document" className="text-xs font-medium uppercase text-muted-foreground">CNPJ ou CPF</Label>
                <Input
                  id="billing-document"
                  value={companyDocument}
                  onChange={(event) => setCompanyDocument(formatCpfCnpj(event.target.value))}
                  placeholder="00.000.000/0000-00"
                  className="h-10 bg-background/50"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="billing-email" className="text-xs font-medium uppercase text-muted-foreground">E-mail de cobrança</Label>
              <Input
                id="billing-email"
                type="email"
                value={billingEmail}
                onChange={(event) => setBillingEmail(event.target.value)}
                placeholder="financeiro@empresa.com.br"
                className="h-10 bg-background/50"
              />
              <p className="text-[0.8rem] text-muted-foreground">
                As faturas e comprovantes serão enviados para este e-mail.
              </p>
            </div>
          </CardContent>
        </Card>

        {isCardMethod && (
          <Card>
            <CardHeader>
              <CardTitle>Dados do cartão corporativo</CardTitle>
              <CardDescription>Necessários para tokenizar e salvar o cartão do cliente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="card-holder-name">Nome impresso</Label>
                  <Input
                    id="card-holder-name"
                    value={cardForm.holderName}
                    onChange={handleCardFormChange("holderName")}
                    placeholder="Nome do titular"
                  />
                  {cardErrors.holderName && (
                    <p className="text-sm text-destructive">{cardErrors.holderName}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="card-holder-email">E-mail do titular</Label>
                  <Input
                    id="card-holder-email"
                    value={cardForm.holderEmail}
                    onChange={handleCardFormChange("holderEmail")}
                    placeholder="titular@empresa.com"
                  />
                  {cardErrors.holderEmail && (
                    <p className="text-sm text-destructive">{cardErrors.holderEmail}</p>
                  )}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="card-document">Documento</Label>
                  <Input
                    id="card-document"
                    value={cardForm.document}
                    onChange={handleCardFormChange("document", formatCpfCnpj)}
                    placeholder="000.000.000-00"
                  />
                  {cardErrors.document && (
                    <p className="text-sm text-destructive">{cardErrors.document}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="card-number">Número do cartão</Label>
                  <Input
                    id="card-number"
                    value={cardForm.number}
                    onChange={handleCardFormChange("number")}
                    placeholder="0000 0000 0000 0000"
                    inputMode="numeric"
                  />
                  {cardErrors.number && (
                    <p className="text-sm text-destructive">{cardErrors.number}</p>
                  )}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="card-expiry-month">Mês</Label>
                  <Input
                    id="card-expiry-month"
                    value={cardForm.expiryMonth}
                    onChange={handleCardFormChange("expiryMonth")}
                    placeholder="MM"
                    inputMode="numeric"
                  />
                  {cardErrors.expiryMonth && (
                    <p className="text-sm text-destructive">{cardErrors.expiryMonth}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="card-expiry-year">Ano</Label>
                  <Input
                    id="card-expiry-year"
                    value={cardForm.expiryYear}
                    onChange={handleCardFormChange("expiryYear")}
                    placeholder="AAAA"
                    inputMode="numeric"
                  />
                  {cardErrors.expiryYear && (
                    <p className="text-sm text-destructive">{cardErrors.expiryYear}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="card-cvv">CVV</Label>
                  <Input
                    id="card-cvv"
                    value={cardForm.cvv}
                    onChange={handleCardFormChange("cvv", sanitizeDigits)}
                    placeholder="123"
                    inputMode="numeric"
                  />
                  {cardErrors.cvv && <p className="text-sm text-destructive">{cardErrors.cvv}</p>}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="card-phone">Telefone</Label>
                  <Input
                    id="card-phone"
                    value={cardForm.phone}
                    onChange={handleCardFormChange("phone", sanitizeDigits)}
                    placeholder="11999999999"
                    inputMode="numeric"
                  />
                  {cardErrors.phone && <p className="text-sm text-destructive">{cardErrors.phone}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="card-postal-code">CEP</Label>
                  <Input
                    id="card-postal-code"
                    value={cardForm.postalCode}
                    onChange={handleCardFormChange("postalCode", sanitizeDigits)}
                    placeholder="00000000"
                    inputMode="numeric"
                  />
                  {cardErrors.postalCode && (
                    <p className="text-sm text-destructive">{cardErrors.postalCode}</p>
                  )}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="card-address-number">Número</Label>
                  <Input
                    id="card-address-number"
                    value={cardForm.addressNumber}
                    onChange={handleCardFormChange("addressNumber")}
                    placeholder="123"
                  />
                  {cardErrors.addressNumber && (
                    <p className="text-sm text-destructive">{cardErrors.addressNumber}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="card-address-complement">Complemento</Label>
                  <Input
                    id="card-address-complement"
                    value={cardForm.addressComplement}
                    onChange={handleCardFormChange("addressComplement")}
                    placeholder="Sala 5"
                  />
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-dashed p-3">
                <Checkbox
                  id="auto-charge"
                  checked={autoChargeConfirmed}
                  onCheckedChange={(checked) => setAutoChargeConfirmed(Boolean(checked))}
                />
                <div>
                  <Label htmlFor="auto-charge" className="font-medium">
                    Confirmo a cobrança automática nas próximas renovações.
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    O cliente será avisado pelo Asaas sempre que uma cobrança for realizada.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-primary/20 bg-primary/5 shadow-md overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" /> Confirmar cobrança
            </CardTitle>
            <CardDescription>Gere a cobrança com os dados informados para liberar o plano.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-background/80 p-5 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Valor desta cobrança</p>
              <p className="text-3xl font-bold text-foreground mt-1">{chargeAmountLabel ?? formattedPrice ?? "--"}</p>
              {summaryDueDateLabel && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  <Calendar className="h-3 w-3" /> Vencimento em {summaryDueDateLabel}
                </p>
              )}
            </div>
            {paymentMethod === "cartao" && !autoChargeConfirmed && (
              <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400">
                <AlertTitle>Autorização necessária</AlertTitle>
                <AlertDescription>
                  Confirme a autorização de cobrança no cartão acima para continuar.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-black/5 dark:bg-white/5 p-6">
            <div className="text-xs text-muted-foreground max-w-md">
              Ao gerar a cobrança, confirmaremos o recebimento e liberaremos o acesso ao plano automaticamente.
            </div>
            <Button
              className="w-full sm:w-auto font-semibold shadow-lg shadow-primary/20"
              size="lg"
              disabled={isConfirmDisabled}
              onClick={handleSubmit}
            >
              {(isSubmitting || isTokenizingCard) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {hasPaymentResult ? "Cobrança gerada" : "Gerar cobrança"}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Status da cobrança</CardTitle>
            <CardDescription>Acompanhe a confirmação do pagamento junto ao Asaas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline">{summaryStatusLabel ?? "Aguardando"}</Badge>
              {paymentMethodLabel && <Badge variant="secondary">{paymentMethodLabel}</Badge>}
              {isPaymentStatusLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Valor</span>
                <span className="font-medium">{chargeAmountLabel ?? "--"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Vencimento</span>
                <span className="font-medium">{summaryDueDateLabel ?? "--"}</span>
              </div>
            </div>
            {paymentStatusError && (
              <Alert variant="destructive">
                <AlertTitle>Erro ao atualizar</AlertTitle>
                <AlertDescription>{paymentStatusError}</AlertDescription>
              </Alert>
            )}
            {!hasPaymentResult && (
              <p className="text-sm text-muted-foreground">
                Gere a cobrança para que o status seja atualizado automaticamente a cada 5 segundos.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instruções de pagamento</CardTitle>
            <CardDescription>Disponibilize o documento ao cliente imediatamente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasPaymentResult && (
              <p className="text-sm text-muted-foreground">
                Assim que você gerar a cobrança, exibiremos aqui o QR Code, boleto ou confirmação do cartão.
              </p>
            )}
            {hasPaymentResult && normalizedBillingType === "PIX" && (
              <div className="space-y-4">
                {pixImageSrc ? (
                  <div className="flex flex-col items-center gap-3">
                    <img src={pixImageSrc} alt="Código PIX" className="w-full max-w-xs rounded-lg border bg-white p-4" />
                    <p className="text-sm text-muted-foreground">Escaneie no aplicativo do banco.</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    O QR Code será exibido assim que o Asaas liberar a cobrança.
                  </div>
                )}
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-center" onClick={() => handleCopy(pixPayload)}>
                    <Copy className="mr-2 h-4 w-4" /> Copiar código PIX
                  </Button>
                  {pixPayload && <p className="break-all rounded bg-muted/50 p-3 text-xs font-mono">{pixPayload}</p>}
                </div>
              </div>
            )}
            {hasPaymentResult && normalizedBillingType === "BOLETO" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Baixe o boleto em PDF e encaminhe para o responsável financeiro.
                </p>
                <div className="flex flex-col gap-2">
                  <Button onClick={handleOpenBoleto}>Abrir boleto</Button>
                  {paymentResult?.charge.invoiceUrl && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        handleOpenLink(paymentResult.charge.invoiceUrl, {
                          title: "Fatura indisponível",
                          description: "O documento ainda não foi liberado pelo Asaas.",
                        })
                      }
                    >
                      Abrir comprovante
                    </Button>
                  )}
                </div>
              </div>
            )}
            {hasPaymentResult && normalizedBillingType === "CREDIT_CARD" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <CreditCard className="h-5 w-5" />
                  <div>
                    <p className="font-medium">
                      Cartão final {paymentResult?.charge.cardLast4 ?? "****"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {paymentResult?.charge.cardBrand
                        ? `Bandeira ${paymentResult.charge.cardBrand}`
                        : "Bandeira não informada"}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  O cartão está tokenizado e as próximas renovações ocorrerão automaticamente.
                </p>
                <Button variant="outline" onClick={handleEditCard}>
                  Atualizar dados do cartão
                </Button>
              </div>
            )}
            {hasPaymentResult && normalizedBillingType === "DEBIT_CARD" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Oriente o cliente a confirmar o débito diretamente no aplicativo do banco.
                </p>
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  O Asaas notificará quando o débito for processado.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico recente</CardTitle>
            <CardDescription>Última cobrança registrada para este plano.</CardDescription>
          </CardHeader>
          <CardContent>
            {selectionPaymentSummary ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium">
                    {formatStatusLabel(selectionPaymentSummary.status ?? null) ?? "Desconhecido"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-medium">
                    {selectionPaymentSummary.amount ? currencyFormatter.format(selectionPaymentSummary.amount) : "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Vencimento</span>
                  <span className="font-medium">
                    {formatDisplayDate(selectionPaymentSummary.dueDate) ?? "--"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma cobrança anterior foi localizada para este plano.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );


  return (
    <div className="min-h-screen bg-muted/20 py-12">
      <div className="container mx-auto max-w-5xl px-4 space-y-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="pl-0 -ml-2 text-muted-foreground hover:text-foreground mb-2"
              onClick={() => handleReturnToPlanSelection()}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para planos
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Gerenciar pagamento</h1>
            <p className="text-base text-muted-foreground max-w-2xl">
              Confirme os dados de faturamento e escolha a melhor forma de pagamento para ativar seu plano.
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="border-destructive/20 bg-destructive/5 text-destructive animate-in fade-in slide-in-from-top-2">
            <AlertTitle className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 rotate-45" /> Não foi possível processar
            </AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!selectedPlan ? renderPlanSelectionFallback() : renderCheckoutSections()}
      </div>
    </div>
  );
};

export default ManagePlanPayment;
