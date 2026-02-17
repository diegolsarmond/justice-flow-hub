import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Eye, ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Intimacoes() {
  const [intimacoes, setIntimacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

  const loadData = async () => {
    let query = supabase.from("intimacoes").select("*").order("data_disponibilizacao", { ascending: false });
    if (search) query = query.or(`numero_processo.ilike.%${search}%,nome_orgao.ilike.%${search}%`);
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    const { data } = await query.limit(100);
    setIntimacoes(data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [search, filterStatus]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("intimacoes").update({ status }).eq("id", id);
    toast({ title: `Intimação marcada como ${status}` });
    loadData();
    if (selected?.id === id) setSelected({ ...selected, status });
  };

  const statusBadge = (status: string | null) => {
    const map: Record<string, { label: string; cls: string }> = {
      pendente: { label: "Pendente", cls: "border-[hsl(var(--warning))]/30 text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10" },
      lida: { label: "Lida", cls: "border-primary/30 text-primary bg-primary/10" },
      respondida: { label: "Respondida", cls: "border-[hsl(var(--success))]/30 text-[hsl(var(--success))] bg-[hsl(var(--success))]/10" },
    };
    const s = map[status ?? "pendente"] ?? { label: status, cls: "" };
    return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
  };

  const syncIntimacoes = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-intimacoes");
      if (error) throw error;
      toast({ title: "Sincronização concluída", description: data?.message ?? "Intimações sincronizadas" });
      loadData();
    } catch (err: any) {
      toast({ title: "Erro na sincronização", description: err?.message ?? "Erro desconhecido", variant: "destructive" });
    }
    setSyncing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Intimações</h1>
          <p className="text-muted-foreground">Comunicações do PJE</p>
        </div>
        <Button variant="outline" onClick={syncIntimacoes} disabled={syncing}>
          {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Sincronizar ComunicaPJE
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por número ou órgão..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="lida">Lida</SelectItem>
                <SelectItem value="respondida">Respondida</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tribunal</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : intimacoes.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma intimação encontrada</TableCell></TableRow>
              ) : (
                intimacoes.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-sm">{i.data_disponibilizacao ? format(new Date(i.data_disponibilizacao), "dd/MM/yyyy") : "-"}</TableCell>
                    <TableCell className="text-sm">{i.sigla_tribunal ?? "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{i.numero_processo ?? "-"}</TableCell>
                    <TableCell className="text-sm">{i.tipo_comunicacao ?? "-"}</TableCell>
                    <TableCell>{statusBadge(i.status)}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => setSelected(i)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Detalhes da Intimação</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Tribunal:</span> <span className="font-medium">{selected.sigla_tribunal}</span></div>
                <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium">{selected.tipo_comunicacao}</span></div>
                <div><span className="text-muted-foreground">Órgão:</span> <span className="font-medium">{selected.nome_orgao}</span></div>
                <div><span className="text-muted-foreground">Classe:</span> <span className="font-medium">{selected.nome_classe}</span></div>
                <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{selected.data_disponibilizacao ? format(new Date(selected.data_disponibilizacao), "dd/MM/yyyy") : "-"}</span></div>
                <div><span className="text-muted-foreground">Status:</span> {statusBadge(selected.status)}</div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Texto da Intimação:</p>
                <ScrollArea className="h-[300px] rounded-md border p-3">
                  <p className="text-sm whitespace-pre-wrap">{selected.texto ?? "Sem texto disponível"}</p>
                </ScrollArea>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => updateStatus(selected.id, "lida")}>Marcar como Lida</Button>
                <Button size="sm" onClick={() => updateStatus(selected.id, "respondida")}>Marcar como Respondida</Button>
                {selected.link && (
                  <Button size="sm" variant="ghost" asChild>
                    <a href={selected.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-3 w-3" />Abrir no PJE</a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
