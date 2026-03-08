import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { getApiBaseUrl } from "@/lib/api";

interface FluxoTrabalhoItem {
  id: number;
  nome: string;
  exibe_menu: boolean;
  ordem: number | null;
}

export default function FluxoTrabalho() {
  const apiUrl = getApiBaseUrl();

  const [items, setItems] = useState<FluxoTrabalhoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState<{
    id?: number;
    nome: string;
    exibe_menu: boolean;
    ordem: string;
  }>({
    nome: "",
    exibe_menu: true,
    ordem: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`${apiUrl}/api/fluxos-trabalho`, {
          headers: { Accept: "application/json" },
        });
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
        setItems(
          parsed.map((r) => {
            const item = r as {
              id: number | string;
              nome?: string;
              exibe_menu?: boolean;
              ordem?: number | null;
            };
            return {
              id: Number(item.id),
              nome: item.nome ?? "",
              exibe_menu: item.exibe_menu ?? true,
              ordem: item.ordem == null ? null : Number(item.ordem),
            };
          })
        );
      } catch (e: unknown) {
        console.error(e);
        setErrorMsg(e instanceof Error ? e.message : "Erro ao buscar dados");
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [apiUrl]);

  const handleOpenCreate = () => {
    setFormData({
      nome: "",
      exibe_menu: true,
      ordem: "",
    });
    setErrorMsg(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (item: FluxoTrabalhoItem) => {
    setFormData({
      id: item.id,
      nome: item.nome,
      exibe_menu: item.exibe_menu,
      ordem: item.ordem?.toString() || "",
    });
    setErrorMsg(null);
    setIsEditOpen(true);
  };

  const handleSave = async (isEdit: boolean) => {
    const nome = formData.nome.trim();
    if (!nome) return;

    setSaving(true);
    setErrorMsg(null);

    const payload = {
      nome,
      ativo: true,
      exibe_menu: formData.exibe_menu,
      ordem: formData.ordem.trim() === "" ? null : Number(formData.ordem),
    };

    try {
      const url = isEdit
        ? `${apiUrl}/api/fluxos-trabalho/${formData.id}`
        : `${apiUrl}/api/fluxos-trabalho`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const responseData = await res.json();

      const newItem: FluxoTrabalhoItem = {
        id: Number(isEdit ? formData.id : (responseData?.id ?? responseData?.data?.id ?? Date.now())),
        nome: responseData?.nome ?? nome,
        exibe_menu: responseData?.exibe_menu ?? payload.exibe_menu,
        ordem: responseData?.ordem === undefined || responseData?.ordem === null ? payload.ordem : Number(responseData.ordem)
      };

      if (isEdit) {
        setItems(prev => prev.map(i => i.id === newItem.id ? newItem : i));
        setIsEditOpen(false);
      } else {
        setItems(prev => [...prev, newItem]);
        setIsCreateOpen(false);
      }

    } catch (e) {
      console.error(e);
      setErrorMsg("Não foi possível salvar o item.");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir?")) return;
    try {
      const res = await fetch(`${apiUrl}/api/fluxos-trabalho/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      console.error(e);
      setErrorMsg("Não foi possível excluir o item.");
    }
  };

  const renderForm = () => (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome do Fluxo</Label>
        <Input
          id="nome"
          placeholder="Ex: Contencioso Cível"
          value={formData.nome}
          onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ordem">Ordem de Exibição</Label>
        <Input
          id="ordem"
          type="number"
          placeholder="0"
          value={formData.ordem}
          onChange={(e) => setFormData(prev => ({ ...prev, ordem: e.target.value }))}
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
        <div className="space-y-0.5">
          <Label className="text-base font-medium">Exibir no Menu</Label>
          <p className="text-sm text-muted-foreground">
            Define se este fluxo de trabalho aparece no menu lateral.
          </p>
        </div>
        <Switch
          checked={formData.exibe_menu}
          onCheckedChange={(v) => setFormData(prev => ({ ...prev, exibe_menu: v }))}
        />
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Fluxo de Trabalho</h1>
          <p className="text-muted-foreground mt-1">Gerencie os fluxos de trabalho</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreate} size="lg" className="shadow-sm">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Fluxo de Trabalho</DialogTitle>
              <DialogDescription>
                Crie um novo fluxo de trabalho para organizar seus processos.
              </DialogDescription>
            </DialogHeader>
            {renderForm()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={() => handleSave(false)} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {errorMsg && <p className="text-red-600">{errorMsg}</p>}

      <Card className="border-muted bg-card shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-6">Nome</TableHead>
                <TableHead className="w-40">Exibe no menu</TableHead>
                <TableHead className="w-24">Ordem</TableHead>
                <TableHead className="w-32 text-right pr-6">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Carregando...
                    </div>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                    Nenhum fluxo de trabalho cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium pl-6 py-4">{item.nome}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={item.exibe_menu
                          ? "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 border-blue-200"
                          : "text-muted-foreground bg-muted hover:bg-muted/80"}
                      >
                        {item.exibe_menu ? "Sim" : "Não"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.ordem ?? "—"}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" onClick={() => handleOpenEdit(item)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteItem(item.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Fluxo de Trabalho</DialogTitle>
            <DialogDescription>
              Edite as informações do fluxo de trabalho.
            </DialogDescription>
          </DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => handleSave(true)} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
