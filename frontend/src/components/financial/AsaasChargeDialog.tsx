import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isValid, isBefore, startOfDay } from 'date-fns';
import {
  AsaasCharge,
  AsaasChargeStatus,
  AsaasPaymentMethod,
  CreateAsaasChargePayload,
  CardTokenPayload,
  CardTokenResponse,
  Flow,
  createAsaasCharge,
  fetchChargeDetails,
  listChargeStatus,
  tokenizeCard,
  CustomerSyncStatus,
  fetchCustomerSyncStatus,
  syncCustomerNow,
  refundAsaasCharge,
  resendAsaasCharge,
  refreshAsaasChargeStatus,
  normalizeFlowId,
} from '@/lib/flows';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Loader2, RefreshCcw, Clipboard, Send, CreditCard, QrCode, Undo2, CheckCircle2, Barcode } from 'lucide-react';

export type CustomerOption = {
  id: string;
  label: string;
  email?: string;
  document?: string;
  raw: unknown;
};

type CardTokenDetails = {
  token: string;
  brand?: string;
  last4Digits?: string;
  holderName: string;
  holderEmail: string;
  document: string;
  phone: string;
  postalCode: string;
  addressNumber: string;
  addressComplement?: string;
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

const DEFAULT_INSTALLMENT_OPTIONS = [1, 2, 3, 6, 12];
const DIGIT_ONLY_REGEX = /\D+/g;
const FLOW_INTEGER_ID_REGEX = /^[0-9]+$/;
const REFUNDABLE_CHARGE_STATUSES = new Set([
  'RECEIVED',
  'RECEIVED_IN_CASH',
  'RECEIVED_PARTIALLY',
  'CONFIRMED',
]);

const STATUS_TRANSLATIONS: Record<string, string> = {
  PENDING: 'Pendente',
  RECEIVED: 'Recebido',
  CONFIRMED: 'Confirmado',
  OVERDUE: 'Vencido',
  REFUNDED: 'Estornado',
  RECEIVED_IN_CASH: 'Recebido em Dinheiro',
  REFUND_REQUESTED: 'Estorno Solicitado',
  CHARGEBACK_REQUESTED: 'Chargeback Solicitado',
  CHARGEBACK_DISPUTE: 'Em Disputa de Chargeback',
  AWAITING_CHARGEBACK_REVERSAL: 'Aguardando Reversão',
  DUNNING_REQUESTED: 'Cobrança Solicitada',
  DUNNING_RECEIVED: 'Recuperado via Cobrança',
  AWAITING_RISK_ANALYSIS: 'Em Análise de Risco',
};

function translateStatus(status: string): string {
  return STATUS_TRANSLATIONS[status] ?? status;
}

function sanitizeDigits(value: string): string {
  return value.replace(DIGIT_ONLY_REGEX, '');
}

function isCardPayment(method: AsaasPaymentMethod): boolean {
  return method === 'CREDIT_CARD' || method === 'DEBIT_CARD';
}

function validateCardForm(form: CardFormState): CardFormErrors {
  const errors: CardFormErrors = {};

  if (!form.holderName.trim()) {
    errors.holderName = 'Informe o nome impresso no cartão.';
  }

  if (!form.holderEmail.trim() || !form.holderEmail.includes('@')) {
    errors.holderEmail = 'Informe um e-mail válido.';
  }

  const documentDigits = sanitizeDigits(form.document);
  if (documentDigits.length < 11) {
    errors.document = 'Informe um CPF/CNPJ válido.';
  }

  const cardDigits = sanitizeDigits(form.number);
  if (cardDigits.length < 13) {
    errors.number = 'Número do cartão inválido.';
  }

  if (!form.expiryMonth || Number(form.expiryMonth) < 1 || Number(form.expiryMonth) > 12) {
    errors.expiryMonth = 'Mês inválido.';
  }

  if (!form.expiryYear || form.expiryYear.length < 2) {
    errors.expiryYear = 'Ano inválido.';
  }

  const cvvDigits = sanitizeDigits(form.cvv);
  if (cvvDigits.length < 3 || cvvDigits.length > 4) {
    errors.cvv = 'Código de segurança inválido.';
  }

  const phoneDigits = sanitizeDigits(form.phone);
  if (phoneDigits.length < 8) {
    errors.phone = 'Informe um telefone válido.';
  }

  const postalCodeDigits = sanitizeDigits(form.postalCode);
  if (postalCodeDigits.length < 8) {
    errors.postalCode = 'Informe um CEP válido.';
  }

  if (!form.addressNumber.trim()) {
    errors.addressNumber = 'Informe o número do endereço.';
  }

  return errors;
}

function resolveSyncStatusInfo(status?: string | null): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (!status) {
    return { label: 'Nunca sincronizado', variant: 'outline' };
  }

  const normalized = status.toLowerCase();

  if (normalized.includes('error') || normalized.includes('erro') || normalized.includes('fail')) {
    return { label: 'Com erro', variant: 'destructive' };
  }

  if (normalized.includes('pending') || normalized.includes('aguard') || normalized.includes('processing')) {
    return { label: 'Pendente', variant: 'outline' };
  }

  if (normalized.includes('sync') || normalized.includes('atualiz') || normalized.includes('ok')) {
    return { label: 'Sincronizado', variant: 'secondary' };
  }

  return { label: status, variant: 'default' };
}

