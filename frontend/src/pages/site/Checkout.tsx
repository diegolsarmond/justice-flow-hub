import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, CreditCard, FileText, Gift, Loader2, QrCode, Shield, Sparkles } from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { plans } from "@/data/plans";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { routes } from "@/config/routes";
import {
  getAdditionalSubscriptionStorageKeys,
  getSubscriptionStorageKey,
} from "@/features/auth/subscriptionStorage";
import {
  persistManagePlanSelection,
  type ManagePlanSelection,
  type PricingMode,
} from "@/features/plans/managePlanPaymentStorage";
import { fetchPlanOptions, type PlanOption } from "@/features/plans/api";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const formatCurrency = (value: number | null): string | null => {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return currencyFormatter.format(value);
};

// Máscaras de formatação
const formatCpfCnpj = (value: string): string => {
  const digits = value.replace(/\D/g, "");

  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    // CNPJ: 00.000.000/0000-00
    return digits
      .slice(0, 14)
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }
};

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const formatCep = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 5) {
    return digits;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const subscriptionStorageKey = useMemo(
    () => getSubscriptionStorageKey(user),
    [user?.empresa_id, user?.id],
  );
  const [isRedirecting, setIsRedirecting] = useState(() => Boolean(user?.empresa_id));
  const [loading, setLoading] = useState(false);
  const [loadingTrial, setLoadingTrial] = useState(false);
  const [billingType, setBillingType] = useState<"CREDIT_CARD" | "BOLETO" | "PIX">("PIX");
  const [apiPlan, setApiPlan] = useState<PlanOption | null>(null);
  const [customerData, setCustomerData] = useState({
    name: "",
    email: "",
    cpfCnpj: "",
    phone: "",
    postalCode: "",
    addressNumber: "",
    company: "",
  });
  const [accountData, setAccountData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [creditCardData, setCreditCardData] = useState({
    holderName: "",
    number: "",
    expiryMonth: "",
    expiryYear: "",
    ccv: "",
  });

  const planId = searchParams.get("plan");
  const cycle = (searchParams.get("cycle") as "monthly" | "yearly") ?? "yearly";
  const plan = useMemo(() => plans.find((item) => item.id === planId) ?? null, [planId]);

  // Carrega o plano da API
  useEffect(() => {
    if (!planId) return;

    const loadApiPlan = async () => {
      try {
        const options = await fetchPlanOptions();
        // Tenta encontrar por ID numérico ou por nome
        const numericId = parseInt(planId, 10);
        let foundPlan = options.find((option) => option.id === numericId);

        if (!foundPlan && plan) {
          const normalizedName = plan.name.trim().toLowerCase();
          foundPlan = options.find((option) => option.name.trim().toLowerCase() === normalizedName);
        }

        setApiPlan(foundPlan ?? null);
      } catch (error) {
        console.error("Failed to load API plan", error);
      }
    };

    void loadApiPlan();
  }, [planId, plan]);

  useEffect(() => {
    if (!plan && !apiPlan) {
      // Delay redirect to allow API plan load
      const timeout = setTimeout(() => {
        if (!apiPlan) {
          navigate("/plans", { replace: true });
        }
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [plan, apiPlan, navigate]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setCustomerData((previous) => {
      const next = { ...previous };
      if (!previous.name.trim()) {
        next.name = user.nome_completo;
      }
      if (!previous.email.trim()) {
        next.email = user.email;
      }
      return next;
    });
  }, [user]);

  useEffect(() => {
    const currentPlan = apiPlan ?? plan;
    if (!currentPlan || !user?.empresa_id) {
      setIsRedirecting(false);
      return;
    }

    let cancelled = false;
    setIsRedirecting(true);

    const redirectToInternalCheckout = async () => {
      try {
        if (apiPlan) {
          const pricingMode: PricingMode = cycle === "yearly" ? "anual" : "mensal";
          const features = apiPlan.includedResources
            ? apiPlan.includedResources.split(",").map(s => s.trim()).filter(s => s.length > 0)
            : plan?.features ?? [];

          const selection: ManagePlanSelection = {
            plan: {
              id: apiPlan.id,
              nome: apiPlan.name,
              descricao: apiPlan.description,
              recursos: features,
              valorMensal: apiPlan.monthlyPrice,
              valorAnual: apiPlan.annualPrice,
              precoMensal: formatCurrency(apiPlan.monthlyPrice),
              precoAnual: formatCurrency(apiPlan.annualPrice),
              descontoAnualPercentual: null,
              economiaAnual: null,
              economiaAnualFormatada: null,
            },
            pricingMode,
          };

          persistManagePlanSelection(selection);
          if (!cancelled) {
            navigate(routes.meuPlanoPayment, { state: selection, replace: true });
          }
        }
      } catch (error) {
        if (!cancelled) {
          setIsRedirecting(false);
        }
      }
    };

    void redirectToInternalCheckout();

    return () => {
      cancelled = true;
    };
  }, [cycle, navigate, plan, apiPlan, user?.empresa_id]);

  // Determinar valores do plano
  const displayPlan = apiPlan ?? plan;
  const planName = apiPlan?.name ?? plan?.name ?? "Plano";
  const planDescription = apiPlan?.description ?? plan?.description ?? "";
  const monthlyPrice = apiPlan?.monthlyPrice ?? plan?.monthlyPrice ?? 0;
  const yearlyPrice = apiPlan?.annualPrice ?? plan?.yearlyPrice ?? 0;
  const value = cycle === "monthly" ? monthlyPrice : yearlyPrice;
  const monthlyEquivalent = cycle === "yearly" && yearlyPrice ? yearlyPrice / 12 : monthlyPrice;
  const cycleType = cycle === "monthly" ? "MONTHLY" : "YEARLY";

  const features = useMemo(() => {
    if (apiPlan?.includedResources) {
      return apiPlan.includedResources.split(",").map(s => s.trim()).filter(s => s.length > 0);
    }
    return plan?.features ?? [];
  }, [apiPlan, plan]);

  if (!displayPlan && !apiPlan) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 py-32 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando informações do plano…</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 py-32 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Redirecionando para o checkout interno…</p>
        </div>
        <Footer />
      </div>
    );
  }

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

  const handleStartTrial = async () => {
    if (loadingTrial) return;

    // Se usuário não está logado, redireciona para registro
    if (!user) {
      navigate(`${routes.register}?plan=${planId}&cycle=${cycle}&trial=true`);
      return;
    }

    setLoadingTrial(true);
    try {
      // Cria trial de 14 dias
      await requestJson(getApiUrl("trials"), {
        method: "POST",
        body: JSON.stringify({
          planId: apiPlan?.id ?? planId,
          userId: user.id,
          empresaId: user.empresa_id,
          duration: 14,
        }),
      });

      toast({
        title: "🎉 Período de teste ativado!",
        description: "Você tem 14 dias para experimentar todas as funcionalidades.",
      });
      navigate(routes.dashboard);
    } catch (error: any) {
      toast({
        title: "Erro ao ativar período de teste",
        description: error?.message ?? "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setLoadingTrial(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || isRedirecting) {
      return;
    }

    // Validação de senha se não logado
    if (!user) {
      if (!accountData.password || accountData.password.length < 6) {
        toast({
          title: "Senha inválida",
          description: "A senha deve ter pelo menos 6 caracteres.",
          variant: "destructive",
        });
        return;
      }
      if (accountData.password !== accountData.confirmPassword) {
        toast({
          title: "Senhas não coincidem",
          description: "A confirmação de senha deve ser igual à senha.",
          variant: "destructive",
        });
        return;
      }
      if (!customerData.company?.trim()) {
        toast({
          title: "Empresa obrigatória",
          description: "Informe o nome da sua empresa ou escritório.",
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);

    try {
      let currentUserId: number | null = user?.id ?? null;
      let currentEmpresaId: number | null = user?.empresa_id ?? null;

      // Se não está logado, primeiro cria a conta do usuário
      if (!user) {
        const phoneDigits = customerData.phone.replace(/\D/g, "");
        const registerPayload = {
          name: customerData.name.trim(),
          email: customerData.email.trim(),
          company: customerData.company.trim(),
          password: accountData.password,
          phone: phoneDigits.length > 0 ? phoneDigits : undefined,
          planId: apiPlan?.id ?? parseInt(planId ?? "0", 10),
          cpfCnpj: customerData.cpfCnpj?.replace(/\D/g, "") || undefined,
        };

        const registerResp = await requestJson<{
          user?: { id?: number; empresa_id?: number };
          userId?: number;
          empresaId?: number;
        }>(getApiUrl("auth/register"), {
          method: "POST",
          body: JSON.stringify(registerPayload),
        });

        currentUserId = registerResp?.user?.id ?? registerResp?.userId ?? null;
        currentEmpresaId = registerResp?.user?.empresa_id ?? registerResp?.empresaId ?? null;

        if (!currentUserId) {
          // Conta criada mas sem retorno de ID - continua sem vincular
          console.warn("Usuário criado mas ID não retornado");
        }

        toast({
          title: "Conta criada com sucesso!",
          description: "Sua conta foi criada. Confirme seu email para ter acesso completo.",
        });
      }

      // Cria o cliente no Asaas
      const customerResp = await requestJson<{ id?: string }>(getApiUrl("site/asaas/customers"), {
        method: "POST",
        body: JSON.stringify({
          ...customerData,
          userId: currentUserId,
          empresaId: currentEmpresaId,
        }),
      });

      const customerId = customerResp?.id;
      if (!customerId) {
        throw new Error("Não foi possível identificar o cliente");
      }

      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + 7);

      const metadata: Record<string, unknown> = {
        origin: "site-checkout",
        planId: apiPlan?.id ?? planId,
        cycle,
      };

      if (currentUserId) {
        metadata.userId = currentUserId;
      }

      if (currentEmpresaId) {
        metadata.empresaId = currentEmpresaId;
      }

      if (customerData.email) {
        metadata.customerEmail = customerData.email;
      }

      if (customerData.cpfCnpj) {
        metadata.customerDocument = customerData.cpfCnpj;
      }

      const subscriptionData = {
        customer: customerId,
        billingType,
        value,
        nextDueDate: nextDueDate.toISOString().split("T")[0],
        cycle: cycleType,
        description: `Assinatura ${planName} (${cycle === "monthly" ? "mensal" : "anual"})`,
        externalReference: `plan-${apiPlan?.id ?? planId}-${Date.now()}`,
        metadata,
        userId: currentUserId,
        empresaId: currentEmpresaId,
        ...(billingType === "CREDIT_CARD" && {
          creditCard: creditCardData,
          creditCardHolderInfo: customerData,
        }),
      };

      const subscriptionResp = await requestJson<{ id?: string }>(
        getApiUrl("site/asaas/subscriptions"),
        {
          method: "POST",
          body: JSON.stringify(subscriptionData),
        },
      );

      const subscriptionId = subscriptionResp?.id;
      if (!subscriptionId) {
        throw new Error("Não foi possível identificar a assinatura");
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(subscriptionStorageKey, subscriptionId);
        const additionalKeys = getAdditionalSubscriptionStorageKeys(user, subscriptionStorageKey);
        for (const key of additionalKeys) {
          localStorage.removeItem(key);
        }
        localStorage.setItem("customerId", customerId);
      }

      toast({
        title: "Assinatura criada com sucesso!",
        description: "Você pode acompanhar o pagamento na próxima tela.",
      });
      navigate(routes.subscription(subscriptionId));
    } catch (error: any) {
      toast({
        title: "Erro ao criar assinatura",
        description: error?.message ?? "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Back Button */}
          <Link
            to={routes.plans}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para planos
          </Link>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Trial Banner */}
              <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-full bg-green-500/20">
                        <Gift className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-green-700 dark:text-green-400">
                          Experimente grátis por 14 dias
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Teste todas as funcionalidades sem compromisso. Sem cartão de crédito.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleStartTrial}
                      disabled={loadingTrial}
                      className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
                    >
                      {loadingTrial ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Começar Teste Grátis
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-4 text-muted-foreground">
                    ou assine agora
                  </span>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Customer Data */}
                <Card>
                  <CardHeader>
                    <CardTitle>Dados do Cliente</CardTitle>
                    <CardDescription>Preencha seus dados para criar a assinatura</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome Completo</Label>
                        <Input
                          id="name"
                          required
                          placeholder="Seu nome completo"
                          value={customerData.name}
                          onChange={(event) => setCustomerData((prev) => ({ ...prev, name: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          required
                          placeholder="seu@email.com"
                          value={customerData.email}
                          onChange={(event) => setCustomerData((prev) => ({ ...prev, email: event.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cpfCnpj">CPF/CNPJ</Label>
                        <Input
                          id="cpfCnpj"
                          required
                          placeholder="000.000.000-00"
                          value={customerData.cpfCnpj}
                          onChange={(event) => setCustomerData((prev) => ({ ...prev, cpfCnpj: formatCpfCnpj(event.target.value) }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone</Label>
                        <Input
                          id="phone"
                          required
                          placeholder="(00) 00000-0000"
                          value={customerData.phone}
                          onChange={(event) => setCustomerData((prev) => ({ ...prev, phone: formatPhone(event.target.value) }))}
                        />
                      </div>
                    </div>
                    {/* Campos adicionais quando não logado */}
                    {!user && (
                      <div className="space-y-2">
                        <Label htmlFor="company">Empresa / Escritório</Label>
                        <Input
                          id="company"
                          required
                          placeholder="Nome da sua empresa ou escritório"
                          value={customerData.company}
                          onChange={(event) => setCustomerData((prev) => ({ ...prev, company: event.target.value }))}
                        />
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">CEP</Label>
                        <Input
                          id="postalCode"
                          required
                          placeholder="00000-000"
                          value={customerData.postalCode}
                          onChange={(event) => setCustomerData((prev) => ({ ...prev, postalCode: formatCep(event.target.value) }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="addressNumber">Número</Label>
                        <Input
                          id="addressNumber"
                          required
                          placeholder="123"
                          value={customerData.addressNumber}
                          onChange={(event) => setCustomerData((prev) => ({ ...prev, addressNumber: event.target.value }))}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Account Data - Only when not logged in */}
                {!user && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Dados de Acesso</CardTitle>
                      <CardDescription>Crie sua senha para acessar a plataforma</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="password">Senha</Label>
                          <Input
                            id="password"
                            type="password"
                            required
                            placeholder="Mínimo 6 caracteres"
                            value={accountData.password}
                            onChange={(event) => setAccountData((prev) => ({ ...prev, password: event.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                          <Input
                            id="confirmPassword"
                            type="password"
                            required
                            placeholder="Repita a senha"
                            value={accountData.confirmPassword}
                            onChange={(event) => setAccountData((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Após a confirmação, você receberá um email para ativar sua conta.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Payment Method */}
                <Card>
                  <CardHeader>
                    <CardTitle>Forma de Pagamento</CardTitle>
                    <CardDescription>Escolha como deseja pagar sua assinatura</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup value={billingType} onValueChange={(value) => setBillingType(value as typeof billingType)}>
                      <div className="grid md:grid-cols-3 gap-4">
                        <label className={`flex cursor-pointer flex-col gap-3 rounded-xl border-2 p-4 transition-all ${billingType === "PIX" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50"}`}>
                          <RadioGroupItem value="PIX" className="sr-only" />
                          <div className="flex items-center justify-between">
                            <QrCode className="h-6 w-6 text-primary" />
                            {billingType === "PIX" && <Badge variant="secondary" className="text-xs">Selecionado</Badge>}
                          </div>
                          <div>
                            <span className="font-semibold">PIX</span>
                            <p className="text-xs text-muted-foreground mt-1">Pagamento instantâneo com QR Code</p>
                          </div>
                        </label>
                        <label className={`flex cursor-pointer flex-col gap-3 rounded-xl border-2 p-4 transition-all ${billingType === "BOLETO" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50"}`}>
                          <RadioGroupItem value="BOLETO" className="sr-only" />
                          <div className="flex items-center justify-between">
                            <FileText className="h-6 w-6 text-primary" />
                            {billingType === "BOLETO" && <Badge variant="secondary" className="text-xs">Selecionado</Badge>}
                          </div>
                          <div>
                            <span className="font-semibold">Boleto</span>
                            <p className="text-xs text-muted-foreground mt-1">Receba por email imediatamente</p>
                          </div>
                        </label>
                        <label className={`flex cursor-pointer flex-col gap-3 rounded-xl border-2 p-4 transition-all ${billingType === "CREDIT_CARD" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50"}`}>
                          <RadioGroupItem value="CREDIT_CARD" className="sr-only" />
                          <div className="flex items-center justify-between">
                            <CreditCard className="h-6 w-6 text-primary" />
                            {billingType === "CREDIT_CARD" && <Badge variant="secondary" className="text-xs">Selecionado</Badge>}
                          </div>
                          <div>
                            <span className="font-semibold">Cartão</span>
                            <p className="text-xs text-muted-foreground mt-1">Aprovação imediata</p>
                          </div>
                        </label>
                      </div>
                    </RadioGroup>

                    {billingType === "CREDIT_CARD" && (
                      <div className="mt-6 p-4 bg-muted/50 rounded-xl space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="holderName">Nome impresso no cartão</Label>
                          <Input
                            id="holderName"
                            required
                            placeholder="NOME COMO NO CARTÃO"
                            value={creditCardData.holderName}
                            onChange={(event) => setCreditCardData((prev) => ({ ...prev, holderName: event.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="number">Número do cartão</Label>
                          <Input
                            id="number"
                            required
                            placeholder="0000 0000 0000 0000"
                            value={creditCardData.number}
                            onChange={(event) => setCreditCardData((prev) => ({ ...prev, number: event.target.value }))}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="expiryMonth">Mês</Label>
                            <Input
                              id="expiryMonth"
                              placeholder="MM"
                              required
                              value={creditCardData.expiryMonth}
                              onChange={(event) => setCreditCardData((prev) => ({ ...prev, expiryMonth: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="expiryYear">Ano</Label>
                            <Input
                              id="expiryYear"
                              placeholder="AA"
                              required
                              value={creditCardData.expiryYear}
                              onChange={(event) => setCreditCardData((prev) => ({ ...prev, expiryYear: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="ccv">CVV</Label>
                            <Input
                              id="ccv"
                              required
                              placeholder="123"
                              value={creditCardData.ccv}
                              onChange={(event) => setCreditCardData((prev) => ({ ...prev, ccv: event.target.value }))}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Button type="submit" size="lg" className="w-full h-14 text-base font-semibold" disabled={loading || isRedirecting}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>Finalizar Assinatura - {formatCurrency(value)}</>
                  )}
                </Button>
              </form>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Plan Summary */}
              <Card className="sticky top-24">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Resumo do Pedido</CardTitle>
                    <Badge variant="outline">{cycle === "monthly" ? "Mensal" : "Anual"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                    <h3 className="font-bold text-xl mb-1">{planName}</h3>
                    {planDescription && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{planDescription}</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-muted-foreground">Valor {cycle === "monthly" ? "mensal" : "anual"}</span>
                      <span className="text-2xl font-bold">{formatCurrency(value)}</span>
                    </div>
                    {cycle === "yearly" && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Equivalente mensal</span>
                        <span className="text-green-600 font-medium">{formatCurrency(monthlyEquivalent)}/mês</span>
                      </div>
                    )}
                  </div>

                  {features.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-3">Incluso no plano:</p>
                      <ul className="space-y-2">
                        {features.slice(0, 6).map((feature, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                        {features.length > 6 && (
                          <li className="text-sm text-muted-foreground pl-6">
                            + {features.length - 6} recursos adicionais
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Security */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Pagamento Seguro</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Transações criptografadas com padrão PCI DSS via Asaas
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Checkout;
