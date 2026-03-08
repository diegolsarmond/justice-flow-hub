import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Check } from "lucide-react";

export type PricingPlan = {
    name: string;
    price: string | null;
    yearlyPrice: string | null;
    period: string;
    features: string[];
    description?: string | null;
    buttonText: string;
    href: string;
    isPopular?: boolean;
};

type PricingProps = {
    plans: PricingPlan[];
    onPrimaryClick?: (plan: PricingPlan, index: number) => void;
    onSecondaryClick?: (plan: PricingPlan, index: number) => void;
    secondaryButtonText?: string;
    secondaryHref?: string;
};

const Pricing = ({ plans, onPrimaryClick, onSecondaryClick, secondaryButtonText, secondaryHref }: PricingProps) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {plans.map((plan, index) => (
                <Card
                    key={plan.name}
                    className={`relative flex h-full flex-col overflow-hidden border bg-background/70 backdrop-blur transition-all duration-300 hover:-translate-y-2 hover:shadow-quantum ${
                        plan.isPopular ? "border-transparent shadow-quantum ring-2 ring-quantum-bright/60" : "border-quantum-light/20"
                    }`}
                >
                    {plan.isPopular && (
                        <span className="absolute top-4 right-4 rounded-full bg-gradient-quantum px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                            Mais completo
                        </span>
                    )}
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-quantum-bright/60 to-transparent"></div>
                    <CardHeader className="space-y-4">
                        <div className="space-y-2">
                            <CardTitle className="text-2xl">{plan.name}</CardTitle>
                            {plan.description && <CardDescription className="text-muted-foreground leading-relaxed">{plan.description}</CardDescription>}
                        </div>
                        <div className="space-y-2">
                            {plan.price && (
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-quantum-bright">{plan.price}</span>
                                    <span className="text-sm text-muted-foreground">/ {plan.period}</span>
                                </div>
                            )}
                            {plan.yearlyPrice && (
                                <p className="text-sm text-muted-foreground">Plano anual: {plan.yearlyPrice}</p>
                            )}
                            {!plan.price && !plan.yearlyPrice && <p className="text-sm text-muted-foreground">Investimento sob consulta.</p>}
                        </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-4">
                        <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-quantum-light">Principais benefícios</p>
                            <ul className="space-y-2">
                                {plan.features.length > 0 ? (
                                    plan.features.slice(0, 6).map((feature) => (
                                        <li key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
                                            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-quantum-bright" />
                                            <span>{feature}</span>
                                        </li>
                                    ))
                                ) : (
                                    <li className="text-sm text-muted-foreground">Personalize o pacote com nossos especialistas para incluir os recursos desejados.</li>
                                )}
                            </ul>
                        </div>
                    </CardContent>
                    <CardFooter className="mt-auto flex flex-col gap-3">
                        <Button
                            variant="quantum"
                            className="w-full track-link"
                            asChild
                            onClick={() => onPrimaryClick?.(plan, index)}
                        >
                            <a href={plan.href} className="flex items-center justify-center gap-2">
                                <span>{plan.buttonText}</span>
                                <ArrowRight className="h-5 w-5" />
                                <span className="sr-only"> {plan.name}</span>
                            </a>
                        </Button>
                        <Button
                            variant="outline_quantum"
                            className="w-full track-link"
                            asChild
                            onClick={() => onSecondaryClick?.(plan, index)}
                        >
                            <a href={secondaryHref ?? plan.href}>{secondaryButtonText ?? "Falar no WhatsApp"}</a>
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
};

export default Pricing;
