import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  AlertCircle,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  loadAdminAnalyticsOverview,
  type AdminAnalyticsOverview,
  type RevenueByPlanSlice,
  type CohortPoint,
  type FunnelStage,
  type AdminMonthlyPoint,
} from "@/services/analytics";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))"];

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Analytics() {
  const [analytics, setAnalytics] = useState<AdminAnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const overview = await loadAdminAnalyticsOverview(controller.signal);
        if (!mounted) {
          return;
        }
        setAnalytics(overview);
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("Falha ao carregar analytics administrativos", err);
        if (mounted) {
          setError("Não foi possível carregar as métricas de analytics.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const dashboard = analytics?.dashboard;
  const metrics = dashboard?.metrics ?? {
    mrr: 0,
    arr: 0,
    churnRate: 0,
    conversionRate: 0,
    activeSubscriptions: 0,
    trialSubscriptions: 0,
    totalCompanies: 0,
    monthlyGrowth: 0,
  };

  const monthlySeries: AdminMonthlyPoint[] = dashboard?.monthlySeries ?? [];
  const revenueByPlan: RevenueByPlanSlice[] = analytics?.revenueByPlan ?? [];
  const cohort: CohortPoint[] = analytics?.cohort ?? [];
  const funnel: FunnelStage[] = analytics?.funnel ?? [];
  const retention = analytics?.retention ?? { gross: 0, net: 0, logo: 0 };
  const revenueMetrics = analytics?.revenueMetrics ?? {
    currentArpu: 0,
    previousArpu: 0,
    revenueGrowthRate: 0,
    expansionRevenue: 0,
    contractionRevenue: 0,
  };
  const customerMetrics = analytics?.customerMetrics ?? {
    cac: 0,
    ltv: 0,
    paybackPeriodMonths: 0,
    trialConversion: 0,
  };

  const formattedRetention = useMemo(
    () => ({
      gross: `${retention.gross.toFixed(1)}%`,
      net: `${retention.net.toFixed(1)}%`,
      logo: `${retention.logo.toFixed(1)}%`,
    }),
    [retention.gross, retention.net, retention.logo],
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Relatórios e Analytics
        </h1>
        <p className="text-muted-foreground mt-1">
          Visão estratégica e análise completa de métricas de negócio.
        </p>
      </div>

      {error ? (
        <Card className="border-destructive/50 bg-destructive/10 text-destructive animate-in slide-in-from-top-2">
          <CardContent className="flex items-center gap-3 py-4 text-sm font-medium">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </CardContent>
        </Card>
      ) : null}

      {/* Executive Summary */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4" aria-busy={isLoading}>
        <Card className="shadow-md border-muted/60 hover:border-primary/20 transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MRR</CardTitle>
            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.mrr)}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
              <span className={metrics.monthlyGrowth >= 0 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                {metrics.monthlyGrowth >= 0 ? "+" : ""}
                {metrics.monthlyGrowth}%
              </span>
              <span className="ml-1">vs mês anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-muted/60 hover:border-primary/20 transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Customer LTV</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(customerMetrics.ltv)}</div>
            <p className="text-xs text-muted-foreground mt-1">Lifetime Value médio</p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-muted/60 hover:border-primary/20 transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">CAC Payback</CardTitle>
            <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Target className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerMetrics.paybackPeriodMonths.toFixed(1)} meses</div>
            <p className="text-xs text-muted-foreground mt-1">Tempo para recuperar CAC</p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-muted/60 hover:border-primary/20 transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Revenue Retention</CardTitle>
            <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formattedRetention.net}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
              <span className="text-green-600">Expansão &gt; Churn</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Analytics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7" aria-busy={isLoading}>
        <Card className="col-span-4 shadow-md border-muted/60">
          <CardHeader>
            <CardTitle>Evolução MRR e ARR</CardTitle>
            <CardDescription>Crescimento da receita recorrente ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlySeries} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `R$ ${value / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                  }}
                  itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                  formatter={(value: number) => [formatCurrency(value), "MRR"]}
                />
                <Area
                  type="monotone"
                  dataKey="mrr"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorMrr)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3 shadow-md border-muted/60">
          <CardHeader>
            <CardTitle>Receita por Plano</CardTitle>
            <CardDescription>Distribuição do MRR por tipo de plano</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={revenueByPlan}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="revenue"
                >
                  {revenueByPlan.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px"
                  }}
                  itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                  formatter={(value: number) => [formatCurrency(value), "Receita"]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
              {revenueByPlan.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span>{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cohort and Churn Analysis */}
      <div className="grid gap-6 md:grid-cols-2" aria-busy={isLoading}>
        <Card className="shadow-md border-muted/60">
          <CardHeader>
            <CardTitle>Análise de Cohort - Retenção</CardTitle>
            <CardDescription>Percentual de clientes retidos mensalmente</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cohort} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--popover))" }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, "Retidos"]}
                />
                <Line
                  type="monotone"
                  dataKey="retained"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "hsl(var(--primary))" }}
                  activeDot={{ r: 6 }}
                  name="Retidos"
                />
                <Line
                  type="monotone"
                  dataKey="churned"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Churn"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-md border-muted/60">
          <CardHeader>
            <CardTitle>Funil de Conversão</CardTitle>
            <CardDescription>Eficiência da aquisição até cliente ativo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={funnel} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="stage"
                  type="category"
                  width={100}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted)/0.2)" }}
                  contentStyle={{ borderRadius: "8px", borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--popover))" }}
                  formatter={(value: number, name) => [
                    name === "count" ? value : `${value.toFixed(1)}%`,
                    name === "count" ? "Quantidade" : "Conversão",
                  ]}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid gap-6 md:grid-cols-3" aria-busy={isLoading}>
        <Card className="shadow-md border-muted/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-primary" />
              SaaS Metrics
            </CardTitle>
            <CardDescription>Indicadores vitais de saúde do negócio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm text-muted-foreground">Monthly Churn Rate</span>
              <span className="font-mono font-medium text-destructive">{metrics.churnRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm text-muted-foreground">Annual Churn Rate</span>
              <span className="font-mono font-medium">{(metrics.churnRate * 12).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm text-muted-foreground">Gross Revenue Retention</span>
              <span className="font-mono font-medium">{formattedRetention.gross}</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm text-muted-foreground">Net Revenue Retention</span>
              <span className="font-mono font-medium text-green-600 dark:text-green-400">{formattedRetention.net}</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm text-muted-foreground">Logo Retention</span>
              <span className="font-mono font-medium">{formattedRetention.logo}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-muted/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Revenue Metrics
            </CardTitle>
            <CardDescription>Detalhamento de crescimento financeiro</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm text-muted-foreground">ARPU (Atual)</span>
              <span className="font-mono font-medium">{formatCurrency(revenueMetrics.currentArpu)}</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm text-muted-foreground">ARPU (Anterior)</span>
              <span className="font-mono font-medium text-muted-foreground">{formatCurrency(revenueMetrics.previousArpu)}</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm text-muted-foreground">Growth Rate</span>
              <span className="font-mono font-medium text-green-600 dark:text-green-400">{revenueMetrics.revenueGrowthRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm text-muted-foreground">Expansion</span>
              <span className="font-mono font-medium text-blue-600 dark:text-blue-400">{formatCurrency(revenueMetrics.expansionRevenue)}</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm text-muted-foreground">Contraction</span>
              <span className="font-mono font-medium text-destructive">{formatCurrency(revenueMetrics.contractionRevenue)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-muted/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Customer Metrics
            </CardTitle>
            <CardDescription>Eficiência em aquisição e valor do cliente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm text-muted-foreground">CAC</span>
              <span className="font-mono font-medium">{formatCurrency(customerMetrics.cac)}</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm text-muted-foreground">LTV</span>
              <span className="font-mono font-medium">{formatCurrency(customerMetrics.ltv)}</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm text-muted-foreground">LTV:CAC Ratio</span>
              <span className="font-mono font-medium text-green-600 dark:text-green-400">
                {customerMetrics.cac > 0
                  ? `${(customerMetrics.ltv / customerMetrics.cac).toFixed(1)}:1`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm text-muted-foreground">Payback Period</span>
              <span className="font-mono font-medium">{customerMetrics.paybackPeriodMonths.toFixed(1)} meses</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm text-muted-foreground">Trial Conversion</span>
              <span className="font-mono font-medium">{customerMetrics.trialConversion.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
