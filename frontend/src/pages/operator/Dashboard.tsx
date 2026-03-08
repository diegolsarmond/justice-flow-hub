import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3, LayoutDashboard } from "lucide-react";

import {
    loadDashboardAnalytics,
    type DashboardAnalytics,
    type DistributionSlice,
    type RankingEntry,
    type TimeHistogram,
} from "@/services/analytics";
import { Card, CardContent } from "@/components/ui/card";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { PieChartCard } from "@/components/dashboard/PieChartCard";
import { HorizontalBarCard } from "@/components/dashboard/HorizontalBarCard";
import { VerticalBarCard } from "@/components/dashboard/VerticalBarCard";
import { RankingCard } from "@/components/dashboard/RankingCard";
import { MapCard } from "@/components/dashboard/MapCard";

interface ChartDataItem {
    name: string;
    value: number;
    percentage: number;
}

interface RankingItem {
    position: number;
    label: string;
    value: number;
    percentage: number;
}

interface MapItem {
    state: string;
    name: string;
    value: number;
    percentage: number;
}

const toPercentage = (value: number) => (Number.isFinite(value) ? Number(value.toFixed(1)) : 0);

const formatNumber = (value: number) => value.toLocaleString("pt-BR");

const formatCurrency = (value: number) =>
    (Number.isFinite(value) ? value : 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });

const buildDistributionData = (items: DistributionSlice[]): ChartDataItem[] =>
    items.map((item) => ({
        name: item.name,
        value: Number.isFinite(item.rawValue ?? NaN) ? (item.rawValue ?? 0) : item.value,
        percentage: toPercentage(item.value),
    }));

const buildRankingData = (items: RankingEntry[]): RankingItem[] =>
    items.slice(0, 5).map((item, index) => ({
        position: index + 1,
        label: item.label,
        value: item.value,
        percentage: toPercentage(item.percentage),
    }));

const EmptyStateCard = ({ title, message }: { title: string; message?: string }) => (
    <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed border-2 hover:border-primary/50 transition-colors bg-muted/5 h-full min-h-[200px]">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted shadow-sm mb-4">
            <BarChart3 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            {message ?? "Ainda não há dados suficientes para exibir esta métrica."}
        </p>
    </Card>
);

