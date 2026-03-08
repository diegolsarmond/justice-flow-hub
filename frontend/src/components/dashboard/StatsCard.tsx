import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface StatItem {
  label: string;
  value: number | string;
  percentage: number;
}

interface StatsCardProps {
  title: string;
  mainValue?: string;
  stats: StatItem[];
}

export function StatsCard({ title, mainValue, stats }: StatsCardProps) {
  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>

        {mainValue && (
          <div className="text-4xl font-semibold tracking-tight text-foreground">
            {mainValue}
          </div>
        )}

        {stats.length > 0 ? (
          <div className="space-y-5">
            {stats.map((stat, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground/90 truncate">
                    {stat.label}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {stat.percentage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  </span>
                </div>

                <div className="relative w-full h-2 rounded-lg overflow-hidden bg-muted">
                  <div
                    className="h-full transition-all duration-500 rounded-lg"
                    style={{
                      width: `${Math.max(stat.percentage, 3)}%`,
                      background: `linear-gradient(90deg, hsl(var(--chart-1)), hsl(var(--chart-2)))`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sem dados disponíveis.</p>
        )}
      </div>
    </Card>
  );
}
