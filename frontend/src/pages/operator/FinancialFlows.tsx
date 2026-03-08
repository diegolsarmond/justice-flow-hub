import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isBefore, isValid, parseISO, startOfDay, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  fetchFlows,
  createFlow,
  settleFlow,
  Flow,
  AsaasCharge,
  AsaasChargeStatus,
  normalizeFlowId,
  resendAsaasCharge,
  refreshAsaasChargeStatus,
  receiveAsaasChargeInCash,
  ReceiveAsaasChargeInCashPayload,
  syncAsaasCharges,
} from '@/lib/flows';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Info, AlertCircle, ChevronLeft, ChevronRight, ChevronsUpDown, Check, ChevronDown, BarChart3 } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AsaasChargeDialog } from '@/components/financial/AsaasChargeDialog';
import type { CustomerOption } from '@/components/financial/AsaasChargeDialog';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  MoreHorizontal,
  FileText,
  CreditCard,
  RefreshCw,
  Send,
  Search,
  ListFilter,
  Clock,
  CheckCircle2,
  RotateCcw,
  Loader2,
} from 'lucide-react';

const CHART_COLORS = {
  receitas: '#16a34a',
  despesas: '#dc2626',
  aberto: '#f59e0b',
} as const;

const chartConfig = {
  receitas: {
    label: 'Receitas',
    color: '#16a34a',
  },
  despesas: {
    label: 'Despesas',
    color: '#dc2626',
  },
  aberto: {
    label: 'Cobranças em aberto',
    color: '#f59e0b',
  },
} satisfies ChartConfig;

const CHART_SERIES_LABELS = {
  receitas: 'Receitas',
  despesas: 'Despesas',
  aberto: 'Cobranças em aberto',
} as const;

const STATUS_BADGE_COLORS = {
  yellow: 'border-yellow-200 bg-yellow-100 text-yellow-800',
  green: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  red: 'border-rose-200 bg-rose-100 text-rose-800',
  neutral: 'border-slate-200 bg-slate-100 text-slate-800',
  blue: 'border-sky-200 bg-sky-100 text-sky-800',
} as const;

export const ASAAS_STATUS_DISPLAY = {
  PENDING: { label: 'Pendente', badgeClassName: STATUS_BADGE_COLORS.yellow },
  AWAITING_RISK_ANALYSIS: { label: 'Aguardando análise', badgeClassName: STATUS_BADGE_COLORS.yellow },
  IN_ANALYSIS: { label: 'Em análise', badgeClassName: STATUS_BADGE_COLORS.yellow },
  SCHEDULED: { label: 'Agendado', badgeClassName: STATUS_BADGE_COLORS.yellow },
  SENT: { label: 'Enviado', badgeClassName: STATUS_BADGE_COLORS.blue },
  BANK_SLIP_VIEWED: { label: 'Boleto visualizado', badgeClassName: STATUS_BADGE_COLORS.blue },
  AUTHORIZED: { label: 'Autorizado', badgeClassName: STATUS_BADGE_COLORS.green },
  RECEIVED: { label: 'Recebido', badgeClassName: STATUS_BADGE_COLORS.green },
  RECEIVED_IN_CASH: { label: 'Recebido em dinheiro', badgeClassName: STATUS_BADGE_COLORS.green },
  RECEIVED_PARTIALLY: { label: 'Recebido parcialmente', badgeClassName: STATUS_BADGE_COLORS.green },
  CONFIRMED: { label: 'Confirmado', badgeClassName: STATUS_BADGE_COLORS.green },
  ANTICIPATED: { label: 'Antecipado', badgeClassName: STATUS_BADGE_COLORS.green },
  OVERDUE: { label: 'Em atraso', badgeClassName: STATUS_BADGE_COLORS.red },
  FAILED: { label: 'Falhou', badgeClassName: STATUS_BADGE_COLORS.red },
  CANCELED: { label: 'Cancelado', badgeClassName: STATUS_BADGE_COLORS.red },
  CANCELLED: { label: 'Cancelado', badgeClassName: STATUS_BADGE_COLORS.red },
  CHARGEBACK: { label: 'Chargeback', badgeClassName: STATUS_BADGE_COLORS.red },
  DUNNING_REQUESTED: { label: 'Negativação solicitada', badgeClassName: STATUS_BADGE_COLORS.red },
  DUNNING_RECEIVED: { label: 'Negativação concluída', badgeClassName: STATUS_BADGE_COLORS.red },
  REFUND_PENDING: { label: 'Estorno pendente', badgeClassName: STATUS_BADGE_COLORS.neutral },
  REFUND_IN_PROGRESS: { label: 'Estorno em processamento', badgeClassName: STATUS_BADGE_COLORS.neutral },
  REFUND_REQUESTED: { label: 'Estorno solicitado', badgeClassName: STATUS_BADGE_COLORS.neutral },
  REFUND_DENIED: { label: 'Estorno negado', badgeClassName: STATUS_BADGE_COLORS.red },
  REFUNDED: { label: 'Estornado', badgeClassName: STATUS_BADGE_COLORS.neutral },
  MANUAL_RECONCILIATION: { label: 'Reconciliação manual', badgeClassName: STATUS_BADGE_COLORS.neutral },
} satisfies Record<string, { label: string; badgeClassName: string }>;

export const getAsaasStatusDisplay = (status: string | null | undefined) => {
  const normalized = status ? status.toString().trim().toUpperCase() : '';
  if (!normalized) {
    return { label: 'Cobrança gerada', badgeClassName: STATUS_BADGE_COLORS.neutral };
  }
  const mapped = ASAAS_STATUS_DISPLAY[normalized];
  if (mapped) {
    return mapped;
  }
  const fallbackLabel = normalized
    .split('_')
    .map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
    .join(' ');
  return { label: fallbackLabel, badgeClassName: STATUS_BADGE_COLORS.neutral };
};

type ChargeStatusSummaryProps = {
  status?: string | null;
};

export const ChargeStatusSummary = ({ status }: ChargeStatusSummaryProps) => {
  if (!status) {
    return <span className="text-xs text-muted-foreground">Cobrança gerada</span>;
  }
  const { label, badgeClassName } = getAsaasStatusDisplay(status);
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <span>Último status:</span>
      <Badge variant="outline" className={cn('text-[0.65rem] font-semibold', badgeClassName)}>
        {label}
      </Badge>
    </span>
  );
};

type FlowFormState = {
  tipo: Flow['tipo'];
  descricao: string;
  valor: string;
  vencimento: string;
  clienteId: string;
  fornecedorId: string;
};

const INITIAL_FORM_STATE: FlowFormState = {
  tipo: 'receita',
  descricao: '',
  valor: '',
  vencimento: '',
  clienteId: '',
  fornecedorId: '',
};

type SupplierOption = CustomerOption & { phone?: string };

const formatDateForInput = (date: Date) => format(date, 'yyyy-MM-dd');
const getDefaultPaymentDate = () => formatDateForInput(startOfDay(new Date()));

