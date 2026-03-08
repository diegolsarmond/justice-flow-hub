import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { getApiBaseUrl } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/features/auth/AuthProvider";

interface ApiSetor {
  id: number | string;
  nome?: string;
  empresa?: number | string | null;
  empresa_nome?: string | null;
  ativo?: boolean;
  datacriacao?: string | null;
}

interface ApiEmpresa {
  id: number | string;
  nome_empresa?: string;
}

interface EmpresaOption {
  id: number;
  nome: string;
}

interface Setor {
  id: number;
  nome: string;
  empresaId: number | null;
  empresaNome: string;
  ativo: boolean;
  datacriacao?: string;
}

interface SetorFormState {
  nome: string;
  empresaId: string;
  ativo: boolean;
}

const apiUrl = getApiBaseUrl();
const endpointBase = "/api/setores";

const NO_COMPANY_SELECTED_VALUE = "__no_company_selected__";

function joinUrl(base: string, path = "") {
  const b = base.replace(/\/+$/, "");
  const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${b}${p}`;
}

function parseArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.rows)) return obj.rows as T[];
    if (obj.data) {
      const data = obj.data as unknown;
      if (Array.isArray(data)) return data as T[];
      if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).rows)) {
        return (data as Record<string, unknown>).rows as T[];
      }
    }
  }
  return [];
}

export default function Setores() {
  const { user, isLoading: authLoading } = useAuth();
  const [setores, setSetores] = useState<Setor[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSetor, setEditingSetor] = useState<Setor | null>(null);
  const [formState, setFormState] = useState<SetorFormState>({
    nome: "",
    empresaId: "",
    ativo: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [setorToDelete, setSetorToDelete] = useState<Setor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const empresaMap = useMemo(() => {
    const map = new Map<number, string>();
    empresas.forEach((empresa) => {
      map.set(empresa.id, empresa.nome);
    });
    return map;
  }, [empresas]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setSetores([]);
      setEmpresas([]);
      setErrorMsg("Não foi possível identificar o usuário autenticado.");
      setLoading(false);
      return;
    }

    const userEmpresaId = user.empresa_id;

    if (userEmpresaId == null) {
      setSetores([]);
      setEmpresas([]);
      setErrorMsg("Sua conta não possui empresa vinculada.");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [empresasRes, setoresRes] = await Promise.all([
          fetch(joinUrl(apiUrl, "/api/empresas"), { headers: { Accept: "application/json" } }),
          fetch(joinUrl(apiUrl, endpointBase), { headers: { Accept: "application/json" } }),
        ]);

        if (!empresasRes.ok) {
          throw new Error(`HTTP ${empresasRes.status}: ${await empresasRes.text()}`);
        }
        if (!setoresRes.ok) {
          throw new Error(`HTTP ${setoresRes.status}: ${await setoresRes.text()}`);
        }

        const empresasDataRaw = parseArray<ApiEmpresa>(await empresasRes.json()).map((empresa) => ({
          id: Number(empresa.id),
          nome: empresa.nome_empresa ?? "",
        }));
        let empresasData = empresasDataRaw.filter((empresa) => empresa.id === userEmpresaId);

        if (empresasData.length === 0) {
          empresasData = [
            {
              id: userEmpresaId,
              nome: user.empresa_nome ?? `Empresa #${userEmpresaId}`,
            },
          ];
        }

        setEmpresas(empresasData);

        const mapEmpresas = new Map<number, string>();
        empresasData.forEach((empresa) => mapEmpresas.set(empresa.id, empresa.nome));

        const setoresData = parseArray<ApiSetor>(await setoresRes.json())
          .map((setor) => mapApiSetorToSetor(setor, mapEmpresas))
          .filter((setor) => setor.empresaId === userEmpresaId);
        setSetores(sortSetores(setoresData));
      } catch (error) {
        console.error(error);
        setErrorMsg("Não foi possível carregar os setores.");
        setSetores([]);
        setEmpresas([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, user]);

  const openCreateDialog = () => {
    setEditingSetor(null);
    setFormState({
      nome: "",
      empresaId: user?.empresa_id != null ? String(user.empresa_id) : "",
      ativo: true,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (setor: Setor) => {
    setEditingSetor(setor);
    setFormState({
      nome: setor.nome,
      empresaId: setor.empresaId != null ? setor.empresaId.toString() : "",
      ativo: setor.ativo,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditingSetor(null);
    setFormState({ nome: "", empresaId: "", ativo: true });
    setFormError(null);
  };

  const handleSubmit = async () => {
    const nome = formState.nome.trim();
    if (!nome) {
      setFormError("Nome é obrigatório");
      return;
    }

    let empresaId = formState.empresaId ? Number(formState.empresaId) : null;
    if (empresaId === null && user?.empresa_id != null) {
      empresaId = user.empresa_id;
    }
    const payload = {
      nome,
      empresa: empresaId,
      ativo: formState.ativo,
    };

    setSaving(true);
    setFormError(null);

    try {
      const url = editingSetor
        ? joinUrl(apiUrl, `${endpointBase}/${editingSetor.id}`)
        : joinUrl(apiUrl, endpointBase);
      const response = await fetch(url, {
        method: editingSetor ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      const data = await response.json();
      const setor = mapApiSetorToSetor(data, empresaMap);

      setSetores((prev) => {
        const updated = editingSetor
          ? prev.map((item) => (item.id === editingSetor.id ? setor : item))
          : [...prev, setor];
        return sortSetores(updated);
      });

      toast({
        title: editingSetor ? "Setor atualizado" : "Setor criado",
        description: editingSetor
          ? "As informações do setor foram atualizadas com sucesso."
          : "Novo setor cadastrado com sucesso.",
      });

      closeDialog();
    } catch (error) {
      console.error(error);
      setFormError("Não foi possível salvar o setor.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (setor: Setor) => {
    setSetorToDelete(setor);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setSetorToDelete(null);
  };

  const handleDelete = async () => {
    if (!setorToDelete) return;
    setDeleting(true);
    setErrorMsg(null);
    try {
      const url = joinUrl(apiUrl, `${endpointBase}/${setorToDelete.id}`);
      const response = await fetch(url, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      setSetores((prev) => prev.filter((item) => item.id !== setorToDelete.id));
      toast({ title: "Setor excluído" });
      setSetorToDelete(null);
    } catch (error) {
      console.error(error);
      setErrorMsg("Não foi possível excluir o setor.");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Setores</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os setores e escritórios da sua organização
          </p>
        </div>
        <Button onClick={openCreateDialog} size="lg" className="shadow-sm">
          <Plus className="mr-2 h-4 w-4" />
          Novo Setor
        </Button>
      </div>

      {errorMsg && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm font-medium">
          {errorMsg}
        </div>
      )}

      <Card className="border-muted bg-card shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-6">Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-[100px] text-right pr-6">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Carregando setores...
                    </div>
                  </TableCell>
                </TableRow>
              ) : setores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Nenhum setor encontrado. Cadastre um novo setor para começar.
                  </TableCell>
                </TableRow>
              ) : (
                setores.map((setor) => (
                  <TableRow key={setor.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium pl-6 py-4">{setor.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{setor.empresaNome || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={setor.ativo
                          ? "bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-200"
                          : "text-muted-foreground bg-muted hover:bg-muted/80"}
                      >
                        {setor.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(setor.datacriacao)}</TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => openEditDialog(setor)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Editar</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => confirmDelete(setor)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Excluir</span>
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

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSetor ? "Editar Setor" : "Novo Setor"}</DialogTitle>
            <DialogDescription>
              {editingSetor
                ? "Atualize as informações do setor selecionado."
                : "Informe os dados para cadastrar um novo setor."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Setor</Label>
              <Input
                id="nome"
                value={formState.nome}
                onChange={(event) => setFormState((prev) => ({ ...prev, nome: event.target.value }))}
                placeholder="Ex: Departamento Jurídico"
              />
            </div>

            <div className="space-y-2">
              <Label>Empresa Vinculada</Label>
              <Select
                value={
                  formState.empresaId === ""
                    ? NO_COMPANY_SELECTED_VALUE
                    : formState.empresaId
                }
                onValueChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    empresaId: value === NO_COMPANY_SELECTED_VALUE ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COMPANY_SELECTED_VALUE}>Sem empresa</SelectItem>
                  {empresas.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id.toString()}>
                      {empresa.nome || `Empresa #${empresa.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Status do Setor</Label>
                <p className="text-sm text-muted-foreground">
                  Setores ativos ficam visíveis para seleção no sistema.
                </p>
              </div>
              <Switch
                checked={formState.ativo}
                onCheckedChange={(value) => setFormState((prev) => ({ ...prev, ativo: value }))}
              />
            </div>

            {formError && (
              <div className="text-sm text-destructive flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-destructive" />
                {formError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!setorToDelete} onOpenChange={(open) => (!open ? cancelDelete() : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir setor</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Tem certeza de que deseja excluir o setor
              {" "}
              <strong>{setorToDelete?.nome}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete} disabled={deleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deleting ? "Excluindo..." : "Excluir Setor"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function mapApiSetorToSetor(apiSetor: ApiSetor, empresas: Map<number, string>): Setor {
  const id = Number(apiSetor.id);
  const empresaRaw = apiSetor.empresa;
  const empresaId = empresaRaw === null || empresaRaw === undefined || empresaRaw === ""
    ? null
    : Number(empresaRaw);
  const ativo = typeof apiSetor.ativo === "boolean" ? apiSetor.ativo : Boolean(apiSetor.ativo);
  return {
    id,
    nome: apiSetor.nome ?? "",
    empresaId,
    empresaNome: apiSetor.empresa_nome ?? (empresaId != null ? empresas.get(empresaId) ?? "" : ""),
    ativo,
    datacriacao: apiSetor.datacriacao ?? undefined,
  };
}

function sortSetores(items: Setor[]): Setor[] {
  return [...items].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
