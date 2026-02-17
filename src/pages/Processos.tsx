import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, RefreshCw, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

const TRIBUNAIS_ALIAS: Record<string, string> = {
  TJAC: "tjac", TJAL: "tjal", TJAM: "tjam", TJAP: "tjap", TJBA: "tjba", TJCE: "tjce",
  TJDFT: "tjdft", TJES: "tjes", TJGO: "tjgo", TJMA: "tjma", TJMG: "tjmg", TJMS: "tjms",
  TJMT: "tjmt", TJPA: "tjpa", TJPB: "tjpb", TJPE: "tjpe", TJPI: "tjpi", TJPR: "tjpr",
  TJRJ: "tjrj", TJRN: "tjrn", TJRO: "tjro", TJRR: "tjrr", TJRS: "tjrs", TJSC: "tjsc",
  TJSE: "tjse", TJSP: "tjsp", TJTO: "tjto", TRF1: "trf1", TRF2: "trf2", TRF3: "trf3",
  TRF4: "trf4", TRF5: "trf5", TRF6: "trf6", TST: "tst", STJ: "stj", STF: "stf",
};

export default function Processos() {
  const [processos, setProcessos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncNumero, setSyncNumero] = useState("");
  const [syncTribunal, setSyncTribunal] = useState("");
  const [form, setForm] = useState({ numero_cnj: "", tribunal: "", orgao_julgador: "", assunto: "", status: "em_andamento", grau: "" });

  const loadProcessos = async () => {
    let query = supabase.from("processos").select("*").order("updated_at", { ascending: false });
    if (search) query = query.ilike("numero_cnj", `%${search}%`);
    const { data } = await query.limit(100);
    setProcessos(data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadProcessos(); }, [search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("processos").insert(form);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Processo cadastrado!" });
      setDialogOpen(false);
      setForm({ numero_cnj: "", tribunal: "", orgao_julgador: "", assunto: "", status: "em_andamento", grau: "" });
      loadProcessos();
    }
  };

  const statusMap: Record<string, { label: string; className: string }> = {
    em_andamento: { label: "Em andamento", className: "border-primary/30 text-primary bg-primary/10" },
    suspenso: { label: "Suspenso", className: "border-[hsl(var(--warning))]/30 text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10" },
    arquivado: { label: "Arquivado", className: "border-muted-foreground/30 text-muted-foreground bg-muted" },
    encerrado: { label: "Encerrado", className: "border-[hsl(var(--success))]/30 text-[hsl(var(--success))] bg-[hsl(var(--success))]/10" },
  };

  const formatCNJ = (cnj: string) => {
    if (!cnj) return cnj;
    const clean = cnj.replace(/\D/g, "");
    if (clean.length === 20) {
      return clean.replace(/(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})/, "$1-$2.$3.$4.$5.$6");
    }
    return cnj;
  };

  const syncProcesso = async () => {
    if (!syncNumero || !syncTribunal) {
      toast({ title: "Erro", description: "Informe o número CNJ e o tribunal", variant: "destructive" });
      return;
    }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-processos", {
        body: { numero_cnj: syncNumero, tribunal_alias: TRIBUNAIS_ALIAS[syncTribunal] ?? syncTribunal.toLowerCase() },
      });
      if (error) throw error;
      toast({ title: "Sincronização concluída", description: data?.message ?? "Processo sincronizado" });
      setSyncDialogOpen(false);
      setSyncNumero("");
      setSyncTribunal("");
      loadProcessos();
    } catch (err: any) {
      toast({ title: "Erro na sincronização", description: err?.message ?? "Erro desconhecido", variant: "destructive" });
    }
    setSyncing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Processos</h1>
          <p className="text-muted-foreground">Gestão de processos judiciais</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><RefreshCw className="mr-2 h-4 w-4" />Sincronizar Datajud</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Sincronizar Processo via Datajud</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Número CNJ</Label>
                  <Input value={syncNumero} onChange={(e) => setSyncNumero(e.target.value)} placeholder="00000000020238130000" />
                </div>
                <div className="space-y-2">
                  <Label>Tribunal</Label>
                  <Select value={syncTribunal} onValueChange={setSyncTribunal}>
                    <SelectTrigger><SelectValue placeholder="Selecione o tribunal" /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(TRIBUNAIS_ALIAS).map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={syncProcesso} disabled={syncing} className="w-full">
                  {syncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Buscar e Sincronizar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Novo Processo</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar Processo</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Número CNJ</Label>
                <Input value={form.numero_cnj} onChange={(e) => setForm({ ...form, numero_cnj: e.target.value })} placeholder="00000000020238130000" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tribunal</Label>
                  <Input value={form.tribunal} onChange={(e) => setForm({ ...form, tribunal: e.target.value })} placeholder="TJMG" />
                </div>
                <div className="space-y-2">
                  <Label>Grau</Label>
                  <Input value={form.grau} onChange={(e) => setForm({ ...form, grau: e.target.value })} placeholder="G1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Órgão Julgador</Label>
                <Input value={form.orgao_julgador} onChange={(e) => setForm({ ...form, orgao_julgador: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Assunto</Label>
                <Input value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="suspenso">Suspenso</SelectItem>
                    <SelectItem value="arquivado">Arquivado</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Cadastrar</Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por número CNJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número CNJ</TableHead>
                <TableHead>Tribunal</TableHead>
                <TableHead>Órgão Julgador</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : processos.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum processo encontrado</TableCell></TableRow>
              ) : (
                processos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{formatCNJ(p.numero_cnj)}</TableCell>
                    <TableCell>{p.tribunal ?? "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{p.orgao_julgador ?? "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{p.assunto ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusMap[p.status]?.className ?? ""}>
                        {statusMap[p.status]?.label ?? p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
