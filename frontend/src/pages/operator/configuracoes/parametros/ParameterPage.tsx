import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { getApiBaseUrl } from "@/lib/api";

interface Item { id: number; nome: string;[key: string]: string | number | boolean | null }

interface BooleanField { key: string; label: string; default?: boolean }

interface SelectField { key: string; label: string; optionsEndpoint: string }

interface SelectOption { value: string; label: string }

interface ParameterPageProps {
    title: string;
    description: string;
    placeholder: string;
    emptyMessage: string;
    endpoint?: string; // ex.: "/api/areas"
    booleanFields?: BooleanField[];
    selectField?: SelectField;
}

// junta base + path sem barras duplicadas/faltando
function joinUrl(base: string, path = "") {
    const b = base.replace(/\/+$/, "");
    const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
    return `${b}${p}`;
}

export default function ParameterPage({
    title, description, placeholder, emptyMessage, endpoint, booleanFields, selectField,
}: ParameterPageProps) {
    const apiUrl = getApiBaseUrl();

    const [items, setItems] = useState<Item[]>([]);

    // States for Dialogs
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);

    // Form States (Shared for Create/Edit to simplify logic, but could be separate)
    const [formData, setFormData] = useState<{
        id?: number;
        nome: string;
        booleans: Record<string, boolean>;
        selectValue?: string;
    }>({
        nome: "",
        booleans: {},
        selectValue: undefined
    });

    const [selectOptions, setSelectOptions] = useState<SelectOption[]>([]);
    const [selectLoading, setSelectLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!selectField) {
            setSelectOptions([]);
            setFormData(prev => ({ ...prev, selectValue: undefined }));
            return;
        }
        const url = joinUrl(apiUrl, selectField.optionsEndpoint);
        let cancelled = false;
        setSelectLoading(true);
        (async () => {
            try {
                const res = await fetch(url, { headers: { Accept: "application/json" } });
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
                const data = await res.json();
                const parsed: unknown[] =
                    Array.isArray(data) ? data :
                        Array.isArray(data?.rows) ? data.rows :
                            Array.isArray(data?.data?.rows) ? data.data.rows :
                                Array.isArray(data?.data) ? data.data : [];
                if (!cancelled) {
                    setSelectOptions(parsed.map((r) => {
                        const option = r as { id?: number | string; nome?: string; descricao?: string; label?: string };
                        const value = option?.id != null ? String(option.id) : "";
                        const label = option?.nome ?? option?.descricao ?? option?.label ?? value;
                        return { value, label };
                    }));
                }
            } catch (e) {
                console.error(e);
                if (!cancelled) {
                    setSelectOptions([]);
                }
            } finally {
                if (!cancelled) {
                    setSelectLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [apiUrl, selectField]);

    const resolveSelectLabel = (value: unknown) => {
        if (value == null) return "";
        const strValue = String(value);
        const found = selectOptions.find((option) => option.value === strValue);
        return found?.label ?? strValue;
    };

    useEffect(() => {
        if (!endpoint) return;
        const url = joinUrl(apiUrl, endpoint);
        setLoading(true);
        setErrorMsg(null);
        (async () => {
            try {
                const res = await fetch(url, { headers: { Accept: "application/json" } });
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
                const data = await res.json();
                const parsed: unknown[] =
                    Array.isArray(data) ? data :
                        Array.isArray(data?.rows) ? data.rows :
                            Array.isArray(data?.data?.rows) ? data.data.rows :
                                Array.isArray(data?.data) ? data.data : [];
                setItems(parsed.map((r) => {
                    const item = r as { id: number | string; nome?: string; descricao?: string; name?: string;[key: string]: unknown };
                    const extra: Record<string, boolean> = {};
                    booleanFields?.forEach(f => {
                        extra[f.key] = typeof item[f.key] === 'boolean' ? (item[f.key] as boolean) : f.default ?? false;
                    });
                    const selectValue = selectField ? (item[selectField.key] as string | number | null | undefined) : undefined;
                    return {
                        id: Number(item.id),
                        nome: item.nome ?? item.descricao ?? item.name ?? "",
                        ...extra,
                        ...(selectField ? { [selectField.key]: selectValue == null ? null : (typeof selectValue === 'number' ? selectValue : Number(selectValue)) } : {}),
                    };
                }));
            } catch (e: unknown) {
                console.error(e);
                setErrorMsg(e instanceof Error ? e.message : "Erro ao buscar dados");
                setItems([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [apiUrl, endpoint, booleanFields, selectField]);

    const handleOpenCreate = () => {
        setFormData({
            nome: "",
            booleans: booleanFields?.reduce((acc, field) => ({ ...acc, [field.key]: field.default ?? false }), {}) ?? {},
            selectValue: undefined
        });
        setErrorMsg(null);
        setIsCreateOpen(true);
    };

    const handleOpenEdit = (item: Item) => {
        const itemBooleans: Record<string, boolean> = {};
        booleanFields?.forEach(f => { itemBooleans[f.key] = !!item[f.key]; });

        setFormData({
            id: item.id,
            nome: item.nome,
            booleans: itemBooleans,
            selectValue: item[selectField?.key ?? ''] != null ? String(item[selectField?.key ?? '']) : undefined
        });
        setErrorMsg(null);
        setIsEditOpen(true);
    };

    const handleSave = async (isEdit: boolean) => {
        const nome = formData.nome.trim();
        if (!nome) return;

        const payload: Record<string, unknown> = { nome, ativo: true };
        booleanFields?.forEach(f => {
            payload[f.key] = formData.booleans[f.key];
        });
        if (selectField) {
            payload[selectField.key] = formData.selectValue ? Number(formData.selectValue) : null;
        }

        setSaving(true);
        setErrorMsg(null);

        try {
            if (endpoint) {
                const url = isEdit
                    ? joinUrl(apiUrl, `${endpoint}/${formData.id}`)
                    : joinUrl(apiUrl, endpoint);
                const method = isEdit ? "PUT" : "POST";

                const res = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
                const responseData = await res.json();

                // Refresh list or optimistic update could be better, but re-fetching is safer for now or manual construction
                // Manually constructing for speed as per original code
                if (isEdit) {
                    setItems((prev) => prev.map((i) => {
                        if (i.id !== formData.id) return i;
                        // Reconstruction logic similar to original
                        const updatedItem: Item = {
                            id: Number(responseData?.id ?? formData.id),
                            nome: responseData?.nome ?? responseData?.descricao ?? nome,
                        };
                        booleanFields?.forEach(f => {
                            updatedItem[f.key] = (responseData?.[f.key] ?? payload[f.key]) as boolean;
                        });
                        if (selectField) {
                            const responseValue = responseData?.[selectField.key] ?? payload[selectField.key] ?? null;
                            updatedItem[selectField.key] = responseValue == null ? null : (typeof responseValue === 'number' ? responseValue : Number(responseValue));
                        }
                        return updatedItem;
                    }));
                } else {
                    const added: Item = {
                        id: Number(responseData?.id ?? responseData?.data?.id ?? Date.now()),
                        nome: responseData?.nome ?? responseData?.data?.nome ?? nome,
                    };
                    booleanFields?.forEach(f => {
                        added[f.key] = (responseData?.[f.key] ?? responseData?.data?.[f.key] ?? payload[f.key]) as boolean;
                    });
                    if (selectField) {
                        const responseValue = responseData?.[selectField.key] ?? responseData?.data?.[selectField.key] ?? payload[selectField.key] ?? null;
                        added[selectField.key] = responseValue == null ? null : (typeof responseValue === 'number' ? responseValue : Number(responseValue));
                    }
                    setItems((prev) => [...prev, added]);
                }
            } else {
                // No endpoint mode (mock/local)
                if (isEdit) {
                    setItems((prev) => prev.map((i) => (i.id === formData.id ? { ...i, nome, ...payload, id: i.id } : i)));
                } else {
                    setItems((prev) => [...prev, { id: Date.now(), nome, ...payload }]);
                }
            }
            if (isEdit) setIsEditOpen(false);
            else setIsCreateOpen(false);
        } catch (e) {
            console.error(e);
            setErrorMsg("Não foi possível salvar o item.");
        } finally {
            setSaving(false);
        }
    };

    const deleteItem = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir este item?")) return;

        if (endpoint) {
            try {
                const res = await fetch(joinUrl(apiUrl, `${endpoint}/${id}`), { method: "DELETE" });
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
            } catch (e) {
                console.error(e);
                setErrorMsg("Não foi possível excluir o item.");
                return;
            }
        }
        setItems((prev) => prev.filter((i) => i.id !== id));
    };

    const columnsCount = 1 + (selectField ? 1 : 0) + (booleanFields?.length ?? 0) + 1;

    const renderFormContent = () => (
        <div className="space-y-6 py-4">
            <div className="space-y-2">
                <Label htmlFor="nome" className="text-sm font-medium">Nome</Label>
                <Input
                    id="nome"
                    placeholder={placeholder}
                    value={formData.nome}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                    className="h-10 bg-background/50 focus:bg-background transition-colors"
                />
            </div>

            {selectField && (
                <div className="space-y-2">
                    <Label className="text-sm font-medium">{selectField.label}</Label>
                    <Select
                        value={formData.selectValue}
                        onValueChange={(val) => setFormData(prev => ({ ...prev, selectValue: val }))}
                        disabled={selectLoading}
                    >
                        <SelectTrigger className="h-10 bg-background/50 focus:bg-background transition-colors">
                            <SelectValue placeholder={`Selecione ${selectField.label.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent>
                            {selectLoading ? (
                                <SelectItem value="__loading" disabled>Carregando...</SelectItem>
                            ) : selectOptions.length > 0 ? (
                                selectOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))
                            ) : (
                                <SelectItem value="__empty" disabled>Nenhuma opção disponível</SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {booleanFields?.map(f => (
                <div key={f.key} className="flex items-center justify-between rounded-xl border p-4 bg-muted/20 hover:bg-muted/30 transition-colors">
                    <div className="space-y-0.5">
                        <Label className="text-base font-medium" htmlFor={`bool-${f.key}`}>{f.label}</Label>
                    </div>
                    <Switch
                        id={`bool-${f.key}`}
                        checked={formData.booleans[f.key]}
                        onCheckedChange={(v) => setFormData(prev => ({
                            ...prev,
                            booleans: { ...prev.booleans, [f.key]: v }
                        }))}
                    />
                </div>
            ))}
        </div>
    );

    return (
        <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        {title}
                    </h1>
                    <p className="text-muted-foreground mt-1 text-lg">
                        {description}
                    </p>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={handleOpenCreate} size="lg" className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98]">
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Adicionar Item</DialogTitle>
                            <DialogDescription>
                                Preencha os dados para adicionar um novo registro.
                            </DialogDescription>
                        </DialogHeader>
                        {renderFormContent()}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={saving}>Cancelar</Button>
                            <Button onClick={() => handleSave(false)} disabled={saving} className="shadow-md">
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {errorMsg && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm font-medium animate-in slide-in-from-top-2">
                    {errorMsg}
                </div>
            )}

            <Card className="shadow-lg border-muted/40">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/5 hover:bg-muted/5 border-b border-muted/40">
                                <TableHead className="pl-6 h-12 font-semibold text-foreground/70">Nome</TableHead>
                                {selectField && <TableHead className="font-semibold text-foreground/70">{selectField.label}</TableHead>}
                                {booleanFields?.map(f => <TableHead key={f.key} className="font-semibold text-foreground/70">{f.label}</TableHead>)}
                                <TableHead className="w-[100px] text-right pr-6 font-semibold text-foreground/70">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={columnsCount} className="h-32 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                            <p className="text-sm">Carregando dados...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : items.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={columnsCount} className="h-32 text-center text-muted-foreground">
                                        {emptyMessage}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                items.map((item) => (
                                    <TableRow key={item.id} className="group hover:bg-muted/30 border-b border-muted/40 transition-colors">
                                        <TableCell className="font-medium pl-6 py-4 text-foreground/90">{item.nome}</TableCell>
                                        {selectField && (
                                            <TableCell className="text-muted-foreground">
                                                {resolveSelectLabel(item[selectField.key]) || "—"}
                                            </TableCell>
                                        )}
                                        {booleanFields?.map(f => (
                                            <TableCell key={f.key}>
                                                <Badge
                                                    variant={item[f.key] ? "secondary" : "outline"}
                                                    className={item[f.key]
                                                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                                        : "text-muted-foreground bg-muted/50 border-muted-foreground/20"}
                                                >
                                                    {item[f.key] ? "Sim" : "Não"}
                                                </Badge>
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-right pr-6">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button size="icon" variant="ghost" onClick={() => handleOpenEdit(item)} className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" onClick={() => deleteItem(item.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
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
                        <DialogTitle>Editar Item</DialogTitle>
                        <DialogDescription>
                            Faça alterações nos dados do registro.
                        </DialogDescription>
                    </DialogHeader>
                    {renderFormContent()}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={saving}>Cancelar</Button>
                        <Button onClick={() => handleSave(true)} disabled={saving} className="shadow-md">
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
