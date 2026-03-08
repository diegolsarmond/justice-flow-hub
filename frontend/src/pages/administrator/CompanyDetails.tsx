import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowLeft,
  Building2,
  Calendar,
  IdCard,
  Mail,
  Phone,
  User,
  Pencil,
  TrendingUp,
  Clock,
  Package,
  Shield,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { routes } from "@/config/routes";
import { getApiUrl } from "@/lib/api";
import {
  ApiCompany,
  ApiPlan,
  ApiUser,
  Company,
  CompanyStatusBadge,
  buildUsersIndex,
  describePlanPhase,
  formatCurrency,
  formatDate,
  mapApiCompanyToCompany,
  parseDataArray,
  parseDataItem,
  getPlanIndex,
} from "./companies-data";

interface SummaryCardProps {
  icon: LucideIcon;
  title: string;
  value: string | ReactNode;
  description?: string;
  accentColor?: string;
}

const SummaryCard = ({ icon: Icon, title, value, description, accentColor = "primary" }: SummaryCardProps) => {
  const colorClasses: Record<string, { border: string; bg: string; text: string }> = {
    primary: { border: "border-l-primary", bg: "bg-primary/10", text: "text-primary" },
    green: { border: "border-l-green-500", bg: "bg-green-500/10", text: "text-green-500" },
    blue: { border: "border-l-blue-500", bg: "bg-blue-500/10", text: "text-blue-500" },
    orange: { border: "border-l-orange-500", bg: "bg-orange-500/10", text: "text-orange-500" },
    emerald: { border: "border-l-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-600" },
  };

  const colors = colorClasses[accentColor] || colorClasses.primary;

  return (
    <Card className={`border-l-4 ${colors.border} shadow-sm hover:shadow-md transition-all duration-200`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`h-9 w-9 rounded-full ${colors.bg} flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${colors.text}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description ? <p className="text-xs text-muted-foreground mt-1">{description}</p> : null}
      </CardContent>
    </Card>
  );
};

interface InfoItemProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  description?: string;
}

const InfoItem = ({ icon: Icon, label, value, description }: InfoItemProps) => (
  <div className="flex items-start gap-4 rounded-xl border bg-card/50 p-4 hover:bg-muted/30 transition-colors">
    <div className="mt-0.5 h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
      <Icon className="h-5 w-5 text-muted-foreground" />
    </div>
    <div className="space-y-1 min-w-0 flex-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm font-medium leading-tight break-words">{value}</div>
      {description ? <p className="text-xs text-muted-foreground leading-snug">{description}</p> : null}
    </div>
  </div>
);

interface TimelineItemProps {
  icon: LucideIcon;
  label: string;
  date: string | null;
  description?: string;
  isActive?: boolean;
}

const TimelineItem = ({ icon: Icon, label, date, description, isActive }: TimelineItemProps) => (
  <div className="flex items-start gap-3">
    <div
      className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
        }`}
    >
      <Icon className="h-4 w-4" />
    </div>
    <div className="space-y-0.5 pt-0.5">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">
        {date ? formatDate(date) : "--"}
        {description ? ` • ${description}` : ""}
      </p>
    </div>
  </div>
);

export default function CompanyDetails() {
  const { companyId } = useParams<{ companyId: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    if (!companyId) {
      setCompany(null);
      setError("Empresa não encontrada.");
      setIsLoading(false);
      return () => {
        isMounted = false;
        controller.abort();
      };
    }

    const loadCompany = async () => {
      setIsLoading(true);
      try {
        const companyResponse = await fetch(getApiUrl(`empresas/${companyId}`), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (companyResponse.status === 404) {
          if (isMounted) {
            setCompany(null);
            setError("Empresa não encontrada.");
          }
          return;
        }

        if (!companyResponse.ok) {
          throw new Error(`Falha ao carregar empresa: ${companyResponse.status}`);
        }

        const companyPayload = await companyResponse.json();

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
          } else {
            console.warn("Falha ao carregar planos:", plansResponse.status);
          }
        } catch (plansError) {
          if (plansError instanceof DOMException && plansError.name === "AbortError") {
            return;
          }
          console.warn("Erro ao carregar planos:", plansError);
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

        const apiCompany = parseDataItem<ApiCompany>(companyPayload);
        if (!apiCompany) {
          setCompany(null);
          setError("Não foi possível interpretar os dados da empresa.");
          return;
        }

        setCompany(mapApiCompanyToCompany(apiCompany, plansIndex, usersIndex));
        setError(null);
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        console.error("Erro ao carregar empresa:", fetchError);
        if (isMounted) {
          setCompany(null);
          setError("Não foi possível carregar os detalhes da empresa.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadCompany();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [companyId]);

  const hasValidPlanValue = company?.planValue != null && !Number.isNaN(company.planValue);
  const planValueDisplay = hasValidPlanValue ? `R$ ${formatCurrency(company?.planValue ?? 0)}` : "--";
  const planPhaseDescription = company ? describePlanPhase(company.planPhase) : null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link to={routes.admin.companies}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para empresas
          </Link>
        </Button>
        {company ? (
          <Button asChild className="shadow-sm">
            <Link to={routes.admin.editCompany(company.id)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar empresa
            </Link>
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <p className="text-sm text-muted-foreground">Carregando detalhes da empresa...</p>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Não foi possível carregar os detalhes</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to={routes.admin.companies}>Voltar para a lista de empresas</Link>
            </Button>
          </CardContent>
        </Card>
      ) : company ? (
        <>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border p-6 md:p-8">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold">{company.name}</h1>
                    <p className="text-sm text-muted-foreground">
                      ID #{company.id}
                      {company.createdAt ? ` • Cadastrada em ${formatDate(company.createdAt)}` : ""}
                    </p>
                  </div>
                </div>
                {company.email && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {company.email}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-start gap-2 md:items-end">
                <CompanyStatusBadge status={company.status} />
                {planPhaseDescription ? (
                  <Badge variant="outline" className="text-xs">
                    {planPhaseDescription}
                  </Badge>
                ) : null}
                {company.isActive ? (
                  <Badge variant="outline" className="text-xs border-green-500/50 text-green-600 bg-green-500/10">
                    <Shield className="h-3 w-3 mr-1" />
                    Empresa ativa
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs border-red-500/50 text-red-600 bg-red-500/10">
                    <Shield className="h-3 w-3 mr-1" />
                    Empresa inativa
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              icon={Package}
              title="Plano atual"
              value={company.planName}
              description={company.planId ? `ID: ${company.planId}` : "Sem plano associado"}
              accentColor="primary"
            />
            <SummaryCard
              icon={TrendingUp}
              title="MRR estimado"
              value={<span className={hasValidPlanValue ? "text-emerald-600" : ""}>{planValueDisplay}</span>}
              description={hasValidPlanValue ? "Receita mensal recorrente" : "Sem valor definido"}
              accentColor="emerald"
            />
            <SummaryCard
              icon={User}
              title="Responsável"
              value={company.managerName || "--"}
              description="Gestor da conta"
              accentColor="blue"
            />
            <SummaryCard
              icon={Activity}
              title="Última atividade"
              value={formatDate(company.lastActivity)}
              description="Atualização mais recente"
              accentColor="orange"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  Informações da Empresa
                </CardTitle>
                <CardDescription>Dados cadastrais e informações de contato</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoItem
                    icon={Mail}
                    label="E-mail"
                    value={
                      company.email ? (
                        <a href={`mailto:${company.email}`} className="text-primary hover:underline flex items-center gap-1">
                          {company.email}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "Sem e-mail"
                      )
                    }
                  />
                  <InfoItem
                    icon={Phone}
                    label="Telefone"
                    value={
                      company.phone ? (
                        <a href={`tel:${company.phone}`} className="text-primary hover:underline flex items-center gap-1">
                          {company.phone}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "--"
                      )
                    }
                  />
                  <InfoItem
                    icon={User}
                    label="Responsável"
                    value={company.managerName || "Não informado"}
                    description={company.managerId ? `ID: ${company.managerId}` : undefined}
                  />
                  <InfoItem icon={IdCard} label="CNPJ" value={company.cnpj || "Não informado"} />
                  <InfoItem
                    icon={Package}
                    label="Plano"
                    value={company.planName}
                    description={hasValidPlanValue ? planValueDisplay : "Sem valor definido"}
                  />
                  <InfoItem
                    icon={Activity}
                    label="Status"
                    value={<CompanyStatusBadge status={company.status} />}
                    description={planPhaseDescription ?? undefined}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  Linha do Tempo
                </CardTitle>
                <CardDescription>Datas importantes da assinatura</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <TimelineItem
                  icon={Calendar}
                  label="Data de cadastro"
                  date={company.createdAt}
                  isActive={true}
                />
                <Separator />
                {company.trialStartedAt && (
                  <>
                    <TimelineItem
                      icon={Clock}
                      label="Início do trial"
                      date={company.trialStartedAt}
                      isActive={company.status === "trial"}
                    />
                    <Separator />
                  </>
                )}
                {company.trialEndsAt && (
                  <>
                    <TimelineItem
                      icon={Clock}
                      label="Fim do trial"
                      date={company.trialEndsAt}
                      description={company.status === "trial" ? "Em andamento" : undefined}
                      isActive={company.status === "trial"}
                    />
                    <Separator />
                  </>
                )}
                {company.currentPeriodStart && (
                  <>
                    <TimelineItem
                      icon={Calendar}
                      label="Início do período"
                      date={company.currentPeriodStart}
                      isActive={company.status === "active"}
                    />
                    <Separator />
                  </>
                )}
                {company.currentPeriodEnd && (
                  <>
                    <TimelineItem
                      icon={Calendar}
                      label="Fim do período"
                      date={company.currentPeriodEnd}
                      isActive={company.status === "active"}
                    />
                    <Separator />
                  </>
                )}
                {company.gracePeriodEndsAt && (
                  <TimelineItem
                    icon={Clock}
                    label="Fim da carência"
                    date={company.gracePeriodEndsAt}
                    description={company.status === "grace" ? "Em carência" : undefined}
                    isActive={company.status === "grace"}
                  />
                )}
                <TimelineItem
                  icon={Activity}
                  label="Última atividade"
                  date={company.lastActivity}
                />
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Empresa não encontrada</CardTitle>
            <CardDescription>A empresa solicitada não está disponível.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to={routes.admin.companies}>Voltar para a lista de empresas</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
