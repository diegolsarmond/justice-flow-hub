import { Card } from "@/components/ui/card";
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip, Label } from "recharts";

interface DataItem {
  name: string;
  value: number;
  percentage: number;
}

interface PieChartCardProps {
  title: string;
  data: DataItem[];
}

// Paleta azul escura moderna
const BLUE_GRADIENTS = [
  { from: "hsl(var(--chart-1))", to: "hsl(var(--chart-2))" },
  { from: "hsl(var(--chart-2))", to: "hsl(var(--chart-3))" },
  { from: "hsl(var(--chart-3))", to: "hsl(var(--chart-4))" },
  { from: "hsl(var(--chart-4))", to: "hsl(var(--chart-5))" },
];

const formatNumber = (value: number) => value.toLocaleString("pt-BR");
const formatPercent = (value: number) =>
  `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function PieChartCard({ title, data }: PieChartCardProps) {
  const totalValue = data.reduce((acc, item) => acc + item.value, 0);

  return (
    <Card className="h-full p-6">
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">{title}</h3>

      {data.length > 0 ? (
        <div className="mt-4 flex flex-col items-center gap-6 md:flex-row">
          {/* Gráfico */}
          <div className="flex-1 min-w-[180px]">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <defs>
                  {data.map((_, index) => (
                    <radialGradient
                      key={index}
                      id={`gradient-${index}`}
                      cx="50%"
                      cy="50%"
                      r="80%"
                    >
                      <stop offset="0%" stopColor={BLUE_GRADIENTS[index % BLUE_GRADIENTS.length].from} />
                      <stop offset="100%" stopColor={BLUE_GRADIENTS[index % BLUE_GRADIENTS.length].to} />
                    </radialGradient>
                  ))}
                </defs>

                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    padding: "8px 10px",
                    fontSize: "12px",
                  }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number | string, _name, { payload }: any) => [
                    `${formatNumber(Number(value))} (${formatPercent(payload.percentage)})`,
                    payload.name,
                  ]}
                />

                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={64}
                  outerRadius={100}
                  strokeWidth={0}
                  paddingAngle={3}
                  dataKey="value"
                  animationDuration={650}
                  animationEasing="ease-out"
                >
                  {data.map((_, index) => (
                    <Cell key={index} fill={`url(#gradient-${index})`} />
                  ))}

                  <Label
                    position="center"
                    className="fill-foreground text-base font-semibold"
                    value={formatNumber(totalValue)}
                  />
                  <Label
                    position="center"
                    dy={20}
                    className="fill-muted-foreground text-xs"
                    value="Total"
                  />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legenda */}
          <div className="flex-1 w-full max-h-48 overflow-y-auto pr-1">
            <ul className="space-y-2 text-xs">
              {data.map((item, index) => (
                <li
                  key={item.name}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: BLUE_GRADIENTS[index % BLUE_GRADIENTS.length].to,
                      }}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {formatPercent(item.percentage)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sem dados disponíveis.</p>
      )}
    </Card>
  );
}
