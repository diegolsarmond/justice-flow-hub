import { Card } from "@/components/ui/card";

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

export function RankingCard({ title, data }: RankingCardProps) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">
        {title}
      </h3>

      {data.length > 0 ? (
        <div className="space-y-2">
          {data.map((item) => (
            <div
              key={item.position}
              className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-muted/40 transition-colors"
            >
              {/* Esquerda */}
              <div className="flex items-center gap-3 overflow-hidden">
                {/* Chip da posição */}
                <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground select-none">
                  {item.position}º
                </span>

                {/* Nome com truncation elegante */}
                <span className="text-sm text-foreground truncate max-w-[200px]">
                  {item.label}
                </span>
              </div>

              {/* Direita */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-foreground">
                  {item.value.toLocaleString("pt-BR")}
                </span>
                <span className="text-sm text-muted-foreground text-right min-w-[42px]">
                  {item.percentage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sem dados disponíveis.</p>
      )}
    </Card>
  );
}
