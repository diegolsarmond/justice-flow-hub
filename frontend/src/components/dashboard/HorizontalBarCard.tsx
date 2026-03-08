import {
  Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";

interface DataItem { name: string; value: number; percentage: number; }

interface HorizontalBarCardProps {
  title: string;
  data: DataItem[];
  barColor?: string;
  height?: number;
  yAxisWidth?: number;
  yAxisTextAnchor?: "start" | "end" | "middle";
  yAxisX?: number;
  showPercentageOnly?: boolean;
  showAbsoluteValues?: boolean;
}

export function HorizontalBarCard({
  title,
  data,
  barColor = "hsl(var(--chart-1))",
  height = 200,
  yAxisWidth = 150,
  yAxisTextAnchor = "end",
  yAxisX,
  showPercentageOnly = false,
  showAbsoluteValues = false,
}: HorizontalBarCardProps) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ top: 12, right: 32, left: yAxisWidth, bottom: 0 }}>
            <defs>
              <linearGradient id="horizontal-bar-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={barColor} stopOpacity={0.6} />
                <stop offset="100%" stopColor={barColor} />
              </linearGradient>
            </defs>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={yAxisWidth}
              tick={(props) => {
                const { x, y, payload } = props;
                return (
                  <text
                    x={yAxisX ?? x}
                    y={y}
                    dy={4}
                    textAnchor={yAxisTextAnchor}
                    fill="hsl(var(--foreground))"
                    fontSize={12}
                  >
                    {payload.value}
                  </text>
                );
              }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <Bar dataKey="percentage" radius={[0, 8, 8, 0]} background={{ fill: "hsl(var(--muted))" }} fill="url(#horizontal-bar-gradient)" barSize={18}>
              <LabelList
                dataKey={showAbsoluteValues ? "value" : "percentage"}
                position="right"
                formatter={(value: number, entry: any) => {
                  if (showAbsoluteValues) return value.toLocaleString("pt-BR");
                  if (showPercentageOnly) return `${value}%`;
                  const p = entry?.payload;
                  if (!p) return `${value}%`;
                  return `${p.value.toLocaleString("pt-BR")} (${value}%)`;
                }}
                className="fill-foreground text-sm font-semibold"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-muted-foreground">Sem dados disponíveis.</p>
      )}
    </Card>
  );
}
