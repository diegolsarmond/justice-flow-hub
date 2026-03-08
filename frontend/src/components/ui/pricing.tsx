import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type BillingInterval = "monthly" | "yearly";

export type PricingPlan = {
  name: string;
  description?: string;
  priceMonthly?: string;
  priceYearly?: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlighted?: boolean;
  badge?: string;
};

type PricingProps = {
  title?: string;
  subtitle?: string;
  plans: PricingPlan[];
};

function resolveInitialInterval(plans: PricingPlan[]): BillingInterval {
  const hasMonthly = plans.some((plan) => plan.priceMonthly !== undefined);
  if (hasMonthly) {
    return "monthly";
  }
  return "yearly";
}

export function Pricing({ title, subtitle, plans }: PricingProps) {
  const [interval, setInterval] = useState<BillingInterval>(() => resolveInitialInterval(plans));

  const canToggleInterval = useMemo(
    () => plans.some((plan) => plan.priceMonthly !== undefined && plan.priceYearly !== undefined),
    [plans],
  );

  useEffect(() => {
    setInterval((previous) => {
      const desired = resolveInitialInterval(plans);
      if (previous === desired) {
        return previous;
      }
      return desired;
    });
  }, [plans]);

  return (
    <section className="w-full space-y-10">
      <div className="space-y-3 text-center">
        {title && <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">{title}</h2>}
        {subtitle && <p className="text-muted-foreground text-lg md:text-xl">{subtitle}</p>}
        {canToggleInterval && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className={cn("text-sm font-medium", interval === "monthly" ? "text-primary" : "text-muted-foreground")}>Mensal</span>
            <Switch
              checked={interval === "yearly"}
              onCheckedChange={(checked) => setInterval(checked ? "yearly" : "monthly")}
            />
            <span className={cn("text-sm font-medium", interval === "yearly" ? "text-primary" : "text-muted-foreground")}>Anual</span>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const price = interval === "monthly" ? plan.priceMonthly ?? plan.priceYearly : plan.priceYearly ?? plan.priceMonthly;
          const cadence = interval === "monthly" ? "/mês" : "/ano";
          const showCadence = price !== undefined;

          return (
            <Card
              key={plan.name}
              className={cn(
                "flex h-full flex-col border border-border/70",
                plan.highlighted && "border-primary shadow-lg shadow-primary/20",
              )}
            >
              <CardHeader className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                    {plan.description && <CardDescription className="text-base">{plan.description}</CardDescription>}
                  </div>
                  {plan.badge && (
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{plan.badge}</span>
                  )}
                </div>

                {price && (
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{price}</span>
                    {showCadence && <span className="text-sm text-muted-foreground">{cadence}</span>}
                  </div>
                )}
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button className="w-full" variant={plan.highlighted ? "default" : "outline"} asChild>
                  <Link to={plan.ctaHref}>{plan.ctaLabel}</Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
