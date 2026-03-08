import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCircle,
  ClipboardList,
  Code2,
  Cpu,
  Database,
  Gauge,
  Globe,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  Lightbulb,
  PenTool,
  Puzzle,
  Rocket,
  ServerCog,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Timer,
  Users2,
  Workflow,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import { useServiceBySlug } from "@/hooks/useServices";
import { Skeleton } from "@/components/ui/skeleton";
import { getGtag } from "@/lib/gtag";
import { buildAppPath } from "@/config/app-config";
import devSquadIllustration from "@/assets/dev-squad-illustration.svg";
import productJourneyIllustration from "@/assets/product-journey-illustration.svg";
import integrationMapIllustration from "@/assets/integration-map-illustration.svg";
import planUpgradeIllustration from "@/assets/plan-upgrade-illustration.svg";

const Desenvolvimento = () => {
  const { data: service, isLoading: isServiceLoading } = useServiceBySlug("desenvolvimento");

  const heroLabel = service?.title ?? "Fábrica de Software Quantum Jud";
  const heroHeadline = service?.summary ?? "Times especializados para acelerar sua transformação digital";
  const heroDescription =
    service?.description ??
    "Reunimos squads multidisciplinares para desenhar, desenvolver e evoluir plataformas digitais sob medida para o seu negócio.";

  const heroHighlights = [
    {
      title: "Discovery profundo com o negócio",
      description: "Workshops colaborativos para mapear desafios, oportunidades e priorizar entregas com clareza.",
    },
    {
      title: "Arquitetura escalável desde o primeiro sprint",
      description: "Projetos cloud-native, seguros e prontos para crescer com integração a sistemas legados.",
    },
    {
      title: "Transparência sprint a sprint",
      description: "Rituais ágeis, indicadores e board compartilhado para acompanhar evolução em tempo real.",
    },
  ];

  const heroStats = [
    {
      value: "120+",
      label: "produtos digitais lançados",
      description: "Portais, aplicativos e plataformas corporativas entregues ponta a ponta.",
    },
    {
      value: "40%",
      label: "redução média de time-to-market",
      description: "Squads dedicados, pipelines CI/CD e governança orientada a valor.",
    },
    {
      value: "98%",
      label: "de satisfação dos stakeholders",
      description: "Métricas de NPS, SLAs definidos e acompanhamento executivo contínuo.",
    },
  ];

  const discoveryHighlights = [
    {
      icon: Lightbulb,
      title: "Blueprint estratégico",
      description: "Vision sprints, mapa de oportunidades e definição de KPIs de negócio.",
    },
    {
      icon: Target,
      title: "Jornadas priorizadas",
      description: "Service blueprint e prototipação de fluxos críticos com validação rápida.",
    },
    {
      icon: PenTool,
      title: "UX research contínuo",
      description: "Testes com usuários, insights qualitativos e design system evolutivo.",
    },
    {
      icon: Workflow,
      title: "Roadmap acionável",
      description: "Backlog organizado por valor, riscos mapeados e plano de releases iterativo.",
    },
  ];

  const deliveryMetrics = [
    {
      value: "2x",
      label: "mais velocidade de entrega",
      detail: "Sprints quinzenais, ritos ágeis e automações garantem incremento constante.",
    },
    {
      value: "99,9%",
      label: "de disponibilidade",
      detail: "Arquitetura cloud observável, esteira automatizada e testes a cada release.",
    },
    {
      value: "24h",
      label: "para resposta a incidentes críticos",
      detail: "Runbooks, monitoramento 24/7 e squad de sustentação dedicado.",
    },
    {
      value: "+60",
      label: "especialistas envolvidos",
      detail: "Engenheiros, product managers, designers, cientistas de dados e QAs.",
    },
  ];

  const acceleratorServices = [
    {
      icon: PenTool,
      title: "Design Ops & UX Research",
      description: "Labs de experimentação contínua para garantir experiências consistentes.",
      items: [
        "Design system vivo com guidelines e componentes reutilizáveis",
        "Testes de usabilidade e entrevistas recorrentes",
        "Workshop de co-criação com stakeholders e usuários finais",
      ],
    },
    {
      icon: Workflow,
      title: "Playbooks ágeis Quantum Jud",
      description: "Roteiros e cerimônias que estruturam planejamento, execução e governança.",
      items: [
        "Discovery, inception e product framing facilitados",
        "Gestão de backlog e roadmaps integrados a OKRs",
        "Dashboards operacionais para medir velocidade e qualidade",
      ],
    },
    {
      icon: BarChart3,
      title: "Data & Product Analytics",
      description: "Coleta, tratamento e análise de dados para orientar evolução contínua.",
      items: [
        "Implementação de product analytics e customer data platform",
        "Modelos de previsão e segmentação com machine learning",
        "KPIs e relatórios executivos em tempo real",
      ],
    },
  ];

  const caseStudies = [
    {
      image: productJourneyIllustration,
      segment: "Saúde corporativa",
      title: "Plataforma integrada de benefícios",
      result: "37% menos tempo para onboard de novos clientes com jornadas digitais.",
      metrics: [
        "Onboarding digital lançado em 6 semanas",
        "Integração com 12 parceiros e sistemas legados",
        "NPS 74 após o go-live com 40 mil usuários",
      ],
    },
    {
      image: integrationMapIllustration,
      segment: "Serviços financeiros",
      title: "Hub de crédito e compliance",
      result: "Redução de 52% no retrabalho com automação e rastreabilidade completa.",
      metrics: [
        "Arquitetura de microsserviços com filas e eventos",
        "Auditoria em tempo real e trilhas de decisão",
        "Painéis executivos com indicadores diários",
      ],
    },
    {
      image: planUpgradeIllustration,
      segment: "Educação corporativa",
      title: "Ecossistema de aprendizagem contínua",
      result: "Engajamento 3x maior com conteúdo personalizado por perfis.",
      metrics: [
        "Aplicativos web e mobile integrados",
        "Recomendações inteligentes com IA embarcada",
        "Medição de impacto por trilha, squad e unidade de negócio",
      ],
    },
  ];

  const qaApproach = [
    {
      icon: ShieldCheck,
      title: "Qualidade contínua",
      description: "Testes unitários, integração, contrato e performance automatizados em cada pipeline.",
    },
    {
      icon: Cpu,
      title: "Observabilidade inteligente",
      description: "Monitoramento de logs, métricas e traces com alertas inteligentes e AIOps.",
    },
    {
      icon: LifeBuoy,
      title: "Suporte orientado a SLAs",
      description: "Runbooks, gestão de incidentes e squads de sustentação para evolução contínua.",
    },
  ];

  const capabilityHighlights = [
    {
      icon: Code2,
      title: "Produtos digitais completos",
      description: "Concepção ponta a ponta de plataformas, portais e aplicativos com foco em experiência e resultado.",
      bullets: [
        "Workshops de discovery e mapeamento de processos",
        "UX/UI centrado no usuário com design system reutilizável",
        "Arquitetura orientada a microsserviços e APIs escaláveis",
      ],
    },
    {
      icon: Puzzle,
      title: "Integrações e modernização",
      description: "Modernize sistemas legados, conecte plataformas e automatize operações críticas do negócio.",
      bullets: [
        "Integração com ERPs, CRMs, gateways e plataformas proprietárias",
        "Estratégias de refatoração gradual sem paradas na operação",
        "APIs, mensageria e automações que conectam toda a jornada",
      ],
    },
    {
      icon: Sparkles,
      title: "Inovação guiada por dados",
      description: "Implante produtos digitais inteligentes com analítica, automação e inteligência artificial aplicada.",
      bullets: [
        "Prototipação rápida para validar hipóteses de negócio",
        "Dashboards e relatórios com dados em tempo real",
        "Machine Learning e IA embarcada para personalizar experiências",
      ],
    },
  ];

  const fallbackSolutions = useMemo(
    () => [
      {
        title: "Plataformas de Gestão e Operações",
        description: "Sistemas complexos que conectam equipes, processos e indicadores em uma única solução.",
        features: [
          "Portais corporativos, intranets e gestão de documentos",
          "Fluxos de aprovação, compliance e governança",
          "Integrações com ERPs, CRMs e ferramentas de BI",
          "Arquitetura modular preparada para crescimento",
        ],
      },
      {
        title: "Ecossistemas de Relacionamento",
        description: "Experiências digitais completas para relacionamento com clientes, parceiros e fornecedores.",
        features: [
          "Onboarding digital com automações de jornada",
          "Aplicativos mobile e web responsivos",
          "Comunicação omnichannel e notificações inteligentes",
          "Analytics e painéis executivos integrados",
        ],
      },
      {
        title: "E-commerce e Marketplaces B2B/B2C",
        description: "Plataformas de vendas escaláveis com foco em performance e integração com todo o backoffice.",
        features: [
          "Gestão de catálogos complexos e regras comerciais",
          "Integração com meios de pagamento e fiscal",
          "Ferramentas de marketing, promoções e fidelização",
          "Monitoramento e observabilidade fim a fim",
        ],
      },
      {
        title: "Soluções Data-Driven",
        description: "Produtos que centralizam dados, automatizam decisões e aumentam a inteligência do negócio.",
        features: [
          "Data lakes, pipelines e engenharia de dados",
          "Dashboards e relatórios executivos personalizados",
          "Modelos preditivos e algoritmos de recomendação",
          "Governança e segurança da informação aderentes à LGPD",
        ],
      },
    ],
    [],
  );

  const solutionCards = useMemo(() => {
    if (!service?.features?.length) {
      return fallbackSolutions;
    }

    return service.features.map((featureText, index) => {
      const parts = featureText.split("|").map((part) => part.trim());
      const [titlePart, descriptionPart, featuresPart] = parts;
      const fallback = fallbackSolutions[index % fallbackSolutions.length];
      const parsedFeatures = featuresPart
        ? featuresPart.split(";").map((feature) => feature.trim()).filter(Boolean)
        : fallback.features;
      return {
        title: titlePart?.length ? titlePart : fallback.title,
        description: descriptionPart?.length ? descriptionPart : service.description ?? fallback.description,
        features: parsedFeatures.length ? parsedFeatures : fallback.features,
      };
    });
  }, [fallbackSolutions, service]);

  const engagementModels = [
    {
      icon: Users2,
      title: "Squad dedicada",
      description: "Equipe multidisciplinar exclusiva com governança ágil Quantum Jud e foco em indicadores de negócio.",
      highlights: [
        "Product Manager Quantum Jud como ponto focal",
        "Desenvolvedores full-stack, UX/UI e QA integrados",
        "Backlog priorizado em conjunto a cada sprint",
      ],
    },
    {
      icon: ClipboardList,
      title: "Projetos fechados",
      description: "Escopo definido, roadmap e entregas com previsão clara de prazo e investimento.",
      highlights: [
        "Discovery colaborativo e alinhamento de objetivos",
        "Marcos de validação e homologação assistida",
        "Implantação, treinamento e handover estruturado",
      ],
    },
    {
      icon: Timer,
      title: "Sustentação e evolução",
      description: "Time sob demanda para manter, monitorar e evoluir sistemas críticos em produção.",
      highlights: [
        "SLA alinhado à criticidade do negócio",
        "Squad enxuta para correções e novas demandas",
        "Observabilidade, monitoramento e gestão de incidentes",
      ],
    },
  ];

  const methodology = [
    {
      step: "1",
      title: "Discovery Imersivo",
      description: "Workshops, entrevistas e mapeamento de processos para alinhar objetivos e priorizar entregas.",
      detail: "Mapeamos a jornada dos usuários, regras de negócio e definimos o backlog inicial orientado a valor.",
    },
    {
      step: "2",
      title: "Arquitetura & Design",
      description: "Protótipos navegáveis, design system e definição da arquitetura técnica ideal.",
      detail: "UX research, testes de usabilidade e arquitetura cloud escalável preparada para integração.",
    },
    {
      step: "3",
      title: "Desenvolvimento Ágil",
      description: "Sprints curtas com entregas incrementais, acompanhamento e ritos ágeis semanais.",
      detail: "Pipelines CI/CD, code review contínuo e indicadores de performance compartilhados.",
    },
    {
      step: "4",
      title: "Qualidade & Segurança",
      description: "Testes automatizados, QA funcional e validações de segurança em cada release.",
      detail: "Testes unitários, integração, performance e análise de vulnerabilidades garantindo estabilidade.",
    },
    {
      step: "5",
      title: "Lançamento & Evolução",
      description: "Go-live assistido, monitoramento 24/7 e roadmap de evolução contínua.",
      detail: "Treinamento, dashboards de acompanhamento e squad dedicada à sustentação.",
    },
  ];

  const differentiators = [
    {
      icon: ShieldCheck,
      title: "Governança e compliance",
      description: "Processos aderentes à LGPD, auditoria de acessos, versionamento e rastreabilidade de decisões.",
    },
    {
      icon: ServerCog,
      title: "Infraestrutura preparada",
      description: "Automação de deploy, monitoramento, observabilidade e gestão de incidentes pró-ativa.",
    },
    {
      icon: Layers,
      title: "Co-criação contínua",
      description: "Participação ativa do cliente em ritos ágeis, backlog colaborativo e transparência total.",
    },
    {
      icon: Rocket,
      title: "Foco em resultados",
      description: "OKRs e KPIs definidos em conjunto para medir impacto real no negócio.",
    },
  ];

  const segments = [
    "Jurídico, escritórios e lawtechs",
    "Serviços financeiros, fintechs e seguros",
    "Educação corporativa e edtechs",
    "Indústria, logística e operações complexas",
    "Saúde, bem-estar e planos de benefícios",
    "Setor público, entidades e organizações reguladas",
  ];

  const technologies = [
    {
      icon: LayoutDashboard,
      title: "Frontend moderno",
      description: "React, Next.js, Vue, TypeScript e design systems reutilizáveis.",
    },
    {
      icon: ServerCog,
      title: "APIs e microsserviços",
      description: "Node.js, NestJS, Python, .NET, GraphQL e arquiteturas orientadas a eventos.",
    },
    {
      icon: Smartphone,
      title: "Mobile & Multiplataforma",
      description: "React Native, Flutter, Swift e Kotlin com publicação assistida nas stores.",
    },
    {
      icon: Database,
      title: "Dados & Integrações",
      description: "PostgreSQL, MongoDB, Redis, mensageria, data lakes e integrações com ERPs/CRMs.",
    },
  ];

  const benefits = [
    "Planejamento orientado a OKRs e indicadores de negócio",
    "Pipelines de CI/CD com testes automatizados e code review",
    "Documentação funcional e técnica disponível em tempo real",
    "Squad de sustentação com monitoramento e alertas 24/7",
    "Treinamento das equipes usuárias e handover estruturado",
    "Evolução contínua guiada por dados e feedback dos usuários",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TypebotBubble />
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-primary pt-32 pb-24 lg:pt-40 lg:pb-32">
        {/* Abstract Shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400 rounded-full blur-[120px] opacity-20 animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-400 rounded-full blur-[120px] opacity-20 animate-pulse delay-1000"></div>
        </div>

        <div className="container px-4 relative z-10 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-md mb-8 shadow-lg">
            <Code2 className="h-4 w-4 text-cyan-200" />
            <span className="tracking-wide">{heroLabel}</span>
          </div>

          <h1 className="max-w-5xl text-5xl md:text-7xl font-bold tracking-tight text-white mb-8 leading-tight">
            {heroHeadline.split(" ").slice(0, 3).join(" ")} <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-blue-200">{heroHeadline.split(" ").slice(3).join(" ")}</span>
          </h1>

          <p className="max-w-2xl text-lg md:text-xl text-blue-100/90 leading-relaxed mb-10">
            {heroDescription}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mb-16">
            <Button
              size="lg"
              className="bg-white text-primary hover:bg-white/90 font-semibold h-14 px-8 text-lg rounded-full shadow-xl shadow-blue-900/20 transition-all hover:scale-105"
              onClick={() => window.location.assign(buildAppPath("#contato"))}
            >
              Começar Projeto
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-white/30 text-white hover:bg-white/10 font-semibold h-14 px-8 text-lg rounded-full backdrop-blur-sm"
              onClick={() =>
                window.open(
                  "https://wa.me/553193054200?text=Olá! Quero saber mais sobre desenvolvimento sob medida.",
                  "_blank",
                )
              }
            >
              Falar no WhatsApp
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
            {heroHighlights.map((item, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md text-left hover:bg-white/10 transition-colors">
                <h3 className="text-white font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-blue-100/70 text-sm">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-8 w-full max-w-5xl border-t border-white/10 pt-10">
            {heroStats.map((stat, idx) => (
              <div key={idx} className="text-center">
                <p className="text-4xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-sm font-medium text-blue-200 uppercase tracking-wider mb-2">{stat.label}</p>
                <p className="text-xs text-blue-100/60 hidden md:block">{stat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section className="py-24 bg-background">
        <div className="container px-4">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <span className="text-primary font-semibold text-sm uppercase tracking-wider">O que entregamos</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-6 text-foreground">
              Produtos e plataformas que desenvolvemos
            </h2>
            <p className="text-xl text-muted-foreground">
              Construímos soluções completas para diferentes segmentos, sempre com foco em gerar impacto real nos resultados.
            </p>
          </div>

          {isServiceLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="bg-card border-border/50">
                  <CardHeader>
                    <Skeleton className="h-8 w-2/3 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((__, idx) => (
                        <Skeleton key={idx} className="h-4 w-full" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {solutionCards.map((solution, index) => (
                <Card
                  key={solution.title + index}
                  className="group bg-card border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardHeader>
                    <CardTitle className="text-2xl font-bold group-hover:text-primary transition-colors">{solution.title}</CardTitle>
                    <CardDescription className="text-base mt-2">{solution.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {solution.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-foreground/80">
                          <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Case Studies Section */}

      {/* Case Studies Section */}
      <section className="py-24 bg-muted/30">
        <div className="container px-4">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <span className="text-primary font-semibold text-sm uppercase tracking-wider">Cases de Sucesso</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-6 text-foreground">
              Resultados que transformam operações
            </h2>
            <p className="text-xl text-muted-foreground">
              Conheça alguns exemplos de plataformas entregues pelo time do Quantum Jud, combinando design centrado no usuário, integrações complexas e métricas de negócio.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {caseStudies.map((caseStudy) => (
              <Card
                key={caseStudy.title}
                className="group relative overflow-hidden border-border/50 bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2"
              >
                <div className="relative h-56 bg-muted/50 p-6 flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent opacity-50"></div>
                  <img
                    src={caseStudy.image}
                    alt={caseStudy.title}
                    className="h-full w-auto object-contain z-10 drop-shadow-lg transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute top-4 left-4 z-20">
                    <span className="inline-flex items-center rounded-full bg-background/80 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur-sm border border-border/50">
                      {caseStudy.segment}
                    </span>
                  </div>
                </div>
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors">{caseStudy.title}</CardTitle>
                  <CardDescription className="text-foreground font-medium">{caseStudy.result}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    {caseStudy.metrics.map((metric) => (
                      <li key={metric} className="flex items-start gap-2">
                        <BadgeCheck className="h-5 w-5 text-primary flex-shrink-0" />
                        <span>{metric}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Engagement Models Section */}
      {/* Engagement Models Section */}
      <section className="py-24 bg-background">
        <div className="container px-4">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <span className="text-primary font-semibold text-sm uppercase tracking-wider">Flexibilidade</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-6 text-foreground">
              Modelos de parceria sob medida
            </h2>
            <p className="text-xl text-muted-foreground">
              Escolha a abordagem que melhor se adapta ao momento da sua organização. Ajustamos processos, squad e governança conforme a sua necessidade.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {engagementModels.map((model) => (
              <Card
                key={model.title}
                className="group border-border/50 hover:border-primary/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-2"
              >
                <CardHeader>
                  <div className="p-4 rounded-xl bg-primary/10 w-fit mb-4 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                    <model.icon className="h-7 w-7 text-primary group-hover:text-white transition-colors" />
                  </div>
                  <CardTitle className="text-2xl font-bold">{model.title}</CardTitle>
                  <CardDescription className="text-base mt-2">{model.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {model.highlights.map((highlight) => (
                      <li key={highlight} className="flex items-start space-x-3 text-sm text-muted-foreground">
                        <ArrowRight className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Accelerators Section */}
      <section className="py-24 bg-muted/20">
        <div className="container px-4">
          <div className="text-center mb-16 max-w-4xl mx-auto">
            <span className="text-primary font-semibold text-sm uppercase tracking-wider">Aceleração</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-6 text-foreground">
              Aceleradores para evoluir continuamente
            </h2>
            <p className="text-xl text-muted-foreground">
              Frameworks, ferramentas e times especializados que potencializam a entrega desde o discovery até a operação do produto.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {acceleratorServices.map((service) => (
              <div key={service.title} className="relative group">
                <div className="absolute inset-0 bg-primary/5 rounded-2xl transform rotate-1 group-hover:rotate-2 transition-transform"></div>
                <Card
                  className="relative h-full bg-card border-border/50 hover:border-primary/30 transition-all duration-300"
                >
                  <CardHeader>
                    <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4">
                      <service.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl font-bold">{service.title}</CardTitle>
                    <CardDescription className="text-base">{service.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 text-sm text-muted-foreground">
                      {service.items.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Methodology Section */}
      <section className="py-24 bg-background">
        <div className="container px-4">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <span className="text-primary font-semibold text-sm uppercase tracking-wider">Como trabalhamos</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-6 text-foreground">
              Metodologia ágil e colaborativa
            </h2>
            <p className="text-xl text-muted-foreground">
              Da descoberta ao go-live, conduzimos cada etapa com transparência, governança e foco no valor entregue ao usuário final.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
            <div className="hidden md:block absolute top-[2.5rem] left-0 w-full h-0.5 bg-border -z-10"></div>
            {methodology.map((item, index) => (
              <Card
                key={item.title}
                className="bg-card border-border/50 hover:border-primary/50 transition-all duration-300 group pt-6"
              >
                <CardContent className="p-6 text-center relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background p-1.5 rounded-full">
                    <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-lg font-bold shadow-lg">
                      {item.step}
                    </div>
                  </div>
                  <h3 className="font-semibold mb-3 mt-4 text-lg">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] gap-8 mt-20">
            <Card className="border-border/50 bg-muted/20">
              <CardHeader>
                <CardTitle className="text-2xl font-bold">Diferenciais da nossa operação</CardTitle>
                <CardDescription>
                  Estrutura, processos e governança pensados para garantir segurança, qualidade e escalabilidade em cada projeto.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {differentiators.map((item) => (
                    <li key={item.title} className="flex items-start space-x-4 p-4 rounded-xl bg-background border border-border/50">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-base">{item.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-primary bg-primary/5">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <Globe className="h-5 w-5 text-primary" />
                    <CardTitle className="text-xl">Segmentos de Atuação</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {segments.map((segment) => (
                      <span key={segment} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-background text-foreground border border-border/50">
                        {segment}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <CardTitle className="text-xl">Qualidade e Sustentação</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    {qaApproach.map((item) => (
                      <li key={item.title} className="flex items-start gap-3 border-b border-border/30 last:border-0 pb-3 last:pb-0">
                        <div>
                          <p className="font-medium text-foreground">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-primary text-white border-none shadow-xl">
                <div className="absolute top-0 right-0 p-16 bg-white/10 rounded-full blur-3xl -mr-8 -mt-8"></div>
                <CardHeader className="relative z-10">
                  <CardTitle className="text-xl">Garantias e Supore</CardTitle>
                  <CardDescription className="text-blue-100">
                    Compromisso com a continuidade, evolução e qualidade das soluções entregues.
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10">
                  <ul className="space-y-2">
                    {benefits.slice(0, 4).map((benefit) => (
                      <li key={benefit} className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-cyan-300 flex-shrink-0 mt-0.5" />
                        <span className="text-sm font-medium">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Technologies Section */}
      <section className="py-24 bg-muted/30">
        <div className="container px-4">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <span className="text-primary font-semibold text-sm uppercase tracking-wider">Ecossistema</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 mb-6 text-foreground">
              Tecnologia, stack e integrações
            </h2>
            <p className="text-xl text-muted-foreground">
              Trabalhamos com um ecossistema tecnológico robusto para garantir escalabilidade, segurança e experiências digitais marcantes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {technologies.map((tech, index) => (
              <Card
                key={tech.title}
                className="bg-card border-border/50 hover:border-primary/50 text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader>
                  <div className="p-3.5 rounded-xl bg-muted w-fit mx-auto mb-4 text-foreground">
                    <tech.icon className="h-7 w-7" />
                  </div>
                  <CardTitle className="text-lg font-bold">{tech.title}</CardTitle>
                  <CardDescription className="text-sm mt-2">{tech.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/20 blur-[100px]"></div>
            <div className="absolute bottom-0 left-0 w-1/3 h-full bg-cyan-500/20 blur-[100px]"></div>
            <CardContent className="p-10 relative z-10">
              <h3 className="text-2xl font-bold mb-8 text-center">Stack tecnológico de referência</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                <div className="space-y-2">
                  <h4 className="font-semibold text-cyan-300">Frontend</h4>
                  <p className="text-sm text-slate-300 leading-relaxed">React, Next.js, Vue, TypeScript, TailwindCSS</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-cyan-300">Backend</h4>
                  <p className="text-sm text-slate-300 leading-relaxed">Node.js, Python, .NET, NestJS, Go</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-cyan-300">Mobile</h4>
                  <p className="text-sm text-slate-300 leading-relaxed">React Native, Flutter, Swift, Kotlin</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-cyan-300">DevOps & Cloud</h4>
                  <p className="text-sm text-slate-300 leading-relaxed">AWS, Azure, GCP, Docker, Kubernetes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-background">
        <div className="container px-4">
          <Card className="bg-primary text-white border-0 shadow-2xl max-w-5xl mx-auto overflow-hidden relative">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
            <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/20 rounded-full blur-3xl"></div>
            <CardContent className="p-12 md:p-16 text-center relative z-10">
              <h3 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">Pronto para tirar seu projeto do papel?</h3>
              <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto leading-relaxed">
                Compartilhe seus desafios e receba um plano detalhado com roadmap, time recomendado e investimento para iniciar sua jornada.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="xl"
                  className="bg-white text-primary hover:bg-white/90 font-bold h-14 px-8 text-lg rounded-full shadow-lg"
                  onClick={() => {
                    const gtag = getGtag();
                    gtag?.("event", "contact_click", {
                      service: "desenvolvimento",
                      source: "cta_section",
                    });
                    window.location.assign(buildAppPath("#contato"));
                  }}
                >
                  Solicitar proposta personalizada
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  size="xl"
                  className="bg-transparent border-white/30 text-white hover:bg-white/10 font-bold h-14 px-8 text-lg rounded-full"
                  onClick={() => {
                    const gtag = getGtag();
                    gtag?.("event", "portfolio_request", {
                      service: "desenvolvimento",
                      source: "cta_section",
                    });
                    window.open(
                      "https://wa.me/553193054200?text=Olá! Gostaria de ver o portfólio de cases.",
                      "_blank",
                    );
                  }}
                >
                  Conhecer cases de sucesso
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

export default Desenvolvimento;
