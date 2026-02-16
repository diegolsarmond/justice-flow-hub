import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Bell, CalendarClock, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Stats {
  processos: number;
  intimacoesPendentes: number;
  prazosProximos: number;
  clientes: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ processos: 0, intimacoesPendentes: 0, prazosProximos: 0, clientes: 0 });
  const [intimacoesRecentes, setIntimacoesRecentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [processosRes, intimacoesRes, prazosRes, clientesRes, intimacoesRecentesRes] = await Promise.all([
        supabase.from("processos").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("intimacoes").select("id", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("prazos").select("id", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("clientes").select("id", { count: "exact", head: true }),
        supabase.from("intimacoes").select("*").order("data_disponibilizacao", { ascending: false }).limit(5),
      ]);

      setStats({
        processos: processosRes.count ?? 0,
        intimacoesPendentes: intimacoesRes.count ?? 0,
        prazosProximos: prazosRes.count ?? 0,
        clientes: clientesRes.count ?? 0,
      });
      setIntimacoesRecentes(intimacoesRecentesRes.data ?? []);
      setLoading(false);
    }
    loadData();
  }, []);

  const cards = [
    { title: "Processos Ativos", value: stats.processos, icon: FileText, color: "text-primary" },
    { title: "Intimações Pendentes", value: stats.intimacoesPendentes, icon: Bell, color: "text-[hsl(var(--warning))]" },
    { title: "Prazos Pendentes", value: stats.prazosProximos, icon: CalendarClock, color: "text-[hsl(var(--destructive))]" },
    { title: "Clientes", value: stats.clientes, icon: Users, color: "text-[hsl(var(--success))]" },
  ];

  const statusBadge = (status: string | null) => {
    switch (status) {
      case "pendente": return <Badge variant="outline" className="border-[hsl(var(--warning))]/30 text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10">Pendente</Badge>;
      case "lida": return <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">Lida</Badge>;
      case "respondida": return <Badge variant="outline" className="border-[hsl(var(--success))]/30 text-[hsl(var(--success))] bg-[hsl(var(--success))]/10">Respondida</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do escritório</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{loading ? "..." : card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Intimações Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {intimacoesRecentes.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Nenhuma intimação encontrada</p>
          ) : (
            <div className="space-y-3">
              {intimacoesRecentes.map((i) => (
                <div key={i.id} className="flex items-start justify-between gap-4 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">{i.sigla_tribunal}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{i.tipo_comunicacao}</span>
                    </div>
                    <p className="text-sm font-medium truncate">{i.numero_processo ? `Processo ${i.numero_processo.replace(/(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})/, '$1-$2.$3.$4.$5.$6')}` : "Sem número"}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{i.nome_orgao}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {statusBadge(i.status)}
                    {i.data_disponibilizacao && (
                      <span className="text-xs text-muted-foreground">{format(new Date(i.data_disponibilizacao), "dd/MM/yyyy")}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
