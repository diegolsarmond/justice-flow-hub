import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";

export default function Prazos() {
  const [prazos, setPrazos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ descricao: "", data_vencimento: "", prioridade: "media", status: "pendente" });

  const loadData = async () => {
    const { data } = await supabase.from("prazos").select("*, processos(numero_cnj)").order("data_vencimento");
    setPrazos(data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("prazos").insert(form);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Prazo cadastrado!" });
      setDialogOpen(false);
      setForm({ descricao: "", data_vencimento: "", prioridade: "media", status: "pendente" });
      loadData();
    }
  };

  const urgencyBadge = (dataVenc: string) => {
    const days = differenceInDays(new Date(dataVenc), new Date());
    if (days < 0) return <Badge variant="destructive">Vencido</Badge>;
    if (days <= 1) return <Badge className="bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]">Hoje/Amanhã</Badge>;
    if (days <= 3) return <Badge className="bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]">{days} dias</Badge>;
    return <Badge variant="secondary">{days} dias</Badge>;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pendente: "border-[hsl(var(--warning))]/30 text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10",
      em_andamento: "border-primary/30 text-primary bg-primary/10",
      cumprido: "border-[hsl(var(--success))]/30 text-[hsl(var(--success))] bg-[hsl(var(--success))]/10",
      vencido: "border-[hsl(var(--destructive))]/30 text-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10",
    };
    return <Badge variant="outline" className={map[status] ?? ""}>{status.replace("_", " ")}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prazos</h1>
          <p className="text-muted-foreground">Controle de prazos processuais</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Novo Prazo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar Prazo</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Data de Vencimento</Label>
                <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} required />
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
                      <SelectItem value="cumprido">Cumprido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full">Cadastrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Urgência</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : prazos.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum prazo encontrado</TableCell></TableRow>
              ) : (
                prazos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.descricao}</TableCell>
                    <TableCell className="font-mono text-xs">{(p.processos as any)?.numero_cnj ?? "-"}</TableCell>
                    <TableCell className="text-sm">{format(new Date(p.data_vencimento), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{urgencyBadge(p.data_vencimento)}</TableCell>
                    <TableCell>{statusBadge(p.status ?? "pendente")}</TableCell>
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
