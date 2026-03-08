import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Pricing, { type PricingPlan } from "@/components/Pricing";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import { getApiUrl } from "@/lib/api";
import {
    ArrowRight,
    BarChart3,
    Building2,
    Check,
    FileText,
    Layers,
    MessageSquare,
    Shield,
    Users,
    Workflow,
    Zap,
    Scale,
    Sparkle,
    CheckCircle2
} from "lucide-react";

// Optional helper types and functions (unused but kept for future extension)
type GtagFunction = (...args: unknown[]) => void;

interface PlanoDisponivel {
    id: number;
    nome: string;
    ativo: boolean;
    descricao: string | null;
    recursos: string[];
    valorMensal: number | null;
    valorAnual: number | null;
    precoMensal: string | null;
    precoAnual: string | null;
    descontoAnualPercentual: number | null;
    economiaAnualFormatada: string | null;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
});

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

function parseBooleanFlag(value: unknown): boolean | null {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        return Number.isFinite(value) ? value !== 0 : null;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
            return null;
        }
        if (["1", "true", "sim", "yes", "y", "ativo"].includes(normalized)) {
            return true;
        }
        if (["0", "false", "nao", "não", "no", "n", "inativo"].includes(normalized)) {
            return false;
        }
    }

    return null;
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

// Este helper captura a função gtag, caso esteja disponível no navegador.
const getGtag = (): GtagFunction | undefined => {
    if (typeof window === "undefined") {
        return undefined;
    }
    return (window as typeof window & { gtag?: GtagFunction }).gtag;
};

