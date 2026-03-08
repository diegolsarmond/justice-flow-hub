import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Building2, Users, Calendar, Phone, Info, Eye, Pencil, Settings, TrendingUp, Activity, Package, Clock, CreditCard } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { routes } from "@/config/routes";
import { getApiUrl } from "@/lib/api";
import {
  ApiCompany,
  ApiPlan,
  ApiUser,
  Company,
  CompanyStatusBadge,
  describePlanPhase,
  buildUsersIndex,
  formatCurrency,
  formatDate,
  mapApiCompanyToCompany,
  parseDataArray,
  getPlanIndex,
} from "./companies-data";

type ManagementFormState = {
  isActive: boolean;
  planId: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  gracePeriodEndsAt: string | null;
  subscriptionStatus: string;
};

const toDateTimeLocalValue = (value: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
};

const fromDateTimeLocalValue = (value: string): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

const addDaysToIso = (value: string | null, days: number) => {
  const base = value ? new Date(value) : new Date();
  if (Number.isNaN(base.getTime())) {
    return null;
  }

  base.setDate(base.getDate() + days);
  return base.toISOString();
};

const buildManagementFormState = (company: Company | null): ManagementFormState => ({
  isActive: company?.isActive ?? false,
  planId: company?.planId ?? "",
  trialStartedAt: company?.trialStartedAt ?? null,
  trialEndsAt: company?.trialEndsAt ?? null,
  currentPeriodStart: company?.currentPeriodStart ?? null,
  currentPeriodEnd: company?.currentPeriodEnd ?? null,
  gracePeriodEndsAt: company?.gracePeriodEndsAt ?? null,
  subscriptionStatus: company?.subscriptionStatus ?? "",
});

const SUBSCRIPTION_STATUS_EMPTY_VALUE = "__empty__";

const SUBSCRIPTION_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Sem status definido" },
  { value: "pending", label: "Pendente" },
  { value: "active", label: "Ativo" },
  { value: "grace", label: "Ativo (carência)" },
  { value: "overdue", label: "Inadimplente" },
  { value: "inactive", label: "Inativo" },
];

const DATE_FIELD_TOOLTIPS = {
  trialStart:
    "Guarda quando o trial começou; em migrações antigas usamos a data de cadastro se esse campo estiver vazio.",
  trialEnd:
    "Marca quando o trial local termina. É calculado ao criar uma assinatura trial para cortar o acesso após os 14 dias.",
  currentPeriodStart:
    "Mostra o início do ciclo de cobrança vigente e é atualizado ao criar assinaturas ou conciliar pagamentos.",
  currentPeriodEnd:
    "Determina o fim do ciclo atual, evitando sobreposição de períodos e sendo recalculado a cada pagamento aplicado.",
  gracePeriodEnd:
    "Define até quando a empresa permanece com acesso após o vencimento (carência), sendo recalculado quando recebemos um pagamento.",
};

