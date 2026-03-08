import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import brasilMapSvg from "@/assets/brasil-estados.svg?raw";

const STATE_NAMES: Record<string, string> = {
    AC: "Acre",
    AL: "Alagoas",
    AP: "Amapá",
    AM: "Amazonas",
    BA: "Bahia",
    CE: "Ceará",
    DF: "Distrito Federal",
    ES: "Espírito Santo",
    GO: "Goiás",
    MA: "Maranhão",
    MT: "Mato Grosso",
    MS: "Mato Grosso do Sul",
    MG: "Minas Gerais",
    PA: "Pará",
    PB: "Paraíba",
    PR: "Paraná",
    PE: "Pernambuco",
    PI: "Piauí",
    RJ: "Rio de Janeiro",
    RN: "Rio Grande do Norte",
    RS: "Rio Grande do Sul",
    RO: "Rondônia",
    RR: "Roraima",
    SC: "Santa Catarina",
    SP: "São Paulo",
    SE: "Sergipe",
    TO: "Tocantins",
};

interface MapData {
    state: string;
    name: string;
    value: number;
    percentage: number;
}

interface MapCardProps {
    title: string;
    data: MapData[];
}

export function MapCard({ title, data }: MapCardProps) {
    const [hoveredState, setHoveredState] = useState<string | null>(null);

    const mapMarkup = useMemo(() => {
        if (typeof window === "undefined") {
            return {
                viewBox: "0 0 780 840",
                preserveAspectRatio: "xMidYMid meet",
                paths: [] as { id?: string; uf: string; d: string }[],
            };
        }

        const parser = new DOMParser();
        const documentSvg = parser.parseFromString(brasilMapSvg, "image/svg+xml");
        const svgElement = documentSvg.querySelector("svg");
        const textElements = Array.from(documentSvg.querySelectorAll("text"));
        const paths: { id?: string; uf: string; d: string }[] = [];
        const seenStates = new Set<string>();

        for (const textElement of textElements) {
            const uf = textElement.textContent?.trim().toUpperCase();
            if (!uf || uf.length !== 2) continue;

            let sibling = textElement.previousElementSibling;
            while (
                sibling &&
                (sibling.tagName.toLowerCase() !== "path" ||
                    sibling.getAttribute("class") === "circle")
            ) {
                sibling = sibling.previousElementSibling;
            }

            if (!sibling || sibling.tagName.toLowerCase() !== "path") continue;

            const d = sibling.getAttribute("d");
            if (!d || seenStates.has(uf)) continue;

            seenStates.add(uf);
            paths.push({ id: sibling.getAttribute("id") ?? undefined, uf, d });
        }

        return {
            viewBox: svgElement?.getAttribute("viewBox") ?? "0 0 780 840",
            preserveAspectRatio:
                svgElement?.getAttribute("preserveAspectRatio") ??
                svgElement?.getAttribute("preserveaspectratio") ??
                "xMidYMid meet",
            paths,
        };
    }, []);

    const getStateData = (state: string) =>
        data.find((item) => item.state === state);

    const colorScale = {
        highest: "var(--chart-map-highest)",
        high: "var(--chart-map-high)",
        medium: "var(--chart-map-medium)",
        low: "var(--chart-map-low)",
        lowest: "var(--chart-map-lowest)",
    };

    const getStateColor = (state: string) => {
        const stateData = getStateData(state);
        if (!stateData) return colorScale.lowest;

        const { percentage } = stateData;
        if (percentage >= 15) return colorScale.highest;
        if (percentage >= 10) return colorScale.high;
        if (percentage >= 5) return colorScale.medium;
        if (percentage >= 2) return colorScale.low;
        return colorScale.lowest;
    };

    const hoveredData = hoveredState ? getStateData(hoveredState) : null;

    const getHoveredStateName = () => {
        if (!hoveredData) {
            return null;
        }

        return STATE_NAMES[hoveredData.state] ?? hoveredData.name;
    };

    if (data.length === 0) {
        return (
            <Card className="border border-border/60 bg-gradient-to-br from-background via-card to-background shadow-lg">
                <CardHeader>
                    <CardTitle className="text-base font-medium text-foreground">
                        {title}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Sem dados geográficos disponíveis.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border border-border/60 bg-gradient-to-br from-background via-card to-background shadow-lg">
            <CardHeader>
                <CardTitle className="text-base font-medium text-foreground">
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative space-y-4">
                    {/* Legenda */}
                    <div className="flex flex-wrap gap-3 text-xs">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: colorScale.highest }}
                            />
                            <span>≥15%</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: colorScale.high }}
                            />
                            <span>10-15%</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: colorScale.medium }}
                            />
                            <span>5-10%</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: colorScale.low }}
                            />
                            <span>2-5%</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: colorScale.lowest }}
                            />
                            <span>&lt;2%</span>
                        </div>
                    </div>

                    {/* Tooltip */}
                    {hoveredData ? (
                        <div className="pointer-events-none absolute top-3 right-3 bg-popover border border-border rounded-lg p-3 shadow-lg z-10">
                            <div className="text-sm font-medium">{getHoveredStateName()}</div>
                            <div className="text-2xl font-bold text-primary mt-1">
                                {hoveredData.value.toLocaleString("pt-BR")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {hoveredData.percentage}% do total
                            </div>
                        </div>
                    ) : null}

                    {/* MAPA AUMENTADO */}
                    <div className="relative w-full max-w-[999px] mx-auto">
                        <svg
                            viewBox={mapMarkup.viewBox}
                            preserveAspectRatio={mapMarkup.preserveAspectRatio}
                            className="block w-full h-[450px]"
                        >
                            <g vectorEffect="non-scaling-stroke">
                                {mapMarkup.paths.map((path) => (
                                    <path
                                        key={path.id ?? path.uf}
                                        id={path.id}
                                        data-uf={path.uf}
                                        d={path.d}
                                        fill={getStateColor(path.uf)}
                                        stroke="hsl(var(--border))"
                                        strokeWidth={1}
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                        className="estado cursor-pointer transition-all"
                                        onMouseEnter={() => setHoveredState(path.uf)}
                                        onMouseLeave={() => setHoveredState(null)}
                                    />
                                ))}
                            </g>
                        </svg>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
