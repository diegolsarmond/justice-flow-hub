import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Check, Star } from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious
} from "@/components/ui/carousel";
import { plans as localPlans, Plan as LocalPlan } from "@/data/plans";
import { useAuth } from "@/features/auth/AuthProvider";
import { routes } from "@/config/routes";
import { fetchPlanOptions, type PlanOption } from "@/features/plans/api";

// Helper para combinar dados da API com dados locais (features, popularidade)
const mergePlanData = (apiPlan: PlanOption, localPlans: LocalPlan[]) => {
  const normalizedName = apiPlan.name.trim().toLowerCase();
  const match = localPlans.find(
    (lp) => lp.name.trim().toLowerCase() === normalizedName
  );

  // Usa recursos incluídos da API se disponível, senão fallback para dados locais
  const featuresFromApi = apiPlan.includedResources
    ? apiPlan.includedResources
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
    : null;

  const defaultFeatures = [
    "Acesso completo ao sistema",
    "Suporte especializado",
    "Atualizações constantes",
    "Segurança de dados"
  ];

  return {
    ...apiPlan,
    features: featuresFromApi && featuresFromApi.length > 0
      ? featuresFromApi
      : match?.features || defaultFeatures,
    popular: match?.popular || false,
    description: apiPlan.description || match?.description || "Plano ideal para sua advocacia",
    localId: match?.id // Mantém ID local se existir para facilitar checkout legado se necessário
  };
};

