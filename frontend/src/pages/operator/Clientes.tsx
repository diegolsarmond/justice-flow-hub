import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Plus,
  Search,
  Filter,
  Edit,
  Eye,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { Client } from "@/types/client";
import { getApiBaseUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const apiUrl = getApiBaseUrl();

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
      const candidates = ["message", "mensagem", "error", "detail"];
      for (const key of candidates) {
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

function joinUrl(base: string, path = "") {
  const b = base.replace(/\/+$/, "");
  const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${b}${p}`;
}

interface ApiClient {
  id: number;
  nome: string | null;
  tipo: string | null;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  ativo: boolean | null;
  foto: string | null;
  datacadastro: string | null;
}

const mapApiClientToClient = (c: ApiClient): Client => {
  const normalize = (value: unknown) => {
    if (typeof value === "string") {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
    return "";
  };

  const addressParts: string[] = [];
  const streetLine = [normalize(c.rua), normalize(c.numero)].filter(Boolean).join(", ");
  const neighborhood = normalize(c.bairro);
  const cityState = [normalize(c.cidade), normalize(c.uf)].filter(Boolean).join(" - ");

  if (streetLine) {
    addressParts.push(streetLine);
  }
  if (neighborhood) {
    addressParts.push(neighborhood);
  }
  if (cityState) {
    addressParts.push(cityState);
  }

  const rawType = normalize(c.tipo).toUpperCase();
  const normalizedType = rawType.replace(/\s+/g, "");
  const isPessoaJuridica =
    normalizedType === "2" ||
    normalizedType === "J" ||
    normalizedType === "PJ" ||
    normalizedType === "PESSOAJURIDICA" ||
    normalizedType === "PESSOAJURÍDICA" ||
    normalizedType === "JURIDICA" ||
    normalizedType === "JURÍDICA";
  const type = isPessoaJuridica ? "Pessoa Jurídica" : "Pessoa Física";

  return {
    id: c.id,
    name: normalize(c.nome),
    email: normalize(c.email),
    phone: normalize(c.telefone),
    type,
    document: normalize(c.documento),
    address: addressParts.join(" - "),
    area: "",
    status: c.ativo ? "Ativo" : "Inativo",
    lastContact: normalize(c.datacadastro),
    processes: [],
  };
};

const ITEMS_PER_PAGE = 10;

export default function Clientes() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("todos");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [planMeta, setPlanMeta] = useState<{ inactiveByPlanLimit: number; limit: number | null } | null>(null);
  const { token, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !token) {
      return;
    }

    const abortController = new AbortController();

    const fetchClients = async () => {
      try {
        const url = new URL(joinUrl(apiUrl, "/api/clientes"));
        url.searchParams.set("limit", "1000");
        const response = await fetch(url.toString(), {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal: abortController.signal,
        });
        if (response.status === 403) {
          setClients([]);
          const description = await getForbiddenMessage(response);
          toast({ title: "Acesso negado", description, variant: "destructive" });
          return;
        }
        if (!response.ok) {
          throw new Error("Failed to fetch clients");
        }
        const json = await response.json();
        const data: ApiClient[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.rows)
            ? json.rows
            : Array.isArray(json?.data?.rows)
              ? json.data.rows
              : Array.isArray(json?.data)
                ? json.data
                : [];
        setClients(data.map(mapApiClientToClient));

        if (json?._meta) {
          setPlanMeta({
            inactiveByPlanLimit: json._meta.inactiveByPlanLimit ?? 0,
            limit: json._meta.limit ?? null,
          });
        }
      } catch (error) {
        console.error("Erro ao buscar clientes:", error);
      }
    };

    fetchClients();
    return () => {
      abortController.abort();
    };
  }, [isLoading, token, toast]);

  const filteredClients = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return clients.filter((client) => {
      const matchesSearch =
        normalizedSearch === "" ||
        client.name.toLowerCase().includes(normalizedSearch) ||
        client.email.toLowerCase().includes(normalizedSearch) ||
        client.document.toLowerCase().includes(normalizedSearch) ||
        client.phone.toLowerCase().includes(normalizedSearch);
      const matchesFilter =
        filterType === "todos" ||
        (filterType === "pf" && client.type === "Pessoa Física") ||
        (filterType === "pj" && client.type === "Pessoa Jurídica");
      return matchesSearch && matchesFilter;
    });
  }, [clients, searchTerm, filterType]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredClients.length / ITEMS_PER_PAGE));
  }, [filteredClients.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedClients = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredClients.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredClients, currentPage]);

  const pageStart = filteredClients.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const pageEnd = Math.min(currentPage * ITEMS_PER_PAGE, filteredClients.length);
  const paginationRange = useMemo(() => {
    if (totalPages <= 1) {
      return [1];
    }

    const uniquePages = new Set<number>();
    uniquePages.add(1);
    uniquePages.add(totalPages);

    for (let index = currentPage - 1; index <= currentPage + 1; index += 1) {
      if (index >= 1 && index <= totalPages) {
        uniquePages.add(index);
      }
    }

    return Array.from(uniquePages).sort((a, b) => a - b);
  }, [currentPage, totalPages]);

  const paginationItems = useMemo(() => {
    const items: (number | "ellipsis")[] = [];
    let previous = 0;

    paginationRange.forEach((current) => {
      if (previous && current - previous > 1) {
        items.push("ellipsis");
      }

      items.push(current);
      previous = current;
    });

    return items;
  }, [paginationRange]);

  const toggleClientStatus = async () => {
    if (!selectedClient) return;
    try {
      const url = joinUrl(apiUrl, `/api/clientes/${selectedClient.id}`);
      const response = await fetch(url, { method: "DELETE" });
      if (response.status === 403) {
        setClients([]);
        const description = await getForbiddenMessage(response);
        toast({ title: "Acesso negado", description, variant: "destructive" });
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to update client status");
      }
      setClients((prev) =>
        prev.map((c) =>
          c.id === selectedClient.id
            ? { ...c, status: c.status === "Ativo" ? "Inativo" : "Ativo" }
            : c
        )
      );
    } catch (error) {
      console.error("Erro ao atualizar status do cliente:", error);
    } finally {
      setSelectedClient(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Ativo": return "bg-success text-success-foreground";
      case "Proposta": return "bg-warning text-warning-foreground";
      case "Negociação": return "bg-primary text-primary-foreground";
      case "Inativo": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Clientes
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gerencie todos os seus clientes
            </p>
          </div>
          <Button
            className="bg-primary hover:bg-primary/90 shadow-sm shrink-0"
            onClick={() => navigate("/clientes/novo")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Cliente
          </Button>
        </div>

      {planMeta && planMeta.inactiveByPlanLimit > 0 && (
        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">Clientes inativos por limite do plano</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            {planMeta.inactiveByPlanLimit} cliente(s) estão inativos devido ao limite do seu plano atual
            {planMeta.limit !== null && ` (${planMeta.limit} clientes permitidos)`}.{" "}
            <Link to="/meu-plano" className="font-medium underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100">
              Faça upgrade para reativá-los.
            </Link>
          </AlertDescription>
        </Alert>
      )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 rounded-lg bg-background border-muted-foreground/20"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-48 rounded-lg bg-background border-muted-foreground/20">
              <Filter className="mr-2 h-4 w-4 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              <SelectItem value="pf">Pessoa Física</SelectItem>
              <SelectItem value="pj">Pessoa Jurídica</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="rounded-xl border-muted-foreground/10 shadow-sm overflow-hidden">
          <CardHeader className="border-b bg-muted/20 px-6 py-4">
            <CardTitle className="text-lg font-semibold">Lista de Clientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-muted/50">
                  <TableHead className="font-semibold text-muted-foreground">Nome</TableHead>
                  <TableHead className="font-semibold text-muted-foreground">Email</TableHead>
                  <TableHead className="font-semibold text-muted-foreground">Telefone</TableHead>
                  <TableHead className="font-semibold text-muted-foreground">Tipo</TableHead>
                  <TableHead className="font-semibold text-muted-foreground">Status</TableHead>
                  <TableHead className="text-right font-semibold text-muted-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {paginatedClients.map((client) => (
                <TableRow
                  key={client.id}
                  className="group hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      onClick={() => navigate(`/clientes/${client.id}`)}
                      className="text-primary hover:underline text-left font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-1 rounded px-0.5 -ml-0.5"
                    >
                      {client.name}
                    </button>
                  </TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{client.phone}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{client.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(client.status)}>{client.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => navigate(`/clientes/${client.id}`)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/clientes/${client.id}/editar`)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setSelectedClient(client)}>
                          {client.status === "Ativo" ? (
                            <>
                              <UserX className="mr-2 h-4 w-4 text-destructive" />
                              <span className="text-destructive">Inativar</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="mr-2 h-4 w-4" />
                              <span>Ativar</span>
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredClients.length === 0 && (
            <div className="text-center py-12 px-6 text-muted-foreground">
              Nenhum cliente encontrado
            </div>
          )}
          {filteredClients.length > 0 && (
            <div className="px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t bg-muted/10">
              <span className="text-sm text-muted-foreground">
                Mostrando {pageStart} - {pageEnd} de {filteredClients.length} clientes
              </span>
              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        size="default"
                        onClick={(event) => {
                          event.preventDefault();
                          setCurrentPage((prev) => Math.max(prev - 1, 1));
                        }}
                        aria-disabled={currentPage === 1}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined}
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        <span>Anterior</span>
                      </PaginationLink>
                    </PaginationItem>
                    {paginationItems.map((item, itemIndex) =>
                      item === "ellipsis" ? (
                        <PaginationItem key={`ellipsis-${itemIndex}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={item}>
                          <PaginationLink
                            href="#"
                            size="default"
                            isActive={item === currentPage}
                            onClick={(event) => {
                              event.preventDefault();
                              setCurrentPage(item);
                            }}
                          >
                            {item}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        size="default"
                        onClick={(event) => {
                          event.preventDefault();
                          setCurrentPage((prev) => Math.min(prev + 1, totalPages));
                        }}
                        aria-disabled={currentPage === totalPages}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined}
                      >
                        <span>Próxima</span>
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </PaginationLink>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog
        open={!!selectedClient}
        onOpenChange={(open) => !open && setSelectedClient(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedClient?.status === "Ativo"
                ? "Inativar cliente"
                : "Ativar cliente"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedClient?.status === "Ativo"
                ? "Tem certeza que deseja inativar este cliente?"
                : "Tem certeza que deseja ativar este cliente?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={toggleClientStatus}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
