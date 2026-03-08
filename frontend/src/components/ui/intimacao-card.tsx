import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Eye,
    Calendar,
    Users,
    Clock,
    Loader2,
    Check,
    Building2,
    Archive,
    ListChecks,
    CalendarPlus,
    Scale
} from "lucide-react";
import { cn, formatProcessNumber } from "@/lib/utils";

interface IntimacaoCardProps {
    numeroProcesso: string;
    tipoComunicacao: string | null;
    orgao: string;
    siglaTribunal?: string | null;
    destinatarios: string;
    advogados: string;
    dataDisponibilizacao: string;
    prazo: string | null;
    isUnread: boolean;
    isArchived: boolean;
    onView: () => void;
    onMarkAsRead?: () => void;
    onArchive?: () => void;
    onOpenTask?: () => void;
    onAddToAgenda?: () => void;
    isMarkingAsRead?: boolean;
    isArchiving?: boolean;
    isLoading?: boolean;
}

export function IntimacaoCard({
    numeroProcesso,
    tipoComunicacao,
    orgao,
    siglaTribunal,
    destinatarios,
    advogados,
    dataDisponibilizacao,
    prazo,
    isUnread,
    isArchived,
    onView,
    onMarkAsRead,
    onArchive,
    onOpenTask,
    onAddToAgenda,
    isMarkingAsRead = false,
    isArchiving = false,
    isLoading = false,
}: IntimacaoCardProps) {
    const statusColor = isArchived
        ? "bg-muted text-muted-foreground border-muted-foreground/30"
        : "bg-blue-500/15 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-800";

    return (
        <Card
            className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:shadow-md border-border/60",
                isUnread ? "bg-primary/5 dark:bg-primary/10 border-primary/20" : "bg-card/50",
                isArchived && "opacity-75 bg-muted/30"
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
                            {tipoComunicacao && (
                                <Badge variant="outline" className={cn("capitalize font-medium border", statusColor)}>
                                    {tipoComunicacao}
                                </Badge>
                            )}
                            {siglaTribunal && (
                                <Badge variant="secondary" className="bg-background/80 font-normal text-muted-foreground hover:bg-background/80">
                                    {siglaTribunal}
                                </Badge>
                            )}
                            {isUnread && (
                                <Badge variant="default" className="bg-primary/90 hover:bg-primary animate-pulse">
                                    Nova
                                </Badge>
                            )}
                            {isArchived && (
                                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                                    Arquivada
                                </Badge>
                            )}
                        </div>

                        <h3 className="text-xl font-bold tracking-tight bg-clip-text text-foreground truncate cursor-pointer hover:underline decoration-primary/30 underline-offset-4" onClick={onView}>
                            {formatProcessNumber(numeroProcesso) || "Processo não informado"}
                        </h3>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            <span className="truncate max-w-[400px]">{orgao}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 self-start shrink-0">
                        {isUnread && onMarkAsRead && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); onMarkAsRead(); }}
                                disabled={isMarkingAsRead || isLoading}
                                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                title="Marcar como lida"
                            >
                                {isMarkingAsRead ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="h-4 w-4" />
                                )}
                            </Button>
                        )}

                        {!isArchived && onArchive && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); onArchive(); }}
                                disabled={isArchiving || isLoading}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title="Arquivar"
                            >
                                {isArchiving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Archive className="h-4 w-4" />
                                )}
                            </Button>
                        )}

                        {onOpenTask && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={(e) => { e.stopPropagation(); onOpenTask(); }} title="Criar Tarefa">
                                <ListChecks className="h-4 w-4" />
                            </Button>
                        )}

                        {onAddToAgenda && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={(e) => { e.stopPropagation(); onAddToAgenda(); }} title="Adicionar à Agenda">
                                <CalendarPlus className="h-4 w-4" />
                            </Button>
                        )}

                        <Button
                            size="sm"
                            onClick={onView}
                            disabled={isLoading}
                            className="h-8 px-3 shadow-sm ml-1"
                        >
                            <Eye className="h-3.5 w-3.5 lg:mr-1.5" />
                            <span className="hidden lg:inline">{isLoading ? "Carregando" : "Detalhes"}</span>
                            <span className="lg:hidden">Ver</span>
                        </Button>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px w-full bg-border/40" />

                {/* Info Grid */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Destinatários */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                            <Users className="h-3.5 w-3.5" />
                            Destinatários (Partes)
                        </div>
                        <p className="text-sm font-medium truncate" title={destinatarios}>
                            {destinatarios || "Não informado"}
                        </p>
                    </div>

                    {/* Advogados */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                            <Scale className="h-3.5 w-3.5" />
                            Advogados
                        </div>
                        <p className="text-sm font-medium truncate" title={advogados}>
                            {advogados}
                        </p>
                    </div>

                    {/* Data */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                            <Calendar className="h-3.5 w-3.5" />
                            Disponibilização
                        </div>
                        <p className="text-sm font-medium">
                            {dataDisponibilizacao || "Não informada"}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
