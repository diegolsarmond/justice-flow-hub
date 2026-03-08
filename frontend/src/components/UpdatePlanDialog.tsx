import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { plans as staticPlans } from "@/data/plans";
import { Subscription } from "@/types/subscription";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { fetchPlanOptions, type PlanOption } from "@/features/plans/api";

type UpdatePlanDialogProps = {
  subscription: Subscription;
  onUpdate: () => void;
};

const normalizePlanKey = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/plano/gi, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const UpdatePlanDialog = ({ subscription, onUpdate }: UpdatePlanDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const featuresIndex = useMemo(() => {
    const index = new Map<string, string[]>();
    staticPlans.forEach((plan) => {
      const keys = new Set<string>([
        normalizePlanKey(plan.name),
        normalizePlanKey(plan.id),
      ]);
      keys.forEach((key) => {
        if (key && !index.has(key)) {
          index.set(key, plan.features);
        }
      });
    });
    return index;
  }, []);
  const availablePlans = useMemo(() =>
    planOptions.map((plan) => {
      const normalizedName = normalizePlanKey(plan.name);
      const normalizedDescription = plan.description ? normalizePlanKey(plan.description) : "";
      return {
        id: String(plan.id),
        name: plan.name,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        annualPrice: plan.annualPrice,
        features:
          featuresIndex.get(normalizedName) ??
          (normalizedDescription ? featuresIndex.get(normalizedDescription) ?? [] : []),
        normalizedKey: normalizedName || normalizedDescription,
      };
    }),
    [planOptions, featuresIndex]);
  const planIdMap = useMemo(() => {
    const mapping = new Map<string, string>();
    planOptions.forEach((plan) => {
      const normalizedName = normalizePlanKey(plan.name);
      const normalizedDescription = plan.description ? normalizePlanKey(plan.description) : "";
      const matchedPlan = staticPlans.find((staticPlan) => {
        const normalizedStaticName = normalizePlanKey(staticPlan.name);
        const normalizedStaticId = normalizePlanKey(staticPlan.id);
        return (
          (normalizedStaticName && normalizedStaticName === normalizedName) ||
          (normalizedStaticId && normalizedStaticId === normalizedName) ||
          (normalizedDescription && normalizedDescription === normalizedStaticName)
        );
      });
      if (matchedPlan) {
        mapping.set(String(plan.id), matchedPlan.id);
      }
    });
    return mapping;
  }, [planOptions]);
  const defaultPlan = useMemo(() => {
    if (availablePlans.length === 0) {
      return "";
    }

    const planIdCandidate = (subscription as Subscription & { planId?: unknown }).planId;
    if (typeof planIdCandidate === "number" || typeof planIdCandidate === "string") {
      const normalizedId = String(planIdCandidate).trim();
      if (normalizedId.length > 0) {
        const byId = availablePlans.find((plan) => plan.id === normalizedId);
        if (byId) {
          return byId.id;
        }
      }
    }

    const normalizedDescription = normalizePlanKey(subscription.description ?? "");
    return (
      availablePlans.find((plan) => {
        if (!normalizedDescription) {
          return false;
        }
        const planKey = plan.normalizedKey ?? normalizePlanKey(plan.name);
        return planKey && normalizedDescription.includes(planKey);
      })?.id ??
      availablePlans[0]?.id ??
      ""
    );
  }, [availablePlans, subscription]);
  const [selectedPlan, setSelectedPlan] = useState(defaultPlan);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const controller = new AbortController();
    let cancelled = false;

    const loadPlans = async () => {
      setPlansLoading(true);
      setPlansError(null);

      try {
        const options = await fetchPlanOptions(controller.signal);
        if (!cancelled) {
          setPlanOptions(options);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        if ((error as DOMException)?.name === "AbortError") {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Não foi possível carregar os planos disponíveis.";
        setPlansError(message);
        setPlanOptions([]);
      } finally {
        if (!cancelled) {
          setPlansLoading(false);
        }
      }
    };

    void loadPlans();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open]);

  useEffect(() => {
    setSelectedPlan(defaultPlan);
  }, [defaultPlan]);

  const formatCurrency = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) {
      return null;
    }
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const requestJson = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    let payload: unknown = null;
    if (response.status !== 204) {
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const message =
        (payload && typeof payload === "object" && "error" in payload && payload.error)
          ? String(payload.error)
          : response.statusText || "Falha ao comunicar com o servidor.";
      throw new Error(message);
    }

    return payload;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) {
      return;
    }

    if (!selectedPlan) {
      toast({
        title: "Selecione um plano",
        description: "Escolha uma opção antes de confirmar a mudança.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const resolvedPlanId = (() => {
      const direct = planIdMap.get(String(selectedPlan));
      if (direct) {
        return direct;
      }
      const selected = availablePlans.find((plan) => plan.id === String(selectedPlan));
      if (!selected) {
        return selectedPlan;
      }
      const matchedPlan = staticPlans.find((plan) => {
        const normalizedStaticName = normalizePlanKey(plan.name);
        const normalizedStaticId = normalizePlanKey(plan.id);
        const normalizedSelected = normalizePlanKey(selected.name);
        const normalizedKey = selected.normalizedKey
          ? normalizePlanKey(selected.normalizedKey)
          : "";
        return (
          (normalizedStaticName && normalizedStaticName === normalizedSelected) ||
          (normalizedStaticId && normalizedStaticId === normalizedSelected) ||
          (normalizedKey && normalizedStaticName === normalizedKey)
        );
      });
      return matchedPlan?.id ?? selectedPlan;
    })();

    try {
      await requestJson(getApiUrl(`site/asaas/subscriptions/${encodeURIComponent(subscription.id)}`), {
        method: "PUT",
        body: JSON.stringify({ planId: resolvedPlanId }),
      });

      toast({
        title: "Plano atualizado",
        description: "As informações da assinatura foram atualizadas.",
      });
      setOpen(false);
      onUpdate();
    } catch (err: any) {
      toast({
        title: "Não foi possível atualizar",
        description: err?.message ?? "Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) {
          setSelectedPlan(defaultPlan);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          Atualizar assinatura
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="text-2xl">Atualizar plano</DialogTitle>
            <DialogDescription className="text-base">
              Selecione um novo plano para sua assinatura. A cobrança será ajustada automaticamente no próximo ciclo.
            </DialogDescription>
          </DialogHeader>

          {plansLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p>Carregando opções de planos...</p>
            </div>
          ) : availablePlans.length === 0 ? (
            <div className="py-8 text-center bg-muted/30 rounded-lg border border-dashed">
              <p className="text-muted-foreground">
                {plansError ?? "Nenhum plano disponível para alteração no momento."}
              </p>
            </div>
          ) : (
            <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan} className="grid gap-4 md:grid-cols-2">
              {availablePlans.map((plan) => {
                const isSelected = selectedPlan === plan.id;
                const isCurrent = defaultPlan === plan.id;

                return (
                  <label
                    key={plan.id}
                    htmlFor={plan.id}
                    className={`
                      relative flex flex-col justify-between border-2 rounded-xl p-5 cursor-pointer transition-all duration-200
                      hover:border-primary/50 hover:bg-muted/50
                      ${isSelected
                        ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20"
                        : "border-border bg-card"}
                    `}
                  >
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={plan.id} id={plan.id} className="sr-only" />
                          <div className={`
                            w-5 h-5 rounded-full border flex items-center justify-center transition-colors
                            ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"}
                          `}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-current" />}
                          </div>
                          <span className="font-bold text-lg">{plan.name}</span>
                        </div>
                        {isCurrent && (
                          <span className="text-[10px] uppercase font-bold tracking-wider bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                            Atual
                          </span>
                        )}
                      </div>

                      <div className="pl-8">
                        {plan.description && (
                          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                            {plan.description}
                          </p>
                        )}

                        <div className="mt-4 space-y-1">
                          {formatCurrency(plan.monthlyPrice) ? (
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-bold text-foreground">
                                {formatCurrency(plan.monthlyPrice)}
                              </span>
                              <span className="text-sm font-medium text-muted-foreground">/mês</span>
                            </div>
                          ) : (
                            <span className="text-lg font-bold text-foreground">Consulte condições</span>
                          )}

                          {formatCurrency(plan.annualPrice) && (
                            <p className="text-xs text-muted-foreground font-medium">
                              ou {formatCurrency(plan.annualPrice)}/ano
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {plan.features.length > 0 && (
                      <div className="pl-8 mt-2 pt-4 border-t border-border/50">
                        <ul className="space-y-2">
                          {plan.features.slice(0, 5).map((feature, idx) => (
                            <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                              <span className="mt-0.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                              <span className="leading-tight">{feature}</span>
                            </li>
                          ))}
                          {plan.features.length > 5 && (
                            <li className="text-xs text-primary font-medium pl-3 pt-1">
                              + {plan.features.length - 5} outros benefícios
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </label>
                );
              })}
            </RadioGroup>
          )}

          {plansError && availablePlans.length > 0 && (
            <p className="text-sm font-medium text-destructive px-1">{plansError}</p>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || plansLoading || !selectedPlan || selectedPlan === defaultPlan}
              className="min-w-[140px]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Atualizando...
                </>
              ) : (
                "Confirmar mudança"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UpdatePlanDialog;
