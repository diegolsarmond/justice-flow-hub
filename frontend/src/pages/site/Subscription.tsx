import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Subscription, Payment, PixQRCode } from "@/types/subscription";
import UpdateCardDialog from "@/components/UpdateCardDialog";
import UpdatePlanDialog from "@/components/UpdatePlanDialog";
import { getApiUrl } from "@/lib/api";
import { fetchChargeDetails, fetchFlows, type Flow } from "@/lib/flows";
import {
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  CreditCard,
  Download,
  Loader2,
  Receipt,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const flowStatusLabels: Record<Flow["status"], string> = {
  pendente: "Pendente",
  pago: "Pago",
  estornado: "Estornado",
  vencido: "Vencido",
};

const formatDateLabel = (value: string | null | undefined): string => {
  if (!value) {
    return "—";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(timestamp));
};

const SubscriptionDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pixQrCode, setPixQrCode] = useState<PixQRCode | null>(null);
  const [boletoCode, setBoletoCode] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [lastPaymentStatus, setLastPaymentStatus] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [history, setHistory] = useState<Flow[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyChargeDetails, setHistoryChargeDetails] = useState<
    Record<string, { invoiceUrl: string | null; boletoUrl: string | null }>
  >({});
  const [historyChargeLoading, setHistoryChargeLoading] = useState<Record<string, boolean>>({});
  const [historyChargeErrors, setHistoryChargeErrors] = useState<Record<string, string>>({});
  const [showAllHistory, setShowAllHistory] = useState(false);

  useEffect(() => {
    loadSubscription();
    const interval = setInterval(() => {
      checkPaymentStatusInBackground();
    }, 15000);
    setPollingInterval(interval);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const requestJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
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
        (payload && typeof payload === "object" && "error" in payload && payload.error)
          ? String(payload.error)
          : response.statusText || "Falha ao comunicar com o servidor.";
      throw new Error(message);
    }

    return payload as T;
  };

  const checkPaymentStatusInBackground = async () => {
    if (!id) {
      return;
    }

    try {
      const paymentsResp = await requestJson<{ data: Payment[] }>(
        getApiUrl(`site/asaas/subscriptions/${encodeURIComponent(id)}/payments`),
      );

      const paymentsList = paymentsResp?.data ?? [];
      const pendingPayment = paymentsList.find((payment) => payment.status === "PENDING");
      const confirmedPayment = paymentsList.find((payment) =>
        payment.status === "CONFIRMED" || payment.status === "RECEIVED",
      );

      if (confirmedPayment && lastPaymentStatus === "PENDING") {
        await loadSubscription(false);
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        toast({
          title: "Pagamento confirmado!",
          description: "Sua assinatura foi ativada.",
        });
        setLastPaymentStatus(confirmedPayment.status);
      } else if (pendingPayment) {
        setPayments(paymentsList);
        setLastPaymentStatus("PENDING");
        if (pendingPayment.billingType === "PIX") {
          void loadPixQrCode(pendingPayment.id);
          setBoletoCode(null);
        } else if (pendingPayment.billingType === "BOLETO") {
          void loadBoletoCode(pendingPayment.id);
          setPixQrCode(null);
        } else {
          setPixQrCode(null);
          setBoletoCode(null);
        }
      } else if (confirmedPayment) {
        setPayments(paymentsList);
        setPixQrCode(null);
        setBoletoCode(null);
        setLastPaymentStatus(confirmedPayment.status);
      } else {
        setPayments(paymentsList);
        setPixQrCode(null);
        setBoletoCode(null);
      }
    } catch (error) {
      console.log("Erro ao verificar status (background):", error);
    }
  };

  const loadSubscription = async (showSpinner = true) => {
    if (!id) {
      return;
    }

    try {
      if (showSpinner) {
        setLoading(true);
      }

      const subscriptionResp = await requestJson<Subscription>(
        getApiUrl(`site/asaas/subscriptions/${encodeURIComponent(id)}`),
      );
      setSubscription(subscriptionResp ?? null);

      const paymentsResp = await requestJson<{ data: Payment[] }>(
        getApiUrl(`site/asaas/subscriptions/${encodeURIComponent(id)}/payments`),
      );

      const paymentsList = paymentsResp?.data ?? [];
      setPayments(paymentsList);

      const pendingPayment = paymentsList.find((payment) => payment.status === "PENDING");
      const confirmedPayment = paymentsList.find((payment) =>
        payment.status === "CONFIRMED" || payment.status === "RECEIVED",
      );

      if (confirmedPayment) {
        setLastPaymentStatus(confirmedPayment.status);
      } else if (pendingPayment) {
        setLastPaymentStatus("PENDING");
      }

      if (pendingPayment) {
        if (pendingPayment.billingType === "PIX") {
          loadPixQrCode(pendingPayment.id);
        } else if (pendingPayment.billingType === "BOLETO") {
          loadBoletoCode(pendingPayment.id);
        }
      } else {
        setPixQrCode(null);
        setBoletoCode(null);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar assinatura",
        description: error?.message ?? "Não foi possível carregar os dados.",
        variant: "destructive",
      });
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  };

  const loadPixQrCode = async (paymentId: string) => {
    try {
      const data = await requestJson<PixQRCode>(
        getApiUrl(`site/asaas/payments/${encodeURIComponent(paymentId)}/pix`),
      );
      setPixQrCode(data);
    } catch {
      setPixQrCode(null);
    }
  };

  const loadBoletoCode = async (paymentId: string) => {
    try {
      const data = await requestJson<{ identificationField: string }>(
        getApiUrl(`site/asaas/payments/${encodeURIComponent(paymentId)}/boleto`),
      );
      setBoletoCode(data?.identificationField ?? null);
    } catch {
      setBoletoCode(null);
    }
  };

  const cancelSubscription = async () => {
    if (!subscription || isCancelling) {
      return;
    }

    setIsCancelling(true);
    try {
      await requestJson<Subscription>(
        getApiUrl(`site/asaas/subscriptions/${encodeURIComponent(subscription.id)}/cancel`),
        { method: "POST" },
      );
      toast({
        title: "Assinatura cancelada",
        description: "O cancelamento foi solicitado com sucesso.",
      });
      await loadSubscription();
    } catch (error: any) {
      toast({
        title: "Não foi possível cancelar",
        description: error?.message ?? "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedPayload(true);
    toast({
      title: "Copiado!",
      description: "Conteúdo copiado para a área de transferência.",
    });
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const copyHistoryDocument = async (value: string | null) => {
    if (!value) {
      toast({
        title: "Documento indisponível",
        description: "O Asaas ainda não disponibilizou o link para download.",
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
        description: "Cole o link no navegador para abrir o documento.",
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description:
          error instanceof Error ? error.message : "Não foi possível copiar o link para a área de transferência.",
        variant: "destructive",
      });
    }
  };

  const openHistoryDocument = (
    url: string | null,
    options?: { title?: string; description?: string },
  ) => {
    if (!url) {
      toast({
        title: options?.title ?? "Documento indisponível",
        description: options?.description ?? "O Asaas ainda não disponibilizou o documento.",
        variant: "destructive",
      });
      return;
    }

    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "bg-green-500",
      INACTIVE: "bg-gray-500",
      EXPIRED: "bg-red-500",
      PENDING: "bg-yellow-500",
      RECEIVED: "bg-green-500",
      CONFIRMED: "bg-green-500",
      OVERDUE: "bg-red-500",
      CANCELED: "bg-rose-500",
      CANCELLED: "bg-rose-500",
    };
    return colors[status] ?? "bg-gray-500";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      ACTIVE: "Ativa",
      INACTIVE: "Inativa",
      EXPIRED: "Expirada",
      PENDING: "Pendente",
      RECEIVED: "Recebido",
      CONFIRMED: "Confirmado",
      OVERDUE: "Atrasado",
      CANCELED: "Cancelada",
      CANCELLED: "Cancelada",
    };
    return labels[status] ?? status;
  };

  const formatCurrency = (value: number) => {
    const normalized = typeof value === "number" ? value : Number(value);
    return Number.isFinite(normalized)
      ? normalized.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "R$ 0,00";
  };

  const formatDate = (input: string) => {
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("pt-BR");
  };

  const subscriptionId = subscription?.id ?? null;

  useEffect(() => {
    if (!subscriptionId) {
      setHistory([]);
      setHistoryChargeDetails({});
      setHistoryChargeLoading({});
      setHistoryChargeErrors({});
      setShowAllHistory(false);
      setHistoryError(null);
      setIsHistoryLoading(false);
      return;
    }

    let isActive = true;

    const loadHistory = async () => {
      setIsHistoryLoading(true);
      setHistoryError(null);
      try {
        const flows = await fetchFlows();
        if (!isActive) {
          return;
        }

        const planFlows = flows.filter((flow) => flow.descricao.toLowerCase().includes("assinatura"));
        setHistoryChargeDetails({});
        setHistoryChargeLoading({});
        setHistoryChargeErrors({});
        setShowAllHistory(false);
        setHistory(planFlows);
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.error("Erro ao carregar histórico de pagamentos do plano", error);
        setHistoryError("Não foi possível carregar o histórico de pagamentos.");
      } finally {
        if (isActive) {
          setIsHistoryLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      isActive = false;
    };
  }, [subscriptionId, payments]);

  const planPaymentHistory = useMemo(() => {
    const sorted = [...history].sort((a, b) => {
      const timeA = Date.parse(a.vencimento);
      const timeB = Date.parse(b.vencimento);

      if (Number.isNaN(timeA) && Number.isNaN(timeB)) {
        return 0;
      }

      if (Number.isNaN(timeA)) {
        return 1;
      }

      if (Number.isNaN(timeB)) {
        return -1;
      }

      return timeB - timeA;
    });

    if (showAllHistory) {
      return sorted;
    }

    return sorted.slice(0, 5);
  }, [history, showAllHistory]);

  useEffect(() => {
    if (planPaymentHistory.length === 0) {
      return;
    }

    let isActive = true;

    const loadChargeDetails = async () => {
      // Filter out items that are already loaded or loading
      const entries = planPaymentHistory
        .filter((flow) => {
          const key = `${flow.id}`;
          return historyChargeDetails[key] === undefined && !historyChargeLoading[key];
        })
        .map((flow) => {
          const flowId = typeof flow.id === "number" ? flow.id : Number.parseInt(`${flow.id}`, 10);
          if (!Number.isFinite(flowId)) {
            return null;
          }
          return { id: flowId as number, key: `${flow.id}` };
        })
        .filter((value): value is { id: number; key: string } => Boolean(value));

      if (entries.length === 0) {
        return;
      }

      setHistoryChargeLoading((previous) => {
        const next = { ...previous };
        for (const entry of entries) {
          next[entry.key] = true;
        }
        return next;
      });

      // Split into chunks to avoid browser connection limits if showing many
      const CHUNK_SIZE = 3;
      for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
        if (!isActive) break;
        const chunk = entries.slice(i, i + CHUNK_SIZE);

        await Promise.all(
          chunk.map(async ({ id: flowId, key }) => {
            try {
              const charge = await fetchChargeDetails(flowId);
              if (!isActive) return;

              setHistoryChargeDetails((previous) => ({
                ...previous,
                [key]: {
                  invoiceUrl: charge?.boletoUrl ?? null,
                  boletoUrl: charge?.boletoUrl ?? null,
                },
              }));

              setHistoryChargeErrors((previous) => {
                const newErrors = { ...previous };
                delete newErrors[key];
                return newErrors;
              });
            } catch (error) {
              if (!isActive) return;
              // Mark as loaded but empty to avoid loop
              setHistoryChargeDetails((previous) => ({
                ...previous,
                [key]: { invoiceUrl: null, boletoUrl: null },
              }));
              // Only log/show error if it's strictly necessary, 
              // but we store it to avoid retrying immediately
              setHistoryChargeErrors((previous) => ({
                ...previous,
                [key]: "Indisponível",
              }));
            } finally {
              if (isActive) {
                setHistoryChargeLoading((previous) => ({
                  ...previous,
                  [key]: false,
                }));
              }
            }
          })
        );
      }
    };

    void loadChargeDetails();

    return () => {
      isActive = false;
    };
  }, [planPaymentHistory]); // Depend on VISIBLE history, not all history



  const historyHasMore = history.length > 5;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Assinatura não encontrada</h2>
          <Button onClick={() => navigate("/plans")}>Voltar para Planos</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <Button variant="ghost" onClick={() => navigate("/plans")} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card className="p-8 border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 border-b border-border/40 pb-8">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl font-bold tracking-tight text-foreground">{subscription.description}</h1>
                      <Badge variant="outline" className={`${getStatusColor(subscription.status)}/10 border-none text-foreground font-semibold px-2.5 py-0.5`}>
                        {getStatusLabel(subscription.status)}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground flex items-center gap-2 text-sm">
                      <CreditCard className="w-3.5 h-3.5" /> Faturamento {subscription.cycle === "MONTHLY" ? "Mensal" : "Anual"} via {subscription.billingType}
                    </p>
                  </div>

                  {subscription.pendingPlanName && (
                    <Alert className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Alteração de plano pendente</AlertTitle>
                      <AlertDescription>
                        Você solicitou a alteração para o plano <strong>{subscription.pendingPlanName}</strong>.
                        Aguardando confirmação do pagamento para efetivar a mudança.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={cn("w-2 h-2 rounded-full", subscription.localStatus === subscription.status ? "bg-green-500" : "bg-yellow-500")} />
                    <span>
                      Sincronizado {formatDateLabel(subscription.localUpdatedAt)}
                      {subscription.localStatus !== subscription.status && " (Divergência de status detectada)"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold tracking-tight text-primary">{formatCurrency(subscription.value)}</div>
                  <div className="text-sm font-medium text-muted-foreground mt-1">
                    / {subscription.cycle === "MONTHLY" ? "mês" : "ano"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/20 rounded-xl p-5 border border-border/40">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-background rounded-lg border shadow-sm text-muted-foreground">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-0.5">Próximo vencimento</div>
                    <div className="font-semibold text-lg">{formatDate(subscription.nextDueDate)}</div>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-background rounded-lg border shadow-sm text-muted-foreground">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-0.5">Método Atual</div>
                    <div className="font-semibold text-lg capitalize">{subscription.billingType.toLowerCase().replace("_", " ")}</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-border/40">
                {subscription.billingType === "CREDIT_CARD" && (
                  <UpdateCardDialog subscriptionId={subscription.id} onUpdate={loadSubscription} />
                )}
                <UpdatePlanDialog subscription={subscription} onUpdate={loadSubscription} />

                <div className="flex-grow" />

                <Button
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={cancelSubscription}
                  disabled={
                    isCancelling ||
                    subscription.status === "CANCELED" ||
                    subscription.status === "CANCELLED" ||
                    subscription.status === "INACTIVE"
                  }
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...
                    </>
                  ) : (
                    "Cancelar assinatura"
                  )}
                </Button>
              </div>
            </Card>

            <Card className="p-1 max-w-full overflow-hidden border-border/60 shadow-sm">
              <Tabs defaultValue={pixQrCode ? "pix" : boletoCode ? "boleto" : "payments"} className="w-full">
                <TabsList className="w-full grid grid-cols-3 bg-muted/50 p-1 rounded-lg">
                  {pixQrCode && <TabsTrigger value="pix" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all">Pagar com PIX</TabsTrigger>}
                  {boletoCode && <TabsTrigger value="boleto" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all">Boleto</TabsTrigger>}
                  <TabsTrigger value="payments" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all">Lista de Cobranças</TabsTrigger>
                </TabsList>

                <TabsContent value="payments" className="space-y-4 mt-4">
                  {payments.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhuma cobrança encontrada</p>
                  ) : (
                    payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <div className="font-medium">{payment.description}</div>
                          <div className="text-sm text-muted-foreground">
                            Vencimento: {formatDate(payment.dueDate)}
                          </div>
                          <Badge className={`${getStatusColor(payment.status)} mt-2`}>
                            {getStatusLabel(payment.status)}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(payment.value)}</div>
                          {payment.invoiceUrl && (
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto"
                              onClick={() => window.open(payment.invoiceUrl ?? "", "_blank")}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Fatura
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                {pixQrCode && (
                  <TabsContent value="pix" className="space-y-4 mt-4">
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
                      <p className="text-sm font-medium text-center">
                        ⏱️ Status será atualizado automaticamente após o pagamento
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-4">
                        Escaneie o QR Code ou copie o código PIX para pagar
                      </p>
                      <div className="flex justify-center mb-4">
                        <img
                          src={`data:image/png;base64,${pixQrCode.encodedImage}`}
                          alt="QR Code PIX"
                          className="w-64 h-64 border rounded-lg"
                        />
                      </div>
                      <div className="bg-muted p-4 rounded-lg mb-4">
                        <div className="text-xs text-muted-foreground mb-2">Código PIX Copia e Cola</div>
                        <div className="font-mono text-xs break-all">{pixQrCode.payload}</div>
                      </div>
                      <Button onClick={() => copyToClipboard(pixQrCode.payload)} className="w-full">
                        {copiedPayload ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            Copiar código PIX
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-4">
                        Válido até: {new Date(pixQrCode.expirationDate).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </TabsContent>
                )}

                {boletoCode && (
                  <TabsContent value="boleto" className="space-y-4 mt-4">
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
                      <p className="text-sm font-medium text-center">
                        ⏱️ Status será atualizado automaticamente após o pagamento (1-2 dias úteis)
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-4">
                        Copie o código de barras para pagar
                      </p>
                      <div className="bg-muted p-4 rounded-lg mb-4">
                        <div className="text-xs text-muted-foreground mb-2">Código de Barras</div>
                        <div className="font-mono text-sm">{boletoCode}</div>
                      </div>
                      <Button onClick={() => copyToClipboard(boletoCode)} className="w-full">
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar código de barras
                      </Button>
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </Card>

            <Card className="rounded-2xl border border-border/60 shadow-sm bg-card/60 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-muted/30 pb-6 border-b border-border/40">
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" /> Histórico de pagamentos
                </CardTitle>
                <CardDescription>Consulte as últimas cobranças registradas para o plano.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {historyError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Não foi possível carregar o histórico</AlertTitle>
                    <AlertDescription>{historyError}</AlertDescription>
                  </Alert>
                ) : isHistoryLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando histórico…</p>
                ) : planPaymentHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma cobrança de plano foi encontrada nos registros recentes.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="min-w-full table-fixed border-collapse text-sm">
                        <thead>
                          <tr className="text-left text-xs font-medium uppercase text-muted-foreground">
                            <th className="px-3 py-2 font-medium">Descrição</th>
                            <th className="px-3 py-2 font-medium">Vencimento</th>
                            <th className="px-3 py-2 font-medium">Valor</th>
                            <th className="px-3 py-2 font-medium">Status</th>
                            <th className="px-3 py-2 font-medium">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {planPaymentHistory.map((flow) => {
                            const flowKey = `${flow.id}`;
                            const chargeDetails = historyChargeDetails[flowKey];
                            const isChargeLoading = historyChargeLoading[flowKey];
                            const chargeError = historyChargeErrors[flowKey];
                            const documentUrl = chargeDetails?.invoiceUrl ?? chargeDetails?.boletoUrl ?? null;
                            const documentLabel = chargeDetails?.invoiceUrl
                              ? "fatura"
                              : chargeDetails?.boletoUrl
                                ? "boleto"
                                : "documento";
                            const capitalizedDocumentLabel = `${documentLabel
                              .charAt(0)
                              .toUpperCase()}${documentLabel.slice(1)}`;

                            return (
                              <tr key={flow.id} className="border-b border-border/60 last:border-b-0">
                                <td className="px-3 py-3 align-top">
                                  <div className="space-y-1">
                                    <p className="font-medium text-foreground">{flow.descricao}</p>
                                    {flow.pagamento && (
                                      <p className="text-xs text-muted-foreground">
                                        Pago em {formatDateLabel(flow.pagamento)}
                                      </p>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-3 align-top">
                                  <p className="text-sm text-foreground">{formatDateLabel(flow.vencimento)}</p>
                                </td>
                                <td className="px-3 py-3 align-top">
                                  <p className="text-sm text-foreground">{formatCurrency(flow.valor)}</p>
                                </td>
                                <td className="px-3 py-3 align-top">
                                  <Badge variant="outline" className="rounded-full border-primary/30 text-primary">
                                    {flowStatusLabels[flow.status]}
                                  </Badge>
                                </td>
                                <td className="px-3 py-3 align-top">
                                  {isChargeLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                  ) : chargeError ? (
                                    <p className="text-xs text-destructive">{chargeError}</p>
                                  ) : (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          openHistoryDocument(documentUrl, {
                                            title: `${capitalizedDocumentLabel} indisponível`,
                                            description: `O Asaas ainda não disponibilizou o ${documentLabel} para download.`,
                                          })
                                        }
                                        disabled={!documentUrl}
                                      >
                                        <Receipt className="mr-2 h-4 w-4" /> Abrir
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => void copyHistoryDocument(documentUrl)}
                                        disabled={!documentUrl}
                                      >
                                        <Copy className="h-4 w-4" />
                                        <span className="sr-only">Copiar link</span>
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {historyHasMore && (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="px-0"
                          onClick={() => setShowAllHistory((previous) => !previous)}
                        >
                          {showAllHistory ? "Ver menos" : "Ver tudo"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="p-6 sticky top-4">
              <h3 className="font-semibold mb-4">Informações da Assinatura</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">ID da Assinatura</div>
                  <div className="font-mono text-xs break-all">{subscription.id}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Data de criação</div>
                  <div>{formatDate(subscription.dateCreated)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Cliente</div>
                  <div className="font-mono text-xs break-all">{subscription.customer}</div>
                </div>
                {subscription.externalReference && (
                  <div>
                    <div className="text-muted-foreground mb-1">Referência</div>
                    <div className="font-mono text-xs break-all">{subscription.externalReference}</div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionDetails;
