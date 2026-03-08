import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import quantumLogo from "@/assets/quantum-logo.png";
import { routes } from "@/config/routes";
import { appConfig } from "@/config/app-config";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchPlanOptions, formatPlanPriceLabel, getComparableMonthlyPrice, type PlanOption } from "@/features/plans/api";
import { signUpRequest, ApiError } from "@/features/auth/api";

const Register = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    password: "",
    confirmPassword: ""
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const planFromUrl = searchParams.get("plan");
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [isPlansLoading, setIsPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadPlans = async () => {
      setIsPlansLoading(true);
      setPlansError(null);

      try {
        const plans = await fetchPlanOptions(controller.signal);
        if (!active) {
          return;
        }

        // Ordena do mais barato para o mais caro
        const sortedPlans = [...plans].sort((a, b) => {
          const priceA = getComparableMonthlyPrice(a);
          const priceB = getComparableMonthlyPrice(b);
          if (priceA === null && priceB === null) return 0;
          if (priceA === null) return 1;
          if (priceB === null) return -1;
          return priceA - priceB;
        });

        setPlanOptions(sortedPlans);

        if (sortedPlans.length === 0) {
          setSelectedPlanId("");
          return;
        }

        const normalizedParam = planFromUrl ? planFromUrl.trim() : "";
        const matched = plans.find((plan) => String(plan.id) === normalizedParam);
        const fallback = matched ?? plans[0];
        setSelectedPlanId(String(fallback.id));
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }

        console.error("Falha ao carregar planos disponíveis para cadastro", error);
        setPlansError("Não foi possível carregar os planos disponíveis no momento.");
        setPlanOptions([]);
        setSelectedPlanId("");
      } finally {
        if (active) {
          setIsPlansLoading(false);
        }
      }
    };

    void loadPlans();

    return () => {
      active = false;
      controller.abort();
    };
  }, [planFromUrl]);

  const selectedPlan = useMemo(
    () => planOptions.find((plan) => String(plan.id) === selectedPlanId) ?? null,
    [planOptions, selectedPlanId],
  );

  const formatPhoneInput = (value: string) => {
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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedPlanId) {
      toast({
        variant: "destructive",
        title: "Plano obrigatório",
        description: "Selecione um plano para iniciar o teste gratuito.",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "As senhas não coincidem."
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres."
      });
      return;
    }

    setIsSubmitting(true);

    const phoneDigits = formData.phone.replace(/\D/g, "");

    try {
      const result = await signUpRequest({
        email: formData.email.trim(),
        password: formData.password,
        nome: formData.name.trim(),
        empresa: formData.company.trim(),
        telefone: phoneDigits.length > 0 ? phoneDigits : undefined,
        planId: Number.parseInt(selectedPlanId, 10),
      });

      toast({
        title: "Cadastro realizado!",
        description: result.message,
      });
      navigate(routes.login);
    } catch (error) {
      const description =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Não foi possível concluir o cadastro. Tente novamente.";
      toast({
        variant: "destructive",
        title: "Erro ao cadastrar",
        description
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "phone" ? formatPhoneInput(value) : value
    }));
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Lado Esquerdo: Branding / Decorativo (Apenas Desktop) */}
      <div className="hidden lg:flex flex-col justify-center items-center relative overflow-hidden bg-zinc-900 border-r border-zinc-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-zinc-900/0 to-transparent opacity-40"></div>
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl opacity-20"></div>

        <div className="relative z-10 flex flex-col items-center max-w-lg text-center p-12">
          <img src={quantumLogo} alt={appConfig.appName} className="h-24 w-24 mb-8 drop-shadow-2xl" />
          <h1 className="text-4xl font-bold tracking-tight text-white mb-4">
            Junte-se ao {appConfig.appName}
          </h1>
          <p className="text-lg text-zinc-400 leading-relaxed">
            Comece hoje mesmo a transformar a gestão do seu escritório com tecnologia de ponta.
          </p>

          <div className="mt-12 grid grid-cols-2 gap-4 w-full">
            <div className="p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
              <h3 className="text-white font-semibold mb-1">Inteligente</h3>
              <p className="text-sm text-zinc-400">Automação avançada para seus processos</p>
            </div>
            <div className="p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
              <h3 className="text-white font-semibold mb-1">Seguro</h3>
              <p className="text-sm text-zinc-400">Proteção de dados de nível corporativo</p>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 text-zinc-600 text-sm">
          © {new Date().getFullYear()} {appConfig.appName}. Todos os direitos reservados.
        </div>
      </div>

      {/* Lado Direito: Formulário */}
      <div className="flex items-center justify-center p-4 lg:p-8 bg-background relative overflow-y-auto">
        {/* Mobile Background Accents */}
        <div className="lg:hidden absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>

        <div className="w-full max-w-lg space-y-8 py-8">
          <div className="text-center lg:text-left space-y-2">
            <div className="lg:hidden flex justify-center mb-6">
              <img src={quantumLogo} alt={appConfig.appName} className="h-16 w-16" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Crie sua conta</h2>
            <p className="text-muted-foreground">
              Preencha os dados abaixo para começar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Seu nome"
                  required
                  className="bg-background/50 border-input/50 focus:border-primary focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Empresa</Label>
                <Input
                  id="company"
                  name="company"
                  type="text"
                  value={formData.company}
                  onChange={handleInputChange}
                  placeholder="Sua empresa"
                  required
                  className="bg-background/50 border-input/50 focus:border-primary focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="planId">Plano Selecionado</Label>
              <Select
                value={selectedPlanId}
                onValueChange={setSelectedPlanId}
                disabled={isPlansLoading || planOptions.length === 0}
              >
                <SelectTrigger
                  id="planId"
                  className="bg-background/50 border-input/50 focus:border-primary focus:ring-primary/20"
                >
                  <SelectValue
                    placeholder={
                      isPlansLoading ? "Carregando planos..." : "Selecione o plano do teste"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {planOptions.map((plan, index) => {
                    const isMostPopular = planOptions.length >= 2 && index === planOptions.length - 2;
                    return (
                      <SelectItem key={plan.id} value={String(plan.id)}>
                        <span className="flex items-center gap-2">
                          {`${plan.name} • ${formatPlanPriceLabel(plan)}`}
                          {isMostPopular && (
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              Mais contratado
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {plansError ? (
                <p className="text-sm text-destructive">{plansError}</p>
              ) : selectedPlan ? (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedPlan.description ??
                    "Acesso completo durante 14 dias sem custo."}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  Escolha um plano para o período de teste.
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="seu@email.com"
                  required
                  className="bg-background/50 border-input/50 focus:border-primary focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="(00) 00000-0000"
                  className="bg-background/50 border-input/50 focus:border-primary focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="bg-background/50 border-input/50 focus:border-primary focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  required
                  className="bg-background/50 border-input/50 focus:border-primary focus:ring-primary/20"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-[1.01] active:scale-[0.99] mt-6"
              disabled={
                isSubmitting ||
                isPlansLoading ||
                planOptions.length === 0 ||
                !selectedPlanId
              }
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Criando conta...
                </span>
              ) : (
                "Finalizar Cadastro"
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted/50" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground/80">
                Já possui conta?
              </span>
            </div>
          </div>

          <div className="text-center pb-4">
            <Link
              to={routes.login}
              className="inline-flex items-center justify-center w-full h-11 text-sm font-medium border border-input bg-background/50 hover:bg-accent/50 hover:text-accent-foreground rounded-md transition-colors"
            >
              Fazer login
            </Link>
          </div>

          <div className="text-center">
            <Link to={routes.home} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1">
              ← Voltar para o site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
