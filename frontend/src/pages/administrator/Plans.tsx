import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Loader2, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { getApiBaseUrl, joinUrl } from "@/lib/api";
import { routes } from "@/config/routes";
import { useToast } from "@/hooks/use-toast";
import {
  ModuleInfo,
  Plan,
  PlanFormState,
  initialPlanFormState,
  extractCollection,
  parseInteger,
  sanitizeLimitInput,
  orderModules,
  parseModuleInfo,
  parsePlan,
  formatLimit,
  splitFeatureInput,
  buildRecursosPayload,
  extractCurrencyDigits,
  formatCurrencyInputValue,
  parseCurrencyDigits,
  ensureDefaultModules,
} from "./plans-utils";

interface ModuleMultiSelectProps {
  modules: ModuleInfo[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

const areArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

function ModuleMultiSelect({ modules, selected, onChange, disabled }: ModuleMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggleModule = (moduleId: string) => {
    const next = new Set(selectedSet);
    if (selectedSet.has(moduleId)) {
      next.delete(moduleId);
    } else {
      next.add(moduleId);
    }
    onChange(Array.from(next));
  };

  const triggerLabel = selected.length
    ? `${selected.length} módulo${selected.length > 1 ? "s" : ""} selecionado${selected.length > 1 ? "s" : ""
    }`
    : "Selecione os módulos";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || modules.length === 0}
        >
          <span className="truncate text-left">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(520px,90vw)] p-0">
        <Command>
          <CommandInput placeholder="Buscar módulo..." />
          <CommandList>
            <CommandEmpty>Nenhum módulo encontrado.</CommandEmpty>
            <CommandGroup>
              {modules.map((module) => {
                const isSelected = selectedSet.has(module.id);
                return (
                  <CommandItem
                    key={module.id}
                    value={module.nome}
                    onSelect={() => toggleModule(module.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1 truncate">{module.nome}</span>
                    {module.categoria ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {module.categoria}
                      </span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const PRICE_SANITIZE_REGEX = /[^0-9.,-]/g;

const parsePriceCents = (value: string): number | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const sanitized = trimmed.replace(PRICE_SANITIZE_REGEX, "");
  if (!sanitized) {
    return null;
  }

  if (sanitized.includes(",")) {
    const normalized = sanitized.replace(/\./g, "").replace(/,/g, ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      const cents = Math.round(parsed * 100);
      return Number.isNaN(cents) ? null : cents;
    }
  }

  const normalized = sanitized.replace(/,/g, ".");
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) {
    const cents = Math.round(parsed * 100);
    return Number.isNaN(cents) ? null : cents;
  }

  return null;
};

const formatPriceForInput = (value: string): string => {
  if (!value) {
    return "";
  }

  const cents = parsePriceCents(value);
  if (cents == null) {
    return value.trim();
  }

  return formatCurrencyInputValue(String(cents));
};

const formatPriceForDisplay = (value: string): string => {
  const formatted = formatPriceForInput(value);
  if (!formatted) {
    const trimmed = value.trim();
    return trimmed || "—";
  }

  return formatted;
};

const createFormStateFromPlan = (plan: Plan): PlanFormState => ({
  name: plan.name,
  monthlyPrice: formatPriceForInput(plan.monthlyPrice),
  annualPrice: formatPriceForInput(plan.annualPrice),
  modules: [...plan.modules],
  customAvailableFeatures: plan.customAvailableFeatures.join(", "),
  customUnavailableFeatures: plan.customUnavailableFeatures.join(", "),
  clientLimit: plan.clientLimit != null ? String(plan.clientLimit) : "",
  userLimit: plan.userLimit != null ? String(plan.userLimit) : "",
  processLimit: plan.processLimit != null ? String(plan.processLimit) : "",
  proposalLimit: plan.proposalLimit != null ? String(plan.proposalLimit) : "",
  processSyncEnabled: plan.processSyncEnabled,
  processSyncQuota: plan.processSyncQuota != null ? String(plan.processSyncQuota) : "",
});

export default function Plans() {
  const apiUrl = getApiBaseUrl();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [availableModules, setAvailableModules] = useState<ModuleInfo[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editFormState, setEditFormState] = useState<PlanFormState>(initialPlanFormState);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editIntimationSyncEnabled, setEditIntimationSyncEnabled] = useState(false);
  const [editIntimationSyncQuota, setEditIntimationSyncQuota] = useState("");
  const [editProcessMonitorLawyerLimit, setEditProcessMonitorLawyerLimit] = useState("");
  const [editIntimationMonitorLawyerLimit, setEditIntimationMonitorLawyerLimit] = useState("");
  const [statusUpdatePlanId, setStatusUpdatePlanId] = useState<number | null>(null);

  const moduleLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    availableModules.forEach((module) => {
      map.set(module.id, module.nome);
    });
    return map;
  }, [availableModules]);

  const matchesPublicConsultation = (value: string | undefined): boolean => {
    if (!value) {
      return false;
    }

    const normalized = value
      .normalize("NFD")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    return normalized.includes("consulta publica");
  };

  const availablePublicConsultationModules = useMemo(
    () =>
      availableModules.filter(
        (module) =>
          matchesPublicConsultation(module.categoria) || matchesPublicConsultation(module.nome),
      ),
    [availableModules],
  );

  const publicConsultationModuleIdSet = useMemo(
    () => new Set(availablePublicConsultationModules.map((module) => module.id)),
    [availablePublicConsultationModules],
  );


  const normalizePlan = (plan: Plan, modules: ModuleInfo[]): Plan => {
    const moduleIds = Array.isArray(plan.modules) ? plan.modules : [];
    const publicConsultationModuleIds = Array.isArray(plan.publicConsultationModules)
      ? plan.publicConsultationModules
      : [];

    return {
      ...plan,
      modules: orderModules(
        Array.from(
          new Set([
            ...moduleIds,
            ...publicConsultationModuleIds,
          ]),
        ).filter((id) => modules.some((module) => module.id === id)),
        modules
      ),
      publicConsultationModules: orderModules(
        publicConsultationModuleIds.filter((id) =>
          modules.some((module) => module.id === id)
        ),
        modules
      ),
    };
  };

  const normalizePlans = (rawPlans: Plan[], modules: ModuleInfo[]) =>
    rawPlans
      .map((plan) => normalizePlan(plan, modules))
      .sort((a, b) => a.name.localeCompare(b.name));

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [modulesResponse, plansResponse] = await Promise.all([
        fetch(joinUrl(apiUrl, "/api/perfis/modulos"), { headers: { Accept: "application/json" } }),
        fetch(joinUrl(apiUrl, "/api/planos"), { headers: { Accept: "application/json" } }),
      ]);

      if (!modulesResponse.ok) {
        throw new Error(`HTTP ${modulesResponse.status}: ${await modulesResponse.text()}`);
      }
      if (!plansResponse.ok) {
        throw new Error(`HTTP ${plansResponse.status}: ${await plansResponse.text()}`);
      }

      const modulesPayload = extractCollection(await modulesResponse.json());
      const parsedModules = modulesPayload
        .map((entry) => parseModuleInfo(entry))
        .filter((item): item is ModuleInfo => item !== null);

      const augmentedModules = ensureDefaultModules(parsedModules);

      const plansPayload = extractCollection(await plansResponse.json());
      const parsedPlans = plansPayload
        .map((entry) => parsePlan(entry))
        .filter((item): item is Plan => item !== null);

      setAvailableModules(augmentedModules);
      setPlans(normalizePlans(parsedPlans, augmentedModules));
    } catch (err) {
      console.error(err);
      setAvailableModules([]);
      setPlans([]);
      setError(err instanceof Error ? err.message : "Não foi possível carregar os planos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  const refreshPlans = async () => {
    try {
      const response = await fetch(joinUrl(apiUrl, "/api/planos"), {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const payload = extractCollection(await response.json());
      const parsedPlans = payload
        .map((entry) => parsePlan(entry))
        .filter((item): item is Plan => item !== null);

      setPlans(normalizePlans(parsedPlans, availableModules));
    } catch (err) {
      console.error(err);
      toast({
        title: "Erro ao atualizar planos",
        description: err instanceof Error ? err.message : "Não foi possível atualizar a lista.",
        variant: "destructive",
      });
    }
  };

  const handlePlanStatusChange = async (plan: Plan, nextStatus: boolean) => {
    if (statusUpdatePlanId != null) {
      return;
    }

    setStatusUpdatePlanId(plan.id);
    try {
      const response = await fetch(joinUrl(apiUrl, `/api/planos/${plan.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ ativo: nextStatus }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      let updatedPlan: Plan | null = null;
      try {
        const data = await response.json();
        const parsed = parsePlan(data);
        if (parsed) {
          updatedPlan = normalizePlan(parsed, availableModules);
        }
      } catch {
        updatedPlan = null;
      }

      if (updatedPlan) {
        setPlans((previous) =>
          normalizePlans(
            previous.map((item) => (item.id === updatedPlan!.id ? updatedPlan! : item)),
            availableModules,
          ),
        );
      } else {
        await refreshPlans();
      }

      toast({
        title: nextStatus ? "Plano ativado" : "Plano inativado",
        description: `O plano ${plan.name} foi ${nextStatus ? "ativado" : "inativado"} com sucesso.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Não foi possível atualizar o status do plano",
        description:
          err instanceof Error ? err.message : "Ocorreu um erro ao atualizar o status do plano.",
        variant: "destructive",
      });
    } finally {
      setStatusUpdatePlanId(null);
    }
  };

  const renderModuleBadges = (modules: string[]) => {
    if (modules.length === 0) {
      return <span className="text-sm text-muted-foreground">Nenhum módulo selecionado</span>;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {modules.map((moduleId) => (
          <Badge key={moduleId} variant="secondary">
            {moduleLabelMap.get(moduleId) ?? moduleId}
          </Badge>
        ))}
      </div>
    );
  };

  const renderCustomFeatureBadges = (
    items: string[],
    emptyMessage: string,
    variant: "secondary" | "outline" = "secondary",
  ) => {
    if (items.length === 0) {
      return <span className="text-sm text-muted-foreground">{emptyMessage}</span>;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item} variant={variant} className="whitespace-nowrap">
            {item}
          </Badge>
        ))}
      </div>
    );
  };

  const openEditDialog = (plan: Plan) => {
    setEditingPlan(plan);

    const normalizedModules = orderModules(
      Array.from(new Set([...plan.modules, ...plan.publicConsultationModules])).filter((id) =>
        availableModules.some((module) => module.id === id)
      ),
      availableModules,
    );

    setEditFormState({
      ...createFormStateFromPlan(plan),
      modules: normalizedModules,
    });

    setEditIntimationSyncEnabled(plan.intimationSyncEnabled);
    setEditIntimationSyncQuota(
      plan.intimationSyncQuota != null ? String(plan.intimationSyncQuota) : ""
    );
    setEditProcessMonitorLawyerLimit(
      plan.processMonitorLawyerLimit != null ? String(plan.processMonitorLawyerLimit) : ""
    );
    setEditIntimationMonitorLawyerLimit(
      plan.intimationMonitorLawyerLimit != null ? String(plan.intimationMonitorLawyerLimit) : ""
    );
    setEditError(null);
    setIsEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingPlan(null);
    setEditFormState(initialPlanFormState);
    setEditIntimationSyncEnabled(false);
    setEditIntimationSyncQuota("");
    setEditProcessMonitorLawyerLimit("");
    setEditIntimationMonitorLawyerLimit("");
    setEditError(null);
  };

  const handleEditModuleChange = (modules: string[]) => {
    const normalizedModules = orderModules(
      modules.filter((id) => availableModules.some((module) => module.id === id)),
      availableModules
    );

    setEditFormState((previous) => ({
      ...previous,
      modules: normalizedModules,
    }));
  };

  const editCustomAvailableTopics = useMemo(
    () => splitFeatureInput(editFormState.customAvailableFeatures),
    [editFormState.customAvailableFeatures],
  );

  const editCustomUnavailableTopics = useMemo(
    () => splitFeatureInput(editFormState.customUnavailableFeatures),
    [editFormState.customUnavailableFeatures],
  );

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingPlan || isSavingEdit) {
      return;
    }