export default function Dashboard() {
    const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        let mounted = true;

        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await loadDashboardAnalytics(controller.signal);

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
                    setError("Não foi possível carregar as métricas do dashboard.");
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

    const processCards = analytics?.processCards ?? [];
    const processPoloMetrics = analytics?.processPoloMetrics ?? [];
    const distributions = analytics?.distributions ?? {
        byStatus: [],
        byBranch: [],
        bySegment: [],
        byInstance: [],
        byYear: [],
        byCourt: [],
        byClaimValue: [],
        bySentenceOutcome: [],
    };
    const rankings = analytics?.rankings ?? {
        byStatus: [],
        byBranch: [],
        bySegment: [],
        byInstance: [],
        byState: [],
        bySubject: [],
        byClass: [],
    };
    const averageTimes = analytics?.averageTimes ?? [];
    const timeHistograms = analytics?.timeHistograms ?? [];
    const opportunityStatusMetrics = analytics?.opportunityStatusMetrics ?? [];
    const areaDistribution = analytics?.areaDistribution ?? [];

    const opportunityRanking = useMemo<RankingEntry[]>(() => {
        if (opportunityStatusMetrics.length === 0) {
            return [];
        }

        const total = opportunityStatusMetrics.reduce((sum, item) => sum + item.count, 0);
        if (total === 0) {
            return [];
        }

        return opportunityStatusMetrics.map((item) => ({
            label: item.status,
            value: item.count,
            percentage: Number(((item.count / total) * 100).toFixed(1)),
        }));
    }, [opportunityStatusMetrics]);

    const totalProcesses = processCards.find((card) => card.id === "total")?.value ?? 0;

    const processStats = useMemo(
        () =>
            distributions.byStatus.slice(0, 4).map((item) => ({
                label: item.name,
                value: item.rawValue ?? 0,
                percentage: toPercentage(item.value),
            })),
        [distributions.byStatus],
    );

    const totalPoloCount = useMemo(
        () => processPoloMetrics.reduce((sum, metric) => sum + metric.processCount, 0),
        [processPoloMetrics],
    );

    const totalPoloValue = useMemo(
        () => processPoloMetrics.reduce((sum, metric) => sum + metric.totalValue, 0),
        [processPoloMetrics],
    );

    const processPoloCountStats = useMemo(
        () =>
            processPoloMetrics.map((metric) => ({
                label: `${metric.category} (${formatNumber(metric.processCount)})`,
                value: metric.processCount,
                percentage: toPercentage(
                    totalPoloCount > 0 ? (metric.processCount / totalPoloCount) * 100 : 0,
                ),
            })),
        [processPoloMetrics, totalPoloCount],
    );

    const processPoloValueStats = useMemo(
        () =>
            processPoloMetrics.map((metric) => ({
                label: `${metric.category} (${formatCurrency(metric.totalValue)})`,
                value: metric.totalValue,
                percentage: toPercentage(
                    totalPoloValue > 0 ? (metric.totalValue / totalPoloValue) * 100 : 0,
                ),
            })),
        [processPoloMetrics, totalPoloValue],
    );

    const clientStats = useMemo(() => {
        const metrics = analytics?.clientMetrics;
        if (!metrics || metrics.total <= 0) {
            return [];
        }

        const inactive = Math.max(metrics.total - metrics.active, 0);
        const total = metrics.total || 1;

        return [
            {
                label: `Ativos (${formatNumber(metrics.active)})`,
                value: metrics.active,
                percentage: toPercentage((metrics.active / total) * 100),
            },
            {
                label: `Prospects (${formatNumber(metrics.prospects)})`,
                value: metrics.prospects,
                percentage: toPercentage((metrics.prospects / total) * 100),
            },
            {
                label: `Inativos (${formatNumber(inactive)})`,
                value: inactive,
                percentage: toPercentage((inactive / total) * 100),
            },
        ];
    }, [analytics?.clientMetrics]);

    const branchDistribution = useMemo(
        () => buildDistributionData(distributions.byBranch),
        [distributions.byBranch],
    );

    const yearBarData = useMemo(
        () => buildDistributionData(distributions.byYear),
        [distributions.byYear],
    );

    const courtBarData = useMemo(
        () => buildDistributionData(distributions.byCourt),
        [distributions.byCourt],
    );

    const claimValueBarData = useMemo(
        () => buildDistributionData(distributions.byClaimValue),
        [distributions.byClaimValue],
    );

    const segmentBarData = useMemo(() => {
        const data = buildDistributionData(distributions.bySegment);
        if (data.length > 0) {
            return data;
        }

        return rankings.bySegment.map((item) => ({
            name: item.label,
            value: item.rawValue ?? item.value,
            percentage: toPercentage(item.percentage),
        }));
    }, [distributions.bySegment, rankings.bySegment]);

    const statusBarData = useMemo(
        () => buildDistributionData(distributions.byStatus),
        [distributions.byStatus],
    );

    const sentenceOutcomeData = useMemo(
        () => buildDistributionData(distributions.bySentenceOutcome),
        [distributions.bySentenceOutcome],
    );

    const instanceBarData = useMemo(
        () => buildDistributionData(distributions.byInstance),
        [distributions.byInstance],
    );

    const rankingStatusData = useMemo(
        () => buildRankingData(rankings.byStatus),
        [rankings.byStatus],
    );

    const rankingSegmentData = useMemo(
        () => buildRankingData(rankings.bySegment),
        [rankings.bySegment],
    );

    const rankingSubjectData = useMemo(
        () => buildRankingData(rankings.bySubject),
        [rankings.bySubject],
    );

    const rankingClassData = useMemo(
        () => buildRankingData(rankings.byClass),
        [rankings.byClass],
    );

    const rankingOpportunitiesData = useMemo(
        () => buildRankingData(opportunityRanking),
        [opportunityRanking],
    );

    const buildAverageTimeChart = (keywords: string[]): ChartDataItem[] => {
        if (averageTimes.length === 0) {
            return [];
        }

        const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
        const filtered = averageTimes.filter((metric) => {
            const id = metric.id.toLowerCase();
            const label = metric.label.toLowerCase();
            return normalizedKeywords.some((keyword) => id.includes(keyword) || label.includes(keyword));
        });

        const source = filtered.length > 0 ? filtered : averageTimes;

        return source.map((metric) => ({
            name: metric.label,
            value: metric.valueInDays,
            percentage: Number(metric.valueInDays.toFixed(1)),
        }));
    };

    const findHistogramByKeywords = (keywords: string[]): TimeHistogram | null => {
        if (timeHistograms.length === 0) {
            return null;
        }

        const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
        return (
            timeHistograms.find((histogram) => {
                const id = histogram.id.toLowerCase();
                const label = histogram.label.toLowerCase();
                return normalizedKeywords.some((keyword) => id.includes(keyword) || label.includes(keyword));
            }) ?? null
        );
    };

    const TIME_BUCKET_ORDER = [
        "Até 90 Dias",
        "90 A 180 Dias",
        "180 A 365 Dias",
        "365 A 730 Dias",
        "Acima De 730 Dias",
    ];

    const sortTimeBuckets = (items: ChartDataItem[]) => {
        return [...items].sort((a, b) => {
            const indexA = TIME_BUCKET_ORDER.indexOf(a.name);
            const indexB = TIME_BUCKET_ORDER.indexOf(b.name);

            // Items in the list come first, sorted by index
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;

            // Fallback to alphabetical or other sort for unknown items
            return a.name.localeCompare(b.name);
        });
    };

    // ... inside Dashboard component ...

    const buildHistogramChart = (keywords: string[]): ChartDataItem[] => {
        const histogram = findHistogramByKeywords(keywords);
        if (!histogram) {
            return [];
        }

        const data = histogram.buckets.map((bucket) => ({
            name: bucket.label,
            value: bucket.count,
            percentage: toPercentage(bucket.percentage),
        }));

        return sortTimeBuckets(data);
    };

    // ...



    const buildTimeChart = (keywords: string[]): ChartDataItem[] => {
        const histogramData = buildHistogramChart(keywords);
        if (histogramData.length > 0) {
            return histogramData;
        }

        return buildAverageTimeChart(keywords);
    };

    const timeToJudgmentData = useMemo(
        () => buildTimeChart(["transito", "trânsito", "transit"]),
        [averageTimes, timeHistograms],
    );

    const timeToTrialData = useMemo(
        () => buildTimeChart(["aud", "julgament", "senten", "trial"]),
        [averageTimes, timeHistograms],
    );

    const timeToArchiveData = useMemo(
        () => buildTimeChart(["arquiv", "encerr", "archive"]),
        [averageTimes, timeHistograms],
    );

    const areaDistributionData = useMemo(
        () => buildDistributionData(areaDistribution),
        [areaDistribution],
    );

    const opportunityBarData = useMemo(
        () =>
            opportunityRanking.map((item) => ({
                name: item.label,
                value: item.value,
                percentage: toPercentage(item.percentage),
            })),
        [opportunityRanking],
    );

    const mapData = useMemo<MapItem[]>(() => {
        const stateRanking = rankings.byState ?? [];
        return stateRanking
            .map((item) => {
                const code = item.label?.slice(0, 2)?.toUpperCase();
                if (!code || code.length !== 2) {
                    return null;
                }

                return {
                    state: code,
                    name: item.label,
                    value: item.value,
                    percentage: toPercentage(item.percentage),
                };
            })
            .filter((item): item is MapItem => item !== null);
    }, [rankings.byState]);

    return (
        <div className="space-y-6 lg:space-y-8 px-6 pb-12 lg:px-10 animate-in fade-in duration-700">
            <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <LayoutDashboard className="h-8 w-8 text-primary" />
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-blue-600 to-purple-600 bg-clip-text text-transparent">
                            Dashboard
                        </h1>
                    </div>
                    <p className="text-sm text-balance text-muted-foreground">
                        Visão geral do seu CRM jurídico e indicadores de performance em tempo quase real.
                    </p>
                </div>
            </header>

            {error ? (
                <Card className="border-destructive/50 bg-destructive/10 text-destructive">
                    <CardContent className="flex items-center gap-3 py-4 text-sm font-medium">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                    </CardContent>
                </Card>
            ) : null}

            <main className="space-y-6" aria-busy={isLoading}>
                {/* Visão Geral */}
                <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <div className="group transition-all hover:-translate-y-1 hover:shadow-lg duration-300">
                        <StatsCard
                            title="Processos monitorados"
                            mainValue={formatNumber(totalProcesses)}
                            stats={processStats}
                        />
                    </div>
                    <div className="group transition-all hover:-translate-y-1 hover:shadow-lg duration-300">
                        <StatsCard
                            title="Clientes ativos"
                            mainValue={formatNumber(analytics?.clientMetrics?.total ?? 0)}
                            stats={clientStats}
                        />
                    </div>
                    <div className="group transition-all hover:-translate-y-1 hover:shadow-lg duration-300">
                        <PieChartCard title="Distribuição por ramo" data={branchDistribution} />
                    </div>
                </section>

                {/* Métricas Financeiras e de Polo */}
                <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="group transition-all hover:shadow-md duration-300">
                        <StatsCard
                            title="Processos por polo"
                            mainValue={formatNumber(totalPoloCount)}
                            stats={processPoloCountStats}
                        />
                    </div>
                    <div className="group transition-all hover:shadow-md duration-300">
                        <StatsCard
                            title="Valor dos processos por polo"
                            mainValue={formatCurrency(totalPoloValue)}
                            stats={processPoloValueStats}
                        />
                    </div>
                </section>

                {/* Mapa e Tribunais */}
                <section className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr] h-full">
                    {courtBarData.length > 0 ? (
                        <div className="group transition-all hover:shadow-md duration-300 h-full">
                            <HorizontalBarCard
                                title="Processos por tribunal"
                                data={courtBarData}
                                barColor="hsl(var(--chart-secondary))"
                                height={600}
                                yAxisWidth={140}
                                yAxisTextAnchor="start"
                                yAxisX={10}
                                showAbsoluteValues
                            />
                        </div>
                    ) : (
                        <EmptyStateCard
                            title="Processos por tribunal"
                            message="Sem dados de tribunal disponíveis no momento."
                        />
                    )}
                    <div className="group transition-all hover:shadow-md duration-300 h-full">
                        <MapCard title="Distribuição de processos por estado" data={mapData} />
                    </div>
                </section>

                {/* Segmentos e Status */}
                <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {segmentBarData.length > 0 ? (
                        <div className="group transition-all hover:shadow-md duration-300">
                            <HorizontalBarCard
                                title="Segmentos de justiça"
                                data={segmentBarData}
                                barColor="hsl(var(--chart-secondary))"
                            />
                        </div>
                    ) : (
                        <EmptyStateCard
                            title="Segmentos de justiça"
                        />
                    )}
                    {statusBarData.length > 0 ? (
                        <div className="group transition-all hover:shadow-md duration-300">
                            <HorizontalBarCard
                                title="Status processuais"
                                data={statusBarData}
                                barColor="hsl(var(--chart-1))"
                            />
                        </div>
                    ) : (
                        <EmptyStateCard
                            title="Status processuais"
                        />
                    )}
                    {instanceBarData.length > 0 ? (
                        <div className="group transition-all hover:shadow-md duration-300">
                            <HorizontalBarCard
                                title="Processos por instância"
                                data={instanceBarData}
                                barColor="hsl(var(--chart-secondary))"
                            />
                        </div>
                    ) : (
                        <EmptyStateCard
                            title="Processos por instância"
                        />
                    )}
                </section>

                {/* Sentenças e Tempos */}
                <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="space-y-6">
                        <div className="group transition-all hover:shadow-md duration-300">
                            {sentenceOutcomeData.length > 0 ? (
                                <HorizontalBarCard
                                    title="Resultados de sentença"
                                    data={sentenceOutcomeData}
                                    barColor="hsl(var(--chart-secondary))"
                                />
                            ) : (
                                <EmptyStateCard
                                    title="Resultados de sentença"
                                />
                            )}
                        </div>
                        <div className="group transition-all hover:shadow-md duration-300">
                            {yearBarData.length > 0 ? (
                                <VerticalBarCard
                                    title="Processos por ano"
                                    data={yearBarData}
                                    barColor="hsl(var(--chart-1))"
                                />
                            ) : (
                                <EmptyStateCard
                                    title="Processos por ano"
                                />
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="group transition-all hover:shadow-md duration-300">
                            {claimValueBarData.length > 0 ? (
                                <HorizontalBarCard
                                    title="Faixas de valor"
                                    data={claimValueBarData}
                                    barColor="hsl(var(--chart-1))"
                                />
                            ) : (
                                <EmptyStateCard
                                    title="Processos por faixa de valor"
                                />
                            )}
                        </div>
                        <div className="group transition-all hover:shadow-md duration-300">
                            {rankingStatusData.length > 0 ? (
                                <RankingCard title="Ranking de status" data={rankingStatusData} />
                            ) : (
                                <EmptyStateCard
                                    title="Ranking de status"
                                />
                            )}
                        </div>
                    </div>
                </section>

                {/* Rankings e Tempos */}
                <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <div className="group transition-all hover:shadow-md duration-300">
                        {rankingSubjectData.length > 0 ? (
                            <RankingCard title="Ranking de assuntos" data={rankingSubjectData} />
                        ) : (
                            <EmptyStateCard
                                title="Ranking de assuntos"
                            />
                        )}
                    </div>
                    <div className="group transition-all hover:shadow-md duration-300">
                        {rankingClassData.length > 0 ? (
                            <RankingCard title="Ranking de classes" data={rankingClassData} />
                        ) : (
                            <EmptyStateCard
                                title="Ranking de classes"
                            />
                        )}
                    </div>
                    <div className="group transition-all hover:shadow-md duration-300">
                        {rankingOpportunitiesData.length > 0 ? (
                            <RankingCard title="Ranking de oportunidades" data={rankingOpportunitiesData} />
                        ) : (
                            <EmptyStateCard title="Tops Oportunidades" />
                        )}
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="group transition-all hover:shadow-md duration-300">
                        {timeToJudgmentData.length > 0 ? (
                            <VerticalBarCard
                                title="Tempo até trânsito em julgado"
                                data={timeToJudgmentData}
                                barColor="hsl(var(--chart-secondary))"
                            />
                        ) : (
                            <EmptyStateCard
                                title="Tempo até trânsito em julgado"
                            />
                        )}
                    </div>
                    <div className="group transition-all hover:shadow-md duration-300">
                        {timeToTrialData.length > 0 ? (
                            <VerticalBarCard
                                title="Tempo até julgamento"
                                data={timeToTrialData}
                                barColor="hsl(var(--chart-1))"
                            />
                        ) : (
                            <EmptyStateCard
                                title="Tempo até julgamento"
                            />
                        )}
                    </div>
                    <div className="group transition-all hover:shadow-md duration-300">
                        {timeToArchiveData.length > 0 ? (
                            <VerticalBarCard
                                title="Tempo até arquivamento"
                                data={timeToArchiveData}
                                barColor="hsl(var(--chart-1))"
                            />
                        ) : (
                            <EmptyStateCard
                                title="Tempo até arquivamento"
                            />
                        )}
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="group transition-all hover:shadow-md duration-300">
                        {areaDistributionData.length > 0 ? (
                            <HorizontalBarCard
                                title="Distribuição por área"
                                data={areaDistributionData}
                                barColor="hsl(var(--chart-1))"
                            />
                        ) : (
                            <EmptyStateCard
                                title="Distribuição por área"
                            />
                        )}
                    </div>
                    <div className="group transition-all hover:shadow-md duration-300">
                        {opportunityBarData.length > 0 ? (
                            <HorizontalBarCard
                                title="Oportunidades por status"
                                data={opportunityBarData}
                                barColor="hsl(var(--chart-1))"
                            />
                        ) : (
                            <EmptyStateCard
                                title="Oportunidades por status"
                            />
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}
