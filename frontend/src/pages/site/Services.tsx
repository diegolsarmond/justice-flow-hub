import { Link } from "react-router-dom";
import {
    ArrowRight,
    Bot,
    CheckCircle2,
    CircuitBoard,
    Database,
    MessageSquare,
    Server,
    Settings,
    Sparkles,
    Workflow,
    Layers,
    ShieldCheck,
} from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildAppPath } from "@/config/app-config";

const services = [
    {
        title: "Assistentes Virtuais com IA",
        description:
            "Chatbots que entendem a conversa e respondem de forma natural, ajudando sua equipe a ganhar tempo e eficiência.",
        icon: Bot,
        highlights: ["WhatsApp, Web e Telegram", "Roteiros personalizados", "Acompanhamento em tempo real"],
        link: "/servicos/assistente-ia",
    },
    {
        title: "Automações Empresariais",
        description:
            "Elimine tarefas repetitivas e conecte sistemas para que sua equipe foque no que realmente importa.",
        icon: Settings,
        highlights: ["Integrações com sistemas já usados", "Fluxos automáticos de trabalho", "Alertas e relatórios prontos"],
        link: "/servicos/automacoes",
    },
    {
        title: "Desenvolvimento Sob Medida",
        description:
            "Criamos soluções digitais sob encomenda para apoiar suas operações e melhorar a experiência dos seus clientes.",
        icon: CircuitBoard,
        highlights: ["Projetos escaláveis", "Design intuitivo", "Equipe dedicada do início ao fim"],
        link: "/servicos/desenvolvimento",
    },
    {
        title: "Consultoria em Dados & Analytics",
        description:
            "Organizamos e transformamos dados em informações úteis para apoiar decisões do dia a dia.",
        icon: Database,
        highlights: ["Painéis de acompanhamento", "Revisão de estrutura de dados", "Estratégias alinhadas ao negócio"],
        link: "#contato",
    },
    {
        title: "Infraestrutura & Cloud",
        description:
            "Cuidamos da sua operação em nuvem para que seja segura, estável e com custos sob controle.",
        icon: Server,
        highlights: ["Monitoramento completo", "Gestão de custos", "Alta disponibilidade"],
        link: "#contato",
    },
];

const differentiators = [
    {
        title: "Equipe experiente",
        description: "Profissionais de diferentes áreas trabalhando juntos para entregar valor real.",
    },
    {
        title: "Acompanhamento próximo",
        description: "Estamos presentes em todas as etapas, da ideia inicial ao suporte contínuo.",
    },
    {
        title: "Agilidade com qualidade",
        description: "Entregas rápidas e seguras, sempre com foco no que gera resultado para o seu negócio.",
    },
];

const processSteps = [
    {
        title: "Entendimento",
        description:
            "Conversamos com seu time para entender os desafios e definir o caminho mais adequado.",
        result: "Plano de ação validado",
    },
    {
        title: "Desenho da Solução",
        description:
            "Criamos protótipos e mostramos como a solução vai funcionar na prática.",
        result: "Modelo aprovado",
    },
    {
        title: "Implementação",
        description:
            "Executamos em ciclos curtos, com entregas frequentes e ajustes sempre que necessário.",
        result: "Funcionalidades prontas para uso",
    },
    {
        title: "Crescimento",
        description:
            "Apoiamos a operação, ajustamos e melhoramos continuamente para garantir evolução.",
        result: "Resultados sustentados ao longo do tempo",
    },
];

