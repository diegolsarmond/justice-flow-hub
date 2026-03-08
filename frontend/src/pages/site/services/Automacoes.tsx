import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Workflow, Timer, TrendingUp, ArrowRight, CheckCircle, Cog, Database } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import { getGtag } from "@/lib/gtag";
import { buildAppPath } from "@/config/app-config";

const Automacoes = () => {
    // Features fixos (mockados)
    const fallbackFeatures = useMemo(
        () => [
            {
                icon: Workflow,
                title: "Fluxos Inteligentes",
                description: "Criamos rotinas automáticas que fazem tarefas repetitivas de forma rápida e sem erro.",
            },
            {
                icon: Timer,
                title: "Mais Tempo Livre",
                description: "A automação cuida do operacional e libera sua equipe para atividades mais importantes.",
            },
            {
                icon: Database,
                title: "Integração Simples",
                description: "Conectamos diferentes sistemas para que trabalhem juntos sem complicação.",
            },
            {
                icon: TrendingUp,
                title: "Produtividade em Alta",
                description: "Sua operação ganha velocidade, reduz falhas e melhora a experiência do cliente.",
            },
            {
                icon: Cog,
                title: "Sob Medida",
                description: "Desenhamos soluções personalizadas que se encaixam na realidade da sua empresa.",
            },
        ],
        [],
    );

    const heroLabel = "Automações Empresariais";
    const heroHeadline = "Deixe a tecnologia trabalhar por você";
    const heroDescription =
        "Automação é como ter um time extra dentro da sua empresa, cuidando das tarefas repetitivas todos os dias. Você ganha eficiência, reduz custos e pode focar no crescimento do negócio.";

    const automationTypes = [
        {
            title: "Marketing",
            description: "Campanhas automáticas que falam com o cliente na hora certa.",
            benefits: ["Envio programado de e-mails", "Mensagens personalizadas", "Acompanhamento pós-venda", "Relatórios claros"],
        },
        {
            title: "Gestão de Leads",
            description: "Organize e distribua seus contatos automaticamente.",
            benefits: ["Classificação por prioridade", "Envio automático de conteúdos", "Distribuição entre vendedores", "Medição de resultados"],
        },
        {
            title: "Financeiro",
            description: "Cobranças, faturas e relatórios sem esforço manual.",
            benefits: ["Cobrança automática", "Conciliação bancária", "Alertas de inadimplência", "Redução de erros"],
        },
        {
            title: "Atendimento",
            description: "Automatize parte do suporte ao cliente e acelere respostas.",
            benefits: ["Respostas rápidas", "Triagem automática", "Escalonamento inteligente", "Histórico centralizado"],
        },
    ];

    const results = [
        "Redução de até 60% do tempo em tarefas repetitivas",
        "Aumento médio de 40% na produtividade da equipe",
        "Diminuição de 80% nos erros manuais",
        "Retorno sobre investimento em poucos meses",
        "Funcionários mais satisfeitos por focarem no estratégico",
        "Economia financeira significativa mês a mês",
    ];

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
                            <Settings className="h-4 w-4 text-cyan-200" />
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
                                onClick={() => {
                                    const gtag = getGtag();
                                    gtag?.("event", "automation_analysis_click", { service: "automacoes" });
                                    document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" });
                                }}
                            >
                                Solicitar Análise Gratuita
                                <ArrowRight className="h-5 w-5 ml-2" />
                            </Button>
                            <Button
                                variant="outline"
                                size="lg"
                                className="border-white/30 text-white hover:bg-white/10 font-semibold h-14 px-8 text-lg rounded-full backdrop-blur-sm"
                                onClick={() => {
                                    const gtag = getGtag();
                                    gtag?.("event", "whatsapp_click", { service: "automacoes" });
                                    window.open("https://wa.me/553193054200?text=Olá! Gostaria de saber mais sobre Automações Empresariais.", "_blank");
                                }}
                            >
                                Falar no WhatsApp
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-24 bg-background">
                <div className="container px-4">
                    <div className="text-center mb-16 max-w-3xl mx-auto">
                        <span className="text-primary font-semibold text-sm uppercase tracking-wider">Benefícios</span>
                        <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-6 text-foreground">
                            Como a Automação Ajuda sua Empresa
                        </h2>
                        <p className="text-xl text-muted-foreground">
                            A automação tira das suas mãos atividades que não precisam de esforço humano.
                            Assim, você e seu time podem focar em pensar no futuro e atender melhor os clientes.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {fallbackFeatures.map((feature, index) => (
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
                                    <CardDescription className="text-base mt-2 leading-relaxed">{feature.description}</CardDescription>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Automation Types Section */}
            <section className="py-24 bg-muted/30">
                <div className="container px-4">
                    <div className="text-center mb-16 max-w-3xl mx-auto">
                        <span className="text-primary font-semibold text-sm uppercase tracking-wider">Aplicações Reais</span>
                        <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-6 text-foreground">
                            Exemplos Práticos de Automação
                        </h2>
                        <p className="text-xl text-muted-foreground">
                            Veja onde a automação pode trazer resultado imediato para sua operação.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {automationTypes.map((type, index) => (
                            <Card key={index} className="group bg-card border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                                <CardHeader>
                                    <CardTitle className="text-2xl font-bold group-hover:text-primary transition-colors">
                                        {type.title}
                                    </CardTitle>
                                    <CardDescription className="text-base mt-2">{type.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ul className="grid sm:grid-cols-2 gap-3">
                                        {type.benefits.map((benefit, i) => (
                                            <li key={i} className="flex items-center space-x-2 text-sm text-foreground/80">
                                                <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                                                <span>{benefit}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Results Section */}
            <section className="py-24 bg-background">
                <div className="container px-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <span className="text-primary font-semibold text-sm uppercase tracking-wider">Impacto</span>
                            <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-6 text-foreground">
                                Resultados que Fazem Diferença
                            </h2>
                            <p className="text-xl text-muted-foreground mb-10">
                                Empresas que adotam automação relatam economias reais e mais qualidade no dia a dia.
                            </p>
                            <div className="space-y-6">
                                {results.map((result, index) => (
                                    <div key={index} className="flex items-start space-x-4 p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors">
                                        <div className="p-1.5 rounded-full bg-primary/10 text-primary">
                                            <CheckCircle className="h-5 w-5" />
                                        </div>
                                        <span className="text-foreground font-medium text-lg">{result}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Card className="bg-primary text-white border-0 shadow-2xl overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl -ml-12 -mb-12"></div>
                            <CardContent className="p-10 relative z-10">
                                <h3 className="text-3xl font-bold mb-8 text-center border-b border-white/20 pb-4">Como Implantamos</h3>
                                <div className="space-y-8">
                                    {["Análise de processos", "Planejamento", "Implementação", "Treinamento"].map((etapa, idx) => (
                                        <div key={idx} className="flex items-start space-x-5 group">
                                            <div className="w-10 h-10 rounded-full bg-white text-primary flex items-center justify-center flex-shrink-0 font-bold text-lg group-hover:scale-110 transition-transform">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-lg mb-1">{etapa}</h4>
                                                <p className="text-sm text-blue-100/90 leading-relaxed">
                                                    {idx === 0 && "Entendemos como sua empresa funciona hoje"}
                                                    {idx === 1 && "Desenhamos a solução que melhor atende sua realidade"}
                                                    {idx === 2 && "Configuramos e colocamos em prática as automações"}
                                                    {idx === 3 && "Preparamos sua equipe para usar e acompanhar os resultados"}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
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
                        <CardContent className="p-12 md:p-16 text-center relative z-10">
                            <h3 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">Quer descobrir o que pode ser automatizado?</h3>
                            <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto leading-relaxed">
                                Comece com uma análise gratuita. Vamos mostrar onde a automação pode trazer mais economia, rapidez e qualidade para sua operação.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Button
                                    size="xl"
                                    className="bg-white text-primary hover:bg-white/90 font-bold h-14 px-8 text-lg rounded-full shadow-lg"
                                    onClick={() => {
                                        const gtag = getGtag();
                                        gtag?.("event", "contact_click", { service: "automacoes", source: "cta_section" });
                                        window.location.assign(buildAppPath("#contato"));
                                    }}
                                >
                                    Solicitar Análise Gratuita
                                    <ArrowRight className="h-5 w-5 ml-2" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="xl"
                                    className="bg-transparent border-white/30 text-white hover:bg-white/10 font-bold h-14 px-8 text-lg rounded-full"
                                    onClick={() => {
                                        const gtag = getGtag();
                                        gtag?.("event", "case_study_request", { service: "automacoes" });
                                        window.open("https://wa.me/553193054200?text=Olá! Gostaria de ver cases de automação do Quantum Jud.", "_blank");
                                    }}
                                >
                                    Ver Cases Reais
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

export default Automacoes;
