import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getApiBaseUrl } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import { AlertCircle, CheckCircle, Clock, Headphones, Loader2, Plus, Search, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type SupportRequestStatus = "open" | "in_progress" | "resolved" | "closed" | "cancelled";

interface SupportRequest {
  id: number;
  subject: string;
  description: string | null;
  status: SupportRequestStatus;
  supportAgentId: number | null;
  supportAgentName: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

type SupportMessageSender = "requester" | "support";

interface SupportMessageAttachment {
  id: number;
  messageId: number;
  filename: string;
  contentType: string | null;
  fileSize: number | null;
  createdAt: string;
}

interface SupportMessage {
  id: number;
  supportRequestId: number;
  sender: SupportMessageSender;
  message: string;
  createdAt: string;
  attachments: SupportMessageAttachment[];
}

interface SupportRequestListResponse {
  items?: SupportRequest[];
  total?: number;
}

interface SupportMessageListResponse {
  items?: SupportMessage[];
}

const statusLabels: Record<SupportRequestStatus, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  closed: "Fechado",
  cancelled: "Cancelado",
};

const statusVariants: Record<SupportRequestStatus, "destructive" | "secondary" | "default" | "outline"> = {
  open: "destructive",
  in_progress: "secondary",
  resolved: "default",
  closed: "outline",
  cancelled: "destructive",
};

const statusIcons: Record<SupportRequestStatus, typeof AlertCircle> = {
  open: AlertCircle,
  in_progress: Clock,
  resolved: CheckCircle,
  closed: XCircle,
  cancelled: XCircle,
};

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("pt-BR");
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAverageHandlingTime(requests: SupportRequest[]): string | null {
  const differences = requests
    .map((request) => {
      const created = new Date(request.createdAt).getTime();
      const updated = new Date(request.updatedAt).getTime();

      if (!Number.isFinite(created) || !Number.isFinite(updated) || updated <= created) {
        return null;
      }

      return updated - created;
    })
    .filter((value): value is number => value !== null && value > 0);

  if (differences.length === 0) {
    return null;
  }

  const averageMs = differences.reduce((total, value) => total + value, 0) / differences.length;

  if (!Number.isFinite(averageMs) || averageMs <= 0) {
    return null;
  }

  const averageHours = averageMs / 3_600_000;

  if (averageHours < 1) {
    const minutes = Math.max(1, Math.round(averageMs / 60_000));
    return `${minutes} min`;
  }

  if (averageHours < 24) {
    return `${averageHours.toFixed(1)} h`;
  }

  const days = averageHours / 24;
  return `${days.toFixed(1)} dias`;
}

export default function Support() {
  const [searchTerm, setSearchTerm] = useState("");
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseDialogRequest, setResponseDialogRequest] = useState<SupportRequest | null>(null);
  const [responseMessage, setResponseMessage] = useState("");
  const [isSendingResponse, setIsSendingResponse] = useState(false);
  const [resolvingRequestId, setResolvingRequestId] = useState<number | null>(null);
  const [responseDialogMessages, setResponseDialogMessages] = useState<SupportMessage[]>([]);
  const [isLoadingResponseMessages, setIsLoadingResponseMessages] = useState(false);
  const [responseMessagesError, setResponseMessagesError] = useState<string | null>(null);

  const apiUrl = getApiBaseUrl();

  const fetchRequests = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiUrl}/api/support`, { signal });

        if (!response.ok) {
          throw new Error("Falha ao carregar solicitações de suporte");
        }

        const payload = (await response.json()) as SupportRequestListResponse;
        const items = Array.isArray(payload.items) ? payload.items : [];

        setRequests(items);
        setTotalRequests(typeof payload.total === "number" ? payload.total : items.length);
      } catch (requestError) {
        if ((requestError as { name?: string })?.name === "AbortError" || signal?.aborted) {
          return;
        }

        console.error("Erro ao carregar solicitações de suporte:", requestError);
        setError("Não foi possível carregar as solicitações de suporte. Tente novamente.");
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [apiUrl],
  );

  useEffect(() => {
    const controller = new AbortController();

    void fetchRequests(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchRequests]);

  useEffect(() => {
    if (!responseDialogRequest) {
      setResponseDialogMessages([]);
      setResponseMessagesError(null);
      setIsLoadingResponseMessages(false);
      return;
    }

    const controller = new AbortController();

    const fetchMessages = async () => {
      setIsLoadingResponseMessages(true);
      setResponseMessagesError(null);
      setResponseDialogMessages([]);

      try {
        const response = await fetch(
          `${apiUrl}/api/support/${responseDialogRequest.id}/messages`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch support messages");
        }

        const payload = (await response.json()) as SupportMessageListResponse;
        const items = Array.isArray(payload.items) ? payload.items : [];

        if (!controller.signal.aborted) {
          setResponseDialogMessages(items);
        }
      } catch (messagesError) {
        if ((messagesError as { name?: string })?.name === "AbortError" || controller.signal.aborted) {
          return;
        }

        console.error("Erro ao carregar histórico de mensagens de suporte:", messagesError);
        setResponseMessagesError("Não foi possível carregar o histórico de mensagens. Tente novamente.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingResponseMessages(false);
        }
      }
    };

    void fetchMessages();

    return () => {
      controller.abort();
    };
  }, [apiUrl, responseDialogRequest]);

  const filteredRequests = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    if (!normalizedTerm) {
      return requests;
    }

    return requests.filter((request) => {
      const subject = request.subject?.toLowerCase() ?? "";
      const description = request.description?.toLowerCase() ?? "";
      const requesterName = request.requesterName?.toLowerCase() ?? "";
      const requesterEmail = request.requesterEmail?.toLowerCase() ?? "";

      return (
        subject.includes(normalizedTerm) ||
        description.includes(normalizedTerm) ||
        requesterName.includes(normalizedTerm) ||
        requesterEmail.includes(normalizedTerm)
      );
    });
  }, [requests, searchTerm]);

  const openTickets = useMemo(
    () => requests.filter((request) => request.status === "open").length,
    [requests],
  );
  const inProgressTickets = useMemo(
    () => requests.filter((request) => request.status === "in_progress").length,
    [requests],
  );
  const resolvedTickets = useMemo(
    () => requests.filter((request) => request.status === "resolved").length,
    [requests],
  );

  const distributionTotal = requests.length || 1;
  const averageHandlingTime = useMemo(() => formatAverageHandlingTime(requests), [requests]);

  const getStatusBadge = (status: SupportRequestStatus) => (
    <Badge variant={statusVariants[status]}>{statusLabels[status]}</Badge>
  );

  const getStatusIcon = (status: SupportRequestStatus) => {
    const Icon = statusIcons[status];
    return Icon ? <Icon className="h-4 w-4" /> : null;
  };

  const canResolveRequest = (request: SupportRequest) =>
    request.status !== "resolved" && request.status !== "closed" && request.status !== "cancelled";

  const handleOpenResponseDialog = (request: SupportRequest) => {
    setResponseDialogRequest(request);
    setResponseMessage("");
    setResponseDialogMessages([]);
    setResponseMessagesError(null);
  };

  const handleResponseDialogOpenChange = (open: boolean) => {
    if (!open) {
      setResponseDialogRequest(null);
      setResponseMessage("");
      setIsSendingResponse(false);
      setResponseDialogMessages([]);
      setResponseMessagesError(null);
      setIsLoadingResponseMessages(false);
    }
  };

  const handleSendResponse = async () => {
    if (!responseDialogRequest) {
      return;
    }

    const trimmedMessage = responseMessage.trim();

    if (!trimmedMessage) {
      toast({
        title: "Digite uma mensagem para responder",
        description: "Adicione algum conteúdo para enviar ao cliente.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingResponse(true);

    try {
      const response = await fetch(`${apiUrl}/api/support/${responseDialogRequest.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmedMessage,
          sender: "support",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send support response");
      }

      toast({
        title: "Resposta enviada",
        description: "O solicitante será notificado sobre a mensagem.",
      });

      setResponseDialogRequest(null);
      setResponseMessage("");
      void fetchRequests();
    } catch (sendError) {
      console.error("Erro ao enviar resposta do ticket de suporte:", sendError);
      toast({
        title: "Não foi possível enviar a resposta",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSendingResponse(false);
    }
  };

  const handleResolveRequest = async (request: SupportRequest) => {
    if (!canResolveRequest(request)) {
      return;
    }

    setResolvingRequestId(request.id);

    try {
      const response = await fetch(`${apiUrl}/api/support/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });

      if (!response.ok) {
        throw new Error("Failed to resolve support request");
      }

      toast({
        title: "Solicitação marcada como resolvida",
        description: "O solicitante será notificado sobre a resolução.",
      });

      void fetchRequests();
    } catch (resolveError) {
      console.error("Erro ao resolver ticket de suporte:", resolveError);
      toast({
        title: "Não foi possível resolver o ticket",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setResolvingRequestId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Suporte ao Cliente
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie tickets de suporte e acompanhe solicitações dos clientes.
          </p>
        </div>
        <Button className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98]">
          <Plus className="h-4 w-4 mr-2" />
          Novo Ticket
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive" className="animate-in slide-in-from-top-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar solicitações</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="shadow-md border-muted/60 hover:border-primary/20 transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tickets Abertos</CardTitle>
            <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{openTickets}</div>
            <p className="text-xs text-muted-foreground mt-1">Requerem atenção imediata</p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-muted/60 hover:border-primary/20 transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Andamento</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressTickets}</div>
            <p className="text-xs text-muted-foreground mt-1">Sendo processados pela equipe</p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-muted/60 hover:border-primary/20 transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolvidos Hoje</CardTitle>
            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{resolvedTickets}</div>
            <p className="text-xs text-muted-foreground mt-1">Problemas solucionados com sucesso</p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-muted/60 hover:border-primary/20 transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tempo Médio</CardTitle>
            <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Headphones className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageHandlingTime ?? "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">Média até a primeira resposta</p>
          </CardContent>
        </Card>
      </div>

      {/* Support Tickets Table */}
      <Card className="shadow-lg border-muted/40">
        <CardHeader className="border-b bg-muted/5 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle>Tickets de Suporte</CardTitle>
              <CardDescription>
                Visualize e gerencie todas as solicitações de suporte
                {totalRequests > 0 ? ` (${totalRequests})` : ""}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar tickets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-background/50 border-muted-foreground/20 focus:border-primary/50 transition-all"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => void fetchRequests()} disabled={isLoading} className="hover:bg-muted/50 border-muted-foreground/20">
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-muted/40">
                  <TableHead className="pl-6 h-12">Assunto</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead className="text-right pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <p className="text-sm">Carregando solicitações...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
                {!isLoading && filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      {searchTerm
                        ? "Nenhuma solicitação encontrada para o termo informado."
                        : "Nenhuma solicitação de suporte registrada por enquanto."}
                    </TableCell>
                  </TableRow>
                ) : null}
                {filteredRequests.map((request) => (
                  <TableRow key={request.id} className="group hover:bg-muted/30 border-b border-muted/40 transition-colors">
                    <TableCell className="pl-6 py-4">
                      <div>
                        <div className="font-medium text-foreground group-hover:text-primary transition-colors">{request.subject}</div>
                        {request.description ? (
                          <div className="text-sm text-muted-foreground line-clamp-1 max-w-[280px] mt-0.5">
                            {request.description}
                          </div>
                        ) : null}
                        {request.supportAgentName ? (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                            <Headphones className="h-3 w-3" />
                            Responsável: {request.supportAgentName}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{request.requesterName ?? "—"}</div>
                      {request.requesterEmail ? (
                        <div className="text-sm text-muted-foreground">{request.requesterEmail}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`
                            flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border
                            ${request.status === 'open' ? 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400' : ''}
                            ${request.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400' : ''}
                            ${request.status === 'resolved' ? 'bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400' : ''}
                            ${request.status === 'closed' ? 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400' : ''}
                            ${request.status === 'cancelled' ? 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400' : ''}
                        `}>
                          {getStatusIcon(request.status)}
                          {statusLabels[request.status]}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">{formatDate(request.createdAt)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">{formatDate(request.updatedAt)}</div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenResponseDialog(request)}
                          className="hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                        >
                          Responder
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/30 dark:hover:text-green-400"
                          onClick={() => handleResolveRequest(request)}
                          disabled={!canResolveRequest(request) || resolvingRequestId === request.id}
                        >
                          {resolvingRequestId === request.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-1" /> Resolvendo
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" /> Resolver
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Support Analytics */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-md border-muted/60">
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
            <CardDescription>Visão geral do volume de tickets por situação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="font-medium text-foreground/80">Abertos</span>
                </div>
                <span className="font-bold">{openTickets}</span>
              </div>
              <div className="w-full bg-muted/50 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(openTickets / distributionTotal) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-foreground/80">Em Andamento</span>
                </div>
                <span className="font-bold">{inProgressTickets}</span>
              </div>
              <div className="w-full bg-muted/50 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(inProgressTickets / distributionTotal) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-foreground/80">Resolvidos</span>
                </div>
                <span className="font-bold">{resolvedTickets}</span>
              </div>
              <div className="w-full bg-muted/50 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(resolvedTickets / distributionTotal) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-muted/60">
          <CardHeader>
            <CardTitle>Métricas de Qualidade</CardTitle>
            <CardDescription>Indicadores chave de performance do atendimento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <span className="text-sm font-medium text-muted-foreground">Taxa de Resolução</span>
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">92.3%</Badge>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <span className="text-sm font-medium text-muted-foreground">Satisfação Cliente</span>
              <div className="flex items-center gap-1">
                <span className="font-bold text-foreground">4.7</span>
                <span className="text-xs text-muted-foreground">/ 5.0</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <span className="text-sm font-medium text-muted-foreground">Tempo 1ª Resposta</span>
              <span className="font-mono font-medium">{averageHandlingTime ?? "—"}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <span className="text-sm font-medium text-muted-foreground">Tempo Médio Resolução</span>
              <span className="font-mono font-medium">18.5 horas</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <span className="text-sm font-medium text-muted-foreground">Reaberturas</span>
              <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">3.1%</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={responseDialogRequest !== null} onOpenChange={handleResponseDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Responder ticket</DialogTitle>
            <DialogDescription>
              Envie uma resposta ao solicitante para manter o acompanhamento do ticket.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {responseDialogRequest ? (
              <div className="rounded-md border bg-muted/40 p-4 text-left text-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="font-semibold text-foreground text-base">{responseDialogRequest.subject}</div>
                    {responseDialogRequest.requesterName || responseDialogRequest.requesterEmail ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="font-medium text-foreground">{responseDialogRequest.requesterName ?? "Sem nome"}</span>
                        {responseDialogRequest.requesterEmail && (
                          <>• <span className="opacity-80">{responseDialogRequest.requesterEmail}</span></>
                        )}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0">{getStatusBadge(responseDialogRequest.status)}</div>
                </div>
                {responseDialogRequest.description ? (
                  <div className="p-3 bg-background rounded border text-xs text-muted-foreground leading-relaxed">
                    {responseDialogRequest.description}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Histórico de mensagens</Label>
              <div className="rounded-md border bg-muted/10 h-[300px] flex flex-col">
                {isLoadingResponseMessages ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-xs">Carregando histórico...</span>
                  </div>
                ) : responseMessagesError ? (
                  <div className="flex-1 flex items-center justify-center p-4 text-sm text-destructive">{responseMessagesError}</div>
                ) : responseDialogMessages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center p-4 text-sm text-muted-foreground italic">
                    Nenhuma mensagem registrada.
                  </div>
                ) : (
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {responseDialogMessages.map((message) => {
                        const isSupport = message.sender === "support";

                        return (
                          <div
                            key={message.id}
                            className={`flex flex-col max-w-[85%] ${isSupport ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                          >
                            <div className="flex items-center gap-2 mb-1 px-1">
                              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                {isSupport ? "Suporte" : "Solicitante"}
                              </span>
                              <span className="text-[10px] text-muted-foreground/60">
                                {formatDateTime(message.createdAt)}
                              </span>
                            </div>
                            <div className={`
                                rounded-2xl px-4 py-3 text-sm shadow-sm
                                ${isSupport
                                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                : 'bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-tl-sm'}
                            `}>
                              {message.message ? (
                                <p className="whitespace-pre-line leading-relaxed">
                                  {message.message}
                                </p>
                              ) : null}
                            </div>

                            {message.attachments.length > 0 ? (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {message.attachments.map((attachment) => (
                                  <Badge key={attachment.id} variant="outline" className="text-xs bg-background/50">
                                    {attachment.filename}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-response-message">Nova Mensagem</Label>
              <Textarea
                id="support-response-message"
                value={responseMessage}
                onChange={(event) => setResponseMessage(event.target.value)}
                placeholder="Escreva sua resposta ao cliente..."
                rows={4}
                className="resize-none focus-visible:ring-primary/20"
                disabled={isSendingResponse}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleResponseDialogOpenChange(false)}
              disabled={isSendingResponse}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSendResponse}
              disabled={isSendingResponse}
              className="shadow-lg shadow-primary/20"
            >
              {isSendingResponse ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando
                </>
              ) : (
                "Enviar resposta"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
