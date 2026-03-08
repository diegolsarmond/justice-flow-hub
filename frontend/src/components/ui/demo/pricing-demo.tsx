import { useMemo } from "react";

import { Pricing, PricingPlan } from "@/components/ui/pricing";

const demoPlans: PricingPlan[] = [
  {
    name: "Essencial",
    description: "Ferramentas básicas para organizar seu funil comercial.",
    priceMonthly: "R$ 59",
    priceYearly: "R$ 49",
    features: [
      "Até 3 pipelines de vendas",
      "Dashboards simples",
      "Suporte por e-mail",
    ],
    ctaLabel: "Começar gratuito",
    ctaHref: "/cadastro",
  },
  {
    name: "Profissional",
    description: "Recursos completos para equipes de alta performance.",
    priceMonthly: "R$ 129",
    priceYearly: "R$ 109",
    features: [
      "Automação de tarefas",
      "Integração com e-mail e agenda",
      "Relatórios avançados",
      "Suporte prioritário",
    ],
    ctaLabel: "Falar com vendas",
    ctaHref: "/contato",
    highlighted: true,
    badge: "Mais popular",
  },
  {
    name: "Enterprise",
    description: "Escalabilidade e governança para grandes operações.",
    priceMonthly: "Sob consulta",
    features: [
      "Implantação assistida",
      "SSO e permissões avançadas",
      "Acordos de nível de serviço",
      "Suporte dedicado",
    ],
    ctaLabel: "Solicitar proposta",
    ctaHref: "/contato",
  },
];

export function PricingBasic() {
  const plans = useMemo(() => demoPlans, []);

  return (
    <div className="mx-auto max-w-6xl">
      <Pricing
        title="Planos do CRM"
        subtitle="Escolha o melhor pacote para acelerar suas vendas"
        plans={plans}
      />
    </div>
  );
}
