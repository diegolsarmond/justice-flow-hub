import { Link } from "react-router-dom";
import {
  MessageCircle,
  Smartphone,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Shield,
  DollarSign,
  Users,
  HardDrive,
  Infinity,
  MessageSquare,
  Bell,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import planUpgradeIllustration from "@/assets/plan-upgrade-illustration.svg";

export const planUpgradeIllustrationUrl = planUpgradeIllustration;

export const ConversasUpgradePrompt = () => {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-8 p-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
            <MessageCircle className="h-8 w-8 text-white" />
          </div>
          <h1 className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-3xl font-bold text-transparent">
            Ative já seu número!
          </h1>
          <p className="mt-2 text-muted-foreground">Integre o WhatsApp ao Quantum JUD e centralize seus atendimentos</p>
        </div>

        {/* Steps Card */}
        <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
          <div className="border-b bg-white/50 px-6 py-4 dark:bg-black/20">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <Smartphone className="h-5 w-5 text-green-600" />
              Como conectar
            </h2>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-3">
            {[
              { step: "1", icon: Smartphone, text: "Acesse o WhatsApp no seu celular" },
              { step: "2", icon: MessageSquare, text: 'Vá em "Dispositivos conectados" e toque em "Conectar dispositivo"' },
              { step: "3", icon: QrCode, text: "Aponte seu celular nesta tela e escaneie o QRCode gerado ao lado" },
            ].map((item, index) => (
              <div key={index} className="flex flex-col items-center gap-3 rounded-xl bg-white p-4 text-center shadow-sm dark:bg-black/30">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-lg font-bold text-white">
                  {item.step}
                </div>
                <item.icon className="h-6 w-6 text-green-600" />
                <p className="text-sm text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Card */}
        <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <div className="border-b bg-white/50 px-6 py-4 dark:bg-black/20">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <DollarSign className="h-5 w-5 text-blue-600" />
              Qual o valor desse serviço?
            </h2>
          </div>
          <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: MessageCircle, value: "R$69", label: "/mês por número conectado", color: "blue" },
              { icon: Users, value: "+R$19", label: "/mês por usuário adicional", color: "indigo" },
              { icon: HardDrive, value: "+R$2", label: "/mês por GB de armazenamento", color: "violet" },
              { icon: Infinity, value: "Ilimitado", label: "para planos que já possuem", color: "purple" },
            ].map((item, index) => (
              <div key={index} className="flex flex-col items-center gap-2 rounded-xl bg-white p-4 text-center shadow-sm dark:bg-black/30">
                <item.icon className={`h-6 w-6 text-${item.color}-600`} />
                <span className="text-2xl font-bold text-foreground">{item.value}</span>
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits Card */}
        <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
          <div className="border-b bg-white/50 px-6 py-4 dark:bg-black/20">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <Zap className="h-5 w-5 text-amber-600" />
              Vantagens de integrar seu número
            </h2>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-3">
            {[
              {
                icon: Users,
                title: "Centralização do atendimento",
                description: "Todas as conversas reunidas em um único lugar, com identificação do contato por foto para agilizar o reconhecimento do cliente.",
              },
              {
                icon: MessageSquare,
                title: "Mensagens pré-configuradas",
                description: "Utilize modelos de mensagens salvos para respostas rápidas, aumentando a produtividade da equipe.",
              },
              {
                icon: Bell,
                title: "Indicador de não lidas",
                description: "Badge vermelho em destaque para identificação imediata de atendimentos pendentes.",
              },
            ].map((item, index) => (
              <div key={index} className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-black/30">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 shadow-sm">
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Warnings Card */}
        <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20">
          <div className="border-b bg-white/50 px-6 py-4 dark:bg-black/20">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Limitação de responsabilidade
            </h2>
          </div>
          <div className="space-y-4 p-6">
            <p className="rounded-lg bg-white/80 p-4 text-sm leading-relaxed text-muted-foreground dark:bg-black/30">
              Ao sincronizar o WhatsApp por meio de QR Code, utilizando um método não oficial, você declara estar ciente de que a integração pode ser interrompida a qualquer momento, em decorrência de atualizações, políticas ou alterações técnicas nos aplicativos oficiais da Meta, empresa proprietária do WhatsApp.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-black/30">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                  <Shield className="h-4 w-4 text-red-600" />
                  Cuidados e boas práticas
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                    <span><strong className="text-foreground">Aquecimento de número:</strong> caso seja novo, envie mensagens gradualmente para reduzir riscos de bloqueio.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                    <span><strong className="text-foreground">WhatsApp pessoal:</strong> você é integralmente responsável pelo compartilhamento e acesso concedido a terceiros.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-black/30">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  Recomendações adicionais
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                    <span><strong className="text-foreground">Risco de bloqueio:</strong> números podem sofrer bloqueios temporários ou permanentes sem aviso.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                    <span><strong className="text-foreground">Responsabilidade:</strong> você é responsável pelas mensagens enviadas e conformidade com LGPD.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                    <span><strong className="text-foreground">Desconexões:</strong> sessões podem ser desconectadas automaticamente pelo WhatsApp.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                    <span><strong className="text-foreground">Sem vínculo:</strong> esta integração não possui homologação oficial da Meta.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button asChild size="lg" className="bg-gradient-to-r from-green-600 to-emerald-600 px-8 text-white shadow-lg shadow-green-500/25 hover:from-green-700 hover:to-emerald-700">
            <Link to="/meu-plano">Conhecer planos</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

type ModuleCopy = {
  title: string;
  description: string;
};

const moduleCopyMap: Record<string, ModuleCopy> = {
  dashboard: {
    title: "Painel completo para acompanhar o escritório",
    description:
      "Ative o dashboard inteligente e monitore indicadores, atividades e resultados em um só lugar, com dados em tempo real.",
  },
  conversas: {
    title: "Ative já seu número!",
    description: "Integre o WhatsApp ao Quantum JUD e centralize seus atendimentos.",
  },
  clientes: {
    title: "Crie um CRM jurídico poderoso",
    description:
      "Cadastre clientes, organize dados sensíveis e mantenha relacionamentos saudáveis com automações feitas para o dia a dia jurídico.",
  },
  fornecedores: {
    title: "Organize seus parceiros em um só lugar",
    description:
      "Controle cadastros de fornecedores, contratos e pagamentos futuros com a visibilidade que o seu time precisa.",
  },
  pipeline: {
    title: "Ganhe previsibilidade com o pipeline comercial",
    description:
      "Estruture fluxos de oportunidades, acompanhe etapas e feche novos contratos com mais agilidade.",
  },
  agenda: {
    title: "Nunca mais perca um compromisso",
    description:
      "Sincronize compromissos, atribua responsáveis e acompanhe reuniões e audiências com notificações inteligentes.",
  },
  tarefas: {
    title: "Transforme tarefas em entregas",
    description:
      "Distribua atividades entre a equipe, acompanhe prazos e garanta que nada passe despercebido.",
  },
  processos: {
    title: "Controle o andamento dos processos",
    description:
      "Monitore prazos, publique movimentações e concentre documentos importantes em um só ambiente seguro.",
  },
  "consulta-publica": {
    title: "Consulte processos públicos com agilidade",
    description:
      "Habilite a consulta pública para pesquisar processos, conferir detalhes e acessar informações abertas em poucos passos.",
  },
  intimacoes: {
    title: "Automatize o acompanhamento de intimações",
    description:
      "Receba alertas instantâneos, organize responsáveis e reduza riscos com o monitoramento proativo de intimações.",
  },
  documentos: {
    title: "Padronize documentos em minutos",
    description:
      "Acesse modelos, edite contratos e colabore em tempo real com o módulo de Documentos avançado.",
  },
  arquivos: {
    title: "Organize arquivos com segurança em um só lugar",
    description:
      "Conheça os planos disponíveis e habilite o Meus Arquivos para armazenar, compartilhar e colaborar com o time.",
  },
  financeiro: {
    title: "Domine os números do escritório",
    description:
      "Registre lançamentos, acompanhe entradas e saídas e projete resultados com o módulo Financeiro.",
  },
  relatorios: {
    title: "Tome decisões com dados confiáveis",
    description:
      "Gere relatórios personalizados, acompanhe indicadores chave e compartilhe insights com a liderança.",
  },
  suporte: {
    title: "Acesse o suporte premium do Quantum JUD",
    description:
      "Priorize chamados, fale com especialistas e garanta que o time tenha a ajuda necessária em cada etapa.",
  },
  "configuracoes-usuarios": {
    title: "Gestão avançada de usuários",
    description:
      "Controle permissões, convites e níveis de acesso com workflows prontos para equipes em crescimento.",
  },
  configuracoes: {
    title: "Personalize o Quantum JUD para o seu escritório",
    description:
      "Ative o módulo de configurações para adaptar fluxos, integrações e parametrizações ao seu jeito de trabalhar.",
  },
  "configuracoes-integracoes": {
    title: "Integre suas ferramentas preferidas",
    description:
      "Conecte softwares jurídicos, CRMs, plataformas de comunicação e muito mais em poucos cliques.",
  },
  "configuracoes-parametros": {
    title: "Parametrize processos e cadastros",
    description:
      "Defina campos, etiquetas e regras específicas para manter a base de dados organizada e atualizada.",
  },
  "meu-plano": {
    title: "Gerencie a assinatura do seu escritório",
    description:
      "Visualize informações de cobrança, atualize o plano atual e acompanhe limites diretamente na plataforma.",
  },
};

const fallbackCopy: ModuleCopy = {
  title: "Libere novos recursos no Quantum JUD",
  description:
    "Conheça os planos disponíveis e ative funcionalidades que ajudam seu escritório a ganhar eficiência e resultados.",
};

const resolveCopy = (moduleId: string | string[] | undefined): ModuleCopy => {
  if (!moduleId) {
    return fallbackCopy;
  }

  const moduleIds = Array.isArray(moduleId) ? moduleId : [moduleId];

  for (const id of moduleIds) {
    const copy = moduleCopyMap[id];
    if (copy) {
      return copy;
    }
  }

  return fallbackCopy;
};

interface PlanUpgradePromptProps {
  module?: string | string[];
}

export const PlanUpgradePrompt = ({ module }: PlanUpgradePromptProps) => {
  const moduleIds = Array.isArray(module) ? module : module ? [module] : [];

  if (moduleIds.includes("conversas")) {
    return <ConversasUpgradePrompt />;
  }

  const copy = resolveCopy(module);

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-6 text-center">
        <img
          src={planUpgradeIllustration}
          alt="Ilustração de atualização de plano com destaque para recursos premium"
          className="w-full max-w-[280px]"
        />
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold leading-snug text-foreground sm:text-3xl">{copy.title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{copy.description}</p>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/meu-plano">Conhecer planos</Link>
        </Button>
      </div>
    </div>
  );
};

export type { ModuleCopy };
export { moduleCopyMap };
