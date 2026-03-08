import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import SimpleBackground from "@/components/ui/SimpleBackground";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Rocket, ShieldCheck, Target, Users } from "lucide-react";

const milestones = [
  {
    period: "2016",
    title: "Origens do Quantum Jud",
    description:
      "A Quantum Tecnologia inicia pesquisas com escritórios e departamentos jurídicos para mapear dores e oportunidades.",
  },
  {
    period: "2018",
    title: "Primeiros pilotos",
    description:
      "Protótipos da plataforma integram publicações de tribunais, CRM e automações de atendimento em um único ambiente.",
  },
  {
    period: "2020",
    title: "Lançamento oficial",
    description:
      "O Quantum Jud chega ao mercado com squads consultivos, fluxos prontos e integrações nativas com ecossistemas jurídicos.",
  },
  {
    period: "2022",
    title: "Expansão de módulos",
    description:
      "Incluímos analytics jurídicos, financial ops e conectores low-code para acelerar projetos personalizados.",
  },
  {
    period: "2024+",
    title: "Evolução contínua",
    description:
      "Seguimos co-criando com clientes, parceiros e comunidade legaltech para ampliar os resultados do Quantum Jud.",
  },
];

const pillars = [
  {
    icon: Target,
    title: "Resultados compartilhados",
    description:
      "Objetivos desenhados com o cliente, sprints quinzenais e indicadores acompanhados em conjunto.",
  },
  {
    icon: Users,
    title: "Parceria de longo prazo",
    description:
      "Trabalhamos lado a lado com o time jurídico, capacitando pessoas e garantindo adoção contínua.",
  },
  {
    icon: Lightbulb,
    title: "Inovação aplicada",
    description:
      "IA generativa, automações e UX centrado no usuário para resolver desafios reais do dia a dia jurídico.",
  },
  {
    icon: ShieldCheck,
    title: "Confiança e segurança",
    description:
      "Estruturas robustas de segurança, compliance e privacidade em cada módulo da plataforma.",
  },
];

const recognitions = [
  {
    title: "+120 operações jurídicas",
    description: "Escritórios e departamentos que confiam no Quantum Jud para conduzir sua estratégia.",
  },
  {
    title: "+8 anos de evolução",
    description: "Experiência acumulada com squads multidisciplinares atuando em escala nacional.",
  },
  {
    title: "+350 automações ativas",
    description: "Workflows monitorados 24/7 garantindo eficiência operacional para nossos clientes.",
  },
];

