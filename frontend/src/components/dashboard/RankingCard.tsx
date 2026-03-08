import { Trophy, Medal, Award } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RankingItem {
  position: number;
  label: string;
  value: number;
  percentage: number;
}

interface RankingCardProps {
  title: string;
  data: RankingItem[];
}

function RankIcon({ position }: { position: number }) {
  if (position === 1) {
    return <Trophy className="h-4 w-4 text-amber-500 animate-in zoom-in duration-300" />;
  }
  if (position === 2) {
    return <Medal className="h-4 w-4 text-slate-400 animate-in zoom-in duration-300 delay-75" />;
  }
  if (position === 3) {
    return <Medal className="h-4 w-4 text-amber-700 animate-in zoom-in duration-300 delay-100" />;
  }
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-muted/40 text-[10px] font-bold text-muted-foreground shadow-sm">
      {position}
    </span>
  );
}

function getProgressColor(position: number) {
  if (position === 1) return "bg-amber-500 shadow-md shadow-amber-500/20";
  if (position === 2) return "bg-slate-400 shadow-md shadow-slate-400/20";
  if (position === 3) return "bg-amber-700 shadow-md shadow-amber-700/20";
  return "bg-primary/80";
}

export function RankingCard({ title, data }: RankingCardProps) {
  return (
    <Card className="flex h-full flex-col overflow-hidden bg-gradient-to-br from-card to-muted/20 p-6 shadow-sm ring-1 ring-border/50">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Award className="h-4 w-4 text-muted-foreground" />
          {title}
        </h3>
      </div>

      {data.length > 0 ? (
        <div className="flex-1 space-y-5">
          {data.map((item, index) => (
            <div key={item.position} className="group relative flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border/50 shadow-sm">
                    <RankIcon position={item.position} />
                  </div>
                  <span className="truncate font-medium text-foreground/90 transition-colors group-hover:text-primary">
                    {item.label}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">{item.value.toLocaleString("pt-BR")}</span>
                  <span className="min-w-[3rem] rounded-full bg-muted/60 px-2 py-0.5 text-center font-medium">
                    {item.percentage}%
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative h-1.5 w-full rounded-full bg-secondary/50 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700 ease-out",
                    getProgressColor(item.position)
                  )}
                  style={{ width: `${Math.max(item.percentage, 2)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <Award className="h-8 w-8 opacity-20" />
          <p className="text-sm font-medium">Sem dados para exibir</p>
        </div>
      )}
    </Card>
  );
}