const ServicesPage = () => {
    return (
        <div className="min-h-screen bg-background">
            <TypebotBubble />
            <Header />

            <main>
                {/* Hero Section */}
                <section className="relative overflow-hidden bg-primary pt-32 pb-24 lg:pt-40 lg:pb-32">
                    {/* Abstract Shapes */}
                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400 rounded-full blur-[120px] opacity-20 animate-pulse"></div>
                        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-400 rounded-full blur-[120px] opacity-20 animate-pulse delay-1000"></div>
                    </div>

                    <div className="container px-4 relative z-10 flex flex-col items-center text-center">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-md mb-8 shadow-lg">
                            <Sparkles className="h-4 w-4 text-cyan-200" />
                            <span className="tracking-wide">Soluções Digitais Personalizadas</span>
                        </div>

                        <h1 className="max-w-4xl text-5xl md:text-7xl font-bold tracking-tight text-white mb-8 leading-tight">
                            Tecnologia que <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-blue-200">transforma</span> o seu negócio
                        </h1>

                        <p className="max-w-2xl text-lg md:text-xl text-blue-100/90 leading-relaxed mb-10">
                            Da automação inteligente ao desenvolvimento sob medida. Unimos estratégia e código para criar produtos que escalam sua operação.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                            <Button
                                size="lg"
                                className="bg-white text-primary hover:bg-white/90 font-semibold h-14 px-8 text-lg rounded-full shadow-xl shadow-blue-900/20 transition-all hover:scale-105"
                                onClick={() => document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" })}
                            >
                                Fale com Consultor
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                            <Button
                                variant="outline"
                                size="lg"
                                className="border-white/30 text-white hover:bg-white/10 font-semibold h-14 px-8 text-lg rounded-full backdrop-blur-sm"
                                onClick={() =>
                                    window.open(
                                        "https://wa.me/553193054200?text=Olá! Quero conhecer os serviços da Quantum Tecnologia.",
                                        "_blank",
                                    )
                                }
                            >
                                <MessageSquare className="mr-2 h-5 w-5" />
                                WhatsApp
                            </Button>
                        </div>

                        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
                            {differentiators.map((item, idx) => (
                                <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md text-left hover:bg-white/10 transition-colors">
                                    <h3 className="text-white font-semibold text-lg mb-2">{item.title}</h3>
                                    <p className="text-blue-100/70 text-sm">{item.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Services Grid */}
                <section className="py-24 bg-muted/30 relative">
                    <div className="container relative z-10 px-4">
                        <div className="mb-16 text-center max-w-3xl mx-auto">
                            <span className="text-primary font-semibold text-sm uppercase tracking-wider">Nossos Serviços</span>
                            <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-6 text-foreground">
                                Soluções criadas para o seu desafio
                            </h2>
                            <p className="text-xl text-muted-foreground">
                                Cada serviço é adaptado ao momento e às necessidades da sua empresa. Da primeira automação à transformação completa.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                            {services.map((service, idx) => (
                                <Card
                                    key={service.title}
                                    className="group relative flex h-full flex-col border-border/50 bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 overflow-hidden"
                                >
                                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                    <CardHeader>
                                        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                                            <service.icon className="h-7 w-7" />
                                        </div>
                                        <CardTitle className="text-2xl text-foreground font-bold">{service.title}</CardTitle>
                                        <CardDescription className="text-muted-foreground text-base mt-2 leading-relaxed">
                                            {service.description}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="mt-auto flex flex-col gap-6">
                                        <ul className="space-y-3">
                                            {service.highlights.map((highlight) => (
                                                <li key={highlight} className="flex items-start gap-3 text-sm text-foreground/80">
                                                    <div className="mt-1 p-0.5 rounded-full bg-green-500/20 text-green-600">
                                                        <CheckCircle2 className="h-3 w-3" strokeWidth={3} />
                                                    </div>
                                                    {highlight}
                                                </li>
                                            ))}
                                        </ul>

                                        <div className="pt-4 border-t border-border/50">
                                            {service.link.startsWith("#") ? (
                                                <Button
                                                    variant="ghost"
                                                    className="w-full justify-between group/btn hover:bg-primary/5 hover:text-primary"
                                                    onClick={() =>
                                                        document.getElementById(service.link.replace("#", ""))?.scrollIntoView({ behavior: "smooth" })
                                                    }
                                                >
                                                    Falar com o time
                                                    <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                                                </Button>
                                            ) : (
                                                <Button variant="ghost" className="w-full justify-between group/btn hover:bg-primary/5 hover:text-primary" asChild>
                                                    <Link to={service.link}>
                                                        Explorar detalhes
                                                        <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Process Section */}
                <section className="py-24 bg-background">
                    <div className="container px-4">
                        <div className="mb-16 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                            <div className="max-w-3xl">
                                <span className="text-primary font-semibold text-sm uppercase tracking-wider">Metodologia</span>
                                <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-6 text-foreground">
                                    Como colocamos projetos em prática
                                </h2>
                                <p className="text-xl text-muted-foreground">
                                    Trabalhamos de forma colaborativa e ágil, com entregas frequentes e foco em resultados claros para seu negócio.
                                </p>
                            </div>
                            <div className="rounded-xl bg-primary/5 border border-primary/10 px-6 py-4 text-sm text-foreground backdrop-blur">
                                <div className="flex items-center gap-3 font-medium">
                                    <Workflow className="h-5 w-5 text-primary" />
                                    <span>
                                        +120 projetos entregues com sucesso
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
                            {processSteps.map((step, index) => (
                                <div key={step.title} className="relative group">
                                    {/* Connecting Line (Only for desktop) */}
                                    {index < processSteps.length - 1 && (
                                        <div className="hidden xl:block absolute top-8 left-1/2 w-full h-0.5 bg-border -z-10 group-hover:bg-primary/30 transition-colors" />
                                    )}

                                    <Card className="h-full border-border/50 bg-card hover:border-primary/30 hover:shadow-lg transition-all pt-8">
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background p-2 rounded-full border border-border group-hover:border-primary transition-colors">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white font-bold text-lg shadow-lg">
                                                {index + 1}
                                            </div>
                                        </div>

                                        <CardHeader className="text-center pt-8">
                                            <CardTitle className="text-xl mb-2">{step.title}</CardTitle>
                                            <CardDescription className="text-muted-foreground">{step.description}</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="rounded-lg bg-muted p-4 text-sm text-center border border-border/50">
                                                <p className="font-semibold text-primary mb-1">Resultado esperado</p>
                                                <p className="text-muted-foreground">{step.result}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Partnership Section */}
                <section className="py-24 bg-muted/20 border-t border-border">
                    <div className="container px-4">
                        <div className="grid gap-16 lg:grid-cols-2 items-center">
                            <div>
                                <h2 className="text-3xl md:text-5xl font-bold mb-6 text-foreground leading-tight">
                                    Parceria para crescer com <span className="text-primary">confiança</span>
                                </h2>
                                <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
                                    Não somos apenas fornecedores. Atuamos como extensão do seu time para garantir soluções simples, seguras e que realmente façam diferença no dia a dia.
                                </p>
                                <div className="space-y-6">
                                    {["Equipe multidisciplinar e especializada", "Métricas claras com acompanhamento", "Suporte técnico constante", "Segurança e compliance desde o início"].map((item) => (
                                        <div key={item} className="flex items-center gap-4">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                <CheckCircle2 className="h-5 w-5 text-primary" />
                                            </div>
                                            <p className="text-foreground font-medium">{item}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-12 flex flex-wrap gap-4">
                                    <Button
                                        size="xl"
                                        className="h-14 px-8 text-lg rounded-full shadow-lg"
                                        onClick={() => document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" })}
                                    >
                                        Planejar meu projeto
                                    </Button>
                                    <Button variant="outline" size="xl" className="h-14 px-8 text-lg rounded-full" asChild>
                                        <Link to="/blog">
                                            Ler nossos cases
                                        </Link>
                                    </Button>
                                </div>
                            </div>

                            <div className="relative">
                                {/* Decorator Blob */}
                                <div className="absolute -top-10 -right-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl opacity-50 z-0"></div>

                                <Card className="relative z-10 border-border shadow-2xl bg-white overflow-hidden">
                                    <div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
                                    <CardContent className="p-10 space-y-10">
                                        <div className="flex items-center gap-4">
                                            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                                <ShieldCheck className="h-8 w-8" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold uppercase tracking-wide text-primary">Segurança Garantida</p>
                                                <p className="text-2xl font-bold text-foreground mt-1">98% de renovação</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div className="rounded-2xl border border-border bg-muted/30 p-6 text-center">
                                                <p className="text-4xl font-bold text-primary mb-2">15+</p>
                                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">anos de experiência</p>
                                            </div>
                                            <div className="rounded-2xl border border-border bg-muted/30 p-6 text-center">
                                                <p className="text-4xl font-bold text-primary mb-2">24/7</p>
                                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">suporte crítico</p>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8 text-center">
                                            <p className="text-xl font-bold text-foreground mb-2">Vamos conversar?</p>
                                            <p className="text-muted-foreground mb-6">
                                                Agende uma reunião rápida com nossos especialistas para entender como podemos ajudar.
                                            </p>
                                            <Button
                                                variant="outline"
                                                className="w-full bg-white hover:bg-white/90 border-primary/20 text-primary font-bold h-12"
                                                onClick={() => document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" })}
                                            >
                                                Agendar reunião agora
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
};

export default ServicesPage;