const parseDateValue = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  return parsed && isValid(parsed) ? parsed : null;
};

const normalizeDateInputValue = (value: string | null | undefined): string | null => {
  const parsed = parseDateValue(value);
  return parsed ? formatDateForInput(parsed) : null;
};

function normalizeCustomerOption(entry: unknown): CustomerOption | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const idCandidate =
    record.id ??
    record.clienteId ??
    record.cliente_id ??
    record.customerId ??
    record.customer_id ??
    record.externalId ??
    record.external_id;

  if (idCandidate === undefined || idCandidate === null) {
    return null;
  }

  const id = String(idCandidate);
  const nameCandidate =
    record.nome ??
    record.name ??
    record.razaoSocial ??
    record['razao_social'] ??
    record.companyName ??
    record.fantasia ??
    record.legalName;

  const emailCandidate = record.email ?? record.emailPrincipal ?? record.primaryEmail ?? record.contatoEmail;
  const documentCandidate = record.cpfCnpj ?? record.documento ?? record.document ?? record.cnpj ?? record.cpf;

  return {
    id,
    label: typeof nameCandidate === 'string' && nameCandidate.length > 0 ? nameCandidate : `Cliente ${id}`,
    email: typeof emailCandidate === 'string' ? emailCandidate : undefined,
    document: typeof documentCandidate === 'string' ? documentCandidate : undefined,
    raw: entry,
  };
}

function normalizeSupplierOption(entry: unknown): SupplierOption | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const idCandidate =
    record.id ??
    record.fornecedorId ??
    record.fornecedor_id ??
    record.supplierId ??
    record.supplier_id ??
    record.externalId ??
    record.external_id;

  if (idCandidate === undefined || idCandidate === null) {
    return null;
  }

  const id = String(idCandidate);
  const nameCandidate =
    record.nome ??
    record.razaoSocial ??
    record['razao_social'] ??
    record.fantasia ??
    record.companyName ??
    record.name;

  const emailCandidate =
    record.email ??
    record.emailPrincipal ??
    record.primaryEmail ??
    record.contatoEmail ??
    record['contato_email'];
  const documentCandidate =
    record.documento ??
    record.document ??
    record.cnpj ??
    record.cpf ??
    record.cpfCnpj ??
    record['numero_documento'];
  const phoneCandidate = record.telefone ?? record.phone ?? record['telefone_principal'];

  const labelCandidate = typeof nameCandidate === 'string' ? nameCandidate.trim() : '';
  const emailValue = typeof emailCandidate === 'string' ? emailCandidate : undefined;
  const documentValue = typeof documentCandidate === 'string' ? documentCandidate : undefined;
  const phoneValue = typeof phoneCandidate === 'string' ? phoneCandidate.trim() : undefined;

  const label = labelCandidate.length > 0 ? labelCandidate : `Fornecedor ${id}`;

  return {
    id,
    label,
    email: emailValue,
    document: documentValue,
    phone: phoneValue && phoneValue.length > 0 ? phoneValue : undefined,
    raw: entry,
  };
}

async function fetchCustomersForFlows(): Promise<CustomerOption[]> {
  const response = await fetch(getApiUrl('clientes'));
  if (!response.ok) {
    throw new Error(`Falha ao carregar clientes (HTTP ${response.status})`);
  }

  const payload = await response.json();
  const listCandidates = Array.isArray(payload)
    ? payload
    : (payload?.items as unknown[]) ?? (payload?.data as unknown[]) ?? (payload?.results as unknown[]) ?? [];

  return listCandidates
    .map((entry) => normalizeCustomerOption(entry))
    .filter((customer): customer is CustomerOption => Boolean(customer));
}

async function fetchSuppliersForFlows(): Promise<SupplierOption[]> {
  const response = await fetch(getApiUrl('fornecedores'));
  if (!response.ok) {
    throw new Error(`Falha ao carregar fornecedores (HTTP ${response.status})`);
  }

  const payload = await response.json();
  const listCandidates = Array.isArray(payload)
    ? payload
    : (payload?.items as unknown[]) ?? (payload?.data as unknown[]) ?? (payload?.results as unknown[]) ?? [];

  return listCandidates
    .map((entry) => normalizeSupplierOption(entry))
    .filter((supplier): supplier is SupplierOption => Boolean(supplier));
}

const DIGIT_ONLY_REGEX = /\D+/g;

const BRAZILIAN_CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const extractCurrencyDigits = (value: string): string => value.replace(DIGIT_ONLY_REGEX, '');

const formatCurrencyInputValue = (digits: string): string => {
  if (!digits) {
    return '';
  }
  const parsed = Number.parseInt(digits, 10);
  if (Number.isNaN(parsed)) {
    return '';
  }
  return BRAZILIAN_CURRENCY_FORMATTER.format(parsed / 100);
};

const parseCurrencyDigits = (digits: string): number | null => {
  if (!digits) {
    return null;
  }
  const parsed = Number.parseInt(digits, 10);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed / 100;
};

const buildOptionDetails = (option: CustomerOption | SupplierOption): string | null => {
  const details: string[] = [];
  if (typeof option.document === 'string' && option.document.trim().length > 0) {
    details.push(option.document.trim());
  }
  if (typeof option.email === 'string' && option.email.trim().length > 0) {
    details.push(option.email.trim());
  }
  if ('phone' in option && typeof option.phone === 'string' && option.phone.trim().length > 0) {
    details.push(option.phone.trim());
  }
  return details.length > 0 ? details.join(' • ') : null;
};