type AsaasChargeDialogProps = {
  flow: Flow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: CustomerOption[];
  customersLoading: boolean;
  onChargeCreated: (flowId: number, charge: AsaasCharge) => void;
  onStatusUpdated: (flowId: number, statuses: AsaasChargeStatus[]) => void;
  persistedCharge?: AsaasCharge | null;
  persistedStatuses?: AsaasChargeStatus[];
};

type CardModalState = {
  flow: Flow;
  payload: CreateAsaasChargePayload;
};

export const AsaasChargeDialog = ({
  flow,
  open,
  onOpenChange,
  customers,
  customersLoading,
  onChargeCreated,
  onStatusUpdated,
  persistedCharge = null,
  persistedStatuses = [],
}: AsaasChargeDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    [],
  );
  const formatCurrency = useCallback(
    (value: number | string | null | undefined) =>
      currencyFormatter.format(Number.parseFloat(value ? value.toString() : '0') || 0),
    [currencyFormatter],
  );
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<AsaasPaymentMethod>('PIX');
  const [installments, setInstallments] = useState<number>(1);
  const [dueDate, setDueDate] = useState('');
  const [lastCharge, setLastCharge] = useState<AsaasCharge | null>(persistedCharge ?? null);
  const [statuses, setStatuses] = useState<AsaasChargeStatus[]>(persistedStatuses ?? []);
  const [cardModalState, setCardModalState] = useState<CardModalState | null>(null);
  const [lastCardDetails, setLastCardDetails] = useState<CardTokenDetails | null>(null);
  const resolveFlowId = useCallback((): string | number | null => {
    if (!flow) {
      return null;
    }

    if (typeof flow.id === 'number') {
      return flow.id;
    }

    const normalizedId = normalizeFlowId(flow.id);
    return normalizedId;
  }, [flow]);
  const normalizedChargeStatus = useMemo(() => {
    if (!lastCharge?.status) {
      return '';
    }
    return lastCharge.status.toString().trim().toUpperCase();
  }, [lastCharge?.status]);
  const isChargeRefunded = normalizedChargeStatus === 'REFUNDED';
  const canRefundCharge = Boolean(normalizedChargeStatus && REFUNDABLE_CHARGE_STATUSES.has(normalizedChargeStatus));
  const refundDisabledReason = useMemo(() => {
    if (!flow) {
      return 'Selecione um lançamento para solicitar estorno.';
    }
    if (!lastCharge) {
      return 'Gere uma cobrança antes de solicitar estorno.';
    }
    if (isChargeRefunded) {
      return 'A cobrança já foi estornada no Asaas.';
    }
    if (!canRefundCharge) {
      return 'O Asaas precisa confirmar o pagamento antes de liberar o estorno.';
    }
    return null;
  }, [flow, lastCharge, isChargeRefunded, canRefundCharge]);

  useEffect(() => {
    if (open) {
      setLastCharge(persistedCharge ?? null);
      setStatuses(persistedStatuses ?? []);
      if (flow?.cliente_id) {
        setCustomerId(String(flow.cliente_id));
      }
    }
  }, [open, persistedCharge, persistedStatuses, flow]);

  useEffect(() => {
    if (!open) {
      // Re-evaluate customerId on close/re-open or rely on the open effect
      setPaymentMethod('PIX');
      setInstallments(1);
      setDueDate('');
      setCardModalState(null);
      setLastCardDetails(null);
    }
  }, [open]);

  useEffect(() => {
    if (paymentMethod === 'PIX' || paymentMethod === 'DEBIT_CARD') {
      setInstallments(1);
    }
  }, [paymentMethod]);

  // Verifica se a data de vencimento está no passado (vencida)
  const isOverdue = useMemo(() => {
    if (!flow?.vencimento) {
      return false;
    }
    try {
      const vencimentoDate = parseISO(flow.vencimento);
      if (!isValid(vencimentoDate)) {
        return false;
      }
      return isBefore(startOfDay(vencimentoDate), startOfDay(new Date()));
    } catch {
      return false;
    }
  }, [flow?.vencimento]);

  // Inicializa dueDate com a data de hoje quando o vencimento está no passado
  useEffect(() => {
    if (open && isOverdue && !dueDate) {
      setDueDate(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [open, isOverdue, dueDate]);

  useEffect(() => {
    // Só limpa o dueDate se não estiver vencido e não for boleto
    if (paymentMethod !== 'BOLETO' && !isOverdue) {
      setDueDate('');
    }
  }, [paymentMethod, isOverdue]);

  useEffect(() => {
    if (!isCardPayment(paymentMethod)) {
      setLastCardDetails(null);
    }
  }, [paymentMethod]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId),
    [customers, customerId],
  );

  const formatStatusDate = useCallback((value?: string) => {
    if (!value) {
      return null;
    }
    try {
      const parsed = parseISO(value);
      if (!isValid(parsed)) {
        return value;
      }
      return format(parsed, 'dd/MM/yyyy HH:mm');
    } catch (error) {
      return value;
    }
  }, []);

  const formatShortDate = useCallback((value?: string | null) => {
    if (!value) {
      return null;
    }
    try {
      const parsed = parseISO(value);
      if (!isValid(parsed)) {
        return value;
      }
      return format(parsed, 'dd/MM/yyyy');
    } catch (error) {
      return value;
    }
  }, []);

  const resolvedFlowId = useMemo(() => resolveFlowId(), [resolveFlowId]);

  const chargeDetailsQuery = useQuery({
    queryKey: ['asaas-charge-details', flow?.id],
    queryFn: () => (resolvedFlowId !== null ? fetchChargeDetails(resolvedFlowId) : Promise.resolve(null)),
    enabled: Boolean(resolvedFlowId !== null && open),
  });

  useEffect(() => {
    if (chargeDetailsQuery.data && flow) {
      setLastCharge(chargeDetailsQuery.data);
      if (typeof flow.id === 'number') {
        onChargeCreated(flow.id, chargeDetailsQuery.data);
      } else {
        const parsed = Number(flow.id);
        if (!isNaN(parsed)) onChargeCreated(parsed, chargeDetailsQuery.data);
      }
    }
  }, [chargeDetailsQuery.data, flow, onChargeCreated]);

  useEffect(() => {
    if (chargeDetailsQuery.error) {
      toast({
        title: 'Erro ao carregar cobrança',
        description:
          chargeDetailsQuery.error instanceof Error ? chargeDetailsQuery.error.message : 'Não foi possível carregar os dados da cobrança.',
        variant: 'destructive',
      });
    }
  }, [chargeDetailsQuery.error, toast]);

  const statusQuery = useQuery({
    queryKey: ['asaas-charge-status', flow?.id],
    queryFn: () => (resolvedFlowId !== null ? listChargeStatus(resolvedFlowId) : Promise.resolve([])),
    enabled: Boolean(resolvedFlowId !== null && open),
  });

  useEffect(() => {
    if (statusQuery.data && flow) {
      setStatuses(statusQuery.data);
      if (typeof flow.id === 'number') {
        onStatusUpdated(flow.id, statusQuery.data);
      } else {
        const parsed = Number(flow.id);
        if (!isNaN(parsed)) onStatusUpdated(parsed, statusQuery.data);
      }
    }
  }, [statusQuery.data, flow, onStatusUpdated]);

  useEffect(() => {
    if (statusQuery.error) {
      toast({
        title: 'Erro ao carregar status',
        description:
          statusQuery.error instanceof Error ? statusQuery.error.message : 'Não foi possível carregar o status da cobrança.',
        variant: 'destructive',
      });
    }
  }, [statusQuery.error, toast]);

  const resendChargeMutation = useMutation({
    mutationFn: async () => {
      if (resolvedFlowId === null) {
        throw new Error('Identificador do lançamento inválido para reenviar a cobrança.');
      }
      return resendAsaasCharge(resolvedFlowId);
    },
    onSuccess: (charge) => {
      if (!flow) {
        return;
      }
      if (charge) {
        setLastCharge(charge);
        if (typeof flow.id === 'number') {
          onChargeCreated(flow.id, charge);
        } else {
          const parsed = Number(flow.id);
          if (!isNaN(parsed)) onChargeCreated(parsed, charge);
        }
      }
      toast({
        title: 'Cobrança reenviada',
        description: 'Uma nova notificação foi enviada ao cliente.',
      });
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      chargeDetailsQuery.refetch();
      statusQuery.refetch();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao reenviar cobrança',
        description: error instanceof Error ? error.message : 'Não foi possível reenviar a cobrança.',
        variant: 'destructive',
      });
    },
  });

  const refreshStatusMutation = useMutation({
    mutationFn: async () => {
      if (resolvedFlowId === null) {
        throw new Error('Identificador do lançamento inválido para atualizar o status.');
      }
      return refreshAsaasChargeStatus(resolvedFlowId);
    },
    onSuccess: (result) => {
      if (!flow) {
        return;
      }
      if (result.charge) {
        setLastCharge(result.charge);
        if (typeof flow.id === 'number') {
          onChargeCreated(flow.id, result.charge);
        } else {
          const parsed = Number(flow.id);
          if (!isNaN(parsed)) onChargeCreated(parsed, result.charge);
        }
      }
      setStatuses(result.statuses);
      if (typeof flow.id === 'number') {
        onStatusUpdated(flow.id, result.statuses);
      } else {
        const parsed = Number(flow.id);
        if (!isNaN(parsed)) onStatusUpdated(parsed, result.statuses);
      }
      toast({
        title: 'Status atualizado',
        description: 'Os status foram sincronizados com o Asaas.',
      });
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      chargeDetailsQuery.refetch();
      statusQuery.refetch();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao atualizar status',
        description: error instanceof Error ? error.message : 'Não foi possível atualizar o status da cobrança.',
        variant: 'destructive',
      });
    },
  });

  const {
    data: customerSyncStatus,
    refetch: refetchCustomerSyncStatus,
    isFetching: isFetchingCustomerSyncStatus,
    error: customerSyncError,
  } = useQuery<CustomerSyncStatus | null>({
    queryKey: ['asaas-customer-status', customerId],
    queryFn: () => (customerId && open ? fetchCustomerSyncStatus(customerId) : Promise.resolve(null)),
    enabled: Boolean(customerId && open),
    staleTime: 1000 * 30,
  });

  useEffect(() => {
    if (customerSyncError) {
      toast({
        title: 'Erro ao carregar status do cliente',
        description:
          customerSyncError instanceof Error ? customerSyncError.message : 'Não foi possível verificar o status do cliente.',
        variant: 'destructive',
      });
    }
  }, [customerSyncError, toast]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!customerId) {
        throw new Error('Selecione um cliente para sincronizar.');
      }
      return syncCustomerNow(customerId);
    },
    onSuccess: () => {
      toast({
        title: 'Sincronização iniciada',
        description: 'A sincronização com o Asaas foi solicitada.',
      });
      refetchCustomerSyncStatus();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao sincronizar cliente',
        description: error instanceof Error ? error.message : 'Não foi possível iniciar a sincronização.',
        variant: 'destructive',
      });
    },
  });

  const chargeMutation = useMutation({
    mutationFn: async (payload: CreateAsaasChargePayload) => {
      if (!flow) {
        throw new Error('Fluxo não selecionado.');
      }
      if (resolvedFlowId === null) {
        throw new Error('Identificador do lançamento inválido.');
      }
      return createAsaasCharge(resolvedFlowId, payload);
    },
    onSuccess: (charge) => {
      if (!flow) {
        return;
      }
      setLastCharge(charge);
      if (typeof flow.id === 'number') {
        onChargeCreated(flow.id, charge);
      } else {
        const parsed = Number(flow.id);
        if (!isNaN(parsed)) onChargeCreated(parsed, charge);
      }
      toast({
        title: 'Cobrança criada com sucesso',
        description: 'Os dados foram enviados para o Asaas.',
      });
      statusQuery.refetch();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao criar cobrança',
        description: error instanceof Error ? error.message : 'Não foi possível criar a cobrança.',
        variant: 'destructive',
      });
    },
  });
  const refundMutation = useMutation({
    mutationFn: async () => {
      if (!flow) {
        throw new Error('Fluxo não selecionado.');
      }
      const resolvedId = resolveFlowId();
      if (resolvedId === null) {
        throw new Error('Identificador do fluxo inválido para estorno.');
      }
      return refundAsaasCharge(resolvedId);
    },
    onSuccess: (result) => {
      if (!flow) {
        return;
      }
      setLastCharge(result.charge);
      const resultFlowId = normalizeFlowId(result.flow?.id ?? flow.id);
      if (resultFlowId && FLOW_INTEGER_ID_REGEX.test(resultFlowId)) {
        const parsed = Number.parseInt(resultFlowId, 10);
        if (Number.isFinite(parsed)) {
          onChargeCreated(parsed, result.charge);
        }
      }
      toast({
        title: 'Estorno solicitado',
        description: 'O estorno foi registrado no Asaas.',
      });
      statusQuery.refetch();
      chargeDetailsQuery.refetch();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao solicitar estorno',
        description: error instanceof Error ? error.message : 'Não foi possível solicitar o estorno.',
        variant: 'destructive',
      });
    },
  });



  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!flow) {
      return;
    }

    if (!customerId) {
      toast({
        title: 'Selecione um cliente',
        description: 'É necessário escolher um cliente para gerar a cobrança.',
        variant: 'destructive',
      });
      return;
    }

    // Verifica se o cliente está sincronizado com o Asaas
    const asaasCustomerId = customerSyncStatus?.customerId;
    if (!asaasCustomerId) {
      toast({
        title: 'Cliente não sincronizado',
        description: 'Sincronize o cliente com o Asaas antes de gerar a cobrança.',
        variant: 'destructive',
      });
      return;
    }

    const basePayload: CreateAsaasChargePayload = {
      customerId: asaasCustomerId,
      paymentMethod,
      installmentCount:
        paymentMethod === 'PIX' || paymentMethod === 'DEBIT_CARD' ? undefined : installments,
      dueDate: dueDate || undefined,
    };

    if (isCardPayment(paymentMethod)) {
      setCardModalState({ flow, payload: basePayload });
      return;
    }

    setLastCardDetails(null);
    setLastCardDetails(null);
    try {
      await chargeMutation.mutateAsync(basePayload);
    } catch (error) {
      // Error is already handled by onError callback in mutation, but we catch here to prevent Uncaught Promise Rejection
      console.error("Failed to create charge", error);
    }
  };

  const handleCardTokenized = async (details: CardTokenDetails) => {
    if (!cardModalState) {
      return;
    }

    try {
      await chargeMutation.mutateAsync({
        ...cardModalState.payload,
        cardToken: details.token,
        cardMetadata: {
          brand: details.brand,
          last4Digits: details.last4Digits,
          holderName: details.holderName,
        },
        additionalData: {
          email: details.holderEmail,
          document: details.document,
          phone: details.phone,
          postalCode: details.postalCode,
          addressNumber: details.addressNumber,
          addressComplement: details.addressComplement,
        },
      });
      setLastCardDetails(details);
      setCardModalState(null);
    } catch (error) {
      console.error("Failed to process card charge", error);
    }
  };

  const handleSyncNow = () => {
    if (!customerId) {
      toast({
        title: 'Selecione um cliente',
        description: 'Escolha um cliente para sincronizar com o Asaas.',
        variant: 'destructive',
      });
      return;
    }
    syncMutation.mutate();
  };

  const handleCopy = useCallback(
    async (value: string | undefined) => {
      if (!value) {
        toast({
          title: 'Conteúdo indisponível',
          description: 'O Asaas ainda não retornou os dados necessários.',
          variant: 'destructive',
        });
        return;
      }
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        toast({
          title: 'Copiar não suportado',
          description: 'Seu navegador não permite copiar automaticamente.',
          variant: 'destructive',
        });
        return;
      }

      try {
        await navigator.clipboard.writeText(value);
        toast({
          title: 'Conteúdo copiado',
          description: 'Cole a informação onde desejar.',
        });
      } catch (error) {
        toast({
          title: 'Erro ao copiar',
          description: error instanceof Error ? error.message : 'Não foi possível copiar o conteúdo.',
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

  const handleSendEmail = useCallback(
    (value: string | undefined) => {
      if (!value) {
        toast({
          title: 'Conteúdo indisponível',
          description: 'O Asaas ainda não retornou os dados necessários.',
          variant: 'destructive',
        });
        return;
      }
      if (!selectedCustomer?.email) {
        toast({
          title: 'E-mail não cadastrado',
          description: 'Cadastre um e-mail para o cliente antes de enviar a cobrança.',
          variant: 'destructive',
        });
        return;
      }

      const subject = encodeURIComponent(`Cobrança ${flow?.descricao ?? ''}`);
      const body = encodeURIComponent(
        [
          `Olá ${selectedCustomer.label},`,
          '',
          `Segue o link/código para pagamento do lançamento "${flow?.descricao ?? ''}" no valor de ${formatCurrency(flow?.valor)}.`,
          '',
          value,
          '',
          'Qualquer dúvida estamos à disposição.',
        ].join('\n'),
      );
      window.open(`mailto:${selectedCustomer.email}?subject=${subject}&body=${body}`, '_blank');
      toast({
        title: 'E-mail preparado',
        description: 'Utilize o seu cliente de e-mail para finalizar o envio.',
      });
    },
    [selectedCustomer, flow, toast, formatCurrency],
  );

  const renderCopyActions = (value: string | undefined, copyLabel: string) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => handleCopy(value)}>
        <Clipboard className="h-4 w-4" />
        {copyLabel}
      </Button>
      <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => handleSendEmail(value)}>
        <Send className="h-4 w-4" />
        Enviar por e-mail
      </Button>
    </div>
  );

  const renderChargeDetails = () => {
    if (!lastCharge) {
      return <p className="text-sm text-muted-foreground">Nenhuma cobrança gerada ainda.</p>;
    }

    // Verifica se o pagamento foi confirmado/recebido
    const normalizedStatus = lastCharge.status?.toString().trim().toUpperCase() ?? '';
    const isPaid = ['RECEIVED', 'RECEIVED_IN_CASH', 'CONFIRMED', 'RECEIVED_PARTIALLY'].includes(normalizedStatus);

    if (lastCharge.paymentMethod === 'PIX') {
      // Se o pagamento foi confirmado, mostra mensagem de sucesso em vez do QR Code
      if (isPaid) {
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800">Pagamento Confirmado</p>
                <p className="text-xs text-emerald-600">O pagamento via PIX foi recebido com sucesso.</p>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <QrCode className="h-5 w-5" />
            <div>
              <p className="text-sm font-medium">Pagamento via PIX</p>
              {lastCharge.dueDate ? (
                <p className="text-xs text-muted-foreground">
                  Expira em: {formatShortDate(lastCharge.dueDate)}
                </p>
              ) : null}
            </div>
          </div>
          {lastCharge.pixQrCode ? (
            <div className="flex justify-center">
              <img
                src={
                  lastCharge.pixQrCode.startsWith('data:image')
                    ? lastCharge.pixQrCode
                    : `data:image/png;base64,${lastCharge.pixQrCode}`
                }
                alt="QR Code PIX"
                className="max-h-64"
              />
            </div>
          ) : null}
          {lastCharge.pixPayload ? (
            <div className="space-y-2 rounded-md border px-3 py-2">
              <p className="text-sm font-medium">Código copia e cola</p>
              <p className="break-all text-xs text-muted-foreground">{lastCharge.pixPayload}</p>
              {renderCopyActions(lastCharge.pixPayload, 'Copiar código PIX')}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              O Asaas ainda está gerando o código PIX para este lançamento.
            </p>
          )}
        </div>
      );
    }

    if (lastCharge.paymentMethod === 'BOLETO') {
      return (
        <div className="space-y-3">
          {lastCharge.boletoUrl ? (
            <div className="space-y-1 rounded-md border px-3 py-2">
              <p className="text-sm font-medium">Link do boleto</p>
              <a
                href={lastCharge.boletoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-sm text-primary"
              >
                {lastCharge.boletoUrl}
              </a>
              {renderCopyActions(lastCharge.boletoUrl, 'Copiar link')}
            </div>
          ) : null}
          {lastCharge.boletoBarcode ? (
            <div className="space-y-1 rounded-md border px-3 py-2">
              <p className="text-sm font-medium">Linha digitável</p>
              <p className="break-all text-xs text-muted-foreground">{lastCharge.boletoBarcode}</p>
              {renderCopyActions(lastCharge.boletoBarcode, 'Copiar linha digitável')}
            </div>
          ) : null}
          {!lastCharge.boletoUrl && !lastCharge.boletoBarcode ? (
            <p className="text-sm text-muted-foreground">Aguardando geração do boleto.</p>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-2 rounded-md border px-3 py-2 text-sm">
        <p>
          Status da transação:{' '}
          <span className="font-semibold">{lastCharge.status ?? 'Pendente'}</span>
        </p>
        {lastCharge.cardAuthorizationCode ? (
          <p>
            Código de autorização:{' '}
            <span className="font-mono text-xs">{lastCharge.cardAuthorizationCode}</span>
          </p>
        ) : null}
        {(() => {
          const cardLast4 = lastCharge.cardLast4 ?? lastCardDetails?.last4Digits;
          if (!cardLast4) {
            return null;
          }
          const cardBrand = lastCharge.cardBrand ?? lastCardDetails?.brand;
          return (
            <p>
              Cartão final {cardLast4}
              {cardBrand ? ` (${cardBrand})` : ''}
            </p>
          );
        })()}
      </div>
    );
  };

  const syncStatusInfo = isFetchingCustomerSyncStatus
    ? { label: 'Carregando...', variant: 'outline' as const }
    : resolveSyncStatusInfo(customerSyncStatus?.status);

  const methodLabels: Record<AsaasPaymentMethod, string> = {
    PIX: 'PIX',
    BOLETO: 'Boleto',
    CREDIT_CARD: 'Cartão de crédito',
    DEBIT_CARD: 'Cartão de débito',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto space-y-6">
        <DialogHeader>
          <DialogTitle>Gerar cobrança</DialogTitle>
          <DialogDescription>
            Configure o envio da cobrança para o lançamento financeiro selecionado.
          </DialogDescription>
        </DialogHeader>

        {flow ? (
          <>
            <div className="rounded-md border bg-muted/40 p-4 text-sm">
              <p className="font-medium">{flow.descricao}</p>
              <p className="text-muted-foreground">Valor: {formatCurrency(flow.valor)}</p>
              {flow.vencimento ? (
                <p className="text-muted-foreground">
                  Vencimento: {formatShortDate(flow.vencimento) ?? flow.vencimento}
                </p>
              ) : (
                <p className="text-muted-foreground">Sem vencimento definido.</p>
              )}
            </div>

            {!lastCharge && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="asaas-customer-select">
                      Cliente
                    </label>
                    <select
                      id="asaas-customer-select"
                      value={customerId}
                      onChange={(event) => setCustomerId(event.target.value)}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      disabled={customersLoading}
                    >
                      <option value="">
                        {customersLoading ? 'Carregando clientes...' : 'Selecione um cliente'}
                      </option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.label}
                        </option>
                      ))}
                    </select>
                    {selectedCustomer?.email ? (
                      <p className="text-xs text-muted-foreground">E-mail: {selectedCustomer.email}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Método de pagamento</label>
                    <div className="grid grid-cols-3 gap-3">
                      <div
                        onClick={() => setPaymentMethod('PIX')}
                        className={cn("cursor-pointer border rounded-md p-3 flex flex-col items-center justify-center gap-2 hover:bg-accent hover:text-accent-foreground transition-all", paymentMethod === 'PIX' ? "border-primary bg-primary/10 text-primary ring-1 ring-primary" : "border-muted bg-popover")}
                      >
                        <QrCode className="h-5 w-5" />
                        <span className="text-xs font-semibold">Pix</span>
                      </div>
                      <div
                        onClick={() => setPaymentMethod('BOLETO')}
                        className={cn("cursor-pointer border rounded-md p-3 flex flex-col items-center justify-center gap-2 hover:bg-accent hover:text-accent-foreground transition-all", paymentMethod === 'BOLETO' ? "border-primary bg-primary/10 text-primary ring-1 ring-primary" : "border-muted bg-popover")}
                      >
                        <Barcode className="h-5 w-5" />
                        <span className="text-xs font-semibold">Boleto</span>
                      </div>
                      <div
                        onClick={() => setPaymentMethod('CREDIT_CARD')}
                        className={cn("cursor-pointer border rounded-md p-3 flex flex-col items-center justify-center gap-2 hover:bg-accent hover:text-accent-foreground transition-all", paymentMethod === 'CREDIT_CARD' ? "border-primary bg-primary/10 text-primary ring-1 ring-primary" : "border-muted bg-popover")}
                      >
                        <CreditCard className="h-5 w-5" />
                        <span className="text-xs font-semibold">Cartão</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="asaas-installments">
                        Parcelamento
                      </label>
                      <select
                        id="asaas-installments"
                        value={installments}
                        onChange={(event) => setInstallments(Number(event.target.value))}
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        disabled={paymentMethod === 'PIX' || paymentMethod === 'DEBIT_CARD'}
                      >
                        {DEFAULT_INSTALLMENT_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option === 1 ? 'À vista' : `${option}x`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {(paymentMethod === 'BOLETO' || isOverdue) && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="asaas-boleto-due">
                          {isOverdue ? 'Nova data de vencimento' : 'Vencimento'}
                        </label>
                        <Input
                          id="asaas-boleto-due"
                          type="date"
                          value={dueDate}
                          onChange={(event) => setDueDate(event.target.value)}
                        />
                        {isOverdue && (
                          <p className="text-[10px] text-amber-600">
                            Lançamento vencido. Defina uma nova data.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Status do cliente no Asaas</p>
                      {customerSyncStatus?.lastSyncedAt ? (
                        <p className="text-xs text-muted-foreground">
                          Última sincronização: {formatStatusDate(customerSyncStatus.lastSyncedAt)}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Nenhum histórico de sincronização encontrado.</p>
                      )}
                      {customerSyncStatus?.message ? (
                        <p className="text-xs text-muted-foreground">{customerSyncStatus.message}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={syncStatusInfo.variant}>{syncStatusInfo.label}</Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={handleSyncNow}
                        disabled={!customerId || syncMutation.isPending}
                      >
                        {syncMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCcw className="h-3.5 w-3.5" />
                        )}
                        {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar com o Asaas'}
                      </Button>
                    </div>
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:justify-end">
                  <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={chargeMutation.isPending}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="gap-2" disabled={chargeMutation.isPending || customersLoading}>
                    {paymentMethod === 'CREDIT_CARD' ? (
                      <>
                        <CreditCard className="h-4 w-4" /> Prosseguir para cartão
                      </>
                    ) : chargeMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Gerando...
                      </>
                    ) : (
                      'Gerar cobrança'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            )}

            <div className="space-y-4 rounded-md border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <h4 className="font-semibold">Detalhes da cobrança</h4>
                  <span className="text-xs text-muted-foreground">
                    Método selecionado: {methodLabels[lastCharge?.paymentMethod ?? paymentMethod]}
                  </span>
                </div>
                {lastCharge ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => refreshStatusMutation.mutate()}
                      disabled={refreshStatusMutation.isPending}
                    >
                      {refreshStatusMutation.isPending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando...
                        </>
                      ) : (
                        <>
                          <RefreshCcw className="h-3.5 w-3.5" /> Atualizar status
                        </>
                      )}
                    </Button>
                    {!['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(lastCharge?.status || '') && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => resendChargeMutation.mutate()}
                        disabled={resendChargeMutation.isPending}
                      >
                        {resendChargeMutation.isPending ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reenviando...
                          </>
                        ) : (
                          <>
                            <Send className="h-3.5 w-3.5" /> Reenviar cobrança
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
              {chargeDetailsQuery.isFetching && !lastCharge ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados da cobrança...
                </p>
              ) : (
                renderChargeDetails()
              )}

              {lastCharge ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-3">
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">
                      {isChargeRefunded ? 'Cobrança estornada no Asaas' : 'Solicitar estorno no Asaas'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isChargeRefunded
                        ? 'O Asaas confirmou o estorno desta cobrança e o lançamento será marcado como estornado.'
                        : 'O estorno reverterá o pagamento no Asaas e atualizará o lançamento como estornado no CRM.'}
                    </p>
                  </div>
                  {isChargeRefunded ? (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Undo2 className="h-3.5 w-3.5" /> Estornado
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => refundMutation.mutate()}
                      disabled={!canRefundCharge || refundMutation.isPending}
                      title={refundDisabledReason ?? undefined}
                    >
                      {refundMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Undo2 className="h-3.5 w-3.5" />
                      )}
                      {refundMutation.isPending ? 'Solicitando...' : 'Solicitar estorno'}
                    </Button>
                  )}
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Histórico de status</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="gap-2"
                    onClick={() => statusQuery.refetch()}
                    disabled={statusQuery.isFetching}
                  >
                    {statusQuery.isFetching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-3.5 w-3.5" />
                    )}
                    {statusQuery.isFetching ? 'Atualizando...' : 'Atualizar'}
                  </Button>
                </div>
                {statuses.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {statuses.map((status) => {
                      const date = formatStatusDate(status.updatedAt);
                      return (
                        <li
                          key={`${status.status}-${status.updatedAt ?? ''}`}
                          className="flex items-center justify-between gap-2 rounded border px-2 py-1"
                        >
                          <span>{translateStatus(status.status)}</span>
                          {date ? <span className="text-xs text-muted-foreground">{date}</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma atualização registrada até o momento.</p>
                )}
              </div>
            </div>
          </>
        ) : flow?.status === 'pago' ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
            <div className="rounded-full bg-emerald-100 p-3 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">Pagamento Confirmado</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Este lançamento já consta como pago no sistema. Não é necessário gerar uma nova cobrança.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Selecione um lançamento para gerar a cobrança.</p>
        )}

        <CardTokenModal
          flow={flow}
          open={Boolean(cardModalState)}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setCardModalState(null);
            }
          }}
          onTokenized={handleCardTokenized}
          isSubmitting={chargeMutation.isPending}
          installments={installments}
        />
      </DialogContent>
    </Dialog>
  );
};

type CardTokenModalProps = {
  flow: Flow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTokenized: (details: CardTokenDetails) => Promise<void>;
  isSubmitting: boolean;
  installments: number;
};

const CardTokenModal = ({
  flow,
  open,
  onOpenChange,
  onTokenized,
  isSubmitting,
  installments,
}: CardTokenModalProps) => {
  const { toast } = useToast();
  const [form, setForm] = useState<CardFormState>({
    holderName: '',
    holderEmail: '',
    document: '',
    number: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    phone: '',
    postalCode: '',
    addressNumber: '',
    addressComplement: '',
  });
  const [errors, setErrors] = useState<CardFormErrors>({});
  const [isTokenizing, setIsTokenizing] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm({
        holderName: '',
        holderEmail: '',
        document: '',
        number: '',
        expiryMonth: '',
        expiryYear: '',
        cvv: '',
        phone: '',
        postalCode: '',
        addressNumber: '',
        addressComplement: '',
      });
      setErrors({});
      setIsTokenizing(false);
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateCardForm(form);
    setErrors(validation);
    if (Object.values(validation).some(Boolean)) {
      toast({
        title: 'Verifique os dados do cartão',
        description: 'Preencha todos os campos obrigatórios para continuar.',
        variant: 'destructive',
      });
      return;
    }

    const payload: CardTokenPayload = {
      holderName: form.holderName.trim(),
      number: sanitizeDigits(form.number),
      expiryMonth: form.expiryMonth.trim(),
      expiryYear: form.expiryYear.trim(),
      cvv: sanitizeDigits(form.cvv),
      document: sanitizeDigits(form.document),
      email: form.holderEmail.trim(),
      phone: sanitizeDigits(form.phone),
      postalCode: sanitizeDigits(form.postalCode),
      addressNumber: form.addressNumber.trim(),
      addressComplement: form.addressComplement.trim() || undefined,
    };

    try {
      setIsTokenizing(true);
      const tokenData: CardTokenResponse = await tokenizeCard(payload);
      await onTokenized({
        token: tokenData.token,
        brand: tokenData.brand,
        last4Digits: tokenData.last4Digits,
        holderName: payload.holderName,
        holderEmail: payload.email,
        document: payload.document,
        phone: payload.phone,
        postalCode: payload.postalCode,
        addressNumber: payload.addressNumber,
        addressComplement: payload.addressComplement,
      });
      onOpenChange(false);
      toast({
        title: 'Cartão validado com sucesso',
        description: 'O token foi gerado e a cobrança será criada.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao processar cartão',
        description: error instanceof Error ? error.message : 'Não foi possível tokenizar o cartão.',
        variant: 'destructive',
      });
    } finally {
      setIsTokenizing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg space-y-4">
        <DialogHeader>
          <DialogTitle>Dados do cartão</DialogTitle>
          <DialogDescription>
            Informe os dados do titular para concluir a cobrança do lançamento "{flow?.descricao ?? ''}".
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3">
            <Input
              placeholder="Nome impresso no cartão"
              value={form.holderName}
              onChange={(event) => setForm((prev) => ({ ...prev, holderName: event.target.value }))}
            />
            {errors.holderName ? <p className="text-xs text-destructive">{errors.holderName}</p> : null}

            <Input
              type="email"
              placeholder="E-mail do titular"
              value={form.holderEmail}
              onChange={(event) => setForm((prev) => ({ ...prev, holderEmail: event.target.value }))}
            />
            {errors.holderEmail ? <p className="text-xs text-destructive">{errors.holderEmail}</p> : null}

            <Input
              placeholder="CPF/CNPJ"
              value={form.document}
              onChange={(event) => setForm((prev) => ({ ...prev, document: event.target.value }))}
            />
            {errors.document ? <p className="text-xs text-destructive">{errors.document}</p> : null}

            <Input
              placeholder="Número do cartão"
              value={form.number}
              onChange={(event) => setForm((prev) => ({ ...prev, number: event.target.value }))}
            />
            {errors.number ? <p className="text-xs text-destructive">{errors.number}</p> : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Input
                  placeholder="Mês"
                  value={form.expiryMonth}
                  onChange={(event) => setForm((prev) => ({ ...prev, expiryMonth: event.target.value }))}
                />
                {errors.expiryMonth ? <p className="text-xs text-destructive">{errors.expiryMonth}</p> : null}
              </div>
              <div className="space-y-1">
                <Input
                  placeholder="Ano"
                  value={form.expiryYear}
                  onChange={(event) => setForm((prev) => ({ ...prev, expiryYear: event.target.value }))}
                />
                {errors.expiryYear ? <p className="text-xs text-destructive">{errors.expiryYear}</p> : null}
              </div>
              <div className="space-y-1">
                <Input
                  placeholder="CVV"
                  value={form.cvv}
                  onChange={(event) => setForm((prev) => ({ ...prev, cvv: event.target.value }))}
                />
                {errors.cvv ? <p className="text-xs text-destructive">{errors.cvv}</p> : null}
              </div>
            </div>

            <Input
              placeholder="Telefone"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
            {errors.phone ? <p className="text-xs text-destructive">{errors.phone}</p> : null}

            <Input
              placeholder="CEP"
              value={form.postalCode}
              onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))}
            />
            {errors.postalCode ? <p className="text-xs text-destructive">{errors.postalCode}</p> : null}

            <Input
              placeholder="Número do endereço"
              value={form.addressNumber}
              onChange={(event) => setForm((prev) => ({ ...prev, addressNumber: event.target.value }))}
            />
            {errors.addressNumber ? <p className="text-xs text-destructive">{errors.addressNumber}</p> : null}

            <Input
              placeholder="Complemento"
              value={form.addressComplement}
              onChange={(event) => setForm((prev) => ({ ...prev, addressComplement: event.target.value }))}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isTokenizing || isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" className="gap-2" disabled={isTokenizing || isSubmitting}>
              {(isTokenizing || isSubmitting) && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </form>

        <p className="text-xs text-muted-foreground">
          O valor será cobrado em {installments} parcela(s) para o lançamento "{flow?.descricao ?? ''}".
        </p>
      </DialogContent>
    </Dialog>
  );
};