    const name = editFormState.name.trim();
    const monthlyPriceDigits = extractCurrencyDigits(editFormState.monthlyPrice);
    const annualPriceDigits = extractCurrencyDigits(editFormState.annualPrice);
    if (!name || !monthlyPriceDigits || !annualPriceDigits) {
      setEditError("Informe o nome, o valor mensal e o valor anual do plano.");
      return;
    }

    const monthlyPriceValue = parseCurrencyDigits(monthlyPriceDigits);
    const annualPriceValue = parseCurrencyDigits(annualPriceDigits);
    if (monthlyPriceValue == null || annualPriceValue == null) {
      setEditError("Informe valores numéricos válidos para os preços mensal e anual.");
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);

    const orderedModules = orderModules(editFormState.modules, availableModules);
    const existingPublicConsultationModuleIds = new Set(
      editingPlan.publicConsultationModules,
    );
    const orderedPublicConsultationModules = orderModules(
      orderedModules.filter(
        (id) =>
          publicConsultationModuleIdSet.has(id) ||
          existingPublicConsultationModuleIds.has(id),
      ),
      availableModules,
    );
    const clientLimit = parseInteger(editFormState.clientLimit);
    const userLimit = parseInteger(editFormState.userLimit);
    const processLimit = parseInteger(editFormState.processLimit);
    const proposalLimit = parseInteger(editFormState.proposalLimit);
    const processSyncQuota = editFormState.processSyncEnabled
      ? parseInteger(editFormState.processSyncQuota)
      : null;
    const intimationSyncQuotaValue = editIntimationSyncEnabled
      ? parseInteger(editIntimationSyncQuota)
      : null;
    const customAvailable = splitFeatureInput(editFormState.customAvailableFeatures);
    const customUnavailable = splitFeatureInput(editFormState.customUnavailableFeatures);
    const processMonitorLawyerLimitValue = parseInteger(editProcessMonitorLawyerLimit);
    const intimationMonitorLawyerLimitValue = parseInteger(editIntimationMonitorLawyerLimit);

