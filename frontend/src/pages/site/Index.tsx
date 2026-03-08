'use client'
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import { SplineScene } from "@/components/ui/splite";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarClock,
  CheckCircle2,
  FileText,
  FolderCog,
  Gavel,
  Layers,
  Link as LinkIcon,
  MessageSquare,
  Scale,
  Shield,
  Sparkles,
  Users,
  Workflow,
  Zap
} from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { Spotlight } from "@/components/ui/spotlight";
import {
  getAdditionalSubscriptionStorageKeys,
  getSubscriptionStorageKey,
} from "@/features/auth/subscriptionStorage";
import { routes } from "@/config/routes";
import { fetchPlanOptions, formatPlanPriceLabel, getComparableMonthlyPrice, type PlanOption } from "@/features/plans/api";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious
} from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";

const HERO_SPLINE_SCENE = "https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [availablePlans, setAvailablePlans] = useState<PlanOption[]>([]);
  const [isPlansLoading, setIsPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);

  const subscriptionStorageKey = useMemo(
    () => getSubscriptionStorageKey(user),
    [user?.empresa_id, user?.id],
  );

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
        setAvailablePlans(plans);
      } catch (err) {
        if (!active || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        console.error(err);
        setPlansError("Não foi possível carregar os planos disponíveis no momento.");
        setAvailablePlans([]);
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
  }, []);

  const handleSubscriptionClick = () => {
    if (typeof window === "undefined") {
      navigate("/plans");
      return;
    }

    const additionalKeys = getAdditionalSubscriptionStorageKeys(user, subscriptionStorageKey);
    for (const key of additionalKeys) {
      localStorage.removeItem(key);
    }

    const subscriptionId = localStorage.getItem(subscriptionStorageKey);
    if (subscriptionId) {
      navigate(`/subscription/${subscriptionId}`);
    } else {
      navigate("/plans");
    }
  };

  const handleDemoClick = () => {
    document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleWhatsappClick = () => {
    window.open(
      "https://wa.me/553193054200?text=Olá! Gostaria de conhecer o CRM Jurídico Quantum.",
      "_blank"
    );
  };

  const heroFeatures = [
    {
      icon: FolderCog,
      title: "Gestão Completa de Processos",
      description: "Controle processos, prazos, audiências e tarefas em uma única plataforma integrada.",
    },
    {
      icon: Bot,
      title: "Inteligência Artificial Integrada",
      description: "Automatize peças jurídicas, resumos e insights com IA especializada em advocacia.",
    },
    {
      icon: MessageSquare,
      title: "WhatsApp Business Integrado",
      description: "Atenda clientes diretamente no CRM com histórico unificado e automações.",
    },
  ];

  const productivityMetrics = [
    {
      value: "-45%",
      label: "tempo em tarefas manuais",
      description: "Robôs jurídicos capturam movimentações automaticamente e notificam o time responsável."
    },
    {
      value: "+60%",
      label: "conversão de clientes",
      description: "Funis dedicados para prospecção, onboarding e fidelização com follow-up automatizado."
    },
    {
      value: "14 dias",
      label: "para go-live completo",
      description: "Metodologia de implementação guiada por especialistas em operações jurídicas."
    }
  ];

  const modules = [
    {
      icon: FolderCog,
      title: "Gestão de Processos e Fluxos",
      description: "Controle processos, tarefas e workflows personalizados com checklists, responsáveis e fases totalmente configuráveis.",
      features: [
        "Agenda de prazos integrada ao calendário",
        "Relatórios completos por área e cliente",
        "Automação de tarefas recorrentes e SLAs",
      ],
    },
    {
      icon: CalendarClock,
      title: "Agenda e Produtividade",
      description: "Conecte compromissos, audiências e follow-ups em uma única agenda colaborativa.",
      features: [
        "Visão semanal, mensal e por responsável",
        "Alertas por e-mail, push e WhatsApp",
        "Dashboards de desempenho em tempo real",
      ],
    },
    {
      icon: FileText,
      title: "Documentos com IA Jurídica",
      description: "Construa modelos inteligentes e utilize a IA para elaborar peças e contratos automaticamente.",
      features: [
        "Biblioteca de modelos personalizada",
        "Preenchimento automático com dados do processo",
        "Resumos gerados por inteligência artificial",
      ],
    },
    {
      icon: MessageSquare,
      title: "Conversas com WhatsApp",
      description: "Gerencie atendimentos sem sair da plataforma com o WhatsApp integrado.",
      features: [
        "Caixa de entrada compartilhada",
        "Chatbots e respostas assistidas por IA",
        "Registro automático de conversas",
      ],
    },
    {
      icon: LinkIcon,
      title: "Integrações Judiciais",
      description: "Sincronize com PJe, PROJUDI e principais sistemas judiciais do Brasil.",
      features: [
        "Intimações automáticas no CRM",
        "Consulta aos principais tribunais",
        "Integração com gateways de pagamento",
      ],
    },
    {
      icon: BarChart3,
      title: "Relatórios e Analytics",
      description: "Visualize indicadores estratégicos para tomada de decisão baseada em dados.",
      features: [
        "Dashboards executivos personalizados",
        "Relatórios por área, cliente e time",
        "Projeção de honorários e receita",
      ],
    },
  ];

  const differentials = [
    {
      icon: Sparkles,
      title: "IA Jurídica Proprietária",
      description: "Nossa inteligência artificial foi treinada especificamente para o direito brasileiro, entendendo terminologia, legislação e jurisprudência."
    },
    {
      icon: Shield,
      title: "Segurança de Nível Bancário",
      description: "Dados criptografados, backup em tempo real e infraestrutura em conformidade com a LGPD."
    },
    {
      icon: Zap,
      title: "Automação Inteligente",
      description: "Automatize tarefas repetitivas, prazos, notificações e fluxos de trabalho com poucos cliques."
    },
    {
      icon: Users,
      title: "Suporte Especializado",
      description: "Equipe de especialistas jurídicos e técnicos disponíveis para auxiliar sua operação."
    },
  ];

  const highlightedPlanId = useMemo(() => {
    if (availablePlans.length === 0) {
      return null;
    }

    const sorted = [...availablePlans]
      .map((plan) => ({ plan, monthly: getComparableMonthlyPrice(plan) }))
      .filter((entry) => entry.monthly !== null)
      .sort((a, b) => (b.monthly ?? 0) - (a.monthly ?? 0));

    return sorted[0]?.plan.id ?? null;
  }, [availablePlans]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
    [],
  );

  const normalizedPlans = useMemo(
    () =>
      availablePlans.map((plan) => ({
        option: plan,
        priceLabel: formatPlanPriceLabel(plan),
        featured: highlightedPlanId !== null && plan.id === highlightedPlanId,
        monthlyLabel:
          typeof plan.monthlyPrice === "number"
            ? currencyFormatter.format(plan.monthlyPrice)
            : null,
        annualLabel:
          typeof plan.annualPrice === "number" ? currencyFormatter.format(plan.annualPrice) : null,
      })),
    [availablePlans, highlightedPlanId, currencyFormatter],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted">
      <TypebotBubble />
      <Header />
      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-8 pb-20 bg-gradient-hero text-white">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-blue-400/30 blur-3xl rounded-full animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-cyan-400/20 blur-3xl rounded-full"></div>

          <Spotlight
            className="-top-40 left-0 md:left-60 md:-top-20 opacity-50"
            fill="white"
          />

          <div className="container relative z-10 px-4">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className="flex flex-col justify-center space-y-8 animate-in slide-in-from-left duration-700 fade-in">
                <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-1.5 w-fit border border-white/20">
                  <Gavel className="h-4 w-4" />
                  <span className="text-sm font-medium text-white/90">CRM Jurídico #1 do Brasil</span>
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight">
                  O CRM que transforma a gestão do seu{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-cyan-200">
                    Escritório de Advocacia
                  </span>
                </h1>

                <p className="text-lg md:text-xl text-blue-100/90 max-w-xl leading-relaxed">
                  Gestão completa de processos, clientes, documentos e finanças em uma única plataforma.
                  Com inteligência artificial e automações para você focar no que realmente importa.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button
                    size="lg"
                    variant="hero_primary"
                    className="font-semibold h-14 px-8 text-base"
                    onClick={() => navigate(routes.register)}
                  >
                    Começar Grátis por 14 dias
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                  <Button
                    size="lg"
                    variant="hero_secondary"
                    className="font-semibold h-14 px-8 text-base"
                    onClick={handleWhatsappClick}
                  >
                    Falar com Especialista
                  </Button>
                </div>

                <div className="flex items-center gap-6 pt-2 text-sm text-blue-100/80">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    <span>Sem cartão de crédito</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    <span>Setup em minutos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    <span>Suporte incluso</span>
                  </div>
                </div>
              </div>

              <div className="relative h-[400px] lg:h-[550px] w-full flex items-center justify-center lg:justify-end animate-in slide-in-from-right duration-1000 fade-in delay-200">
                <div className="w-full h-full relative z-10 scale-110">
                  <SplineScene
                    scene={HERO_SPLINE_SCENE}
                    className="w-full h-full"
                  />
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-500/30 blur-[100px] rounded-full z-0 pointer-events-none" />
              </div>
            </div>

            {/* Hero Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
              {heroFeatures.map((feature, index) => (
                <Card key={feature.title} className="bg-white/10 border-white/20 backdrop-blur-sm text-left hover:bg-white/15 transition-all duration-300 hover:-translate-y-1">
                  <CardHeader className="space-y-3">
                    <div className="p-3 rounded-full bg-white/20 w-fit">
                      <feature.icon className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle className="text-lg text-white">{feature.title}</CardTitle>
                    <CardDescription className="text-white/80 text-sm leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Social Proof / Metrics Section */}
        <section className="py-20 bg-background">
          <div className="container px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-primary">
                Resultados reais para escritórios jurídicos
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Escritórios que utilizam a plataforma Quantum aumentam sua produtividade e conversão de clientes significativamente.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {productivityMetrics.map((metric) => (
                <Card key={metric.label} className="bg-gradient-to-br from-card to-muted/30 border-primary/10 hover:shadow-xl hover:border-primary/30 transition-all duration-300 group hover:-translate-y-2">
                  <CardHeader>
                    <CardTitle className="text-5xl font-bold text-primary">{metric.value}</CardTitle>
                    <CardDescription className="text-lg text-foreground/80 font-medium">
                      {metric.label}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{metric.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Modules Section */}
        <section className="py-20 bg-gradient-to-br from-muted/50 to-background">
          <div className="container px-4">
            <div className="text-center mb-16">
              <div className="inline-flex items-center px-4 py-2 mb-6 text-sm font-medium rounded-full bg-primary/10 text-primary">
                <Layers className="h-4 w-4 mr-2" />
                Módulos Especializados
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-primary">
                Tudo que seu escritório precisa em um só lugar
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Do primeiro contato com o cliente até o encerramento do caso, gerencie toda a operação jurídica.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {modules.map((module) => (
                <Card key={module.title} className="border-border/50 bg-card/70 backdrop-blur hover:border-primary/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl group">
                  <CardHeader>
                    <div className="p-4 rounded-xl bg-primary/10 w-fit mb-4 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                      <module.icon className="h-6 w-6 text-primary group-hover:text-white transition-colors" />
                    </div>
                    <CardTitle className="text-xl">{module.title}</CardTitle>
                    <CardDescription className="text-muted-foreground leading-relaxed">
                      {module.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {module.features.map((feature) => (
                        <div key={feature} className="flex items-start space-x-3">
                          <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-muted-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Differentials Section */}
        <section className="py-20 bg-background">
          <div className="container px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center px-4 py-2 mb-6 text-sm font-medium rounded-full bg-primary text-white">
                  <Scale className="h-4 w-4 mr-2" />
                  Por que escolher o Quantum
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6">
                  O único CRM feito{" "}
                  <span className="text-primary">por advogados, para advogados</span>
                </h2>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  Desenvolvido com base em mais de 10 anos de experiência em operações jurídicas,
                  nosso CRM entende as necessidades específicas de escritórios de advocacia.
                </p>
                <div className="space-y-6">
                  {differentials.map((item) => (
                    <Card key={item.title} className="border-primary/10 hover:border-primary/30 transition-all">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-xl bg-primary/10">
                            <item.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg mb-1">{item.title}</CardTitle>
                            <CardDescription className="text-muted-foreground leading-relaxed">
                              {item.description}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
              <Card className="bg-gradient-hero text-white border-0 shadow-2xl">
                <CardContent className="p-8 space-y-6">
                  <h3 className="text-2xl font-semibold">Comece agora mesmo</h3>
                  <p className="text-white/80">
                    Experimente gratuitamente por 14 dias e comprove os resultados.
                    Sem compromisso, sem cartão de crédito.
                  </p>
                  <ul className="space-y-3 text-white/80 text-sm">
                    <li className="flex items-start space-x-3">
                      <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span>Acesso completo a todos os módulos</span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span>Suporte especializado em operações jurídicas</span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span>Importação de dados de outros sistemas</span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span>Templates de documentos prontos para uso</span>
                    </li>
                  </ul>
                  <div className="flex flex-col gap-3 pt-4">
                    <Button
                      size="lg"
                      variant="hero_primary"
                      className="w-full font-semibold"
                      onClick={() => navigate(routes.register)}
                    >
                      Criar conta gratuita
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                    <Button
                      size="lg"
                      variant="hero_secondary"
                      className="w-full"
                      onClick={handleWhatsappClick}
                    >
                      Falar pelo WhatsApp
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Plans Section */}
        <section id="planos" className="relative overflow-hidden py-24 bg-gradient-to-br from-background via-muted/30 to-background">
          <div className="absolute inset-0 opacity-60">
            <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          </div>
          <div className="container relative z-10 px-4">
            <div className="text-center mb-16 space-y-6">
              <div className="inline-flex items-center px-5 py-2 text-sm font-semibold tracking-wide uppercase rounded-full border border-primary/30 bg-background/80 backdrop-blur">
                <Layers className="h-4 w-4 mr-2 text-primary" />
                Planos e Preços
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-primary">
                Escolha o plano ideal para seu escritório
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Comece com 14 dias grátis em qualquer plano. Escale conforme sua necessidade.
              </p>
            </div>

            {isPlansLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Card key={`plan-skeleton-${index}`} className="border-primary/10 bg-background/50">
                    <CardHeader className="space-y-3">
                      <Skeleton className="h-6 w-1/2" />
                      <Skeleton className="h-5 w-1/3" />
                      <Skeleton className="h-20 w-full" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-10 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : plansError ? (
              <Card className="border-destructive/30 bg-destructive/10 text-destructive">
                <CardHeader>
                  <CardTitle className="text-xl">Planos indisponíveis</CardTitle>
                  <CardDescription className="text-sm text-destructive">{plansError}</CardDescription>
                </CardHeader>
              </Card>
            ) : normalizedPlans.length > 0 ? (
              <Carousel className="relative">
                <CarouselContent>
                  {normalizedPlans.map((plan) => {
                    const normalizedName = plan.option.name ?? "custom";
                    const planInitial = normalizedName.charAt(0).toUpperCase();
                    return (
                      <CarouselItem key={plan.option.id} className="md:basis-1/2 lg:basis-1/3">
                        <Card
                          className={`group relative flex h-full flex-col overflow-hidden border border-border/50 bg-card/80 backdrop-blur transition-all duration-300 hover:-translate-y-2 hover:border-primary/50 hover:shadow-xl ${plan.featured ? "shadow-lg border-primary/30" : ""
                            }`}
                        >
                          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-primary/60" />
                          {plan.featured && (
                            <div className="absolute top-6 right-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-lg">
                              Mais escolhido
                            </div>
                          )}
                          <CardHeader className="space-y-5 pt-10">
                            <div className="space-y-3">
                              <CardTitle className="text-2xl flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                                  {planInitial}
                                </span>
                                {plan.option.name}
                              </CardTitle>
                              {plan.option.description && (
                                <CardDescription className="text-muted-foreground leading-relaxed">
                                  {plan.option.description}
                                </CardDescription>
                              )}
                            </div>
                            <div className="space-y-2">
                              {plan.monthlyLabel && (
                                <div className="flex items-baseline gap-2">
                                  <span className="text-4xl font-bold text-primary">
                                    {plan.monthlyLabel}
                                  </span>
                                  <span className="text-sm text-muted-foreground">/mês</span>
                                </div>
                              )}
                              {plan.annualLabel && (
                                <p className="text-sm text-muted-foreground">
                                  Pagamento anual: {plan.annualLabel} / ano
                                </p>
                              )}
                              {!plan.monthlyLabel && !plan.annualLabel && (
                                <p className="text-sm text-muted-foreground">Investimento sob consulta.</p>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="flex-1 space-y-4">
                            <div className="rounded-lg border border-border/30 bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
                              Inicie agora com 14 dias de acesso completo, templates prontos e suporte especializado.
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                              Cancele quando quiser durante o período de testes.
                            </div>
                          </CardContent>
                          <CardFooter className="mt-auto flex flex-col gap-3">
                            <Button asChild size="lg" className="w-full">
                              <Link
                                to={`${routes.register}?plan=${plan.option.id}`}
                                className="flex items-center justify-center gap-2"
                              >
                                Começar agora
                                <ArrowRight className="h-4 w-4" />
                              </Link>
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
            ) : (
              <Card className="relative overflow-hidden border-primary/20 bg-background/80 backdrop-blur">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-primary/60" />
                <CardHeader>
                  <CardTitle className="text-xl">Planos sob medida</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    Converse com nossos especialistas para receber uma proposta personalizada.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild size="lg">
                    <Link to={routes.register} className="flex items-center justify-center gap-2">
                      Falar com especialista
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {/* Final CTA Section */}
        <section id="contato" className="py-20 bg-gradient-to-br from-muted/50 via-background to-background">
          <div className="container px-4">
            <Card className="bg-gradient-hero text-white border-0 shadow-2xl max-w-5xl mx-auto overflow-hidden relative">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
              <CardContent className="p-12 text-center space-y-8 relative z-10">
                <h3 className="text-3xl md:text-4xl font-bold">
                  Pronto para transformar seu escritório?
                </h3>
                <p className="text-xl text-white/90 max-w-3xl mx-auto leading-relaxed">
                  Junte-se a centenas de escritórios que já utilizam a plataforma Quantum para
                  aumentar produtividade, organizar processos e conquistar mais clientes.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Button
                    size="lg"
                    variant="hero_primary"
                    className="font-semibold h-14 px-8"
                    onClick={() => navigate(routes.register)}
                  >
                    Começar Grátis por 14 dias
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                  <Button
                    size="lg"
                    variant="hero_secondary"
                    className="font-semibold h-14 px-8"
                    onClick={handleWhatsappClick}
                  >
                    Falar no WhatsApp
                  </Button>
                </div>
                <p className="text-sm text-white/70">
                  Sem cartão de crédito • Setup em minutos • Suporte incluso
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
