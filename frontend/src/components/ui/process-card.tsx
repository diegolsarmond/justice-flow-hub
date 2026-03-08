import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Calendar,
  Users,
  FileText,
  Pencil,
  Gavel,
  Clock,
  Loader2,
  Check,
  MapPin,
  Building2,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ProcessCardProps {
  numero: string;
  classe: string;
  status: string;
  cliente: string;
  advogados: string;
  advogadosResumo?: string | null;
  dataDistribuicao: string;
  ultimaMovimentacao: string;
  ultimaMovimentacaoData?: string | null;
  ultimaMovimentacaoTipo?: string | null;
  ultimaMovimentacaoDescricao?: string | null;
  jurisdicao: string;
  orgaoJulgador: string;
  onView: () => void;
  onEdit?: () => void;
  isLoading?: boolean;
  naoLido?: boolean;
  onMarkAsRead?: () => void;
  isMarkingAsRead?: boolean;
}

const formatDateToPtBR = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("pt-BR");
};

export function ProcessCard({
  numero,
  classe,
  status,
  cliente,
  advogados,
  advogadosResumo,
  dataDistribuicao,
  ultimaMovimentacao,
  ultimaMovimentacaoData,
  ultimaMovimentacaoTipo,
  ultimaMovimentacaoDescricao,
  jurisdicao,
  orgaoJulgador,
  onView,
  onEdit,
  isLoading = false,
  naoLido = false,
  onMarkAsRead,
  isMarkingAsRead = false,
}: ProcessCardProps) {
  const { toast } = useToast();
  const resolvedAdvogados = (() => {
    const advogadosLabel = typeof advogados === "string" ? advogados.trim() : "";
    if (advogadosLabel && advogadosLabel !== "Não informado") {
      return advogadosLabel;
    }

    if (typeof advogadosResumo === "string") {
      const trimmed = advogadosResumo.trim();
      if (trimmed) {
        return trimmed;
      }
    }

    return advogadosLabel || "Não informado";
  })();

  const resolvedUltimaMovimentacao = (() => {
    const dateLabel =
      formatDateToPtBR(ultimaMovimentacaoData) ??
      formatDateToPtBR(ultimaMovimentacao);

    // Simplifies the display if there are details
    const details = [ultimaMovimentacaoTipo]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean);

    if (details.length === 0) {
      // Only date or raw string
      const rawLabel = typeof ultimaMovimentacao === "string" ? ultimaMovimentacao.trim() : "";
      return dateLabel || rawLabel || "Sem movimentações recentes";
    }

    return `${dateLabel ? `${dateLabel} • ` : ""}${details.join(" - ")}`;
  })();

  const isUnread = Boolean(naoLido);
  const statusColor = status === "Ativo" || status === "Em andamento"
    ? "bg-emerald-500/15 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800"
    : "bg-slate-500/15 text-slate-700 border-slate-200 dark:text-slate-400 dark:border-slate-800";

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:shadow-md border-border/60",
        isUnread ? "bg-primary/5 dark:bg-primary/10 border-primary/20" : "bg-card/50"
      )}
    >
      {isUnread && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
      )}

      <CardContent className="p-5 space-y-5">
        {/* Header Section */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5 flex-1 w-full min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn("capitalize font-medium border", statusColor)}>
                {status}
              </Badge>
              <Badge variant="secondary" className="bg-background/80 font-normal text-muted-foreground hover:bg-background/80">
                {classe}
              </Badge>
              {isUnread && (
                <Badge variant="default" className="bg-primary/90 hover:bg-primary animate-pulse">
                  Nova atualização
                </Badge>
              )}
            </div>

            <div
              className="flex items-center gap-2 group/copy cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(numero);
                toast({
                  description: "Número do processo copiado para a área de transferência",
                  duration: 2000,
                });
              }}
            >
              <h3 className="text-xl font-bold tracking-tight bg-clip-text text-foreground truncate group-hover/copy:text-primary transition-colors">
                {numero}
              </h3>
              <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover/copy:opacity-100 transition-opacity" />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{jurisdicao}</span>
              <span className="text-border">|</span>
              <span className="truncate max-w-[300px]">{orgaoJulgador}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start shrink-0">
            {isUnread && onMarkAsRead && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMarkAsRead}
                disabled={isMarkingAsRead || isLoading}
                className="text-primary hover:text-primary hover:bg-primary/10 h-8 px-2 lg:px-3"
              >
                {isMarkingAsRead ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                )}
                <span className="hidden lg:inline">Marcar lido</span>
              </Button>
            )}

            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="h-8 w-8 p-0 lg:w-auto lg:px-3 lg:h-8"
              >
                <Pencil className="h-3.5 w-3.5 lg:mr-1.5" />
                <span className="hidden lg:inline">Editar</span>
              </Button>
            )}

            <Button
              size="sm"
              onClick={onView}
              disabled={isLoading}
              className="h-8 px-3 shadow-sm"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Eye className="h-3.5 w-3.5 lg:mr-1.5" />
              )}
              <span className="hidden lg:inline">{isLoading ? "Carregando" : "Detalhes"}</span>
              <span className="lg:hidden">Ver</span>
            </Button>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-border/40" />

        {/* Info Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Cliente */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              <Users className="h-3.5 w-3.5" />
              Cliente
            </div>
            <p className="text-sm font-medium truncate" title={cliente}>
              {cliente || "Não informado"}
            </p>
          </div>

          {/* Advogados */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              <Gavel className="h-3.5 w-3.5" />
              Advogados
            </div>
            <p className="text-sm font-medium truncate" title={resolvedAdvogados}>
              {resolvedAdvogados}
            </p>
          </div>

          {/* Distribuição */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              <Calendar className="h-3.5 w-3.5" />
              Distribuição
            </div>
            <p className="text-xs text-muted-foreground/70 font-medium">
              {dataDistribuicao || "Não informada"}
            </p>
          </div>

          {/* Última Movimentação */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              <Clock className="h-3.5 w-3.5" />
              Última Movimentação
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-primary truncate" title={resolvedUltimaMovimentacao}>
                {formatDateToPtBR(ultimaMovimentacaoData) || formatDateToPtBR(ultimaMovimentacao) || "Data não informada"}
              </span>
              <span className="text-xs text-muted-foreground truncate" title={ultimaMovimentacaoDescricao || ultimaMovimentacaoTipo || ""}>
                {ultimaMovimentacaoTipo || ultimaMovimentacaoDescricao || "Sem detalhes"}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