const Plans = () => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [loading, setLoading] = useState(true);
  const [displayPlans, setDisplayPlans] = useState<ReturnType<typeof mergePlanData>[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    let mounted = true;
    const loadPlans = async () => {
      try {
        const apiOptions = await fetchPlanOptions();
        if (mounted) {
          const merged = apiOptions.map(p => mergePlanData(p, localPlans));
          // Ordenar por preço
          merged.sort((a, b) => (a.monthlyPrice || 0) - (b.monthlyPrice || 0));
          setDisplayPlans(merged);
        }
      } catch (error) {
        console.error("Failed to load plans", error);
        // Fallback para planos locais se API falhar, formatando para parecer com API
        if (mounted) {
          const fallback = localPlans.map(lp => ({
            id: -1, // ID fictício
            name: lp.name,
            description: lp.description,
            monthlyPrice: lp.monthlyPrice,
            annualPrice: lp.yearlyPrice,
            features: lp.features,
            popular: lp.popular,
            localId: lp.id
          }));
          setDisplayPlans(fallback as any);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadPlans();
    return () => { mounted = false; };
  }, []);

  const handleSelectPlan = (plan: typeof displayPlans[0]) => {
    // Se temos um plano da API, usamos o ID dele. Se for fallback, usamos localId se possível
    // Para checkout público, normalmente passamos o ID do plano ou nome.
    // O checkout espera 'plan' query param. Se for sistema legado, pode esperar string 'starter'.
    // Mas o user pediu "planos do sistema", então o ID numérico é o correto para integração real.
    // Vamos passar o ID numérico se > 0, senão o localId string.

    const planIdentifier = plan.id > 0 ? plan.id : plan.localId;
    const checkoutPath = `${routes.checkout}?plan=${encodeURIComponent(String(planIdentifier))}&cycle=${billingCycle}`;
    navigate(checkoutPath);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/20">
      <TypebotBubble />
      <Header />

      <main className="flex-1 relative">
        {/* Hero Section with Gradient */}
        <section className="relative overflow-hidden bg-gradient-hero text-white py-20">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-400/30 blur-3xl rounded-full animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-cyan-400/20 blur-3xl rounded-full"></div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center max-w-4xl mx-auto space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                <span className="flex h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
                <span className="text-sm font-medium text-white/90">14 dias grátis em qualquer plano</span>
              </div>

              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
                Escolha o plano ideal para{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-cyan-200">
                  escalar sua advocacia
                </span>
              </h1>

              <p className="text-xl md:text-2xl text-blue-100/90 leading-relaxed max-w-2xl mx-auto">
                Tecnologia de ponta acessível para escritórios de todos os tamanhos.
                Comece agora e transforme sua rotina jurídica.
              </p>

              <div className="flex flex-col items-center gap-4 pt-8">
                <p className="text-sm text-white/70 font-medium">Escolha o período de cobrança:</p>
                <div className="inline-flex p-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full relative shadow-lg">
                  <div
                    className={`absolute w-1/2 h-[calc(100%-12px)] top-1.5 rounded-full transition-all duration-300 ease-in-out ${billingCycle === "monthly"
                      ? "bg-white/20 shadow-md left-1.5"
                      : "bg-white shadow-lg left-[calc(50%-3px)]"
                      }`}
                  />
                  <button
                    onClick={() => setBillingCycle("monthly")}
                    className={`relative z-10 px-10 py-3 text-sm font-semibold rounded-full transition-all duration-200 ${billingCycle === "monthly"
                      ? "text-white"
                      : "text-white/60 hover:text-white"
                      }`}
                  >
                    Mensal
                  </button>
                  <button
                    onClick={() => setBillingCycle("yearly")}
                    className={`relative z-10 px-10 py-3 text-sm font-semibold rounded-full transition-all duration-200 flex items-center gap-2 ${billingCycle === "yearly"
                      ? "text-primary"
                      : "text-white/60 hover:text-white"
                      }`}
                  >
                    Anual
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full transition-all ${billingCycle === "yearly"
                      ? "bg-green-500 text-white"
                      : "bg-green-500/20 text-green-300"
                      }`}>
                      -20%
                    </span>
                  </button>
                </div>
                {billingCycle === "yearly" && (
                  <p className="text-sm text-green-300 font-medium animate-in fade-in slide-in-from-bottom-2">
                    🎉 Você está economizando 20% com o plano anual!
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Plans Section */}
        <section className="py-20 bg-gradient-to-b from-background to-muted/30">
          <div className="container mx-auto px-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground animate-pulse">Carregando planos disponíveis...</p>
              </div>
            ) : (
              <div className="max-w-7xl mx-auto">
                <Carousel
                  opts={{
                    align: "start",
                    loop: true,
                  }}
                  className="w-full"
                >
                  <CarouselContent className="-ml-2 md:-ml-4">
                    {displayPlans.map((plan, idx) => {
                      const price = billingCycle === "monthly" ? plan.monthlyPrice : plan.annualPrice;
                      const visualPrice = billingCycle === "monthly"
                        ? plan.monthlyPrice
                        : (plan.annualPrice ? plan.annualPrice / 12 : 0);

                      const isPopular = plan.popular;

                      return (
                        <CarouselItem key={plan.id} className="pl-2 md:pl-4 md:basis-1/2 lg:basis-1/3">
                          <div
                            className={`group relative flex flex-col bg-card rounded-3xl p-8 transition-all duration-300 border h-full ${isPopular
                              ? "border-primary shadow-2xl shadow-primary/20 ring-2 ring-primary/20"
                              : "border-border/50 hover:border-primary/30 hover:shadow-xl hover:-translate-y-2"
                              }`}
                          >
                            {isPopular && (
                              <div className="absolute -top-5 left-0 right-0 mx-auto w-fit">
                                <div className="bg-gradient-to-r from-primary to-cyan-600 text-white text-xs font-bold uppercase tracking-wide py-1.5 px-4 rounded-full shadow-lg flex items-center gap-1.5">
                                  <Star className="w-3.5 h-3.5 fill-current" />
                                  Mais Escolhido
                                </div>
                              </div>
                            )}

                            <div className="mb-6 p-5 bg-gradient-to-br from-muted/50 to-muted/30 rounded-2xl border border-border/30">
                              <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
                              <p className="text-muted-foreground text-sm line-clamp-2">{plan.description}</p>
                            </div>

                            <div className="mb-6">
                              <div className="flex items-baseline gap-1">
                                <span className="text-lg font-medium text-muted-foreground">R$</span>
                                <span className="text-5xl font-bold tracking-tight text-foreground">
                                  {visualPrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span className="text-muted-foreground font-medium">/mês</span>
                              </div>
                              {billingCycle === "yearly" && (
                                <p className="text-xs text-muted-foreground mt-2 font-medium">
                                  Faturado anualmente em R$ {plan.annualPrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              )}
                            </div>

                            <ul className="space-y-3 mb-8 flex-1">
                              {plan.features.map((feature, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                                  <div className="mt-0.5 rounded-full p-1 bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                    <Check className="w-3 h-3" strokeWidth={3} />
                                  </div>
                                  {feature}
                                </li>
                              ))}
                            </ul>

                            <Button
                              onClick={() => handleSelectPlan(plan)}
                              className={`w-full h-12 rounded-xl text-base font-semibold transition-all ${isPopular
                                ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5"
                                : "bg-card dark:bg-muted border-2 border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40"
                                }`}
                            >
                              Começar Agora
                            </Button>
                          </div>
                        </CarouselItem>
                      );
                    })}
                  </CarouselContent>
                  <CarouselPrevious className="hidden md:flex -left-12" />
                  <CarouselNext className="hidden md:flex -right-12" />
                </Carousel>
              </div>
            )}

            {/* Custom Plan CTA */}
            <div className="mt-20 text-center max-w-3xl mx-auto">
              <Card className="bg-gradient-to-br from-card to-muted/50 border-border/50 p-8 md:p-12 rounded-3xl">
                <h4 className="text-2xl font-bold mb-3">Precisa de um plano personalizado?</h4>
                <p className="text-muted-foreground mb-8 text-lg">
                  Para grandes escritórios ou demandas específicas, nossa equipe comercial pode montar uma proposta sob medida.
                </p>
                <Button variant="outline" onClick={() => navigate("/contact")} className="rounded-full px-8 h-12 text-base font-semibold">
                  Falar com Consultor
                </Button>
              </Card>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Plans;
