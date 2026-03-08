import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { getApiBaseUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

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

interface Etiqueta {
  id: number;
  nome: string;
  exibe_pipeline: boolean;
  ordem: number | null;
  id_fluxo_trabalho: number | null;
}

interface FluxoTrabalhoItem {
  id: number;
  nome: string;
}

export default function Etiquetas() {
  const apiUrl = getApiBaseUrl();
  const { toast } = useToast();

  const [items, setItems] = useState<Etiqueta[]>([]);
  const [fluxos, setFluxos] = useState<FluxoTrabalhoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const [formData, setFormData] = useState({
    id: 0,
    nome: "",
    exibe_pipeline: true,
    ordem: "" as string,
    id_fluxo_trabalho: "no_selection" as string,
  });

  const forbiddenToastShown = useRef(false);

  const handleForbidden = async (response: Response, clear: () => void) => {
    if (response.status !== 403) {
      return false;
    }
    clear();
    const description = await getForbiddenMessage(response);
    setErrorMsg(description);
    if (!forbiddenToastShown.current) {
      toast({ title: "Acesso negado", description, variant: "destructive" });
      forbiddenToastShown.current = true;
    }
    return true;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`${apiUrl}/api/etiquetas`, {
          headers: { Accept: "application/json" },
        });
        if (await handleForbidden(res, () => setItems([]))) {
          setLoading(false);
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
        setItems(
          parsed.map((r) => {
            const item = r as {
              id: number | string;
              nome?: string;
              exibe_pipeline?: boolean;
              ordem?: number | null;
              id_fluxo_trabalho?: number | string | null;
            };
            return {
              id: Number(item.id),
              nome: item.nome ?? "",
              exibe_pipeline: item.exibe_pipeline ?? true,
              ordem:
                item.ordem === undefined || item.ordem === null
                  ? null
                  : Number(item.ordem),
              id_fluxo_trabalho:
                item.id_fluxo_trabalho === undefined || item.id_fluxo_trabalho === null
                  ? null
                  : Number(item.id_fluxo_trabalho),
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

  useEffect(() => {
    const fetchFluxos = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/fluxos-trabalho`, {
          headers: { Accept: "application/json" },
        });
        if (await handleForbidden(res, () => setFluxos([]))) {
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
        setFluxos(
          parsed.map((r) => {
            const item = r as { id: number | string; nome?: string };
            return { id: Number(item.id), nome: item.nome ?? "" };
          })
        );
      } catch (e) {
        console.error(e);
      }
    };
    fetchFluxos();
  }, [apiUrl]);

  const handleOpenCreate = () => {
    setFormData({
      id: 0,
      nome: "",
      exibe_pipeline: true,
      ordem: "",
      id_fluxo_trabalho: "no_selection",
    });
    setErrorMsg(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (item: Etiqueta) => {
    setFormData({
      id: item.id,
      nome: item.nome,
      exibe_pipeline: item.exibe_pipeline,
      ordem: item.ordem?.toString() || "",
      id_fluxo_trabalho: item.id_fluxo_trabalho?.toString() || "no_selection",
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
      exibe_pipeline: formData.exibe_pipeline,
      ordem: formData.ordem.trim() === "" ? null : Number(formData.ordem),
      id_fluxo_trabalho: formData.id_fluxo_trabalho === "no_selection" ? null : Number(formData.id_fluxo_trabalho),
    };

    try {
      const url = isEdit
        ? `${apiUrl}/api/etiquetas/${formData.id}`
        : `${apiUrl}/api/etiquetas`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const responseData = await res.json();

      if (isEdit) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === formData.id
              ? {
                id: Number(responseData?.id ?? formData.id),
                nome: responseData?.nome ?? nome,
                exibe_pipeline:
                  responseData?.exibe_pipeline ?? payload.exibe_pipeline,
                ordem:
                  responseData?.ordem === undefined || responseData?.ordem === null
                    ? payload.ordem
                    : Number(responseData.ordem),
                id_fluxo_trabalho:
                  responseData?.id_fluxo_trabalho === undefined || responseData?.id_fluxo_trabalho === null
                    ? payload.id_fluxo_trabalho
                    : Number(responseData.id_fluxo_trabalho),
              }
              : i
          )
        );
        setIsEditOpen(false);
      } else {
        setItems((prev) => [
          ...prev,
          {
            id: Number(responseData?.id ?? responseData?.data?.id ?? Date.now()),
            nome: responseData?.nome ?? nome,
            exibe_pipeline:
              responseData?.exibe_pipeline ?? payload.exibe_pipeline ?? true,
            ordem:
              responseData?.ordem === undefined || responseData?.ordem === null
                ? payload.ordem
                : Number(responseData.ordem),
            id_fluxo_trabalho:
              responseData?.id_fluxo_trabalho === undefined || responseData?.id_fluxo_trabalho === null
                ? payload.id_fluxo_trabalho
                : Number(responseData.id_fluxo_trabalho),
          },
        ]);
        setIsCreateOpen(false);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Não foi possível salvar a etiqueta.");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir?")) return;
    try {
      const res = await fetch(`${apiUrl}/api/etiquetas/${id}`, {
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
        <Label htmlFor="nome">Nome da Etiqueta</Label>
        <Input
          id="nome"
          placeholder="Ex: Urgente"
          value={formData.nome}
          onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Fluxo de Trabalho</Label>
        <Select
          value={formData.id_fluxo_trabalho}
          onValueChange={(val) => setFormData(prev => ({ ...prev, id_fluxo_trabalho: val }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um fluxo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="no_selection">Nenhum</SelectItem>
            {fluxos.map((f) => (
              <SelectItem key={f.id} value={f.id.toString()}>
                {f.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ordem">Ordem / Prioridade</Label>
          <Input
            id="ordem"
            type="number"
            placeholder="0"
            value={formData.ordem}
            onChange={(e) => setFormData(prev => ({ ...prev, ordem: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
        <div className="space-y-0.5">
          <Label className="text-base font-medium">Exibir no Pipeline</Label>
          <p className="text-sm text-muted-foreground">
            Define se esta etiqueta aparece nos cartões do pipeline.
          </p>
        </div>
        <Switch
          checked={formData.exibe_pipeline}
          onCheckedChange={(v) => setFormData(prev => ({ ...prev, exibe_pipeline: v }))}
        />
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Etiquetas</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as etiquetas utilizadas para classificar processos e cards.
          </p>
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
              <DialogTitle>Nova Etiqueta</DialogTitle>
              <DialogDescription>
                Preencha os dados da nova etiqueta.
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

      {errorMsg && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm font-medium flex items-center gap-2">
          <X className="h-4 w-4" />
          {errorMsg}
        </div>
      )}

      <Card className="border-muted bg-card shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-6">Nome</TableHead>
                <TableHead className="w-[25%]">Fluxo de Trabalho</TableHead>
                <TableHead className="w-[20%]">Exibe no Pipeline</TableHead>
                <TableHead className="w-[15%]">Ordem</TableHead>
                <TableHead className="w-[100px] text-right pr-6">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Carregando...
                    </div>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Nenhuma etiqueta encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium pl-6 py-4">{item.nome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {fluxos.find((f) => f.id === item.id_fluxo_trabalho)?.nome || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={item.exibe_pipeline
                          ? "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 border-blue-200"
                          : "text-muted-foreground bg-muted hover:bg-muted/80"}
                      >
                        {item.exibe_pipeline ? "Sim" : "Não"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.ordem ?? "—"}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteItem(item.id)}
                        >
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
            <DialogTitle>Editar Etiqueta</DialogTitle>
            <DialogDescription>
              Atualize os dados da etiqueta.
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
