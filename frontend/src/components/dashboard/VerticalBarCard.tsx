import { Card } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface DataItem {
  name: string;
  value: number;
  percentage: number;
}

interface VerticalBarCardProps {
  title: string;
  data: DataItem[];
  barColor?: string;
}

const BLUE_GRADIENTS = [
  { from: "hsl(var(--chart-1))", to: "hsl(var(--chart-2))" },
  { from: "hsl(var(--chart-3))", to: "hsl(var(--chart-4))" },
  { from: "hsl(var(--chart-2))", to: "hsl(var(--chart-3))" },
  { from: "hsl(var(--chart-4))", to: "hsl(var(--chart-5))" },
];

const formatNumber = (value: number) => value.toLocaleString("pt-BR");
const formatPercent = (value: number) =>
  `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function VerticalBarCard({ title, data, barColor }: VerticalBarCardProps) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>

      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ bottom: 50, top: 10 }}>
            <defs>
              {data.map((_, index) => (
                <linearGradient
                  key={index}
                  id={`bar-gradient-${index}`}
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  {barColor ? (
                    <>
                      <stop offset="0%" stopColor={barColor} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={barColor} />
                    </>
                  ) : (
                    <>
                      <stop
                        offset="0%"
                        stopColor={BLUE_GRADIENTS[index % BLUE_GRADIENTS.length].from}
                      />
                      <stop
                        offset="100%"
                        stopColor={BLUE_GRADIENTS[index % BLUE_GRADIENTS.length].to}
                      />
                    </>
                  )}
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid vertical={false} stroke="hsl(var(--muted-foreground) / 0.1)" />

            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              formatter={(_, __, { payload }) => [
                `${formatNumber(payload.value)} (${formatPercent(payload.percentage)})`,
                payload.name,
              ]}
            />

            <XAxis
              dataKey="name"
              angle={-35}
              textAnchor="end"
              tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />

            <Bar
              dataKey="value"
              radius={[6, 6, 0, 0]}
              animationDuration={600}
              animationEasing="ease-out"
            >
              {data.map((_, index) => (
                <Cell key={index} fill={`url(#bar-gradient-${index})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-muted-foreground">Sem dados disponíveis.</p>
      )}
    </Card>
  );
}
