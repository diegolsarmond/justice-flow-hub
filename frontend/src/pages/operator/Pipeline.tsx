import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, MoreHorizontal, DollarSign, Calendar, User, Search, X, Target, ArrowLeft, BarChart3, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { refreshGoogleToken } from "@/lib/googleAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface Opportunity {
  id: number;
  title: string;
  client: string;
  processType: string;
  value: number;
  probability: number;
  stage: string;
  dueDate: string;
  area: string;
  responsible: string;
  createdAt?: string;
  status?: string;
  statusId?: string;
}

interface StatusOption {
  id: string;
  name: string;
}

interface Stage {
  id: string;
  name: string;
  color: string;
  flowId?: string;
}

interface Flow {
  id: string;
  name: string;
}

export default function Pipeline() {
  const apiUrl = getApiBaseUrl();
  const navigate = useNavigate();
  const { fluxoId: paramFluxoId } = useParams<{ fluxoId?: string }>();
  const fluxoId = paramFluxoId === "todos" ? undefined : paramFluxoId;
  const { toast } = useToast();

  const [pipelineName, setPipelineName] = useState<string>("Vendas");
  const [stages, setStages] = useState<Stage[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<string>("");
  const [moveStages, setMoveStages] = useState<Stage[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [movingOpportunityId, setMovingOpportunityId] = useState<number | null>(null);
  const [isSavingMove, setIsSavingMove] = useState(false);
  const forbiddenToastShown = useRef(false);

  const handleForbidden = async (response: Response, clear: () => void) => {
    if (response.status !== 403) {
      return false;
    }
    clear();
    if (!forbiddenToastShown.current) {
      const description = await getForbiddenMessage(response);
      toast({ title: "Acesso negado", description, variant: "destructive" });
      forbiddenToastShown.current = true;
    } else {
      await response.text().catch(() => { });
    }
    return true;
  };

  useEffect(() => {
    const fetchStages = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/etiquetas`, {
          headers: { Accept: "application/json" },
        });
        if (await handleForbidden(res, () => setStages([]))) {
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const parsed: unknown[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.rows)
            ? data.rows
            : Array.isArray(data?.data?.rows)
              ? data.data.rows
              : Array.isArray(data?.data)
                ? data.data
                : [];
        const filtered = fluxoId
          ? parsed.filter(
            (r) => String((r as { id_fluxo_trabalho?: number | string }).id_fluxo_trabalho) === fluxoId
          )
          : parsed;
        const colors = [
          "bg-blue-100 text-blue-800",
          "bg-yellow-100 text-yellow-800",
          "bg-orange-100 text-orange-800",
          "bg-green-100 text-green-800",
          "bg-purple-100 text-purple-800",
          "bg-pink-100 text-pink-800",
        ];
        setStages(
          filtered.map((r, idx) => {
            const item = r as {
              id: number | string;
              nome?: string;
              id_fluxo_trabalho?: number | string;
            };
            return {
              id: String(item.id),
              name: item.nome ?? "",
              color: colors[idx % colors.length],
              flowId: item.id_fluxo_trabalho
                ? String(item.id_fluxo_trabalho)
                : undefined,
            };
          })
        );
      } catch (e) {
        console.error(e);
      }
    };
    fetchStages();
  }, [apiUrl, fluxoId]);

  useEffect(() => {
    const shouldFetchMenus = Boolean(fluxoId) || moveModalOpen;
    if (!shouldFetchMenus) {
      if (!moveModalOpen) {
        setFlows([]);
      }
      return;
    }

    const fetchMenus = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/fluxos-trabalho/menus`, {
          headers: { Accept: "application/json" },
        });
        if (await handleForbidden(res, () => {
          if (moveModalOpen) {
            setFlows([]);
            setSelectedFlow("");
            setMoveStages([]);
          }
          if (fluxoId) {
            setPipelineName("");
          }
        })) {
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
        if (moveModalOpen) {
          setFlows(parsed.map((m) => ({ id: String(m.id), name: m.nome ?? "" })));
        }

        if (fluxoId) {
          const current = parsed.find((m) => String(m.id) === fluxoId);
          if (current?.nome) {
            setPipelineName(current.nome);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchMenus();
  }, [apiUrl, fluxoId, moveModalOpen]);

  useEffect(() => {
    if (!moveModalOpen) {
      return;
    }

    const fetchStatuses = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/situacao-propostas`, {
          headers: { Accept: "application/json" },
        });
        if (await handleForbidden(res, () => setStatusOptions([]))) {
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const parsed: unknown[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.rows)
            ? data.rows
            : Array.isArray(data?.data?.rows)
              ? data.data.rows
              : Array.isArray(data?.data)
                ? data.data
                : [];
        setStatusOptions(
          parsed.map((s) => {
            const item = s as { id: number | string; nome?: string; name?: string };
            return {
              id: String(item.id),
              name: item.nome ?? item.name ?? String(item.id),
            };
          })
        );
      } catch (e) {
        console.error(e);
      }
    };
    fetchStatuses();
  }, [apiUrl, moveModalOpen]);

  useEffect(() => {
    if (!selectedFlow) {
      setMoveStages([]);
      return;
    }

    const fetchStagesForFlow = async () => {
      try {
        const res = await fetch(
          `${apiUrl}/api/etiquetas/fluxos-trabalho/${selectedFlow}`,
          {
            headers: { Accept: "application/json" },
          }
        );
        if (await handleForbidden(res, () => {
          setMoveStages([]);
          setSelectedStage("");
        })) {
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const parsed: unknown[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.rows)
            ? data.rows
            : Array.isArray(data?.data?.rows)
              ? data.data.rows
              : Array.isArray(data?.data)
                ? data.data
                : [];
        const mapped = parsed.map((r) => {
          const item = r as {
            id: number | string;
            nome?: string;
            id_fluxo_trabalho?: number | string;
          };
          return {
            id: String(item.id),
            name: item.nome ?? "",
            color: "",
            flowId: item.id_fluxo_trabalho
              ? String(item.id_fluxo_trabalho)
              : undefined,
          };
        });
        setMoveStages(mapped);
        setSelectedStage((prev) =>
          prev && !mapped.some((stage) => stage.id === prev) ? "" : prev
        );
      } catch (e) {
        console.error(e);
      }
    };
    setMoveStages([]);
    fetchStagesForFlow();
  }, [selectedFlow, apiUrl]);

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const dragStartedSincePointerDown = useRef(false);
  const isDragging = useRef(false);

  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        const url = fluxoId
          ? `${apiUrl}/api/oportunidades/fase/${fluxoId}`
          : `${apiUrl}/api/oportunidades`;

        const [
          oppRes,
          areasRes,
          usersRes,
          clientsRes,
          typesRes,
        ] = await Promise.all([
          fetch(url, { headers: { Accept: "application/json" } }),
          fetch(`${apiUrl}/api/areas`, { headers: { Accept: "application/json" } }),
          fetch(`${apiUrl}/api/usuarios`, {
            headers: { Accept: "application/json" },
          }),
          fetch(`${apiUrl}/api/clientes`, {
            headers: { Accept: "application/json" },
          }),
          fetch(`${apiUrl}/api/tipo-processos`, {
            headers: { Accept: "application/json" },
          }),
        ]);

        if (
          await handleForbidden(oppRes, () => setOpportunities([])) ||
          await handleForbidden(areasRes, () => setOpportunities([])) ||
          await handleForbidden(usersRes, () => setOpportunities([])) ||
          await handleForbidden(clientsRes, () => setOpportunities([])) ||
          await handleForbidden(typesRes, () => setOpportunities([]))
        ) {
          return;
        }

        if (!oppRes.ok)
          throw new Error(`HTTP ${oppRes.status}: ${await oppRes.text()}`);
        if (!areasRes.ok)
          throw new Error(`HTTP ${areasRes.status}: ${await areasRes.text()}`);
        if (!usersRes.ok)
          throw new Error(`HTTP ${usersRes.status}: ${await usersRes.text()}`);
        if (!clientsRes.ok)
          throw new Error(`HTTP ${clientsRes.status}: ${await clientsRes.text()}`);
        if (!typesRes.ok)
          throw new Error(`HTTP ${typesRes.status}: ${await typesRes.text()}`);

        const data = await oppRes.json();
        const areasData = await areasRes.json();
        const usersData = await usersRes.json();
        const clientsData = await clientsRes.json();
        const typesData = await typesRes.json();

        const parsedOpps: unknown[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.rows)
            ? data.rows
            : Array.isArray(data?.data?.rows)
              ? data.data.rows
              : Array.isArray(data?.data)
                ? data.data
                : [];

        const parsedAreas: unknown[] = Array.isArray(areasData)
          ? areasData
          : Array.isArray(areasData?.rows)
            ? areasData.rows
            : Array.isArray(areasData?.data?.rows)
              ? areasData.data.rows
              : Array.isArray(areasData?.data)
                ? areasData.data
                : [];

        const parsedUsers: unknown[] = Array.isArray(usersData)
          ? usersData
          : Array.isArray(usersData?.rows)
            ? usersData.rows
            : Array.isArray(usersData?.data?.rows)
              ? usersData.data.rows
              : Array.isArray(usersData?.data)
                ? usersData.data
                : [];

        const parsedClients: unknown[] = Array.isArray(clientsData)
          ? clientsData
          : Array.isArray(clientsData?.rows)
            ? clientsData.rows
            : Array.isArray(clientsData?.data?.rows)
              ? clientsData.data.rows
              : Array.isArray(clientsData?.data)
                ? clientsData.data
                : [];

        const parsedTypes: unknown[] = Array.isArray(typesData)
          ? typesData
          : Array.isArray(typesData?.rows)
            ? typesData.rows
            : Array.isArray(typesData?.data?.rows)
              ? typesData.data.rows
              : Array.isArray(typesData?.data)
                ? typesData.data
                : [];

        const areaMap: Record<string, string> = {};
        parsedAreas.forEach((a) => {
          const item = a as { id?: number | string; nome?: string };
          if (item.id) areaMap[String(item.id)] = item.nome ?? "";
        });

        const userMap: Record<string, string> = {};
        parsedUsers.forEach((u) => {
          const item = u as {
            id?: number | string;
            nome_completo?: string;
            nome?: string;
          };
          if (item.id)
            userMap[String(item.id)] = item.nome_completo ?? item.nome ?? "";
        });

        const clientMap: Record<string, string> = {};
        parsedClients.forEach((c) => {
          const item = c as { id?: number | string; nome?: string };
          if (item.id) clientMap[String(item.id)] = item.nome ?? "";
        });

        const typeMap: Record<string, string> = {};
        parsedTypes.forEach((t) => {
          const item = t as { id?: number | string; nome?: string };
          if (item.id) typeMap[String(item.id)] = item.nome ?? "";
        });

        setOpportunities(
          parsedOpps.map((o) => {
            const item = o as Record<string, unknown>;
            const responsibleId = item.responsavel_id
              ? String(item.responsavel_id)
              : "";
            const clientId = item.solicitante_id ? String(item.solicitante_id) : "";
            return {
              id: Number(item.id),
              title:
                (item.detalhes as string) ||
                (item.numero_processo_cnj as string) ||
                `Oportunidade ${item.id}`,
              client: clientId ? clientMap[clientId] || clientId : "",
              processType: item.tipo_processo_id
                ? typeMap[String(item.tipo_processo_id)] || ""
                : "",
              value: item.valor_honorarios ? Number(item.valor_honorarios) : 0,
              probability: item.percentual_honorarios
                ? Number(item.percentual_honorarios)
                : 0,
              stage: item.etapa_id ? String(item.etapa_id) : "",
              dueDate: (item.prazo_proximo as string) || "",
              area: item.area_atuacao_id
                ? areaMap[String(item.area_atuacao_id)] || ""
                : "",
              responsible: responsibleId
                ? userMap[responsibleId] || responsibleId
                : "",
              createdAt: (item.created_at as string) || "",
              status: (item.status as string) || (item.status_nome as string) || "Em andamento",
              statusId: item.status_id ? String(item.status_id) : undefined,
            };
          })
        );
      } catch (e) {
        console.error(e);
      }
    };
    fetchOpportunities();
  }, [apiUrl, fluxoId]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [selectedResponsible, setSelectedResponsible] = useState<string>("all");

  const uniqueAreas = Array.from(new Set(opportunities.map(o => o.area).filter(Boolean))).sort();
  const uniqueResponsibles = Array.from(new Set(opportunities.map(o => o.responsible).filter(Boolean))).sort();

  const filteredOpportunities = opportunities.filter(opp => {
    const matchesSearch = searchTerm === "" ||
      opp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.client.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesArea = selectedArea === "all" || opp.area === selectedArea;
    const matchesResponsible = selectedResponsible === "all" || opp.responsible === selectedResponsible;

    return matchesSearch && matchesArea && matchesResponsible;
  });

  const getOpportunitiesByStage = (stageId: string) => {
    return filteredOpportunities.filter(opp => opp.stage === stageId);
  };

  const getTotalValueByStage = (stageId: string) => {
    return getOpportunitiesByStage(stageId)
      .reduce((total, opp) => total + opp.value, 0);
  };

  const getCreationYear = (createdAt?: string) => {
    if (!createdAt) return null;
    const trimmed = createdAt.trim();
    if (!trimmed) return null;

    const isoMatch = trimmed.match(/^(\d{4})-\d{2}-\d{2}/);
    if (isoMatch) return Number(isoMatch[1]);

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.getFullYear();

    const brDateMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (brDateMatch) return Number(brDateMatch[3]);

    const yearMatch = trimmed.match(/(\d{4})/);
    return yearMatch ? Number(yearMatch[1]) : null;
  };

  const formatOpportunityIdentifier = (opportunity: Opportunity) => {
    const year = getCreationYear(opportunity.createdAt);
    return year ? `#${opportunity.id}/${year}` : `#${opportunity.id}`;
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 80) return "text-success";
    if (probability >= 60) return "text-warning";
    return "text-muted-foreground";
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    opportunityId: number,
  ) => {
    dragStartedSincePointerDown.current = true;
    isDragging.current = true;
    event.dataTransfer.setData("text/plain", opportunityId.toString());
  };

  const handleDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    stageId: string
  ) => {
    event.preventDefault();
    isDragging.current = false;
    const id = Number(event.dataTransfer.getData("text/plain"));

    try {
      const storedRefresh = localStorage.getItem('google_refresh_token');
      if (storedRefresh) {
        try {
          await refreshGoogleToken(storedRefresh);
        } catch (err) {
          console.error('Erro ao renovar token do Google', err);
        }
      }

      const res = await fetch(`${apiUrl}/api/oportunidades/${id}/etapa`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ etapa_id: Number(stageId) }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      setOpportunities((prev) =>
        prev.map((opp) => (opp.id === id ? { ...opp, stage: stageId } : opp))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleMoveModalOpenChange = (open: boolean) => {
    setMoveModalOpen(open);
    if (!open) {
      setMovingOpportunityId(null);
      setSelectedFlow("");
      setSelectedStage("");
      setSelectedStatus("");
      setMoveStages([]);
    }
  };

  const handleMoveOpportunity = async () => {
    if (!movingOpportunityId || !selectedStage || !selectedFlow) {
      return;
    }

    try {
      setIsSavingMove(true);

      const storedRefresh = localStorage.getItem("google_refresh_token");
      if (storedRefresh) {
        try {
          await refreshGoogleToken(storedRefresh);
        } catch (err) {
          console.error("Erro ao renovar token do Google", err);
        }
      }

      const res = await fetch(
        `${apiUrl}/api/oportunidades/${movingOpportunityId}/etapa`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ etapa_id: Number(selectedStage) }),
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      if (selectedStatus && movingOpportunityId) {
        // Also update status if selected
        const statusRes = await fetch(
          `${apiUrl}/api/oportunidades/${movingOpportunityId}/status`,
          {
            method: "PATCH",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status_id: Number(selectedStatus) }),
          }
        );
        if (!statusRes.ok) {
          console.error(`HTTP ${statusRes.status}: ${await statusRes.text()}`);
        }
      }

      setOpportunities((prev) =>
        prev.map((opp) => {
          if (opp.id !== movingOpportunityId) return opp;

          let updated = { ...opp };
          if (selectedStage) updated.stage = selectedStage;
          if (selectedStatus) {
            updated.statusId = selectedStatus;
            const statusObj = statusOptions.find(s => s.id === selectedStatus);
            if (statusObj) updated.status = statusObj.name;
          }
          return updated;
        })
      );

      handleMoveModalOpenChange(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingMove(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/pipeline")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Pipelines
          </Button>
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Target className="h-4 w-4" />
            <span className="text-sm font-medium">{paramFluxoId === "todos" ? "Visão Consolidada" : pipelineName}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {paramFluxoId === "todos" ? "Todas as Oportunidades" : `Pipeline de ${pipelineName}`}
          </h1>
          <p className="text-muted-foreground mt-1">
            {paramFluxoId === "todos" ? "Lista de todas as oportunidades" : "Acompanhe e gerencie suas oportunidades"}
          </p>
        </div>
        <Button
          size="lg"
          className="bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all shrink-0"
          onClick={() => navigate("/pipeline/nova-oportunidade")}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova Oportunidade
        </Button>
      </div>

      {/* Filters */}
      <Card className="border shadow-sm bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou cliente..."
                className="pl-9 h-10 rounded-lg"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Select value={selectedArea} onValueChange={setSelectedArea}>
                <SelectTrigger className="w-[160px] sm:w-[180px] h-10 rounded-lg">
                  <SelectValue placeholder="Área" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Áreas</SelectItem>
                  {uniqueAreas.map(area => (
                    <SelectItem key={area} value={area}>{area}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedResponsible} onValueChange={setSelectedResponsible}>
                <SelectTrigger className="w-[160px] sm:w-[180px] h-10 rounded-lg">
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Responsáveis</SelectItem>
                  {uniqueResponsibles.map(resp => (
                    <SelectItem key={resp} value={resp}>{resp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(searchTerm || selectedArea !== "all" || selectedResponsible !== "all") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedArea("all");
                    setSelectedResponsible("all");
                  }}
                  title="Limpar filtros"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="overflow-hidden border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{filteredOpportunities.length}</p>
                <p className="text-xs text-muted-foreground">Total Oportunidades</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xl font-bold text-success">
                  R$ {filteredOpportunities.reduce((total, opp) => total + opp.value, 0).toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-muted-foreground">Valor Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">
                  {filteredOpportunities.length > 0 ? Math.round(filteredOpportunities.reduce((total, opp) => total + opp.probability, 0) / filteredOpportunities.length) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Probabilidade Média</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10">
                <TrendingUp className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xl font-bold text-warning">
                  R$ {Math.round(filteredOpportunities.reduce((total, opp) => total + (opp.value * opp.probability / 100), 0)).toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-muted-foreground">Receita Prevista</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline View (Kanban or List) */}
      {paramFluxoId === "todos" ? (
        <Card className="overflow-hidden border shadow-sm rounded-xl">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold">Título</TableHead>
                  <TableHead className="font-semibold">Cliente</TableHead>
                  <TableHead className="font-semibold">Valor</TableHead>
                  <TableHead className="font-semibold">Probabilidade</TableHead>
                  <TableHead className="font-semibold">Situação</TableHead>
                  <TableHead className="font-semibold">Etapa</TableHead>
                  <TableHead className="font-semibold">Responsável</TableHead>
                  <TableHead className="text-right font-semibold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOpportunities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground py-12">
                      <div className="flex flex-col items-center gap-2">
                        <BarChart3 className="h-10 w-10 opacity-40" />
                        <p>Nenhuma oportunidade encontrada.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOpportunities.map((opportunity) => (
                    <TableRow
                      key={opportunity.id}
                      className="cursor-pointer hover:bg-muted/60 transition-colors group"
                      onClick={() => navigate(`/pipeline/oportunidade/${opportunity.id}`)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="truncate max-w-[200px]" title={opportunity.title}>{opportunity.title}</span>
                          <span className="text-[10px] text-muted-foreground">{formatOpportunityIdentifier(opportunity)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                              <User className="h-3 w-3" />
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-[150px]" title={opportunity.client}>{opportunity.client}</span>
                        </div>
                      </TableCell>
                      <TableCell>R$ {opportunity.value.toLocaleString('pt-BR')}</TableCell>
                      <TableCell>
                        <span className={getProbabilityColor(opportunity.probability)}>
                          {opportunity.probability}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {opportunity.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={stages.find(s => s.id === opportunity.stage)?.color || "bg-secondary"}>
                          {stages.find(s => s.id === opportunity.stage)?.name || opportunity.stage}
                        </Badge>
                      </TableCell>
                      <TableCell>{opportunity.responsible}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Editar</DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.stopPropagation();

                                const stageInfo = stages.find(
                                  (stageItem) => stageItem.id === opportunity.stage
                                );
                                const defaultFlowId = stageInfo?.flowId ?? fluxoId ?? "";

                                setMovingOpportunityId(opportunity.id);
                                setSelectedFlow(defaultFlowId);
                                setSelectedStage(stageInfo ? stageInfo.id : "");
                                setSelectedStatus(opportunity.statusId || "");
                                setMoveStages([]);
                                setMoveModalOpen(true);
                              }}
                            >
                              Mover para...
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <div className="flex gap-5 overflow-x-auto pb-6 items-start">
          {stages.map((stage) => {
            const stageOpportunities = getOpportunitiesByStage(stage.id);
            const totalValue = getTotalValueByStage(stage.id);

            return (
              <div
                key={stage.id}
                className="flex flex-col min-w-[300px] max-w-[320px] flex-shrink-0 rounded-xl border bg-muted/30 shadow-sm overflow-hidden"
              >
                {/* Stage Header */}
                <div className="p-4 border-b bg-card space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={cn("font-medium", stage.color)}>
                      {stage.name}
                    </Badge>
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {stageOpportunities.length}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    R$ {totalValue.toLocaleString('pt-BR')}
                  </p>
                </div>

                {/* Opportunities */}
                <div
                  className="flex-1 space-y-3 p-3 min-h-[420px] max-h-[70vh] overflow-y-auto"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage.id)}
                >
                  {stageOpportunities.map((opportunity) => (
                    <Card
                      key={opportunity.id}
                      className="cursor-pointer hover:shadow-lg hover:border-primary/20 transition-all duration-200"
                      draggable
                      onPointerDown={() => {
                        dragStartedSincePointerDown.current = false;
                      }}
                      onDragStart={(e) => handleDragStart(e, opportunity.id)}
                      onDragEnd={() => {
                        isDragging.current = false;
                      }}
                      onDragOver={handleDragOver}
                      onClick={() => {
                        const dragged = dragStartedSincePointerDown.current;
                        dragStartedSincePointerDown.current = false;

                        if (!dragged) {
                          navigate(`/pipeline/oportunidade/${opportunity.id}`);
                        }
                        const targetId = opportunity.id;
                        setTimeout(() => {
                          if (!isDragging.current) {
                            navigate(`/pipeline/oportunidade/${targetId}`);
                          }
                        }, 0);
                      }}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-sm font-medium leading-tight">
                            {opportunity.processType}
                          </CardTitle>
                          <div onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Editar</DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    const stageInfo = stages.find(
                                      (stageItem) => stageItem.id === opportunity.stage
                                    );
                                    const defaultFlowId = stageInfo?.flowId ?? fluxoId ?? "";

                                    setMovingOpportunityId(opportunity.id);
                                    setSelectedFlow(defaultFlowId);
                                    setSelectedStage(stageInfo ? stageInfo.id : "");
                                    setSelectedStatus(opportunity.statusId || "");
                                    setMoveStages([]);
                                    setMoveModalOpen(true);
                                  }}
                                >
                                  Mover para...
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              <User className="h-3 w-3" />
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground truncate">
                            {opportunity.client}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-success" />
                            <span className="text-sm font-medium text-success">
                              R$ {opportunity.value.toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <span className={`text-xs font-medium ${getProbabilityColor(opportunity.probability)}`}>
                            {opportunity.probability}%
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(opportunity.dueDate).toLocaleDateString('pt-BR')}
                          </div>
                          <div className="flex items-start justify-between gap-2">
                            <Badge variant="outline" className="text-xs">
                              {opportunity.area}
                            </Badge>
                            <div className="text-right leading-tight">
                              <span className="block text-xs text-muted-foreground">
                                {opportunity.responsible}
                              </span>
                              <span className="block text-[10px] text-muted-foreground">
                                {formatOpportunityIdentifier(opportunity)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {stageOpportunities.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg m-2">
                      <Target className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">Arraste oportunidades aqui</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={moveModalOpen} onOpenChange={handleMoveModalOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover oportunidade</DialogTitle>
            <DialogDescription>
              Selecione a situação, fluxo e etapa de destino
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Situação
              </label>
              <Select
                value={selectedStatus}
                onValueChange={setSelectedStatus}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma situação" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Fluxo de Trabalho
              </label>
              <Select
                value={selectedFlow}
                onValueChange={(value) => {
                  setSelectedFlow(value);
                  setSelectedStage("");
                  setMoveStages([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um fluxo" />
                </SelectTrigger>
                <SelectContent>
                  {flows.map((flow) => (
                    <SelectItem key={flow.id} value={flow.id}>
                      {flow.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Etapa de Destino
              </label>
              <Select
                value={selectedStage}
                onValueChange={setSelectedStage}
                disabled={!selectedFlow || !moveStages.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma etapa" />
                </SelectTrigger>
                <SelectContent>
                  {moveStages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleMoveModalOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleMoveOpportunity}
              disabled={!selectedFlow || !selectedStage || isSavingMove}
            >
              {isSavingMove ? "Movendo..." : "Mover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