    const payload: Record<string, unknown> = {
      nome: name,
      valor_mensal: monthlyPriceValue,
      valor_anual: annualPriceValue,
      valor: monthlyPriceValue,
      modulos: orderedModules,
      recursos: buildRecursosPayload({
        modules: orderedModules,
        customAvailable,
        customUnavailable,
      }),
      limite_clientes: clientLimit,
      clientes_limit: clientLimit,
      client_limit: clientLimit,
      limite_usuarios: userLimit,
      qtde_usuarios: userLimit,
      limite_processos: processLimit,
      max_casos: processLimit,
      limite_propostas: proposalLimit,
      sincronizacao_processos_habilitada: editFormState.processSyncEnabled,
      sincronizacao_processos_cota: editFormState.processSyncEnabled ? processSyncQuota : null,
      sincronizacao_processos_limite: editFormState.processSyncEnabled ? processSyncQuota : null,
      sincronizacaoProcessosLimite: editFormState.processSyncEnabled ? processSyncQuota : null,
      processSyncLimit: editFormState.processSyncEnabled ? processSyncQuota : null,
      consulta_publica_modulos: orderedPublicConsultationModules,
      consultaPublicaModulos: orderedPublicConsultationModules,
      publicConsultationModules: orderedPublicConsultationModules,
      recursos_consulta_publica: orderedPublicConsultationModules,
      sincronizacao_intimacoes_habilitada: editIntimationSyncEnabled,
      sincronizacaoIntimacoesHabilitada: editIntimationSyncEnabled,
      intimationSyncEnabled: editIntimationSyncEnabled,
      sincronizacao_intimacoes_cota: editIntimationSyncEnabled ? intimationSyncQuotaValue : null,
      sincronizacaoIntimacoesCota: editIntimationSyncEnabled ? intimationSyncQuotaValue : null,
      sincronizacao_intimacoes_limite: editIntimationSyncEnabled
        ? intimationSyncQuotaValue
        : null,
      sincronizacaoIntimacoesLimite: editIntimationSyncEnabled
        ? intimationSyncQuotaValue
        : null,
      intimationSyncLimit: editIntimationSyncEnabled ? intimationSyncQuotaValue : null,
      intimationSyncQuota: editIntimationSyncEnabled ? intimationSyncQuotaValue : null,
      limite_advogados_processos: processMonitorLawyerLimitValue,
      limiteAdvogadosProcessos: processMonitorLawyerLimitValue,
      limite_advogados_processos_monitorados: processMonitorLawyerLimitValue,
      processMonitorLawyerLimit: processMonitorLawyerLimitValue,
      limite_advogados_intimacoes: intimationMonitorLawyerLimitValue,
      limiteAdvogadosIntimacoes: intimationMonitorLawyerLimitValue,
      limite_advogados_intimacoes_monitoradas: intimationMonitorLawyerLimitValue,
      intimationMonitorLawyerLimit: intimationMonitorLawyerLimitValue,
    };

