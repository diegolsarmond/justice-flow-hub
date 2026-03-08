import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus, Target, LayoutGrid, ChevronRight, Sparkles } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const forbiddenMessage = "Usuário autenticado não possui empresa vinculada.";

async function getForbiddenMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data === "string") {
      const trimmed = data.trim();
      return trimmed || forbiddenMessage;
    }
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const keys = ["message", "mensagem", "error", "detail"];
      for (const key of keys) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }
    }
  } catch {
    return forbiddenMessage;
  }
  return forbiddenMessage;
}

interface MenuItem {
  id: string;
  name: string;
}

const pipelineColors = [
  "from-blue-500/10 to-indigo-500/5 border-blue-200/50 dark:border-blue-800/50",
  "from-emerald-500/10 to-teal-500/5 border-emerald-200/50 dark:border-emerald-800/50",
  "from-violet-500/10 to-purple-500/5 border-violet-200/50 dark:border-violet-800/50",
  "from-amber-500/10 to-orange-500/5 border-amber-200/50 dark:border-amber-800/50",
];

export default function PipelineMenu() {
  const apiUrl = getApiBaseUrl();
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchMenus = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/fluxos-trabalho/menus`, {
          headers: { Accept: "application/json" },
        });
        if (res.status === 403) {
          setMenus([]);
          const description = await getForbiddenMessage(res);
          toast({ title: "Acesso negado", description, variant: "destructive" });
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        type MenuApiItem = { id: number | string; nome?: string };
        const parsed: MenuApiItem[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.rows)
          ? data.rows
          : Array.isArray(data?.data?.rows)
          ? data.data.rows
          : Array.isArray(data?.data)
          ? data.data
          : [];
        setMenus(parsed.map((i) => ({ id: String(i.id), name: i.nome ?? "" })));
      } catch (e) {
        console.error(e);
      }
    };
    fetchMenus();
  }, [apiUrl]);

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 sm:mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-sm font-medium">Gestão Comercial</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Pipelines
            </h1>
            <p className="mt-1 text-muted-foreground max-w-xl">
              Selecione um pipeline para visualizar oportunidades ou veja todas em uma única visão
            </p>
          </div>
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all shrink-0"
            onClick={() => navigate("/configuracoes/parametros/fluxo-de-trabalho")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Pipeline
          </Button>
        </div>
      </div>

      {/* Pipeline Grid */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Card "Todos" - Destaque */}
        <Card
          className={cn(
            "group cursor-pointer overflow-hidden border-2 transition-all duration-300",
            "bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5",
            "border-primary/20 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10",
            "dark:from-primary/10 dark:via-primary/5 dark:to-transparent"
          )}
          onClick={() => navigate("/pipeline/todos")}
        >
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <LayoutGrid className="h-6 w-6" />
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
            <CardTitle className="text-xl mt-3">Todos</CardTitle>
            <p className="text-sm text-muted-foreground">
              Visualize todas as oportunidades em formato de lista
            </p>
          </CardHeader>
        </Card>

        {/* Cards dos pipelines */}
        {menus.map((menu, idx) => (
          <Card
            key={menu.id}
            className={cn(
              "group cursor-pointer overflow-hidden border transition-all duration-300",
              "bg-card hover:shadow-lg hover:shadow-muted/50",
              "hover:-translate-y-0.5",
              `bg-gradient-to-br ${pipelineColors[idx % pipelineColors.length]}`
            )}
            onClick={() => navigate(`/pipeline/${menu.id}`)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Target className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
              <CardTitle className="text-xl mt-3">{menu.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Pipeline de vendas com visão Kanban
              </p>
            </CardHeader>
          </Card>
        ))}

        {/* Empty state */}
        {menus.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Nenhum pipeline encontrado
              </h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Crie seu primeiro pipeline para começar a gerenciar oportunidades de vendas.
              </p>
              <Button
                onClick={() => navigate("/configuracoes/parametros/fluxo-de-trabalho")}
                variant="outline"
              >
                Ir para Configurações
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