const CRM = () => {
    // Títulos e textos do cabeçalho configurados para serem claros e convidativos
    const heroLabel = "Suíte Completa de CRM Quantum Jud";
    const heroHeadline = "Gerencie seus clientes de forma simples e eficiente";
    const heroDescription =
        "Centralize suas interações, automatize tarefas repetitivas e acompanhe suas vendas em uma plataforma fácil de usar.";

    // Lista de recursos apresentados de forma simples e acessível
    const generalFeatures = useMemo(
        () => [
            {
                icon: Zap,
                title: "Automação de Tarefas",
                description:
                    "Deixe o sistema cuidar de cadastros, lembretes e atualizações automaticamente.",
            },
            {
                icon: MessageSquare,
                title: "Centralização de Contatos",
                description:
                    "Converse com clientes por e-mail, WhatsApp e telefone em um só lugar.",
            },
            {
                icon: BarChart3,
                title: "Relatórios Claros",
                description:
                    "Visualize indicadores de desempenho em relatórios simples e intuitivos.",
            },
            {
                icon: Shield,
                title: "Segurança e Privacidade",
                description:
                    "Seus dados protegidos com criptografia e controle de acesso.",
            },
            {
                icon: FileText,
                title: "Gestão de Documentos",
                description:
                    "Organize contratos, processos e arquivos de forma prática.",
            },
            {
                icon: Workflow,
                title: "Integração Fácil",
                description:
                    "Conecte o CRM com outros sistemas e aplicativos do seu negócio.",
            },
        ],
        [],
    );

    // Como estamos usando dados mockados, as features são estáticas
    const featureCards = useMemo(() => generalFeatures, [generalFeatures]);

    // Segmentos atendidos com exemplos e destaques
    const industries = [
        {
            icon: Scale,
            title: "Advocacia",
            description: "Gestão completa de processos, prazos e relacionamento com clientes e correspondentes.",
            highlights: ["Integração com tribunais", "Automação de prazos", "Geração de peças e contratos"],
        },
        {
            icon: Building2,
            title: "Mercado Imobiliário",
            description: "Gestão de funil de vendas, propostas e pós-venda para construtoras e imobiliárias.",
            highlights: ["Integração com portais", "Controle de documentos", "Follow-up automático"],
        },
    ];

    // Diferenciais específicos para escritórios de advocacia
    const lawDifferentials = [
        {
            icon: Users,
            title: "Gestão de Clientes e Casos",
            description: "Dossiês completos com histórico de atendimento, honorários e documentos vinculados.",
        },
        {
            icon: FileText,
            title: "Automação de Peças",
            description: "Modelos inteligentes que preenchem dados de processos e geram peças em poucos cliques.",
        },
        {
            icon: Workflow,
            title: "Fluxos de Prazos",
            description: "Alertas automáticos e redistribuição de tarefas conforme SLA e especialidade jurídica.",
        },
        {
            icon: Layers,
            title: "Controle Financeiro",
            description: "Painéis de receitas recorrentes, adiantamentos e divisão de honorários por sócio.",
        },
    ];

    const successMetrics = [
        "Redução média de 45% no tempo de atualização de processos",
        "Aumento de 60% na taxa de conversão de leads jurídicos",
        "Visão 360º da carteira com relatórios executivos semanais",
        "Suporte especializado com onboarding em até 14 dias",
    ];

    const includedInAllPlans = [
        {
            icon: Sparkle,
            title: "Onboarding estratégico guiado",
            description: "Migração assistida, parametrização de fluxos e acompanhamento dedicado durante os primeiros 90 dias.",
        },
        {
            icon: MessageSquare,
            title: "Suporte humano multicanal",
            description: "Especialistas disponíveis por WhatsApp, chat e e-mail com SLA de respostas em minutos.",
        },
        {
            icon: Shield,
            title: "Segurança jurídica e LGPD",
            description: "Criptografia de ponta a ponta, trilhas de auditoria e hospedagem em nuvem certificada no Brasil.",
        },
        {
            icon: BarChart3,
            title: "Dashboards executivos",
            description: "Painéis personalizados com previsibilidade de receitas, produtividade e margens por unidade de negócio.",
        },
    ];

    const [planosDisponiveis, setPlanosDisponiveis] = useState<PlanoDisponivel[]>([]);
    const [planosLoading, setPlanosLoading] = useState(true);
    const [planosError, setPlanosError] = useState<string | null>(null);

    useEffect(() => {
        let disposed = false;
        const controller = new AbortController();

        const loadPlans = async () => {
            setPlanosLoading(true);
            setPlanosError(null);

            try {
                const response = await fetch(getApiUrl("planos"), {
                    headers: { Accept: "application/json" },
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Falha ao carregar planos (HTTP ${response.status})`);
                }

                const payload = await response.json();
                const rows = normalizeApiRows(payload);
                const parsed = rows
                    .map((entry) => {
                        if (!entry || typeof entry !== "object") {
                            return null;
                        }

                        const record = entry as Record<string, unknown>;
                        const id = toNumber(record["id"]);
                        if (id === null) {
                            return null;
                        }

                        const nomeCandidate = typeof record["nome"] === "string" ? record["nome"].trim() : null;
                        const ativo = parseBooleanFlag(record["ativo"]) ?? true;
                        const descricaoRaw =
                            typeof record["descricao"] === "string"
                                ? record["descricao"].trim()
                                : typeof record["detalhes"] === "string"
                                    ? record["detalhes"].trim()
                                    : null;
                        const recursos = parseRecursos([
                            record["recursos"],
                            record["recursosDisponiveis"],
                            record["recursos_disponiveis"],
                            record["features"],
                            record["items"],
                            record["modules"],
                            record["modulos"],
                        ]);

                        const rawValorMensal =
                            (record["valor_mensal"] ??
                                record["valorMensal"] ??
                                record["preco_mensal"] ??
                                record["precoMensal"]) as unknown;
                        const rawValorAnual =
                            (record["valor_anual"] ??
                                record["valorAnual"] ??
                                record["preco_anual"] ??
                                record["precoAnual"]) as unknown;

                        const valorMensal = toNumber(rawValorMensal);
                        const valorAnual = toNumber(rawValorAnual);
                        const pricing = computePricingDetails(valorMensal, valorAnual);

                        const precoMensal =
                            pricing.precoMensal ??
                            (typeof rawValorMensal === "string" && rawValorMensal.trim() ? rawValorMensal.trim() : null);
                        const precoAnual =
                            pricing.precoAnual ??
                            (typeof rawValorAnual === "string" && rawValorAnual.trim() ? rawValorAnual.trim() : null);

                        return {
                            id,
                            nome: nomeCandidate && nomeCandidate.length > 0 ? nomeCandidate : `Plano ${id}`,
                            ativo,
                            descricao: descricaoRaw && descricaoRaw.length > 0 ? descricaoRaw : null,
                            recursos,
                            valorMensal,
                            valorAnual,
                            precoMensal,
                            precoAnual,
                            descontoAnualPercentual: pricing.descontoPercentual,
                            economiaAnualFormatada: pricing.economiaAnualFormatada,
                        } satisfies PlanoDisponivel;
                    })
                    .filter((item): item is PlanoDisponivel => item !== null);

                if (!disposed) {
                    setPlanosDisponiveis(parsed);
                }
            } catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") {
                    return;
                }
                console.error(error);
                if (!disposed) {
                    setPlanosError("Não foi possível carregar os planos disponíveis no momento.");
                    setPlanosDisponiveis([]);
                }
            } finally {
                if (!disposed) {
                    setPlanosLoading(false);
                }
            }
        };

        void loadPlans();

        return () => {
            disposed = true;
            controller.abort();
        };
    }, []);

    const planosAtivos = useMemo(() => planosDisponiveis.filter((plan) => plan.ativo), [planosDisponiveis]);

    const planosOrdenados = useMemo(() => {
        if (planosAtivos.length === 0) {
            return [];
        }

        return [...planosAtivos].sort((a, b) => {
            const valorA = a.valorMensal ?? (a.valorAnual !== null ? a.valorAnual / 12 : Number.POSITIVE_INFINITY);
            const valorB = b.valorMensal ?? (b.valorAnual !== null ? b.valorAnual / 12 : Number.POSITIVE_INFINITY);
            return valorA - valorB;
        });
    }, [planosAtivos]);

    const destaquePlanoId = useMemo(() => {
        if (planosOrdenados.length === 0) {
            return null;
        }

        const destaque = planosOrdenados.reduce((acc, plan) => {
            const accValor = acc.valorMensal ?? (acc.valorAnual !== null ? acc.valorAnual / 12 : 0);
            const planValor = plan.valorMensal ?? (plan.valorAnual !== null ? plan.valorAnual / 12 : 0);
            return planValor > accValor ? plan : acc;
        }, planosOrdenados[0]);

        return destaque.id;
    }, [planosOrdenados]);

    const pricingPlans = useMemo<PricingPlan[]>(() => {
        return planosOrdenados.map((plan) => {
            const price = plan.precoMensal ?? (plan.valorMensal !== null ? currencyFormatter.format(plan.valorMensal) : null);
            const yearlyPrice = plan.precoAnual ?? (plan.valorAnual !== null ? currencyFormatter.format(plan.valorAnual) : null);

            return {
                name: plan.nome,
                price,
                yearlyPrice,
                period: price ? "mês" : "ano",
                features: plan.recursos,
                description: plan.descricao,
                buttonText: "Solicitar proposta",
                href: "#contato",
                isPopular: destaquePlanoId === plan.id,
            } as PricingPlan;
        });
    }, [destaquePlanoId, planosOrdenados]);

    const handleDemoClick = (source: string) => {
        const gtag = getGtag();
        gtag?.("event", "crm_demo_click", {
            service: "crm",
            source,
        });
        document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" });
    };

    const handleWhatsappClick = (source: string) => {
        const gtag = getGtag();
        gtag?.("event", "crm_whatsapp_click", {
            service: "crm",
            source,
        });
        window.open("https://wa.me/553193054200?text=Olá! Gostaria de saber mais sobre a suíte de CRMs do Quantum Jud.", "_blank");
    };

    return (
        <div className="min-h-screen bg-background">
            <TypebotBubble />
            <Header />

            {/* Hero Section */}
            <section className="relative overflow-hidden bg-primary pt-32 pb-24 lg:pt-40 lg:pb-32">
                {/* Abstract Shapes */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400 rounded-full blur-[120px] opacity-20 animate-pulse"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-400 rounded-full blur-[120px] opacity-20 animate-pulse delay-1000"></div>
                </div>

                <div className="container px-4 relative z-10">
                    <div className="max-w-5xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-md mb-8 shadow-lg">
                            <Sparkle className="h-4 w-4 text-cyan-200" />
                            <span className="tracking-wide">{heroLabel}</span>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight tracking-tight text-white">
                            {heroHeadline}
                        </h1>

                        <p className="text-lg md:text-xl mb-12 text-blue-100/90 max-w-3xl mx-auto leading-relaxed">
                            {heroDescription}
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto">
                            <Button
                                size="lg"
                                className="bg-white text-primary hover:bg-white/90 font-semibold h-14 px-8 text-lg rounded-full shadow-xl shadow-blue-900/20 transition-all hover:scale-105"
                                onClick={() => handleDemoClick("hero")}
                            >
                                Solicitar Demonstração
                                <ArrowRight className="h-5 w-5 ml-2" />
                            </Button>
                            <Button
                                variant="outline"
                                size="lg"
                                className="border-white/30 text-white hover:bg-white/10 font-semibold h-14 px-8 text-lg rounded-full backdrop-blur-sm"
                                onClick={() => handleWhatsappClick("hero")}
                            >
                                Falar no WhatsApp
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* General Features */}
            <section className="py-24 bg-background">
                <div className="container px-4">
                    <div className="text-center mb-16 max-w-3xl mx-auto">
                        <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                            Recursos que Potencializam seu Time
                        </h2>
                        <p className="text-xl text-muted-foreground">
                            Operações modernas precisam de automação, dados confiáveis e atendimento conectado. Nossa suíte de CRM entrega isso desde o primeiro dia.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {featureCards.map((feature, index) => (
                            <Card
                                key={feature.title + index}
                                className="group bg-card border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                                style={{ animationDelay: `${index * 0.1}s` }}
                            >
                                <CardHeader>
                                    <div className="p-3.5 rounded-xl bg-primary/10 w-fit mb-4 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                                        <feature.icon className="h-6 w-6 text-primary group-hover:text-white transition-colors" />
                                    </div>
                                    <CardTitle className="text-xl font-bold">
                                        {feature.title}
                                    </CardTitle>
                                    <CardDescription className="text-base mt-2 leading-relaxed">
                                        {feature.description}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Industries Section */}
            <section className="py-24 bg-muted/30">
                <div className="container px-4">
                    <div className="text-center mb-16 max-w-3xl mx-auto">
                        <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                            Especializado em Segmentos Estratégicos
                        </h2>
                        <p className="text-xl text-muted-foreground">
                            Operações jurídicas e imobiliárias contam com fluxos prontos, integrações profundas e relatórios sob medida para
                            acelerar resultados desde o primeiro mês.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {industries.map((industry) => (
                            <Card
                                key={industry.title}
                                className="group bg-card border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                            >
                                <CardHeader>
                                    <div className="p-3.5 rounded-xl bg-primary/10 w-fit mb-4 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                                        <industry.icon className="h-6 w-6 text-primary group-hover:text-white transition-colors" />
                                    </div>
                                    <CardTitle className="text-2xl font-bold">{industry.title}</CardTitle>
                                    <CardDescription className="text-base mt-2">
                                        {industry.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {industry.highlights.map((item) => (
                                            <div key={item} className="flex items-start space-x-3 text-sm text-foreground/80">
                                                <div className="p-0.5 rounded-full bg-primary/10 text-primary mt-0.5">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </div>
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Highlight Section for Legal CRM */}
            <section className="py-24 bg-background relative overflow-hidden">
                <div className="container px-4 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-8">
                                <Scale className="h-4 w-4" />
                                <span>CRM para Escritórios de Advocacia</span>
                            </div>
                            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                                Especialistas em Gestão Jurídica Digital
                            </h2>
                            <p className="text-lg text-muted-foreground mb-12">
                                Com mais de uma década acompanhando escritórios de diferentes portes, desenvolvemos um CRM que une gestão de processos, atendimento consultivo e inteligência financeira em uma única plataforma.
                            </p>
                            <div className="space-y-12 mb-12">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {lawDifferentials.map((item) => (
                                        <Card key={item.title} className="bg-card border-border/50 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1">
                                            <CardHeader className="pb-3">
                                                <div className="p-2.5 rounded-lg bg-primary/10 w-fit mb-3">
                                                    <item.icon className="h-5 w-5 text-primary" />
                                                </div>
                                                <CardTitle className="text-lg font-bold">{item.title}</CardTitle>
                                                <CardDescription className="text-muted-foreground text-sm mt-1">{item.description}</CardDescription>
                                            </CardHeader>
                                        </Card>
                                    ))}
                                </div>

                                <div className="space-y-8">

                                    <div className="space-y-4">
                                        <span className="text-primary font-semibold text-sm uppercase tracking-wider">
                                            Planos Quantum
                                        </span>
                                        <h3 className="text-3xl font-bold text-foreground">
                                            Planos que evoluem com o seu escritório
                                        </h3>
                                        <p className="text-base text-muted-foreground">
                                            Compare modalidades, desbloqueie funcionalidades avançadas e garanta que cada etapa da operação jurídica esteja coberta com automação, inteligência e atendimento consultivo.
                                        </p>
                                    </div>

                                    <div className="space-y-6">
                                        {planosLoading ? (
                                            <Card className="border-border/50 bg-card/70 backdrop-blur">
                                                <CardContent className="flex items-center justify-center p-8">
                                                    <div className="flex items-center gap-2 text-primary">
                                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                                                        <p className="text-sm font-medium">Carregando opções de planos...</p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ) : planosError ? (
                                            <Card className="border-destructive/40 bg-destructive/5">
                                                <CardContent className="space-y-4 p-6">
                                                    <p className="text-sm text-destructive">{planosError}</p>
                                                    <div className="flex flex-wrap gap-3">
                                                        <Button
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                            onClick={() => handleDemoClick("planos_erro")}
                                                        >
                                                            Solicitar atendimento
                                                            <ArrowRight className="h-5 w-5 ml-2" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            className="border-destructive/30 text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleWhatsappClick("planos_erro")}
                                                        >
                                                            Falar no WhatsApp
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ) : planosOrdenados.length > 0 ? (
                                            <Pricing
                                                plans={pricingPlans}
                                            />
                                        ) : (
                                            <Card className="border-dashed border-border/50 bg-card/60 backdrop-blur">
                                                <CardContent className="p-6 space-y-4">
                                                    <p className="text-sm text-muted-foreground">
                                                        Nenhum plano disponível no momento. Entre em contato para receber uma proposta personalizada.
                                                    </p>
                                                    <div className="flex flex-wrap gap-3">
                                                        <Button
                                                            className="bg-primary text-white hover:bg-primary/90"
                                                            onClick={() => handleDemoClick("planos_vazios")}
                                                        >
                                                            Solicitar atendimento
                                                            <ArrowRight className="h-5 w-5 ml-2" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            onClick={() => handleWhatsappClick("planos_vazios")}
                                                        >
                                                            Falar no WhatsApp
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}

                                        <div className="rounded-3xl border border-border/50 bg-card/70 p-6 shadow-sm">
                                            <div className="mb-6 flex items-center gap-3">
                                                <div className="rounded-full bg-primary/10 p-3 text-primary">
                                                    <Layers className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">Tudo incluso</p>
                                                    <h4 className="text-lg font-bold text-foreground">Recursos presentes em todos os planos</h4>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {includedInAllPlans.map((item) => (
                                                    <div
                                                        key={item.title}
                                                        className="group flex items-start gap-3 rounded-2xl border border-transparent bg-muted/40 p-4 transition-all duration-300 hover:border-primary/20 hover:bg-primary/5"
                                                    >
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary shadow-sm transition-transform duration-300 group-hover:scale-105">
                                                            <item.icon className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-foreground text-sm">{item.title}</p>
                                                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            <div className="flex flex-wrap gap-4">
                                <Button size="lg" className="bg-primary text-white hover:bg-primary/90 h-14 px-8 rounded-full shadow-lg" onClick={() => handleDemoClick("legal_section")}>
                                    Solicitar Demonstração
                                    <ArrowRight className="h-5 w-5 ml-2" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="h-14 px-8 rounded-full"
                                    onClick={() => handleWhatsappClick("legal_section")}
                                >
                                    Falar no WhatsApp
                                </Button>
                                <Button variant="ghost" size="lg" className="h-14 px-8 rounded-full hover:bg-primary/5 text-primary" asChild>
                                    <a href="/produtos/crm-advocacia">CRM Advocacia <ArrowRight className="ml-2 h-4 w-4" /></a>
                                </Button>
                            </div>
                        </div>

                        <div className="sticky top-24">
                            <Card className="bg-primary text-white border-0 shadow-2xl overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                                <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl -ml-12 -mb-12"></div>
                                <CardContent className="p-10 relative z-10 space-y-8">
                                    <h3 className="text-2xl font-bold border-b border-white/20 pb-4">Principais ganhos para seu escritório</h3>
                                    <div className="space-y-6">
                                        {successMetrics.map((metric) => (
                                            <div key={metric} className="flex items-start space-x-4">
                                                <div className="p-1 rounded-full bg-white/20 text-white mt-0.5">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </div>
                                                <span className="text-blue-100 text-lg">{metric}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="rounded-xl bg-white/10 p-6 backdrop-blur-sm border border-white/10">
                                        <div className="flex items-center gap-3 mb-3 text-cyan-200">
                                            <Sparkle className="h-5 w-5" />
                                            <h4 className="text-lg font-bold">Implementação guiada</h4>
                                        </div>
                                        <p className="text-blue-50/90 leading-relaxed text-sm">
                                            Nossa equipe acompanha todas as etapas: migração de dados, personalização de fluxos, treinamento e indicadores estratégicos para a diretoria.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 bg-background">
                <div className="container px-4">
                    <Card className="bg-primary text-white border-0 shadow-2xl max-w-5xl mx-auto overflow-hidden relative">
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                        <div className="absolute -top-32 -left-32 w-80 h-80 bg-white/20 rounded-full blur-3xl"></div>
                        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-cyan-500/30 rounded-full blur-3xl"></div>
                        <CardContent className="p-12 md:p-16 text-center relative z-10 space-y-8">
                            <h3 className="text-3xl md:text-5xl font-bold tracking-tight">
                                Pronto para transformar a gestão de relacionamento?
                            </h3>
                            <p className="text-xl text-blue-100 mb-10 max-w-3xl mx-auto leading-relaxed">
                                Solicite uma demonstração personalizada e conheça na prática como o Quantum Jud pode conectar equipes, clientes e resultados.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Button
                                    size="xl"
                                    className="bg-white text-primary hover:bg-white/90 font-bold h-14 px-8 text-lg rounded-full shadow-lg"
                                    onClick={() => handleDemoClick("cta_section")}
                                >
                                    Solicitar Demonstração
                                    <ArrowRight className="h-5 w-5 ml-2" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="xl"
                                    className="bg-transparent border-white/30 text-white hover:bg-white/10 font-bold h-14 px-8 text-lg rounded-full"
                                    onClick={() => handleWhatsappClick("cta_section")}
                                >
                                    Falar no WhatsApp
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default CRM;
