import { useEffect, useState } from "react";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    CartesianGrid,
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
    Folder,
    AlertCircle,
    BellRing,
    Mail,
    Archive,
    CheckCircle,
    CalendarClock,
    ClipboardList,
    Clock,
    AlertTriangle,
    CalendarDays,
    PlayCircle,
    XCircle,
    PiggyBank,
    Banknote,
    Scale,
    PauseCircle,
    RefreshCcw,
    MoreHorizontal,
    Download,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    loadReportsAnalytics,
    type ReportsAnalytics,
    type FinancialSeriesPoint,
} from "@/services/analytics";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))"];

const CSV_SEPARATOR = ";";

type CsvRow = Array<string | number>;

const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const escapeCsvValue = (value: string) => `"${value.replace(/"/g, '""')}"`;

const buildCsvContent = (headers: string[], rows: CsvRow[]) => {
    const headerLine = headers.map((header) => escapeCsvValue(header)).join(CSV_SEPARATOR);
    const dataLines = rows.map((row) =>
        row.map((cell) => escapeCsvValue(String(cell ?? ""))).join(CSV_SEPARATOR),
    );
    return [headerLine, ...dataLines].join("\n");
};

const triggerDownloadFromUrl = (url: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const downloadCsv = (content: string, fileName: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    try {
        triggerDownloadFromUrl(url, fileName);
    } finally {
        URL.revokeObjectURL(url);
    }
};

export default function Relatorios() {
    const [analytics, setAnalytics] = useState<ReportsAnalytics | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        let mounted = true;

        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await loadReportsAnalytics(controller.signal);
                if (!mounted) {
                    return;
                }

                setAnalytics(data);
                setError(null);
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") {
                    return;
                }

                if (mounted) {
                    setError("Não foi possível carregar os relatórios analíticos.");
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

    const overview = analytics?.overview;
    const monthlySeries = overview?.monthlySeries ?? [];
    const areaDistribution = overview?.areaDistribution ?? [];
    const financialSeries: FinancialSeriesPoint[] = analytics?.financialSeries ?? [];
    const financialSummary = analytics?.financialSummary ?? {
        totalRevenue: 0,
        totalExpenses: 0,
        balance: 0,
        revenueGrowth: 0,
    };
    const intimationSummary = analytics?.intimationSummary ?? {
        total: 0,
        unread: 0,
        active: 0,
        upcoming: 0,
    };
    const taskSummary = analytics?.taskSummary ?? {
        total: 0,
        pending: 0,
        overdue: 0,
        completed: 0,
    };
    const agendaSummary = analytics?.agendaSummary ?? {
        total: 0,
        upcoming: 0,
        ongoing: 0,
        concluded: 0,
        cancelled: 0,
    };

    const processMetrics = overview?.processMetrics ?? {
        total: 0,
        classifications: [
            { id: "arquivamento", label: "Arquivamento/Baixa", count: 0, percentage: 0 },
            { id: "suspensao", label: "Suspensão/Sobrestamento", count: 0, percentage: 0 },
            { id: "recurso", label: "Recurso", count: 0, percentage: 0 },
            { id: "outros", label: "Outros movimentos", count: 0, percentage: 0 },
        ],
    };
    const processClassifications = processMetrics.classifications ?? [];
    const monthlyGrowth = overview?.kpis.monthlyGrowth ?? 0;

    const formatPercentage = (value: number) =>
        value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    const classificationIconMap: Record<string, LucideIcon> = {
        arquivamento: Archive,
        suspensao: PauseCircle,
        recurso: RefreshCcw,
        outros: MoreHorizontal,
    };
    const fallbackClassificationIcon = MoreHorizontal;

    const intimationChartData = [
        { label: "Ativas", value: intimationSummary.active },
        { label: "Não lidas", value: intimationSummary.unread },
        { label: "Próximos prazos", value: intimationSummary.upcoming },
    ];

    const taskChartData = [
        { label: "Pendentes", value: taskSummary.pending },
        { label: "Atrasadas", value: taskSummary.overdue },
        { label: "Concluídas", value: taskSummary.completed },
    ];

    const agendaChartData = [
        { label: "Próximos", value: agendaSummary.upcoming },
        { label: "Em andamento", value: agendaSummary.ongoing },
        { label: "Concluídos", value: agendaSummary.concluded },
        { label: "Cancelados", value: agendaSummary.cancelled },
    ];

    type ChartExportType =
        | "monthlySeries"
        | "areaDistribution"
        | "intimationChartData"
        | "financialSeries"
        | "taskChartData"
        | "agendaChartData";

    const chartExportMap: Record<ChartExportType, { headers: string[]; rows: CsvRow[]; fileName: string }> = {
        monthlySeries: {
            headers: ["Mês", "Novos processos", "Processos encerrados"],
            rows: monthlySeries.map((point) => [
                point.month,
                point.processos.toString(),
                point.encerrados.toString(),
            ]),
            fileName: "relatorios-processos.csv",
        },
        areaDistribution: {
            headers: ["Área", "Participação (%)"],
            rows: areaDistribution.map((slice) => [
                slice.name,
                slice.value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
            ]),
            fileName: "relatorios-distribuicao-area.csv",
        },
        intimationChartData: {
            headers: ["Status", "Quantidade"],
            rows: intimationChartData.map((item) => [item.label, item.value.toString()]),
            fileName: "relatorios-intimacoes.csv",
        },
        financialSeries: {
            headers: ["Mês", "Receitas", "Despesas"],
            rows: financialSeries.map((point) => [
                point.month,
                formatCurrency(point.receita),
                formatCurrency(point.despesas),
            ]),
            fileName: "relatorios-financeiro.csv",
        },
        taskChartData: {
            headers: ["Status", "Quantidade"],
            rows: taskChartData.map((item) => [item.label, item.value.toString()]),
            fileName: "relatorios-tarefas.csv",
        },
        agendaChartData: {
            headers: ["Status", "Quantidade"],
            rows: agendaChartData.map((item) => [item.label, item.value.toString()]),
            fileName: "relatorios-agenda.csv",
        },
    };

    const handleExport = (type: ChartExportType) => {
        const mapping = chartExportMap[type];
        if (!mapping || mapping.rows.length === 0) {
            return;
        }

        const csvContent = buildCsvContent(mapping.headers, mapping.rows);
        downloadCsv(csvContent, mapping.fileName);
    };

    return (
        <div className="space-y-8 px-6 lg:px-10">
            <div>
                <h1 className="text-3xl font-bold">Relatórios Jurídicos</h1>
                <p className="text-muted-foreground">Análise de performance do seu CRM jurídico</p>
            </div>

            {error ? (
                <Card className="border-destructive/50 bg-destructive/10 text-destructive">
                    <CardContent className="flex items-center gap-3 py-4 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        <span>{error}</span>
                    </CardContent>
                </Card>
            ) : null}

            <section className="space-y-4" aria-busy={isLoading}>
                <div>
                    <h2 className="text-2xl font-semibold">Processos</h2>
                    <p className="text-sm text-muted-foreground">Resumo dos processos e dos principais indicadores</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Processos Totais</CardTitle>
                            <Folder className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{processMetrics.total}</div>
                            <p className="text-xs text-muted-foreground">Processos registrados na base</p>
                            <div className="mt-1 flex items-center text-xs text-muted-foreground">
                                <TrendingUp
                                    className={`mr-1 h-3 w-3 ${monthlyGrowth >= 0 ? "text-green-500" : "text-destructive"}`}
                                />
                                {monthlyGrowth >= 0 ? "+" : ""}
                                {monthlyGrowth}% vs mês anterior
                            </div>
                        </CardContent>
                    </Card>

                    {processClassifications.map((classification) => {
                        const Icon = classificationIconMap[classification.id] ?? fallbackClassificationIcon;
                        return (
                            <Card key={classification.id}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">{classification.label}</CardTitle>
                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{classification.count}</div>
                                    <p className="text-xs text-muted-foreground">
                                        {formatPercentage(classification.percentage)}% dos processos
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-4">
                        <CardHeader className="flex items-center justify-between gap-4">
                            <div>
                                <CardTitle>Evolução de Processos</CardTitle>
                                <CardDescription>Crescimento de processos ao longo do tempo</CardDescription>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleExport("monthlySeries")}
                                disabled={chartExportMap.monthlySeries.rows.length === 0}
                                aria-label="Exportar evolução de processos"
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="pl-2">
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={monthlySeries}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Area
                                        type="monotone"
                                        dataKey="processos"
                                        stroke="hsl(var(--primary))"
                                        fill="hsl(var(--primary))"
                                        fillOpacity={0.3}
                                        name="Novos"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="encerrados"
                                        stroke="hsl(var(--secondary))"
                                        fill="hsl(var(--secondary))"
                                        fillOpacity={0.3}
                                        name="Encerrados"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card className="col-span-3">
                        <CardHeader className="flex items-center justify-between gap-4">
                            <div>
                                <CardTitle>Distribuição por Área</CardTitle>
                                <CardDescription>Processos por área de atuação</CardDescription>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleExport("areaDistribution")}
                                disabled={chartExportMap.areaDistribution.rows.length === 0}
                                aria-label="Exportar distribuição por área"
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={areaDistribution}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                                        outerRadius={80}
                                        dataKey="value"
                                    >
                                        {areaDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, "Percentual"]} />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Métricas de Processos</CardTitle>
                            <CardDescription>Visão geral dos processos jurídicos</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {processClassifications.map((classification) => (
                                <div className="flex items-baseline justify-between gap-4" key={classification.id}>
                                    <span className="text-sm">{classification.label}</span>
                                    <div className="text-right">
                                        <div className="font-medium">{classification.count}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {formatPercentage(classification.percentage)}% do total
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div className="flex items-baseline justify-between gap-4">
                                <span className="text-sm">Crescimento Mensal</span>
                                <span
                                    className={
                                        monthlyGrowth >= 0 ? "font-medium text-green-600" : "font-medium text-destructive"
                                    }
                                >
                                    {monthlyGrowth >= 0 ? "+" : ""}
                                    {monthlyGrowth}%
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <section className="space-y-4" aria-busy={isLoading}>
                <div>
                    <h2 className="text-2xl font-semibold">Intimações</h2>
                    <p className="text-sm text-muted-foreground">Monitoramento das comunicações recebidas</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total de intimações</CardTitle>
                            <BellRing className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{intimationSummary.total}</div>
                            <p className="text-xs text-muted-foreground">Registros sincronizados no período</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Não lidas</CardTitle>
                            <Mail className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{intimationSummary.unread}</div>
                            <p className="text-xs text-muted-foreground">Intimações aguardando leitura</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ativas</CardTitle>
                            <Archive className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{intimationSummary.active}</div>
                            <p className="text-xs text-muted-foreground">Ainda não arquivadas</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Próximos prazos</CardTitle>
                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{intimationSummary.upcoming}</div>
                            <p className="text-xs text-muted-foreground">Até 7 dias para vencer</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="flex items-center justify-between gap-4">
                        <div>
                            <CardTitle>Distribuição de Intimações</CardTitle>
                            <CardDescription>Visão geral dos status das intimações</CardDescription>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleExport("intimationChartData")}
                            disabled={chartExportMap.intimationChartData.rows.length === 0}
                            aria-label="Exportar distribuição de intimações"
                        >
                            <Download className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={intimationChartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="label" />
                                <YAxis allowDecimals={false} />
                                <Tooltip formatter={(value: number) => [value, "Quantidade"]} />
                                <Bar dataKey="value" fill="hsl(var(--primary))" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </section>

            <section className="space-y-4" aria-busy={isLoading}>
                <div>
                    <h2 className="text-2xl font-semibold">Financeiro</h2>
                    <p className="text-sm text-muted-foreground">Fluxo consolidado de receitas e despesas</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
                            <PiggyBank className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(financialSummary.totalRevenue)}</div>
                            <p className="text-xs text-muted-foreground">Receita acumulada no período</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Despesas Totais</CardTitle>
                            <Banknote className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(financialSummary.totalExpenses)}</div>
                            <p className="text-xs text-muted-foreground">Custos e saídas registradas</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Saldo</CardTitle>
                            <Scale className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(financialSummary.balance)}</div>
                            <p className="text-xs text-muted-foreground">Receitas menos despesas</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Crescimento da Receita</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {financialSummary.revenueGrowth >= 0 ? "+" : ""}
                                {financialSummary.revenueGrowth.toFixed(1)}%
                            </div>
                            <p className="text-xs text-muted-foreground">Comparação com o mês anterior</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="flex items-center justify-between gap-4">
                        <div>
                            <CardTitle>Fluxo Financeiro Mensal</CardTitle>
                            <CardDescription>Receitas e despesas consolidadas</CardDescription>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleExport("financialSeries")}
                            disabled={chartExportMap.financialSeries.rows.length === 0}
                            aria-label="Exportar fluxo financeiro"
                        >
                            <Download className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={financialSeries}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" />
                                <YAxis allowDecimals={false} />
                                <Tooltip
                                    formatter={(value: number, name) => [
                                        formatCurrency(value),
                                        name === "receita" ? "Receita" : "Despesas",
                                    ]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="receita"
                                    stroke="hsl(var(--primary))"
                                    fill="hsl(var(--primary))"
                                    fillOpacity={0.3}
                                    name="Receita"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="despesas"
                                    stroke="hsl(var(--secondary))"
                                    fill="hsl(var(--secondary))"
                                    fillOpacity={0.3}
                                    name="Despesas"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </section>

            <section className="space-y-4" aria-busy={isLoading}>
                <div>
                    <h2 className="text-2xl font-semibold">Tarefas</h2>
                    <p className="text-sm text-muted-foreground">Controle das atividades operacionais</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total de tarefas</CardTitle>
                            <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{taskSummary.total}</div>
                            <p className="text-xs text-muted-foreground">Incluindo concluídas e pendentes</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{taskSummary.pending}</div>
                            <p className="text-xs text-muted-foreground">Aguardando execução</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{taskSummary.overdue}</div>
                            <p className="text-xs text-muted-foreground">Prazo já encerrado</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{taskSummary.completed}</div>
                            <p className="text-xs text-muted-foreground">Tarefas finalizadas</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="flex items-center justify-between gap-4">
                        <div>
                            <CardTitle>Status das Tarefas</CardTitle>
                            <CardDescription>Distribuição entre pendências, atrasos e conclusões</CardDescription>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleExport("taskChartData")}
                            disabled={chartExportMap.taskChartData.rows.length === 0}
                            aria-label="Exportar status das tarefas"
                        >
                            <Download className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={taskChartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="label" />
                                <YAxis allowDecimals={false} />
                                <Tooltip formatter={(value: number) => [value, "Quantidade"]} />
                                <Bar dataKey="value" fill="hsl(var(--primary))" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </section>

            <section className="space-y-4" aria-busy={isLoading}>
                <div>
                    <h2 className="text-2xl font-semibold">Agenda</h2>
                    <p className="text-sm text-muted-foreground">Acompanhamento dos compromissos agendados</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Eventos totais</CardTitle>
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{agendaSummary.total}</div>
                            <p className="text-xs text-muted-foreground">Compromissos registrados</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Próximos</CardTitle>
                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{agendaSummary.upcoming}</div>
                            <p className="text-xs text-muted-foreground">Eventos futuros agendados</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Em andamento</CardTitle>
                            <PlayCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{agendaSummary.ongoing}</div>
                            <p className="text-xs text-muted-foreground">Compromissos iniciados ou vencidos</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{agendaSummary.concluded}</div>
                            <p className="text-xs text-muted-foreground">Eventos finalizados</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Cancelados</CardTitle>
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{agendaSummary.cancelled}</div>
                            <p className="text-xs text-muted-foreground">Removidos da agenda</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="flex items-center justify-between gap-4">
                        <div>
                            <CardTitle>Status da Agenda</CardTitle>
                            <CardDescription>Distribuição por estágio dos compromissos</CardDescription>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleExport("agendaChartData")}
                            disabled={chartExportMap.agendaChartData.rows.length === 0}
                            aria-label="Exportar status da agenda"
                        >
                            <Download className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={agendaChartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="label" />
                                <YAxis allowDecimals={false} />
                                <Tooltip formatter={(value: number) => [value, "Quantidade"]} />
                                <Bar dataKey="value" fill="hsl(var(--primary))" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
