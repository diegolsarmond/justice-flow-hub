import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  LayoutDashboard,
  Users,
  Scale,
  CalendarDays,
  ListTodo,
  Wallet,
  FileBarChart,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  MessageCircle,
  Bell,
  Search,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react";

const storageKey = "jus-connect-system-tutorial";

type TutorialStep = {
  title: string;
  description: string;
  highlights?: string[];
  icon: LucideIcon;
  gradient: string;
  accentColor: string;
};

export function SystemTutorial() {
  const steps = useMemo<TutorialStep[]>(
    () => [
      {
        title: "Dashboard",
        description:
          "Seu painel de controle inteligente. Visualize métricas de desempenho, acompanhe KPIs em tempo real e tome decisões estratégicas com dados precisos.",
        highlights: [
          "Indicadores de produtividade em tempo real",
          "Alertas inteligentes de tarefas e compromissos",
          "Atalhos personalizados para acesso rápido",
          "Visão 360° do escritório",
        ],
        icon: LayoutDashboard,
        gradient: "from-blue-500 via-blue-600 to-indigo-700",
        accentColor: "text-blue-400",
      },
      {
        title: "Clientes",
        description:
          "CRM jurídico completo. Gerencie relacionamentos, acompanhe históricos detalhados e mantenha toda documentação organizada em um só lugar.",
        highlights: [
          "Perfil completo com timeline de interações",
          "Gestão de documentos integrada",
          "Comunicação centralizada por e-mail e WhatsApp",
          "Histórico completo de atendimentos",
        ],
        icon: Users,
        gradient: "from-emerald-500 via-teal-600 to-cyan-700",
        accentColor: "text-emerald-400",
      },
      {
        title: "Processos",
        description:
          "Controle processual avançado. Organize por status, gerencie prazos críticos e mantenha todas as peças e movimentações sincronizadas automaticamente.",
        highlights: [
          "Kanban visual por fases e status",
          "Prazos automáticos com alertas inteligentes",
          "Integração com tribunais e sistemas",
          "Documentos e tarefas vinculadas",
        ],
        icon: Scale,
        gradient: "from-violet-500 via-purple-600 to-fuchsia-700",
        accentColor: "text-violet-400",
      },
      {
        title: "Conversas",
        description:
          "Comunicação integrada via WhatsApp. Centralize todas as conversas com clientes e mantenha o histórico organizado junto aos processos.",
        highlights: [
          "Integração nativa com WhatsApp Business",
          "Histórico de mensagens vinculado ao cliente",
          "Envio de documentos e notificações",
          "Atendimento multiusuário organizado",
        ],
        icon: MessageCircle,
        gradient: "from-green-400 via-emerald-500 to-green-600",
        accentColor: "text-green-400",
      },
      {
        title: "Intimações",
        description:
          "Gestão inteligente de intimações. Receba notificações automáticas dos tribunais, gerencie prazos e nunca perca um prazo judicial.",
        highlights: [
          "Captura automática de intimações",
          "Alertas de prazos críticos",
          "Classificação por urgência e tipo",
          "Vinculação automática a processos",
        ],
        icon: Bell,
        gradient: "from-red-500 via-rose-600 to-pink-700",
        accentColor: "text-red-400",
      },
      {
        title: "Agenda",
        description:
          "Organize compromissos, audiências e reuniões em um calendário visual e intuitivo com sincronização automática.",
        highlights: [
          "Visualização diária, semanal e mensal",
          "Sincronização com Google Calendar",
          "Lembretes automáticos por e-mail e push",
          "Compartilhamento entre equipe",
        ],
        icon: CalendarDays,
        gradient: "from-amber-500 via-orange-600 to-red-600",
        accentColor: "text-amber-400",
      },
      {
        title: "Tarefas",
        description:
          "Produtividade maximizada. Delegue tarefas, acompanhe o progresso da equipe e mantenha todos alinhados com notificações inteligentes.",
        highlights: [
          "Delegação inteligente com responsáveis",
          "Acompanhamento de progresso em tempo real",
          "Alertas configuráveis por prioridade",
          "Vinculação a processos e clientes",
        ],
        icon: ListTodo,
        gradient: "from-cyan-500 via-sky-600 to-blue-700",
        accentColor: "text-cyan-400",
      },
      {
        title: "Consulta Pública",
        description:
          "Pesquise processos em tribunais de todo o Brasil. Localize informações públicas rapidamente com nossa busca inteligente.",
        highlights: [
          "Busca em múltiplos tribunais",
          "Resultados unificados e organizados",
          "Importação rápida de dados",
          "Monitoramento de novos processos",
        ],
        icon: Search,
        gradient: "from-indigo-500 via-purple-600 to-violet-700",
        accentColor: "text-indigo-400",
      },
      {
        title: "Documentos Padrões",
        description:
          "Biblioteca de modelos jurídicos. Crie, edite e reutilize contratos, petições e documentos com preenchimento automático.",
        highlights: [
          "Templates personalizáveis",
          "Preenchimento automático de dados",
          "Versionamento de documentos",
          "Organização por categoria e tipo",
        ],
        icon: FileText,
        gradient: "from-teal-500 via-emerald-600 to-green-700",
        accentColor: "text-teal-400",
      },
      {
        title: "Financeiro",
        description:
          "Gestão financeira completa. Controle receitas e despesas, emita cobranças automatizadas e acompanhe o fluxo de caixa com precisão.",
        highlights: [
          "Dashboard financeiro com gráficos interativos",
          "Emissão de cobranças via PIX, boleto e cartão",
          "Controle de inadimplência automatizado",
          "Relatórios de faturamento detalhados",
        ],
        icon: Wallet,
        gradient: "from-lime-500 via-green-600 to-emerald-700",
        accentColor: "text-lime-400",
      },
      {
        title: "Relatórios",
        description:
          "Análises detalhadas do seu escritório. Extraia relatórios personalizados para tomar decisões baseadas em dados.",
        highlights: [
          "Relatórios analíticos por módulo",
          "Exportação em PDF e Excel",
          "Gráficos interativos",
          "Filtros avançados personalizáveis",
        ],
        icon: FileBarChart,
        gradient: "from-orange-500 via-amber-600 to-yellow-600",
        accentColor: "text-orange-400",
      },
      {
        title: "Configurações",
        description:
          "Controle total do sistema. Configure permissões, integrações e personalize o sistema para as necessidades do seu escritório.",
        highlights: [
          "Gestão avançada de usuários e acessos",
          "Integrações com APIs e parceiros",
          "Personalização de parâmetros",
          "Segurança e auditoria",
        ],
        icon: Settings,
        gradient: "from-slate-500 via-gray-600 to-zinc-700",
        accentColor: "text-slate-400",
      },
    ],
    [],
  );

  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored !== "hidden") {
      setOpen(true);
    }
  }, []);

  const closeTutorial = useCallback(() => {
    if (typeof window !== "undefined") {
      if (dontShowAgain) {
        window.localStorage.setItem(storageKey, "hidden");
      } else {
        window.localStorage.removeItem(storageKey);
      }
    }
    setOpen(false);
    setStepIndex(0);
  }, [dontShowAgain]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value) {
        closeTutorial();
      } else {
        setOpen(true);
      }
    },
    [closeTutorial],
  );

  const animateStep = useCallback((newIndex: number) => {
    setIsAnimating(true);
    setTimeout(() => {
      setStepIndex(newIndex);
      setIsAnimating(false);
    }, 150);
  }, []);

  const handleNext = useCallback(() => {
    if (stepIndex < steps.length - 1) {
      animateStep(stepIndex + 1);
    } else {
      closeTutorial();
    }
  }, [closeTutorial, stepIndex, steps.length, animateStep]);

  const handlePrev = useCallback(() => {
    if (stepIndex > 0) {
      animateStep(stepIndex - 1);
    }
  }, [stepIndex, animateStep]);

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const isFirstStep = stepIndex === 0;
  const StepIcon = currentStep.icon;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 p-0 shadow-2xl dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 sm:max-w-xl">
        {/* Header com gradiente */}
        <div className={`relative overflow-hidden bg-gradient-to-br ${currentStep.gradient} p-6 pb-12`}>
          {/* Efeito de brilho */}
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-12 -left-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />

          {/* Badge de etapa */}
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            <Sparkles className="h-3 w-3" />
            Etapa {stepIndex + 1} de {steps.length}
          </div>

          {/* Título e ícone */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-lg backdrop-blur-sm">
              <StepIcon className="h-7 w-7 text-white" />
            </div>
            <div>
              <DialogHeader className="space-y-0 p-0 text-left">
                <DialogTitle className="text-2xl font-bold tracking-tight text-white">
                  {currentStep.title}
                </DialogTitle>
              </DialogHeader>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative -mt-6 px-6">
          <div className="flex justify-between gap-1.5">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => animateStep(index)}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${index <= stepIndex
                  ? "bg-gradient-to-r from-white/80 to-white/60 shadow-sm shadow-white/20"
                  : "bg-white/20"
                  } ${index === stepIndex ? "scale-y-125" : ""}`}
                aria-label={`Ir para etapa ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Conteúdo */}
        <div
          className={`space-y-5 px-6 py-5 transition-all duration-150 ${isAnimating ? "translate-x-4 opacity-0" : "translate-x-0 opacity-100"
            }`}
        >
          <DialogDescription className="text-base leading-relaxed text-muted-foreground dark:text-zinc-300">
            {currentStep.description}
          </DialogDescription>

          {currentStep.highlights && (
            <div className="space-y-2.5">
              {currentStep.highlights.map((highlight, idx) => (
                <div
                  key={highlight}
                  className="flex items-start gap-3 rounded-xl bg-muted/50 px-4 py-3 transition-all hover:bg-muted/80 dark:bg-zinc-800/50 dark:hover:bg-zinc-800/80"
                  style={{
                    animationDelay: `${idx * 50}ms`,
                  }}
                >
                  <CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${currentStep.accentColor}`} />
                  <span className="text-sm font-medium text-foreground dark:text-zinc-200">{highlight}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex-col gap-4 border-t border-border/50 bg-muted/30 px-6 py-4 dark:border-zinc-800/50 dark:bg-zinc-900/50 sm:flex-row sm:items-center sm:justify-between">
          <label
            className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-300"
            htmlFor="tutorial-hide"
          >
            <Checkbox
              id="tutorial-hide"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              className="border-muted-foreground/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary dark:border-zinc-600"
            />
            Não mostrar novamente
          </label>

          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            {!isFirstStep && (
              <Button
                variant="ghost"
                onClick={handlePrev}
                className="gap-1 text-muted-foreground hover:bg-muted hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={closeTutorial}
              className="text-muted-foreground hover:bg-muted hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              Pular tutorial
            </Button>
            <Button
              onClick={handleNext}
              className={`gap-1 bg-gradient-to-r ${currentStep.gradient} font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]`}
            >
              {isLastStep ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Começar
                </>
              ) : (
                <>
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
