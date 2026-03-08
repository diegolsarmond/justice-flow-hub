import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  IdCard,
  Package,
  User,
  Shield,
  Save,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { routes } from "@/config/routes";
import { getApiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  ApiCompany,
  parseDataItem,
} from "./companies-data";
import {
  CompanyFormApiPlan as ApiPlan,
  CompanyFormApiUser as ApiUser,
  CompanyFormData,
  NO_MANAGER_SELECTED_VALUE,
  NO_PLAN_SELECTED_VALUE,
  PlanOption,
  UserOption,
  initialCompanyFormData,
  mapPlanToOption,
  mapUserToOption,
  parseDataArray,
  parseOptionalNumber,
  resolveBooleanFlag,
  sanitizeDigits,
} from "./company-form-utils";

export default function EditCompany() {
  const { companyId } = useParams<{ companyId: string }>();
  const [formData, setFormData] = useState<CompanyFormData>(initialCompanyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [auxiliaryError, setAuxiliaryError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    if (!companyId) {
      setLoadError("Empresa não encontrada.");
      setPlanOptions([]);
      setUserOptions([]);
      setIsLoadingCompany(false);
      return () => {
        controller.abort();
      };
    }

    const loadCompany = async () => {
      setIsLoadingCompany(true);
      try {
        const response = await fetch(getApiUrl(`empresas/${companyId}`), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (response.status === 404) {
          if (isMounted) {
            setLoadError("Empresa não encontrada.");
          }
          return;
        }

        if (!response.ok) {
          throw new Error(`Falha ao carregar empresa (${response.status}).`);
        }

        const payload = await response.json();
        if (!isMounted) {
          return;
        }

        const apiCompany = parseDataItem<ApiCompany>(payload);
        if (!apiCompany) {
          setLoadError("Não foi possível interpretar os dados da empresa.");
          return;
        }

        const activeFlag = resolveBooleanFlag(apiCompany.ativo);

        setFormData({
          name: apiCompany.nome_empresa?.trim() ?? "",
          email: apiCompany.email?.trim() ?? "",
          cnpj: apiCompany.cnpj?.trim() ?? "",
          phone: apiCompany.telefone?.trim() ?? "",
          planId: apiCompany.plano != null ? String(apiCompany.plano) : "",
          managerId: apiCompany.responsavel != null ? String(apiCompany.responsavel) : "",
          isActive: activeFlag ?? true,
        });
        setLoadError(null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error(error);
        if (isMounted) {
          setLoadError("Não foi possível carregar os dados da empresa.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingCompany(false);
        }
      }
    };

    const loadPlans = async () => {
      setIsLoadingPlans(true);
      try {
        const response = await fetch(getApiUrl("planos"), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Falha ao carregar planos (${response.status}).`);
        }

        const payload = await response.json();
        if (controller.signal.aborted || !isMounted) {
          return;
        }

        const options = parseDataArray<ApiPlan>(payload)
          .map(mapPlanToOption)
          .filter((option): option is PlanOption => option !== null)
          .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

        setPlanOptions(options);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error(error);
        setAuxiliaryError((previous) => previous ?? "Não foi possível carregar algumas informações auxiliares.");
      } finally {
        if (!controller.signal.aborted && isMounted) {
          setIsLoadingPlans(false);
        }
      }
    };

    const loadUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const response = await fetch(getApiUrl("admin/users"), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Falha ao carregar usuários (${response.status}).`);
        }

        const payload = await response.json();
        if (controller.signal.aborted || !isMounted) {
          return;
        }

        if (!Array.isArray(payload)) {
          throw new Error("Resposta inesperada ao carregar usuários.");
        }

        const options = (payload as ApiUser[])
          .map((item, index) => mapUserToOption(item, index))
          .filter((option): option is UserOption => option !== null)
          .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

        setUserOptions(options);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error(error);
        setAuxiliaryError((previous) => previous ?? "Não foi possível carregar algumas informações auxiliares.");
      } finally {
        if (!controller.signal.aborted && isMounted) {
          setIsLoadingUsers(false);
        }
      }
    };

    void loadCompany();
    void loadPlans();
    void loadUsers();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [companyId]);

  const isLoadingAuxiliaryData = isLoadingPlans || isLoadingUsers;

  const selectedPlanLabel = useMemo(() => {
    if (!formData.planId) {
      return null;
    }

    const plan = planOptions.find((option) => option.id === formData.planId);
    if (!plan) {
      return null;
    }

    return plan.isActive ? plan.label : `${plan.label} (inativo)`;
  }, [formData.planId, planOptions]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting || !companyId) {
      return;
    }

    setIsSubmitting(true);

    const digitsOnlyCnpj = sanitizeDigits(formData.cnpj);
    const digitsOnlyPhone = sanitizeDigits(formData.phone);
    const cnpjValue = digitsOnlyCnpj.length > 0 ? digitsOnlyCnpj : formData.cnpj.trim();

    const payload = {
      nome_empresa: formData.name.trim(),
      cnpj: cnpjValue,
      telefone: digitsOnlyPhone.length > 0 ? digitsOnlyPhone : formData.phone.trim() || null,
      email: formData.email.trim() || null,
      plano: parseOptionalNumber(formData.planId),
      responsavel: parseOptionalNumber(formData.managerId),
      ativo: formData.isActive,
    };

    try {
      const response = await fetch(getApiUrl(`empresas/${companyId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 404) {
        throw new Error("Empresa não encontrada.");
      }

      if (!response.ok) {
        let errorMessage = `Erro ao atualizar empresa (código ${response.status}).`;
        try {
          const errorPayload = await response.json();
          if (errorPayload && typeof errorPayload === "object") {
            const message = (errorPayload as { error?: unknown }).error;
            if (typeof message === "string" && message.trim().length > 0) {
              errorMessage = message;
            }
          }
        } catch (parseError) {
          console.error(parseError);
        }

        throw new Error(errorMessage);
      }

      await response.json().catch(() => null);

      toast({
        title: "Empresa atualizada",
        description: "As informações da empresa foram salvas com sucesso.",
      });
      navigate(routes.admin.companies);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível atualizar a empresa.";

      toast({
        title: "Erro ao atualizar empresa",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link to={routes.admin.companies}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para empresas
          </Link>
        </Button>
        {companyId && !loadError && (
          <Button variant="outline" size="sm" asChild>
            <Link to={routes.admin.companyDetails(Number(companyId))}>
              Ver detalhes
            </Link>
          </Button>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border p-6 md:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Editar Empresa</h1>
            <p className="text-sm text-muted-foreground">
              {formData.name || `Empresa #${companyId}`}
            </p>
          </div>
          {!isLoadingCompany && !loadError && (
            <Badge
              variant="outline"
              className={`ml-auto ${formData.isActive
                ? "border-green-500/50 text-green-600 bg-green-500/10"
                : "border-red-500/50 text-red-600 bg-red-500/10"
                }`}
            >
              <Shield className="h-3 w-3 mr-1" />
              {formData.isActive ? "Ativa" : "Inativa"}
            </Badge>
          )}
        </div>
      </div>

      <Card className="border-muted/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Dados da Empresa
          </CardTitle>
          <CardDescription>Altere os campos necessários e salve as atualizações</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadError ? (
            <Alert variant="destructive">
              <AlertTitle>Erro ao carregar dados</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : null}

          {auxiliaryError ? (
            <Alert variant="destructive">
              <AlertTitle>Atenção</AlertTitle>
              <AlertDescription>{auxiliaryError}</AlertDescription>
            </Alert>
          ) : null}

          {isLoadingCompany ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-sm text-muted-foreground">Carregando dados da empresa...</span>
            </div>
          ) : loadError ? null : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Nome da empresa
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Nome da empresa"
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    E-mail
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="contato@empresa.com"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj" className="flex items-center gap-2 text-sm font-medium">
                    <IdCard className="h-4 w-4 text-muted-foreground" />
                    CNPJ
                  </Label>
                  <Input
                    id="cnpj"
                    name="cnpj"
                    value={formData.cnpj}
                    onChange={handleInputChange}
                    placeholder="00.000.000/0000-00"
                    className="h-11 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-medium">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Telefone
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="(00) 00000-0000"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Plano
                  </Label>
                  <Select
                    value={
                      formData.planId === "" ? NO_PLAN_SELECTED_VALUE : formData.planId
                    }
                    onValueChange={(value) =>
                      setFormData((previous) => ({
                        ...previous,
                        planId: value === NO_PLAN_SELECTED_VALUE ? "" : value,
                      }))
                    }
                    disabled={isLoadingAuxiliaryData}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={isLoadingAuxiliaryData ? "Carregando planos..." : "Selecione um plano"}>
                        {selectedPlanLabel ?? undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PLAN_SELECTED_VALUE}>Sem plano</SelectItem>
                      {planOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.isActive ? option.label : `${option.label} (inativo)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Responsável
                  </Label>
                  <Select
                    value={
                      formData.managerId === "" ? NO_MANAGER_SELECTED_VALUE : formData.managerId
                    }
                    onValueChange={(value) =>
                      setFormData((previous) => ({
                        ...previous,
                        managerId: value === NO_MANAGER_SELECTED_VALUE ? "" : value,
                      }))
                    }
                    disabled={isLoadingAuxiliaryData}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={isLoadingAuxiliaryData ? "Carregando usuários..." : "Selecione um responsável"}>
                        {formData.managerId
                          ? userOptions.find((option) => option.id === formData.managerId)?.label
                          : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_MANAGER_SELECTED_VALUE}>Sem responsável</SelectItem>
                      {userOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-5">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${formData.isActive ? "bg-green-500/10" : "bg-red-500/10"
                    }`}>
                    <Shield className={`h-5 w-5 ${formData.isActive ? "text-green-600" : "text-red-600"}`} />
                  </div>
                  <div>
                    <Label htmlFor="isActive" className="font-medium cursor-pointer">
                      Empresa ativa
                    </Label>
                    <p className="text-sm text-muted-foreground">Controle se a empresa está ativa no sistema.</p>
                  </div>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData((previous) => ({ ...previous, isActive: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t pt-6">
                <Button type="button" variant="outline" asChild disabled={isSubmitting}>
                  <Link to={routes.admin.companies}>Cancelar</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      Salvar alterações
                    </span>
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