const FinancialFlows = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    data: flows = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({ queryKey: ['flows'], queryFn: fetchFlows });
  const {
    data: customers = [],
    isLoading: customersLoading,
    error: customersError,
  } = useQuery({ queryKey: ['flows-customers'], queryFn: fetchCustomersForFlows, staleTime: 1000 * 60 * 5 });
  const {
    data: suppliers = [],
    isLoading: suppliersLoading,
    error: suppliersError,
  } = useQuery({ queryKey: ['flows-suppliers'], queryFn: fetchSuppliersForFlows, staleTime: 1000 * 60 * 5 });

  const [chargeDialogFlow, setChargeDialogFlow] = useState<Flow | null>(null);
  const [chargeSummaries, setChargeSummaries] = useState<Record<number, AsaasCharge | null>>({});
  const [chargeStatusHistory, setChargeStatusHistory] = useState<Record<number, AsaasChargeStatus[]>>({});
  const [settleDialogFlow, setSettleDialogFlow] = useState<FlowWithDetails | null>(null);

  const [settleDate, setSettleDate] = useState(() => getDefaultPaymentDate());
  const [notifySettleCustomer, setNotifySettleCustomer] = useState(false);
  const resolveFlowNumericId = useCallback((flowId: Flow['id']): number | null => {
    if (typeof flowId === 'number' && Number.isInteger(flowId) && flowId >= 0) {
      return flowId;
    }

    const normalizedId = normalizeFlowId(flowId);
    if (!normalizedId || !/^\d+$/.test(normalizedId)) {
      return null;
    }

    const parsed = Number.parseInt(normalizedId, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, []);

  useEffect(() => {
    if (customersError instanceof Error) {
      toast({
        title: 'Erro ao carregar clientes',
        description: customersError.message,
        variant: 'destructive',
      });
    }
  }, [customersError, toast]);

  useEffect(() => {
    if (suppliersError instanceof Error) {
      toast({
        title: 'Erro ao carregar fornecedores',
        description: suppliersError.message,
        variant: 'destructive',
      });
    }
  }, [suppliersError, toast]);

  // Sincroniza as cobranças do Asaas periodicamente ao entrar na tela (polling de 50s)
  useEffect(() => {
    let isMounted = true;

    const performSync = async () => {
      try {
        const result = await syncAsaasCharges();

        if (!isMounted) return;

        // Se houve atualizações, recarrega os flows
        if (result.success && result.result && (result.result.chargesUpdated > 0 || result.result.flowsUpdated > 0)) {
          queryClient.invalidateQueries({ queryKey: ['flows'] });
        }
      } catch (error) {
        // Silenciosamente ignora erros de sincronização para não atrapalhar a experiência do usuário
        console.warn('[FinancialFlows] Sync error:', error);
      }
    };

    // Executa imediatamente ao carregar
    performSync();

    // Configura polling a cada 50 segundos
    const intervalId = setInterval(performSync, 50000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [queryClient]);


  const handleChargeSaved = useCallback(
    (flowId: number, charge: AsaasCharge) => {
      setChargeSummaries((prev) => ({ ...prev, [flowId]: charge }));
      const normalizedStatus = typeof charge.status === 'string' ? charge.status.trim().toUpperCase() : '';
      // Atualiza a listagem quando o status mudar para pagamento confirmado ou estorno
      const shouldRefreshList = [
        'RECEIVED', 'RECEIVED_IN_CASH', 'CONFIRMED', 'RECEIVED_PARTIALLY',
        'REFUNDED', 'REFUND_PENDING', 'REFUND_REQUESTED'
      ].includes(normalizedStatus);
      if (shouldRefreshList) {
        queryClient.invalidateQueries({ queryKey: ['flows'] });
      }
    },
    [queryClient],
  );

  const handleStatusUpdated = useCallback((flowId: number, statuses: AsaasChargeStatus[]) => {
    setChargeStatusHistory((prev) => ({ ...prev, [flowId]: statuses }));
  }, []);


  type DerivedStatus = 'pendente' | 'pago' | 'vencido' | 'estornado';

  type FlowWithDetails = Flow & {
    computedStatus: DerivedStatus;
    dueDate: Date | null;
    pagamentoDate: Date | null;
    normalizedId: string | null;
    canManuallySettle: boolean;
    isPlanCharge: boolean;
  };

  type PeriodTotals = {
    receitas: number;
    despesas: number;
    saldo: number;
    status: Record<DerivedStatus, { count: number; value: number }>;
  };

  type PeriodGroup = {
    key: string;
    label: string;
    sortValue: number;
    flows: FlowWithDetails[];
    totals: PeriodTotals;
  };

  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [activePeriodKey, setActivePeriodKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DerivedStatus>('all');
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | Flow['tipo']>('all');
  const [onlyOpenCharges, setOnlyOpenCharges] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncAsaasCharges();
      if (result.success && result.result && (result.result.chargesUpdated > 0 || result.result.flowsUpdated > 0)) {
        queryClient.invalidateQueries({ queryKey: ['flows'] });
        toast({
          title: 'Sincronização concluída',
          description: `${result.result.chargesUpdated} cobranças atualizadas e ${result.result.flowsUpdated} lançamentos alterados.`,
        });
      } else {
        toast({
          title: 'Sincronização concluída',
          description: 'Todos os registros já estão atualizados.',
        });
      }
    } catch (error) {
      console.warn('[FinancialFlows] Manual sync error:', error);
      toast({
        title: 'Erro na sincronização',
        description: 'Não foi possível sincronizar com o Asaas no momento.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, queryClient, toast]);

  const refreshStatusMutation = useMutation({
    mutationFn: async (flowId: number) => {
      return refreshAsaasChargeStatus(flowId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      toast({
        title: 'Status atualizado',
        description: 'O status da cobrança foi atualizado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar',
        description: error instanceof Error ? error.message : 'Falha ao atualizar status.',
        variant: 'destructive',
      });
    },
  });

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    [],
  );

  const formatCurrency = (value: number) => currencyFormatter.format(value);

  const statusLabels: Record<DerivedStatus, string> = {
    pendente: 'Pendentes',
    pago: 'Pagos',
    vencido: 'Vencidos',
    estornado: 'Estornados',
  };

  const statusSingleLabels: Record<DerivedStatus, string> = {
    pendente: 'Pendente',
    pago: 'Pago',
    vencido: 'Vencido',
    estornado: 'Estornado',
  };

  const statusBadgeClasses: Record<DerivedStatus, string> = {
    pendente: STATUS_BADGE_COLORS.yellow,
    pago: STATUS_BADGE_COLORS.green,
    vencido: STATUS_BADGE_COLORS.red,
    estornado: STATUS_BADGE_COLORS.neutral,
  };

  const deriveMonthLabel = useCallback((date: Date) => {
    const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, []);

  const formatDayDate = (date: Date | null, fallback?: string) => {
    if (!date || !isValid(date)) return fallback ?? '-';
    return format(date, 'dd/MM/yyyy');
  };

  const eligibleFlows = useMemo(() => {
    return flows.filter((flow) => {
      const normalizedOrigin =
        typeof flow.origin === 'string' ? flow.origin.trim().toLowerCase() : '';
      const isPlanCharge = normalizedOrigin === 'plan-payment';

      if (isPlanCharge) {
        return true;
      }

      const hasAssociation = Boolean(flow.cliente_id || flow.fornecedor_id);
      if (hasAssociation) {
        return true;
      }

      const description = (typeof flow.descricao === 'string' ? flow.descricao : '').toLowerCase();
      return !description.includes('assinatura');
    });
  }, [flows]);

  const detailedFlows = useMemo<FlowWithDetails[]>(() => {
    const today = startOfDay(new Date());
    return eligibleFlows.map((flow) => {
      const parsedDueDate = flow.vencimento ? parseISO(flow.vencimento) : null;
      const dueDate = parsedDueDate && isValid(parsedDueDate) ? parsedDueDate : null;
      const parsedPaymentDate = flow.pagamento ? parseISO(flow.pagamento) : null;
      const pagamentoDate = parsedPaymentDate && isValid(parsedPaymentDate) ? parsedPaymentDate : null;
      const normalizedId = normalizeFlowId(flow.id);
      const normalizedOrigin =
        typeof flow.origin === 'string' ? flow.origin.trim().toLowerCase() : '';
      const isPlanCharge = normalizedOrigin === 'plan-payment';

      const computedStatus: DerivedStatus =
        flow.status === 'estornado'
          ? 'estornado'
          : flow.status === 'pago'
            ? 'pago'
            : flow.status === 'vencido'
              ? 'vencido'
              : pagamentoDate
                ? 'pago'
                : dueDate && isBefore(dueDate, today)
                  ? 'vencido'
                  : 'pendente';
      return {
        ...flow,
        computedStatus,
        dueDate,
        pagamentoDate,
        normalizedId,
        canManuallySettle: true,
        isPlanCharge,
      };
    });
  }, [eligibleFlows]);

  const filteredFlows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return detailedFlows.filter((flow) => {
      const descriptionMatches = flow.descricao.toLowerCase().includes(term);
      const planLabelMatches = flow.isPlanCharge && 'plano quantumjud'.includes(term);

      let participantMatches = false;
      if (flow.cliente_id) {
        const customer = customers.find(c => c.id === flow.cliente_id);
        if (customer && customer.label.toLowerCase().includes(term)) {
          participantMatches = true;
        }
      } else if (flow.fornecedor_id) {
        const supplier = suppliers.find(s => s.id === flow.fornecedor_id);
        if (supplier && supplier.label.toLowerCase().includes(term)) {
          participantMatches = true;
        }
      }

      const matchesSearch = term.length === 0 || descriptionMatches || planLabelMatches || participantMatches;
      const matchesStatus =
        statusFilter === 'all' ||
        flow.computedStatus === statusFilter;
      const matchesType = typeFilter === 'all' || flow.tipo === typeFilter;
      const matchesOnlyOpen =
        !onlyOpenCharges ||
        (flow.computedStatus === 'pendente' || flow.computedStatus === 'vencido');

      return matchesSearch && matchesStatus && matchesType && matchesOnlyOpen;
    });
  }, [detailedFlows, onlyOpenCharges, searchTerm, statusFilter, typeFilter, customers, suppliers]);

  const periods = useMemo<PeriodGroup[]>(() => {
    const accumulator = new Map<string, { key: string; label: string; sortValue: number; flows: FlowWithDetails[] }>();

    filteredFlows.forEach((flow) => {
      const key = flow.dueDate ? format(flow.dueDate, 'yyyy-MM') : 'sem-data';
      const sortValue = flow.dueDate ? startOfMonth(flow.dueDate).getTime() : Number.NEGATIVE_INFINITY;
      const label = flow.dueDate ? deriveMonthLabel(flow.dueDate) : 'Sem vencimento';

      if (!accumulator.has(key)) {
        accumulator.set(key, { key, label, sortValue, flows: [] });
      }

      accumulator.get(key)!.flows.push(flow);
    });

    return Array.from(accumulator.values())
      .map<PeriodGroup>((group) => {
        const totals = group.flows.reduce<PeriodTotals>(
          (acc, flow) => {
            if (flow.tipo === 'receita') {
              acc.receitas += flow.valor;
            } else {
              acc.despesas += flow.valor;
            }
            acc.status[flow.computedStatus].count += 1;
            acc.status[flow.computedStatus].value += flow.valor;
            return acc;
          },
          {
            receitas: 0,
            despesas: 0,
            saldo: 0,
            status: {
              pendente: { count: 0, value: 0 },
              pago: { count: 0, value: 0 },
              vencido: { count: 0, value: 0 },
              estornado: { count: 0, value: 0 },
            },
          },
        );
        totals.saldo = totals.receitas - totals.despesas;

        return {
          ...group,
          totals,
        };
      })
      .sort((a, b) => a.sortValue - b.sortValue);
  }, [filteredFlows, deriveMonthLabel]);

  const globalTotals = useMemo(() => {
    const totals = filteredFlows.reduce<PeriodTotals>(
      (acc, flow) => {
        if (flow.tipo === 'receita') {
          acc.receitas += flow.valor;
        } else {
          acc.despesas += flow.valor;
        }
        acc.status[flow.computedStatus].count += 1;
        acc.status[flow.computedStatus].value += flow.valor;
        return acc;
      },
      {
        receitas: 0,
        despesas: 0,
        saldo: 0,
        status: {
          pendente: { count: 0, value: 0 },
          pago: { count: 0, value: 0 },
          vencido: { count: 0, value: 0 },
          estornado: { count: 0, value: 0 },
        },
      },
    );
    totals.saldo = totals.receitas - totals.despesas;
    return totals;
  }, [filteredFlows]);

  const hasAnyEligibleFlow = eligibleFlows.length > 0;
  const hasAnyRawFlow = flows.length > 0;

  const datedPeriods = useMemo(() => periods.filter((period) => period.key !== 'sem-data'), [periods]);
  const undatedPeriod = useMemo(
    () => periods.find((period) => period.key === 'sem-data') ?? null,
    [periods],
  );

  const yearGroups = useMemo(
    () => {
      const accumulator = new Map<number, PeriodGroup[]>();

      datedPeriods.forEach((period) => {
        const [yearPart] = period.key.split('-');
        const year = Number.parseInt(yearPart, 10);
        if (!Number.isFinite(year)) {
          return;
        }
        if (!accumulator.has(year)) {
          accumulator.set(year, []);
        }
        accumulator.get(year)!.push(period);
      });

      return Array.from(accumulator.entries())
        .map(([year, yearPeriods]) => ({
          year,
          periods: yearPeriods.sort((a, b) => a.sortValue - b.sortValue),
        }))
        .sort((a, b) => b.year - a.year);
    },
    [datedPeriods],
  );

  const availableYears = useMemo(() => yearGroups.map((group) => group.year), [yearGroups]);

  useEffect(() => {
    if (availableYears.length === 0) {
      if (activeYear !== null) {
        setActiveYear(null);
      }
      return;
    }

    const currentYear = new Date().getFullYear();
    const fallbackYear = availableYears[0];
    const preferredYear = availableYears.includes(currentYear) ? currentYear : fallbackYear;

    if (activeYear === null || !availableYears.includes(activeYear)) {
      setActiveYear(preferredYear);
    }
  }, [activeYear, availableYears]);

  const periodsForActiveYear = useMemo(() => {
    if (activeYear === null) {
      return [];
    }

    return yearGroups.find((group) => group.year === activeYear)?.periods ?? [];
  }, [activeYear, yearGroups]);

  const visiblePeriods = useMemo(() => {
    const periodsWithYear = periodsForActiveYear;
    return undatedPeriod ? [...periodsWithYear, undatedPeriod] : periodsWithYear;
  }, [periodsForActiveYear, undatedPeriod]);

  const chartData = useMemo(
    () =>
      periodsForActiveYear.map((period) => {
        const monthDate = new Date(period.sortValue);
        const monthLabel = format(monthDate, 'MMM', { locale: ptBR });
        const normalizedLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
        const openChargesValue = period.totals.status.pendente.value + period.totals.status.vencido.value;

        return {
          key: period.key,
          month: normalizedLabel,
          receitas: period.totals.receitas,
          despesas: period.totals.despesas,
          aberto: openChargesValue,
        };
      }),
    [periodsForActiveYear],
  );

  useEffect(() => {
    const visibleKeys = visiblePeriods.map((period) => period.key);
    if (visibleKeys.length === 0) {
      if (activePeriodKey !== null) {
        setActivePeriodKey(null);
      }
      return;
    }

    const now = new Date();
    const currentPeriodKey = format(now, 'yyyy-MM');
    const shouldPrioritizeCurrentMonth = activeYear !== null && activeYear === now.getFullYear();
    const preferredKey =
      shouldPrioritizeCurrentMonth && visibleKeys.includes(currentPeriodKey)
        ? currentPeriodKey
        : visibleKeys[0];

    if (!activePeriodKey || !visibleKeys.includes(activePeriodKey)) {
      setActivePeriodKey(preferredKey);
    }
  }, [activePeriodKey, activeYear, visiblePeriods]);

  const safePeriodKey =
    visiblePeriods.length > 0
      ? activePeriodKey && visiblePeriods.some((period) => period.key === activePeriodKey)
        ? activePeriodKey
        : visiblePeriods[0].key
      : undefined;

  const currentYearIndex = activeYear !== null ? availableYears.indexOf(activeYear) : -1;
  const hasPreviousYear = currentYearIndex >= 0 && currentYearIndex < availableYears.length - 1;
  const hasNextYear = currentYearIndex > 0;

  const handleGoToPreviousYear = () => {
    if (!hasPreviousYear) return;
    const targetYear = availableYears[currentYearIndex + 1];
    setActiveYear(targetYear);
  };

  const handleGoToNextYear = () => {
    if (!hasNextYear) return;
    const targetYear = availableYears[currentYearIndex - 1];
    setActiveYear(targetYear);
  };

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [form, setForm] = useState<FlowFormState>(INITIAL_FORM_STATE);
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = useState(false);
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === form.clienteId) ?? null,
    [customers, form.clienteId],
  );
  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === form.fornecedorId) ?? null,
    [suppliers, form.fornecedorId],
  );
  const isFormValid = useMemo(() => {
    const parsedValue = parseCurrencyDigits(form.valor);
    return Boolean(form.descricao.trim()) && parsedValue !== null;
  }, [form.descricao, form.valor]);

  const createMutation = useMutation({
    mutationFn: () => {
      const parsedValue = parseCurrencyDigits(form.valor) ?? 0;
      return createFlow({
        tipo: form.tipo,
        descricao: form.descricao,
        valor: parsedValue,
        vencimento: form.vencimento,
        clienteId: form.tipo === 'receita' && form.clienteId ? form.clienteId : undefined,
        fornecedorId: form.tipo === 'despesa' && form.fornecedorId ? form.fornecedorId : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      setForm(INITIAL_FORM_STATE);
      setIsCustomerPopoverOpen(false);
      setIsSupplierPopoverOpen(false);
      setIsCreateDialogOpen(false);
    },
  });

  const settleMutation = useMutation({
    mutationFn: ({ flowId, date }: { flowId: string; date: string }) => settleFlow(flowId, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      toast({
        title: 'Lançamento atualizado',
        description: 'O lançamento foi marcado como pago.',
      });
      setSettleDialogFlow(null);
      setSettleDate(getDefaultPaymentDate());
    },
    onError: (error: unknown) => {
      const description =
        error instanceof Error ? error.message : 'Não foi possível marcar o lançamento como pago.';
      toast({
        title: 'Erro ao marcar como pago',
        description,
        variant: 'destructive',
      });
    },
  });

  const resendChargeMutation = useMutation({
    mutationFn: (flowId: number) => resendAsaasCharge(flowId),
    onSuccess: (charge, flowId) => {
      if (charge) {
        handleChargeSaved(flowId, charge);
      }
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      toast({
        title: 'Cobrança reenviada',
        description: 'Uma nova notificação foi enviada ao cliente.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao reenviar cobrança',
        description:
          error instanceof Error ? error.message : 'Não foi possível reenviar a cobrança para o cliente.',
        variant: 'destructive',
      });
    },
  });

  const refreshChargeStatusMutation = useMutation({
    mutationFn: (flowId: number) => refreshAsaasChargeStatus(flowId),
    onSuccess: (result, flowId) => {
      handleStatusUpdated(flowId, result.statuses);
      if (result.charge) {
        handleChargeSaved(flowId, result.charge);
      }
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      toast({
        title: 'Status atualizado',
        description: 'Os status foram sincronizados com o Asaas.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao atualizar status',
        description:
          error instanceof Error ? error.message : 'Não foi possível atualizar o status da cobrança.',
        variant: 'destructive',
      });
    },
  });

  const receiveAsaasChargeInCashMutation = useMutation({
    mutationFn: (variables: { flowId: number; payload: ReceiveAsaasChargeInCashPayload }) => {
      return receiveAsaasChargeInCash(variables.flowId, variables.payload);
    },
    onSuccess: (data, variables) => {
      handleChargeSaved(variables.flowId, data.charge);
      handleStatusUpdated(variables.flowId, [
        { status: data.charge.status ?? 'RECEIVED_IN_CASH', updatedAt: new Date().toISOString() },
        ...(chargeStatusHistory[variables.flowId] ?? []),
      ]);
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      toast({
        title: 'Lançamento atualizado',
        description: 'O recebimento em dinheiro foi registrado no Asaas.',
      });
      handleCloseSettleDialog();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao registrar recebimento',
        description:
          error instanceof Error ? error.message : 'Não foi possível comunicar com o Asaas.',
        variant: 'destructive',
      });
    },
  });

  const handleOpenSettleDialog = (flow: FlowWithDetails) => {
    if (!flow.canManuallySettle) {
      toast({
        title: 'Ação indisponível',
        description: 'Somente lançamentos cadastrados no Quantum JUD podem ser marcados manualmente como pagos.',
        variant: 'destructive',
      });
      return;
    }

    setSettleDialogFlow(flow);
    setNotifySettleCustomer(false);

    const normalizedPaymentDate = normalizeDateInputValue(flow.pagamento ?? undefined);
    if (normalizedPaymentDate) {
      setSettleDate(normalizedPaymentDate);
      return;
    }

    const normalizedDueDate = normalizeDateInputValue(flow.vencimento);
    setSettleDate(normalizedDueDate ?? getDefaultPaymentDate());
  };

  const handleResendCharge = useCallback(
    (flow: FlowWithDetails) => {
      const numericFlowId = resolveFlowNumericId(flow.id);
      if (numericFlowId === null) {
        toast({
          title: 'Ação indisponível',
          description: 'Não foi possível identificar o lançamento para reenviar a cobrança.',
          variant: 'destructive',
        });
        return;
      }

      resendChargeMutation.mutate(numericFlowId);
    },
    [resendChargeMutation, resolveFlowNumericId, toast],
  );

  const handleRefreshChargeStatus = useCallback(
    (flow: FlowWithDetails) => {
      const numericFlowId = resolveFlowNumericId(flow.id);
      if (numericFlowId === null) {
        toast({
          title: 'Ação indisponível',
          description: 'Não foi possível identificar o lançamento para atualizar o status.',
          variant: 'destructive',
        });
        return;
      }

      refreshChargeStatusMutation.mutate(numericFlowId);
    },
    [refreshChargeStatusMutation, resolveFlowNumericId, toast],
  );

  const handleCloseSettleDialog = () => {
    if (settleMutation.isPending || receiveAsaasChargeInCashMutation.isPending) {
      return;
    }


    setSettleDialogFlow(null);
    setSettleDate(getDefaultPaymentDate());
    setNotifySettleCustomer(false);
  };

  const handleConfirmSettle = () => {
    if (!settleDialogFlow || !settleDialogFlow.normalizedId || !settleDate || settleMutation.isPending || receiveAsaasChargeInCashMutation.isPending) {
      return;
    }

    const hasAsaasCharge = Boolean(chargeSummaries[settleDialogFlow.id] || chargeSummaries[settleDialogFlow.normalizedId]);

    if (hasAsaasCharge && settleDialogFlow.tipo === 'receita') {
      receiveAsaasChargeInCashMutation.mutate({
        flowId: Number(settleDialogFlow.normalizedId),
        payload: {
          paymentDate: settleDate,
          value: settleDialogFlow.valor,
          notifyCustomer: notifySettleCustomer
        }
      });
      return;
    }

    settleMutation.mutate({ flowId: settleDialogFlow.normalizedId, date: settleDate });

  };

  const statusOrder: DerivedStatus[] = ['pendente', 'vencido', 'pago', 'estornado'];
  const settleDialogDueDate = settleDialogFlow ? parseDateValue(settleDialogFlow.vencimento) : null;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-2 h-5 w-80" />
        </div>
        <Card className="p-4 sm:p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 sm:p-6 text-destructive">
          <AlertCircle className="h-6 w-6" />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Não foi possível carregar os lançamentos financeiros</h1>
            <p className="text-sm text-destructive/80">
              {(error as Error)?.message || 'Ocorreu um erro inesperado ao comunicar com o servidor.'}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Lançamentos Financeiros</h1>
        <p className="mt-2 text-muted-foreground">
          Visualize todas as cobranças emitidas para os clientes, acompanhe a situação de pagamento e mantenha o controle do
          fluxo de caixa da empresa.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Card className="p-4 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Receitas</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(globalTotals.receitas)}</p>
          </div>
          <ArrowUpCircle className="h-5 w-5 text-emerald-600" />
        </Card>
        <Card className="p-4 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Despesas</p>
            <p className="text-2xl font-bold text-rose-600">{formatCurrency(globalTotals.despesas)}</p>
          </div>
          <ArrowDownCircle className="h-5 w-5 text-rose-600" />
        </Card>
        <Card className="p-4 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Pendentes</p>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(globalTotals.status.pendente.value)}</p>
            <p className="text-xs text-muted-foreground">{globalTotals.status.pendente.count} lançamento(s)</p>
          </div>
          <Clock className="h-5 w-5 text-amber-600" />
        </Card>
        <Card className="p-4 flex flex-row items-center justify-between border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
          <div className="space-y-1">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">Vencidos</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(globalTotals.status.vencido.value)}</p>
            <p className="text-xs text-red-500">{globalTotals.status.vencido.count} lançamento(s)</p>
          </div>
          <AlertCircle className="h-5 w-5 text-red-600" />
        </Card>
        <Card className="p-4 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Pagos</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(globalTotals.status.pago.value)}</p>
            <p className="text-xs text-muted-foreground">{globalTotals.status.pago.count} lançamento(s)</p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        </Card>
        <Card className="p-4 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Estornados</p>
            <p className="text-2xl font-bold text-gray-600">{formatCurrency(globalTotals.status.estornado.value)}</p>
            <p className="text-xs text-muted-foreground">{globalTotals.status.estornado.count} lançamento(s)</p>
          </div>
          <RotateCcw className="h-5 w-5 text-gray-600" />
        </Card>
      </div>



      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            setForm(INITIAL_FORM_STATE);
            setIsCustomerPopoverOpen(false);
            setIsSupplierPopoverOpen(false);
          }
        }}
      >
        <Collapsible open={isChartOpen} onOpenChange={setIsChartOpen}>
          <Card className="space-y-6 p-4 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Resumo mensal do ano selecionado</h2>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                      <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isChartOpen ? "rotate-180" : "")} />
                      <span className="sr-only">Alternar gráfico</span>
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <p className="text-sm text-muted-foreground">
                  Compare receitas, despesas e cobranças em aberto.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {isSyncing ? 'Sincronizando...' : 'Sincronizar Asaas'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsChartOpen(!isChartOpen)}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  {isChartOpen ? "Ocultar Gráfico" : "Visualizar Gráfico"}
                </Button>
                <DialogTrigger asChild>
                  <Button type="button">Nova movimentação</Button>
                </DialogTrigger>
              </div>
            </div>
            <CollapsibleContent>
              <div className="h-[320px] w-full pt-4">
                {chartData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <AreaChart
                      accessibilityLayer
                      data={chartData}
                      margin={{
                        left: 12,
                        right: 12,
                      }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => value.slice(0, 3)}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent indicator="dot" />}
                      />
                      <defs>
                        <linearGradient id="fillReceitas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-receitas)" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="var(--color-receitas)" stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id="fillDespesas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-despesas)" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="var(--color-despesas)" stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id="fillAberto" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-aberto)" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="var(--color-aberto)" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <Area
                        dataKey="aberto"
                        type="natural"
                        fill="url(#fillAberto)"
                        fillOpacity={0.4}
                        stroke="var(--color-aberto)"
                        stackId="a"
                      />
                      <Area
                        dataKey="despesas"
                        type="natural"
                        fill="url(#fillDespesas)"
                        fillOpacity={0.4}
                        stroke="var(--color-despesas)"
                        stackId="a"
                      />
                      <Area
                        dataKey="receitas"
                        type="natural"
                        fill="url(#fillReceitas)"
                        fillOpacity={0.4}
                        stroke="var(--color-receitas)"
                        stackId="a"
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                    </AreaChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border/60 text-sm text-muted-foreground">
                    Nenhum lançamento com vencimento no ano selecionado.
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo lançamento financeiro</DialogTitle>
            <DialogDescription>
              Cadastre uma nova receita ou despesa para controlar o fluxo de caixa.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!isFormValid || createMutation.isPending) {
                return;
              }
              createMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="flow-type">Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(value) => {
                  const nextType = value as Flow['tipo'];
                  setForm((prev) => ({
                    ...prev,
                    tipo: nextType,
                    clienteId: nextType === 'receita' ? prev.clienteId : '',
                    fornecedorId: nextType === 'despesa' ? prev.fornecedorId : '',
                  }));
                  setIsCustomerPopoverOpen(false);
                  setIsSupplierPopoverOpen(false);
                }}
              >
                <SelectTrigger id="flow-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.tipo === 'receita' ? (
              <div className="space-y-2">
                <Label htmlFor="flow-customer">Cliente (opcional)</Label>
                <Popover open={isCustomerPopoverOpen} onOpenChange={setIsCustomerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="flow-customer"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isCustomerPopoverOpen}
                      className="w-full justify-between"
                    >
                      {customersLoading
                        ? 'Carregando clientes...'
                        : selectedCustomer
                          ? selectedCustomer.label
                          : 'Selecione um cliente (opcional)'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." />
                      <CommandList>
                        {customersLoading ? (
                          <div className="p-2 text-sm text-muted-foreground">Carregando clientes...</div>
                        ) : customersError instanceof Error ? (
                          <div className="p-2 text-sm text-destructive">Não foi possível carregar os clientes.</div>
                        ) : (
                          <>
                            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="__none"
                                onSelect={() => {
                                  setForm((prev) => ({ ...prev, clienteId: '' }));
                                  setIsCustomerPopoverOpen(false);
                                }}
                              >
                                <span>Sem cliente</span>
                                <Check className={cn('ml-auto h-4 w-4', form.clienteId === '' ? 'opacity-100' : 'opacity-0')} />
                              </CommandItem>
                              {customers.map((customer) => {
                                const details = buildOptionDetails(customer);
                                const isSelected = form.clienteId === customer.id;
                                const searchableText = [
                                  customer.label,
                                  customer.document,
                                  customer.email,
                                ]
                                  .filter(Boolean)
                                  .join(' ');
                                return (
                                  <CommandItem
                                    key={customer.id}
                                    value={searchableText}
                                    onSelect={() => {
                                      setForm((prev) => ({ ...prev, clienteId: customer.id }));
                                      setIsCustomerPopoverOpen(false);
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium leading-snug">{customer.label}</span>
                                      {details ? (
                                        <span className="text-xs text-muted-foreground">{details}</span>
                                      ) : null}
                                    </div>
                                    <Check className={cn('ml-auto h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="flow-supplier">Fornecedor (opcional)</Label>
                <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="flow-supplier"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isSupplierPopoverOpen}
                      className="w-full justify-between"
                    >
                      {suppliersLoading
                        ? 'Carregando fornecedores...'
                        : selectedSupplier
                          ? selectedSupplier.label
                          : 'Selecione um fornecedor (opcional)'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar fornecedor..." />
                      <CommandList>
                        {suppliersLoading ? (
                          <div className="p-2 text-sm text-muted-foreground">Carregando fornecedores...</div>
                        ) : suppliersError instanceof Error ? (
                          <div className="p-2 text-sm text-destructive">Não foi possível carregar os fornecedores.</div>
                        ) : (
                          <>
                            <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="__none"
                                onSelect={() => {
                                  setForm((prev) => ({ ...prev, fornecedorId: '' }));
                                  setIsSupplierPopoverOpen(false);
                                }}
                              >
                                <span>Sem fornecedor</span>
                                <Check className={cn('ml-auto h-4 w-4', form.fornecedorId === '' ? 'opacity-100' : 'opacity-0')} />
                              </CommandItem>
                              {suppliers.map((supplier) => {
                                const details = buildOptionDetails(supplier);
                                const isSelected = form.fornecedorId === supplier.id;
                                const searchableText = [
                                  supplier.label,
                                  supplier.document,
                                  supplier.email,
                                  supplier.phone,
                                ]
                                  .filter(Boolean)
                                  .join(' ');
                                return (
                                  <CommandItem
                                    key={supplier.id}
                                    value={searchableText}
                                    onSelect={() => {
                                      setForm((prev) => ({ ...prev, fornecedorId: supplier.id }));
                                      setIsSupplierPopoverOpen(false);
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium leading-snug">{supplier.label}</span>
                                      {details ? (
                                        <span className="text-xs text-muted-foreground">{details}</span>
                                      ) : null}
                                    </div>
                                    <Check className={cn('ml-auto h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="flow-description">Descrição</Label>
              <Input
                id="flow-description"
                value={form.descricao}
                onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))}
                placeholder="Ex.: Mensalidade do cliente ACME"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flow-value">Valor</Label>
              <Input
                id="flow-value"
                type="text"
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={formatCurrencyInputValue(form.valor)}
                onChange={(event) => {
                  const digits = extractCurrencyDigits(event.target.value);
                  setForm((prev) => ({ ...prev, valor: digits }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flow-due-date">Vencimento</Label>
              <Input
                id="flow-due-date"
                type="date"
                value={form.vencimento}
                onChange={(event) => setForm((prev) => ({ ...prev, vencimento: event.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!isFormValid || createMutation.isPending}>
                {createMutation.isPending ? 'Salvando...' : 'Salvar lançamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-1 items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, cliente ou fornecedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs border-0 bg-transparent shadow-none focus-visible:ring-0 pl-1"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | DerivedStatus)}>
            <SelectTrigger className="w-[160px] h-8">
              <div className="flex items-center gap-2">
                <ListFilter className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Situação" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as situações</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="vencido">Vencidos</SelectItem>
              <SelectItem value="pago">Pagos</SelectItem>
              <SelectItem value="estornado">Estornados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as 'all' | Flow['tipo'])}>
            <SelectTrigger className="w-[150px] h-8">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="receita">Receitas</SelectItem>
              <SelectItem value="despesa">Despesas</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center space-x-2 border-l pl-3 ml-1">
            <Checkbox
              id="only-open"
              checked={onlyOpenCharges}
              onCheckedChange={(checked) => setOnlyOpenCharges(Boolean(checked))}
            />
            <label
              htmlFor="only-open"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Em aberto
            </label>
          </div>
        </div>
      </div>

      {periods.length > 0 ? (
        <div className="space-y-4">
          {availableYears.length > 0 ? (
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Relatórios mensais</h2>
                <p className="text-sm text-muted-foreground">
                  Navegue entre os anos e selecione um mês para analisar os lançamentos do período.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleGoToPreviousYear}
                  disabled={!hasPreviousYear}
                  aria-label="Ano anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Select
                  value={activeYear !== null ? String(activeYear) : ''}
                  onValueChange={(value) => {
                    const parsedYear = Number.parseInt(value, 10);
                    if (Number.isFinite(parsedYear)) {
                      setActiveYear(parsedYear);
                    }
                  }}
                >
                  <SelectTrigger className="w-[140px]" aria-label="Selecionar ano">
                    <SelectValue placeholder="Selecionar ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleGoToNextYear}
                  disabled={!hasNextYear}
                  aria-label="Próximo ano"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          <Tabs value={safePeriodKey ?? ''} onValueChange={setActivePeriodKey} className="w-full">
            <TabsList className="w-full flex flex-wrap gap-2">
              {visiblePeriods.map((period) => (
                <TabsTrigger key={period.key} value={period.key} className="data-[state=active]:bg-primary/10">
                  <span className="flex items-center gap-2">
                    {period.label}
                    <Badge variant="outline">{period.flows.length}</Badge>
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            {visiblePeriods.map((period) => (
              <TabsContent key={period.key} value={period.key} className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center p-4 border rounded-lg bg-card shadow-sm mb-4">
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-muted-foreground">Receitas:</span>
                      <span className="font-semibold text-emerald-600">{formatCurrency(period.totals.receitas)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-rose-500" />
                      <span className="text-muted-foreground">Despesas:</span>
                      <span className="font-semibold text-rose-600">{formatCurrency(period.totals.despesas)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Saldo:</span>
                    <span className={cn("text-lg font-bold", period.totals.saldo >= 0 ? "text-primary" : "text-destructive")}>
                      {formatCurrency(period.totals.saldo)}
                    </span>
                  </div>
                </div>

                <div className="rounded-md border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted hover:bg-muted">
                        <TableHead className="w-[100px]">Vencimento</TableHead>
                        <TableHead className="w-[120px]">Origem</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Participante</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="w-[100px]">Tipo</TableHead>
                        <TableHead className="w-[100px]">Pagamento</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {period.flows.map((flow) => (
                        <TableRow key={flow.id}>
                          <TableCell className="font-medium">
                            {formatDayDate(flow.dueDate, flow.vencimento)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {flow.isPlanCharge ? <Badge variant="secondary">Plano</Badge> : <span className="text-muted-foreground text-xs">Manual</span>}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{flow.descricao}</span>
                          </TableCell>
                          <TableCell>
                            {flow.cliente_id ? (
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                  {customers.find(c => c.id === flow.cliente_id)?.label || 'Cliente não encontrado'}
                                </span>
                                <span className="text-xs text-muted-foreground">Cliente</span>
                              </div>
                            ) : flow.fornecedor_id ? (
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                  {suppliers.find(s => s.id === flow.fornecedor_id)?.label || 'Fornecedor não encontrado'}
                                </span>
                                <span className="text-xs text-muted-foreground">Fornecedor</span>
                              </div>
                            ) : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(flow.valor)}
                          </TableCell>
                          <TableCell className="capitalize text-muted-foreground">{flow.tipo}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDayDate(flow.pagamentoDate, flow.pagamento ?? undefined)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn('text-xs font-semibold', statusBadgeClasses[flow.computedStatus])}
                            >
                              {statusSingleLabels[flow.computedStatus]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Abrir menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Ações</DropdownMenuLabel>

                                {flow.computedStatus !== 'pago' && flow.computedStatus !== 'estornado' && (
                                  <DropdownMenuItem onClick={() => handleOpenSettleDialog(flow)} disabled={!flow.canManuallySettle || settleMutation.isPending}>
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    <span>Marcar como pago</span>
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuItem onClick={() => setChargeDialogFlow(flow)}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  <span>{chargeSummaries[flow.id] ? 'Gerenciar cobrança' : 'Gerar cobrança'}</span>
                                </DropdownMenuItem>

                                {chargeSummaries[flow.id] && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleResendCharge(flow)}>
                                      <Send className="mr-2 h-4 w-4" />
                                      <span>Reenviar cobrança</span>
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuItem onClick={() => {
                                  const numericId = resolveFlowNumericId(flow.id);
                                  if (numericId) refreshStatusMutation.mutate(numericId);
                                }}>
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  <span>Atualizar status Asaas</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      ) : (
        <Card className="p-4 sm:p-6 text-center text-muted-foreground">
          {hasAnyEligibleFlow
            ? 'Nenhum lançamento atende aos filtros selecionados. Ajuste os filtros para visualizar outras cobranças.'
            : hasAnyRawFlow
              ? 'Nenhum lançamento elegível para exibição. Apenas lançamentos vinculados a clientes ou fornecedores são exibidos.'
              : 'Nenhum lançamento financeiro cadastrado até o momento.'}
        </Card>
      )}

      <Dialog
        open={Boolean(settleDialogFlow)}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseSettleDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como pago</DialogTitle>
            <DialogDescription>
              Informe a data em que o lançamento foi pago para manter o histórico atualizado.
            </DialogDescription>
          </DialogHeader>
          {settleDialogFlow ? (
            <div className="space-y-4">
              <div className="rounded-md border border-border/50 bg-muted/40 p-3 text-sm">
                <p className="font-medium leading-snug">{settleDialogFlow.descricao}</p>
                <p className="text-muted-foreground">
                  {formatCurrency(settleDialogFlow.valor)}
                  {settleDialogDueDate
                    ? ` • vencimento ${formatDayDate(settleDialogDueDate, settleDialogFlow.vencimento ?? undefined)}`
                    : null}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="settle-date">Data do pagamento</Label>
                <Input
                  id="settle-date"
                  type="date"
                  value={settleDate}
                  onChange={(event) => setSettleDate(event.target.value)}
                  disabled={settleMutation.isPending || receiveAsaasChargeInCashMutation.isPending}
                />
              </div>

              {Boolean(chargeSummaries[Number(settleDialogFlow.id)] || chargeSummaries[Number(settleDialogFlow.normalizedId)]) && settleDialogFlow.tipo === 'receita' && (
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox id="notify-settle" checked={notifySettleCustomer} onCheckedChange={(c) => setNotifySettleCustomer(Boolean(c))} disabled={receiveAsaasChargeInCashMutation.isPending} />
                  <Label htmlFor="notify-settle">Notificar cliente pelo Asaas</Label>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseSettleDialog}
              disabled={settleMutation.isPending || receiveAsaasChargeInCashMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSettle}
              disabled={!settleDate || settleMutation.isPending || receiveAsaasChargeInCashMutation.isPending}
            >
              {settleMutation.isPending || receiveAsaasChargeInCashMutation.isPending ? 'Salvando...' : 'Confirmar pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AsaasChargeDialog
        flow={chargeDialogFlow}
        open={Boolean(chargeDialogFlow)}
        onOpenChange={(open) => {
          if (!open) {
            setChargeDialogFlow(null);
          }
        }}
        customers={customers}
        customersLoading={customersLoading}
        onChargeCreated={handleChargeSaved}
        onStatusUpdated={handleStatusUpdated}
        persistedCharge={chargeDialogFlow ? chargeSummaries[chargeDialogFlow.id] ?? null : null}
        persistedStatuses={chargeDialogFlow ? chargeStatusHistory[chargeDialogFlow.id] ?? [] : []}
      />
    </div >
  );
};

export default FinancialFlows;
