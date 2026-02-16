import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Tarefas() {
  const [tarefas, setTarefas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ titulo: "", descricao: "", data_vencimento: "", prioridade: "media", status: "pendente" });

  const loadData = async () => {
    const { data } = await supabase.from("tarefas").select("*, processos(numero_cnj)").order("created_at", { ascending: false });
    setTarefas(data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { titulo: form.titulo, descricao: form.descricao || null, prioridade: form.prioridade, status: form.status };
    if (form.data_vencimento) payload.data_vencimento = form.data_vencimento;
    const { error } = await supabase.from("tarefas").insert(payload);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Tarefa criada!" });
      setDialogOpen(false);
      setForm({ titulo: "", descricao: "", data_vencimento: "", prioridade: "media", status: "pendente" });
      loadData();
    }
  };

  const prioridadeBadge = (p: string) => {
    const map: Record<string, string> = {
      baixa: "bg-muted text-muted-foreground",
      media: "border-primary/30 text-primary bg-primary/10",
      alta: "border-[hsl(var(--warning))]/30 text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10",
      urgente: "border-[hsl(var(--destructive))]/30 text-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10",
    };
    return <Badge variant="outline" className={map[p] ?? ""}>{p}</Badge>;
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pendente: "border-[hsl(var(--warning))]/30 text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10",
      em_andamento: "border-primary/30 text-primary bg-primary/10",
      concluida: "border-[hsl(var(--success))]/30 text-[hsl(var(--success))] bg-[hsl(var(--success))]/10",
      cancelada: "bg-muted text-muted-foreground",
    };
    return <Badge variant="outline" className={map[s] ?? ""}>{s.replace("_", " ")}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tarefas</h1>
          <p className="text-muted-foreground">Gestão de tarefas e atividades</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nova Tarefa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Tarefa</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Data de Vencimento</Label>
                <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="em_andamento">Em andamento</SelectItem>
                      <SelectItem value="concluida">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full">Criar Tarefa</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : tarefas.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma tarefa encontrada</TableCell></TableRow>
              ) : (
                tarefas.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.titulo}</TableCell>
                    <TableCell className="font-mono text-xs">{(t.processos as any)?.numero_cnj ?? "-"}</TableCell>
                    <TableCell className="text-sm">{t.data_vencimento ? format(new Date(t.data_vencimento), "dd/MM/yyyy") : "-"}</TableCell>
                    <TableCell>{prioridadeBadge(t.prioridade ?? "media")}</TableCell>
                    <TableCell>{statusBadge(t.status ?? "pendente")}</TableCell>
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