const DateFieldTooltip = ({ description }: { description: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span
        className="inline-flex h-5 w-5 cursor-help items-center justify-center text-muted-foreground transition hover:text-foreground"
        role="button"
        tabIndex={0}
        aria-label="Saiba mais sobre este campo"
      >
        <Info className="h-3.5 w-3.5" />
      </span>
    </TooltipTrigger>
    <TooltipContent className="max-w-xs text-xs leading-relaxed">
      {description}
    </TooltipContent>
  </Tooltip>
);

export default function Companies() {
  const [searchTerm, setSearchTerm] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadSignal, setReloadSignal] = useState(0);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [managementCompany, setManagementCompany] = useState<Company | null>(null);
  const [managementForm, setManagementForm] = useState<ManagementFormState>(() =>
    buildManagementFormState(null),
  );
  const [isSavingManagement, setIsSavingManagement] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<ApiPlan[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const loadCompanies = async () => {
      setIsLoading(true);
      try {
        const companiesResponse = await fetch(getApiUrl("empresas"), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!companiesResponse.ok) {
          throw new Error(`Falha ao carregar empresas: ${companiesResponse.status}`);
        }

        const companiesPayload = await companiesResponse.json();
        const apiCompanies = parseDataArray<ApiCompany>(companiesPayload);

        let plansIndex = new Map<string, ApiPlan>();
        try {
          const plansResponse = await fetch(getApiUrl("planos"), {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });

          if (plansResponse.ok) {
            const plansPayload = await plansResponse.json();
            const apiPlans = parseDataArray<ApiPlan>(plansPayload);
            plansIndex = getPlanIndex(apiPlans);
            setAvailablePlans(apiPlans);
          } else {
            console.warn("Falha ao carregar planos:", plansResponse.status);
          }
        } catch (planError) {
          if (planError instanceof DOMException && planError.name === "AbortError") {
            return;
          }
          console.warn("Erro ao carregar planos:", planError);
        }

        let usersIndex: Map<string, ApiUser> | undefined;
        try {
          const usersResponse = await fetch(getApiUrl("admin/users"), {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });

          if (usersResponse.ok) {
            const usersPayload = await usersResponse.json();
            const usersData = Array.isArray(usersPayload)
              ? (usersPayload as ApiUser[])
              : parseDataArray<ApiUser>(usersPayload);

            if (usersData.length > 0) {
              usersIndex = buildUsersIndex(usersData);
            } else {
              console.warn("Resposta inesperada ao carregar usuários.");
            }
          } else {
            console.warn("Falha ao carregar usuários:", usersResponse.status);
          }
        } catch (usersError) {
          if (usersError instanceof DOMException && usersError.name === "AbortError") {
            return;
          }
          console.warn("Erro ao carregar usuários:", usersError);
        }

        if (!isMounted) {
          return;
        }

        setCompanies(
          apiCompanies.map((company) => mapApiCompanyToCompany(company, plansIndex, usersIndex)),
        );
        setError(null);
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }

        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        console.error("Erro ao carregar empresas:", fetchError);
        setCompanies([]);
        setError("Não foi possível carregar as empresas.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadCompanies();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [reloadSignal]);

  useEffect(() => {
    setManagementForm(buildManagementFormState(managementCompany));
  }, [managementCompany]);

  const closeManagementDialog = () => {
    setIsManageDialogOpen(false);
    setManagementCompany(null);
  };

  const parseOptionalNumber = (value: string | null) => {
    if (!value) {
      return null;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return null;
    }

    return parsed;
  };

  const handleManagementSave = async () => {
    if (!managementCompany) {
      return;
    }

    setIsSavingManagement(true);
    try {
      const planValue = managementForm.planId.trim();
      const payload = {
        nome_empresa: managementCompany.name,
        cnpj: managementCompany.cnpj || null,
        telefone: managementCompany.phone || null,
        email: managementCompany.email || null,
        plano: planValue ? parseOptionalNumber(planValue) : null,
        responsavel: parseOptionalNumber(managementCompany.managerId),
        ativo: managementForm.isActive,
        trial_started_at: managementForm.trialStartedAt,
        trial_ends_at: managementForm.trialEndsAt,
        current_period_start: managementForm.currentPeriodStart,
        current_period_end: managementForm.currentPeriodEnd,
        grace_expires_at: managementForm.gracePeriodEndsAt,
        subscription_trial_ends_at: managementForm.trialEndsAt,
        subscription_current_period_ends_at: managementForm.currentPeriodEnd,
        subscription_grace_period_ends_at: managementForm.gracePeriodEndsAt,
        subscription_status: managementForm.subscriptionStatus || null,
      };

      const response = await fetch(getApiUrl(`empresas/${managementCompany.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let message = `Não foi possível atualizar a empresa (código ${response.status}).`;
        try {
          const errorPayload = await response.json();
          const errorMessage =
            errorPayload && typeof errorPayload === "object"
              ? (errorPayload as { error?: unknown }).error
              : undefined;
          if (typeof errorMessage === "string" && errorMessage.trim().length > 0) {
            message = errorMessage;
          }
        } catch (parseError) {
          console.error(parseError);
        }
        throw new Error(message);
      }

      await response.json().catch(() => null);

      toast({
        title: "Empresa atualizada",
        description: "As configurações da empresa foram salvas.",
      });
      closeManagementDialog();
      setReloadSignal((value) => value + 1);
    } catch (managementError) {
      const message =
        managementError instanceof Error
          ? managementError.message
          : "Não foi possível atualizar a empresa.";
      toast({
        title: "Erro ao atualizar empresa",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSavingManagement(false);
    }
  };

  const filteredCompanies = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    let result = [...companies];

    result.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB, 'pt-BR');
    });

    if (!query) {
      return result;
    }

    return result.filter((company) => {
      const values = [
        company.name,
        company.email,
        company.cnpj,
        company.managerName,
        company.phone,
        company.planName,
      ];

      return values.some((value) => value && value.toLowerCase().includes(query));
    });
  }, [companies, searchTerm]);

  const totalCompanies = companies.length;
  const activeCompanies = useMemo(
    () =>
      companies.filter((company) => company.status === "active" || company.status === "grace").length,
    [companies],
  );
  const trialCompanies = useMemo(
    () => companies.filter((company) => company.status === "trial").length,
    [companies],
  );
  const activePercentage = totalCompanies > 0 ? ((activeCompanies / totalCompanies) * 100).toFixed(1) : "0.0";

  const totalMRR = useMemo(() => {
    return companies.reduce((total, company) => {
      if ((company.status === "active" || company.status === "grace") && company.planValue) {
        return total + company.planValue;
      }
      return total;
    }, 0);
  }, [companies]);


  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Empresas
          </h1>
          <p className="text-muted-foreground mt-1">
            Visão geral e gestão corporativa do CRM
          </p>
        </div>
        <Button asChild className="w-full md:w-auto shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
          <Link to={routes.admin.newCompany}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Empresa
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Empresas</CardTitle>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompanies}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Base total de clientes cadastrados
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Atividade</CardTitle>
            <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activePercentage}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeCompanies} empresas ativas no momento
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Período de Teste</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {trialCompanies}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Oportunidades de conversão</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MRR Total</CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              R$ {formatCurrency(totalMRR)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Receita mensal recorrente</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="border-muted/60 shadow-sm">
        <CardHeader>
          <CardTitle>Diretório de Empresas</CardTitle>
          <CardDescription>Gerencie o acesso, planos e status de todas as empresas registradas.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background/50 focus:bg-background transition-colors"
              />
            </div>
          </div>

          <div className="rounded-lg border bg-background/50 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>MRR</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs mt-2 block">Carregando dados...</span>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-destructive">
                      {error}
                    </TableCell>
                  </TableRow>
                ) : filteredCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="h-8 w-8 text-muted-foreground/30" />
                        <p>Nenhuma empresa encontrada com os filtros atuais.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompanies.map((company) => (
                    <TableRow key={company.id} className="group hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {company.name}
                          </span>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {company.email || "Sem e-mail"}
                          </span>
                          {company.cnpj && (
                            <span className="text-[10px] text-muted-foreground/80 font-mono mt-0.5">
                              {company.cnpj}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 items-start">
                          <CompanyStatusBadge status={company.status} />
                          {company.planPhase && (
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-muted">
                              {describePlanPhase(company.planPhase)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">
                          {company.planName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{company.managerName || "--"}</span>
                      </TableCell>
                      <TableCell>
                        {company.phone ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            {company.phone}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(company.createdAt)}
                          </span>
                          <span className="text-[10px] opacity-70 mt-0.5">
                            Ativo: {formatDate(company.lastActivity).split(' ')[0]}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-sm">
                          {(company.status === "active" || company.status === "grace") && company.planValue ? (
                            <span className="text-emerald-600">R$ {formatCurrency(company.planValue)}</span>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                asChild
                              >
                                <Link to={routes.admin.companyDetails(company.id)}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver detalhes</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                                asChild
                              >
                                <Link to={routes.admin.editCompany(company.id)}>
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar empresa</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                                onClick={() => {
                                  setManagementCompany(company);
                                  setIsManageDialogOpen(true);
                                }}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Gerenciar assinatura</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isManageDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeManagementDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerenciar empresa</DialogTitle>
            <DialogDescription>
              Ajuste o status, o plano e os períodos de trial e vencimento da empresa selecionada.
            </DialogDescription>
          </DialogHeader>
          {managementCompany ? (
            <div className="space-y-6 py-4">
              <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{managementCompany.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">ID: {managementCompany.id}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-background p-2 rounded-md border shadow-sm">
                    <Switch
                      id="management-active"
                      checked={managementForm.isActive}
                      onCheckedChange={(checked) =>
                        setManagementForm((prev) => ({ ...prev, isActive: checked }))
                      }
                    />
                    <Label htmlFor="management-active" className="text-xs font-medium cursor-pointer">
                      {managementForm.isActive ? "Ativa" : "Inativa"}
                    </Label>
                  </div>
                </div>
              </div>

              <div className="grid gap-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label htmlFor="management-plan" className="text-xs font-medium">Plano</Label>
                    </div>
                    <Select
                      value={managementForm.planId || "__no_plan__"}
                      onValueChange={(value) =>
                        setManagementForm((prev) => ({ ...prev, planId: value === "__no_plan__" ? "" : value }))
                      }
                    >
                      <SelectTrigger id="management-plan" className="h-9">
                        <SelectValue placeholder="Selecione um plano" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__no_plan__">Sem plano</SelectItem>
                        {availablePlans.filter(p => p.id != null).map((plan) => (
                          <SelectItem key={plan.id} value={String(plan.id)}>
                            <div className="flex items-center gap-2">
                              <span>{plan.nome || `Plano ${plan.id}`}</span>
                              {plan.valor != null && (
                                <span className="text-xs text-muted-foreground">• R$ {formatCurrency(plan.valor)}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label htmlFor="management-subscription-status" className="text-xs font-medium">Status Assinatura</Label>
                    </div>
                    <Select
                      value={
                        managementForm.subscriptionStatus ||
                        SUBSCRIPTION_STATUS_EMPTY_VALUE
                      }
                      onValueChange={(value) =>
                        setManagementForm((prev) => ({
                          ...prev,
                          subscriptionStatus:
                            value === SUBSCRIPTION_STATUS_EMPTY_VALUE ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id="management-subscription-status" className="h-9">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUBSCRIPTION_STATUS_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value || SUBSCRIPTION_STATUS_EMPTY_VALUE}
                            value={option.value || SUBSCRIPTION_STATUS_EMPTY_VALUE}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium">Ciclos e Prazos</h4>
                  </div>

                  <div className="grid gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="management-trial-end" className="text-xs">Fim do trial</Label>
                          <DateFieldTooltip description={DATE_FIELD_TOOLTIPS.trialEnd} />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs px-2"
                          onClick={() =>
                            setManagementForm((prev) => ({
                              ...prev,
                              trialEndsAt: addDaysToIso(prev.trialEndsAt, 7),
                            }))
                          }
                          disabled={isSavingManagement}
                        >
                          +7 dias
                        </Button>
                      </div>
                      <Input
                        id="management-trial-end"
                        type="datetime-local"
                        className="h-9 font-mono text-xs"
                        value={toDateTimeLocalValue(managementForm.trialEndsAt)}
                        onChange={(event) =>
                          setManagementForm((prev) => ({
                            ...prev,
                            trialEndsAt: fromDateTimeLocalValue(event.target.value),
                          }))
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="management-period-start" className="text-xs">Início Período</Label>
                          <DateFieldTooltip description={DATE_FIELD_TOOLTIPS.currentPeriodStart} />
                        </div>
                        <Input
                          id="management-period-start"
                          type="datetime-local"
                          className="h-9 font-mono text-xs"
                          value={toDateTimeLocalValue(managementForm.currentPeriodStart)}
                          onChange={(event) =>
                            setManagementForm((prev) => ({
                              ...prev,
                              currentPeriodStart: fromDateTimeLocalValue(event.target.value),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Label htmlFor="management-period-end" className="text-xs">Fim Período</Label>
                            <DateFieldTooltip description={DATE_FIELD_TOOLTIPS.currentPeriodEnd} />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2"
                            onClick={() =>
                              setManagementForm((prev) => ({
                                ...prev,
                                currentPeriodEnd: addDaysToIso(prev.currentPeriodEnd, 30),
                              }))
                            }
                            disabled={isSavingManagement}
                          >
                            +30d
                          </Button>
                        </div>
                        <Input
                          id="management-period-end"
                          type="datetime-local"
                          className="h-9 font-mono text-xs"
                          value={toDateTimeLocalValue(managementForm.currentPeriodEnd)}
                          onChange={(event) =>
                            setManagementForm((prev) => ({
                              ...prev,
                              currentPeriodEnd: fromDateTimeLocalValue(event.target.value),
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:space-x-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={closeManagementDialog} disabled={isSavingManagement}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleManagementSave}
              disabled={isSavingManagement}
              className="min-w-[140px]"
            >
              {isSavingManagement ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Salvando...
                </span>
              ) : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