const NossaHistoria = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
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

          <div className="container relative z-10 px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-md mb-8 shadow-lg">
                <Rocket className="h-4 w-4 text-cyan-200" />
                <span className="tracking-wide">Nossa trajetória</span>
              </div>

              <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight text-white mb-8">
                Uma trajetória construída com escritórios e departamentos jurídicos em todo o Brasil
              </h1>

              <p className="text-lg md:text-xl text-blue-100/90 max-w-3xl mx-auto leading-relaxed mb-12">
                O Quantum Jud nasceu para organizar dados jurídicos, relacionamentos e finanças em um único ecossistema. Evoluímos em conjunto com clientes que buscam previsibilidade e escala.
              </p>

              <div className="grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto">
                <Card className="bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-4xl font-bold text-white mb-1">50+</CardTitle>
                    <p className="text-sm font-medium text-cyan-200 uppercase tracking-wider">Projetos</p>
                  </CardHeader>
                  <CardContent className="text-blue-100/70 text-sm">
                    Projetos entregues com foco em ROI e adoção completa pelos usuários.
                  </CardContent>
                </Card>
                <Card className="bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-4xl font-bold text-white mb-1">200+</CardTitle>
                    <p className="text-sm font-medium text-cyan-200 uppercase tracking-wider">Integrações</p>
                  </CardHeader>
                  <CardContent className="text-blue-100/70 text-sm">
                    Automações e integrações mantidas em operação para diferentes setores.
                  </CardContent>
                </Card>
                <Card className="bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-4xl font-bold text-white mb-1">24/7</CardTitle>
                    <p className="text-sm font-medium text-cyan-200 uppercase tracking-wider">Suporte</p>
                  </CardHeader>
                  <CardContent className="text-blue-100/70 text-sm">
                    Suporte especializado e squads dedicados acompanhando cada cliente.
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Milestones Section */}
        <section className="py-24 bg-background">
          <div className="container relative z-10 px-4">
            <div className="mb-16 max-w-2xl mx-auto text-center">
              <span className="text-primary font-semibold text-sm uppercase tracking-wider">Linha do Tempo</span>
              <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-6 text-foreground">
                Marcos da nossa jornada
              </h2>
              <p className="text-xl text-muted-foreground">
                Crescemos com clientes que buscavam previsibilidade, segurança e produtividade no contencioso e no relacionamento com clientes.
              </p>
            </div>

            <div className="space-y-12 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              {milestones.map((milestone, index) => (
                <div key={milestone.period} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group ${index % 2 === 0 ? 'md:flex-row' : ''}`}>

                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-primary bg-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    <div className="w-3 h-3 bg-primary rounded-full group-hover:scale-125 transition-transform duration-300"></div>
                  </div>

                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-card border border-border/50 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary/30">
                    <div className="flex items-center justify-between space-x-2 mb-2">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-lg">{milestone.title}</div>
                      <time className="font-caveat font-medium text-primary text-xl">{milestone.period}</time>
                    </div>
                    <div className="text-muted-foreground leading-relaxed">{milestone.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pillars Section */}
        <section className="py-24 bg-muted/30">
          <div className="container px-4">
            <div className="mb-16 max-w-2xl mx-auto text-center">
              <span className="text-primary font-semibold text-sm uppercase tracking-wider">Cultura</span>
              <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-6 text-foreground">
                O que nos move
              </h2>
              <p className="text-xl text-muted-foreground">
                Nossa cultura é orientada por pilares que garantem impacto real para os clientes e evolução contínua para o nosso time.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              {pillars.map((pillar) => (
                <Card key={pillar.title} className="group bg-card border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardHeader className="flex flex-row items-center gap-6 pb-2">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                      <pillar.icon className="h-7 w-7" />
                    </div>
                    <CardTitle className="text-2xl text-foreground font-bold">{pillar.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-lg leading-relaxed pt-4">
                    {pillar.description}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Recognitions Section */}
        <section className="py-24 bg-background">
          <div className="container px-4">
            <div className="mb-16 max-w-2xl mx-auto text-center">
              <span className="text-primary font-semibold text-sm uppercase tracking-wider">Confiança</span>
              <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-6 text-foreground">Reconhecimentos dos nossos clientes</h2>
              <p className="text-xl text-muted-foreground">
                Cada projeto concluído fortalece nossa parceria com organizações que confiam no Quantum Jud para liderar seus movimentos digitais.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3 mb-20">
              {recognitions.map((item) => (
                <Card key={item.title} className="bg-card border-border/50 hover:border-primary/50 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <CardHeader>
                    <CardTitle className="text-3xl font-bold text-primary mb-2">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-lg">{item.description}</CardContent>
                </Card>
              ))}
            </div>

            {/* CTA */}
            <Card className="bg-primary text-white border-0 shadow-2xl overflow-hidden relative max-w-5xl mx-auto">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
              <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-white/20 rounded-full blur-3xl"></div>
              <div className="absolute -right-20 -top-20 w-80 h-80 bg-cyan-400/30 rounded-full blur-3xl"></div>

              <CardContent className="p-12 md:p-16 flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                <div className="text-center md:text-left max-w-2xl">
                  <h3 className="text-3xl font-bold mb-4 tracking-tight">Pronto para escrever os próximos capítulos com a gente?</h3>
                  <p className="text-white/90 text-xl leading-relaxed">
                    Vamos explorar como o Quantum Jud pode impulsionar seus resultados com tecnologia e estratégia.
                  </p>
                </div>
                <Button
                  size="xl"
                  className="bg-white text-primary hover:bg-white/90 font-bold h-16 px-10 text-lg rounded-full shadow-lg whitespace-nowrap min-w-[240px]"
                  onClick={() => document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Fale com nosso time
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default NossaHistoria;