    try {
      const response = await fetch(joinUrl(apiUrl, `/api/planos/${editingPlan.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      let updatedPlan: Plan | null = null;
      try {
        const data = await response.json();
        const parsed = parsePlan(data);
        if (parsed) {
          updatedPlan = normalizePlan(parsed, availableModules);
        }
      } catch {
        // Resposta sem corpo JSON; será tratado pelo refresh abaixo
      }

      if (updatedPlan) {
        setPlans((previous) =>
          normalizePlans(
            previous.map((plan) => (plan.id === updatedPlan!.id ? updatedPlan! : plan)),
            availableModules
          )
        );
      } else {
        await refreshPlans();
      }

      toast({
        title: "Plano atualizado",
        description: `O plano ${name} foi atualizado com sucesso.`,
      });
      closeEditDialog();
    } catch (err) {
      console.error(err);
      setEditError(err instanceof Error ? err.message : "Não foi possível atualizar o plano.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Planos
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os planos de assinatura, limites e configurações de recursos.
          </p>
        </div>
        <Button
          onClick={() => navigate(routes.admin.newPlan)}
          className="w-full md:w-auto shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Plano
        </Button>
      </div>

      <Card className="border-muted/60 shadow-md">
        <CardHeader>
          <CardTitle>Catálogo de Planos</CardTitle>
          <CardDescription>Visão geral de todos os planos ativos e inativos no sistema.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Erro ao carregar planos</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-3 h-3 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-3 h-3 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="text-sm text-muted-foreground">Carregando catálogo de planos...</p>
            </div>
          ) : (
            <div className="rounded-lg border bg-background/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="pl-4">Plano</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Módulos</TableHead>
                    <TableHead>Limites</TableHead>
                    <TableHead>Sincronização</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px] text-right pr-4">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id} className="group hover:bg-muted/50 transition-colors">
                      <TableCell className="align-top font-semibold pl-4">
                        <div className="flex flex-col">
                          <span className="text-foreground">{plan.name}</span>
                          <span className="text-xs text-muted-foreground font-normal">ID: {plan.id}</span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground text-xs uppercase tracking-wider">Mensal</span>
                            <span className="font-medium font-mono">{formatPriceForDisplay(plan.monthlyPrice)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground text-xs uppercase tracking-wider">Anual</span>
                            <span className="font-medium font-mono">{formatPriceForDisplay(plan.annualPrice)}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top max-w-[250px]">{renderModuleBadges(plan.modules)}</TableCell>
                      <TableCell className="align-top">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>Clientes</span>
                            <span className="font-medium text-foreground">{formatLimit(plan.clientLimit)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>Usuários</span>
                            <span className="font-medium text-foreground">{formatLimit(plan.userLimit)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>Processos</span>
                            <span className="font-medium text-foreground">{formatLimit(plan.processLimit)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>Propostas</span>
                            <span className="font-medium text-foreground">{formatLimit(plan.proposalLimit)}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${plan.processSyncEnabled ? 'bg-green-500' : 'bg-muted-foreground/30'}`}></div>
                            <span className="text-sm font-medium">{plan.processSyncEnabled ? "Habilitada" : "Desabilitada"}</span>
                          </div>
                          {plan.processSyncEnabled && (
                            <div className="text-xs flex items-center gap-1 text-muted-foreground">
                              <span>Cota:</span>
                              <span className="font-mono font-medium text-foreground">{formatLimit(plan.processSyncQuota)}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`plan-${plan.id}-status`}
                              checked={plan.isActive}
                              onCheckedChange={(checked) => handlePlanStatusChange(plan, checked)}
                              disabled={statusUpdatePlanId != null}
                              className="scale-75 origin-left"
                            />
                            <span className={`text-xs font-medium ${plan.isActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                              {statusUpdatePlanId === plan.id
                                ? "..."
                                : plan.isActive
                                  ? "Ativo"
                                  : "Inativo"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-right pr-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(plan)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {plans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <Plus className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p>Nenhum plano cadastrado. Crie o primeiro plano para começar.</p>
                          <Button variant="outline" size="sm" onClick={() => navigate(routes.admin.newPlan)}>
                            Criar Plano
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeEditDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Plano</DialogTitle>
            <DialogDescription>Atualize as configurações e limites do plano.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-8 py-4">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2 col-span-full lg:col-span-1">
                <Label htmlFor="edit-plan-name">Nome do plano</Label>
                <Input
                  id="edit-plan-name"
                  value={editFormState.name}
                  onChange={(event) =>
                    setEditFormState((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  disabled={isSavingEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-plan-monthly-price">Valor mensal</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <Input
                    id="edit-plan-monthly-price"
                    value={editFormState.monthlyPrice}
                    inputMode="decimal"
                    className="pl-9"
                    onChange={(event) => {
                      const digits = extractCurrencyDigits(event.target.value);
                      setEditFormState((prev) => ({
                        ...prev,
                        monthlyPrice: formatCurrencyInputValue(digits),
                      }));
                    }}
                    disabled={isSavingEdit}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-plan-annual-price">Valor anual</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <Input
                    id="edit-plan-annual-price"
                    value={editFormState.annualPrice}
                    inputMode="decimal"
                    className="pl-9"
                    onChange={(event) => {
                      const digits = extractCurrencyDigits(event.target.value);
                      setEditFormState((prev) => ({
                        ...prev,
                        annualPrice: formatCurrencyInputValue(digits),
                      }));
                    }}
                    disabled={isSavingEdit}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Módulos do Sistema</Label>
              <ModuleMultiSelect
                modules={availableModules}
                selected={editFormState.modules}
                onChange={handleEditModuleChange}
                disabled={isSavingEdit}
              />
              <div className="min-h-[2.5rem] p-3 rounded-md border bg-muted/20">
                {renderModuleBadges(editFormState.modules)}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-plan-custom-available">Recursos Incluídos (Texto Livre)</Label>
                <Textarea
                  id="edit-plan-custom-available"
                  value={editFormState.customAvailableFeatures}
                  onChange={(event) =>
                    setEditFormState((prev) => ({
                      ...prev,
                      customAvailableFeatures: event.target.value,
                    }))
                  }
                  disabled={isSavingEdit}
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  Separe os itens com vírgula. Ex: "Suporte 24h, Backup diário"
                </p>
                <div className="pt-2">
                  {renderCustomFeatureBadges(
                    editCustomAvailableTopics,
                    "", // Empty message controlled by UI layout above
                    "secondary",
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-plan-custom-unavailable">Recursos Excluídos (Texto Livre)</Label>
                <Textarea
                  id="edit-plan-custom-unavailable"
                  value={editFormState.customUnavailableFeatures}
                  onChange={(event) =>
                    setEditFormState((prev) => ({
                      ...prev,
                      customUnavailableFeatures: event.target.value,
                    }))
                  }
                  disabled={isSavingEdit}
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  Separe os itens com vírgula. Ex: "API Access, Whitelabel"
                </p>
                <div className="pt-2">
                  {renderCustomFeatureBadges(
                    editCustomUnavailableTopics,
                    "",
                    "outline",
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2">Limites Operacionais</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-plan-client-limit">Clientes</Label>
                  <Input
                    id="edit-plan-client-limit"
                    inputMode="numeric"
                    value={editFormState.clientLimit}
                    onChange={(event) =>
                      setEditFormState((prev) => ({
                        ...prev,
                        clientLimit: sanitizeLimitInput(event.target.value),
                      }))
                    }
                    disabled={isSavingEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-plan-user-limit">Usuários</Label>
                  <Input
                    id="edit-plan-user-limit"
                    inputMode="numeric"
                    value={editFormState.userLimit}
                    onChange={(event) =>
                      setEditFormState((prev) => ({
                        ...prev,
                        userLimit: sanitizeLimitInput(event.target.value),
                      }))
                    }
                    disabled={isSavingEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-plan-process-limit">Processos</Label>
                  <Input
                    id="edit-plan-process-limit"
                    inputMode="numeric"
                    value={editFormState.processLimit}
                    onChange={(event) =>
                      setEditFormState((prev) => ({
                        ...prev,
                        processLimit: sanitizeLimitInput(event.target.value),
                      }))
                    }
                    disabled={isSavingEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-plan-proposal-limit">Propostas</Label>
                  <Input
                    id="edit-plan-proposal-limit"
                    inputMode="numeric"
                    value={editFormState.proposalLimit}
                    onChange={(event) =>
                      setEditFormState((prev) => ({
                        ...prev,
                        proposalLimit: sanitizeLimitInput(event.target.value),
                      }))
                    }
                    disabled={isSavingEdit}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-plan-process-monitor-lawyer-limit">
                    Advogados (Monitoramento de Processos)
                  </Label>
                  <Input
                    id="edit-plan-process-monitor-lawyer-limit"
                    inputMode="numeric"
                    value={editProcessMonitorLawyerLimit}
                    onChange={(event) =>
                      setEditProcessMonitorLawyerLimit(
                        sanitizeLimitInput(event.target.value)
                      )
                    }
                    disabled={isSavingEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-plan-intimation-monitor-lawyer-limit">
                    Advogados (Monitoramento de Intimações)
                  </Label>
                  <Input
                    id="edit-plan-intimation-monitor-lawyer-limit"
                    inputMode="numeric"
                    value={editIntimationMonitorLawyerLimit}
                    onChange={(event) =>
                      setEditIntimationMonitorLawyerLimit(
                        sanitizeLimitInput(event.target.value)
                      )
                    }
                    disabled={isSavingEdit}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2">Integrações e Sincronização</h3>

              <div className="flex flex-col gap-4 rounded-lg border p-4 bg-muted/10">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Label htmlFor="edit-plan-process-sync" className="text-base font-medium">
                      Sincronização de Processos
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Habilita a atualização automática de andamentos processuais.
                    </p>
                  </div>
                  <Switch
                    id="edit-plan-process-sync"
                    checked={editFormState.processSyncEnabled}
                    onCheckedChange={(checked) =>
                      setEditFormState((prev) => ({
                        ...prev,
                        processSyncEnabled: checked,
                        processSyncQuota: checked ? prev.processSyncQuota : "",
                      }))
                    }
                    disabled={isSavingEdit}
                  />
                </div>

                {editFormState.processSyncEnabled && (
                  <div className="pt-2 sm:w-1/2">
                    <Label htmlFor="edit-plan-process-sync-quota">Cota Mensal de Sincronizações</Label>
                    <Input
                      id="edit-plan-process-sync-quota"
                      inputMode="numeric"
                      value={editFormState.processSyncQuota}
                      onChange={(event) =>
                        setEditFormState((prev) => ({
                          ...prev,
                          processSyncQuota: sanitizeLimitInput(event.target.value),
                        }))
                      }
                      disabled={isSavingEdit}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 rounded-lg border p-4 bg-muted/10">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Label htmlFor="edit-plan-intimation-sync" className="text-base font-medium">
                      Sincronização de Intimações
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Habilita a captura automática de publicações em diários oficiais.
                    </p>
                  </div>
                  <Switch
                    id="edit-plan-intimation-sync"
                    checked={editIntimationSyncEnabled}
                    onCheckedChange={(checked) => {
                      setEditIntimationSyncEnabled(checked);
                      if (!checked) {
                        setEditIntimationSyncQuota("");
                      }
                    }}
                    disabled={isSavingEdit}
                  />
                </div>

                {editIntimationSyncEnabled && (
                  <div className="pt-2 sm:w-1/2">
                    <Label htmlFor="edit-plan-intimation-sync-quota">Cota Mensal de Intimações</Label>
                    <Input
                      id="edit-plan-intimation-sync-quota"
                      inputMode="numeric"
                      value={editIntimationSyncQuota}
                      onChange={(event) =>
                        setEditIntimationSyncQuota(
                          sanitizeLimitInput(event.target.value)
                        )
                      }
                      disabled={isSavingEdit}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            </div>

            {editError ? (
              <Alert variant="destructive">
                <AlertTitle>Erro ao atualizar plano</AlertTitle>
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
              <Button type="button" variant="ghost" onClick={closeEditDialog} disabled={isSavingEdit}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSavingEdit}>
                {isSavingEdit ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar alterações"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
