import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Search, Filter, Plus, Download, MoreHorizontal, Edit, UserX, UserCheck, Mail, AlertTriangle, KeyRound, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { User } from "@/types/user";
import { getApiBaseUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";


const apiUrl = getApiBaseUrl();

function joinUrl(base: string, path = "") {
  const b = base.replace(/\/+$/, "");
  const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${b}${p}`;
}

interface ApiUsuario {
  id: number;
  nome_completo: string;
  email: string;
  perfil: number;
  empresa: number;
  escritorio: number;
  oab: string | null;
  oab_number: string | null;
  oab_uf: string | null;
  status: boolean;
  telefone: string | null;
  ultimo_login: string | null;
  observacoes: string | null;
  datacriacao: string;
}

interface ApiPerfil {
  id: number;
  nome: string;
}

const extractArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (Array.isArray((value as { rows?: unknown })?.rows)) {
    return (value as { rows: T[] }).rows;
  }

  if (Array.isArray((value as { data?: unknown })?.data)) {
    return (value as { data: T[] }).data;
  }

  if (Array.isArray((value as { data?: { rows?: unknown } })?.data?.rows)) {
    return (value as { data: { rows: T[] } }).data.rows;
  }

  return [];
};

const perfilToRole = (perfil: number): User["role"] => {
  switch (perfil) {
    case 1:
      return "admin";
    case 2:
      return "advogado";
    case 3:
      return "estagiario";
    case 4:
      return "secretario";
    default:
      return "advogado";
  }
};

const mapApiUserToUser = (u: ApiUsuario): User => {
  const trimmedNumber = typeof u.oab_number === "string" ? u.oab_number.trim() : "";
  const trimmedUf = typeof u.oab_uf === "string" ? u.oab_uf.trim() : "";

  const parseLegacyOab = (value: string | null) => {
    if (!value) {
      return { numero: "", uf: "" };
    }
    const [numeroPart, ufPart] = value.split("/").map((part) => part?.trim() ?? "");
    return { numero: numeroPart, uf: ufPart };
  };

  const legacy = parseLegacyOab(u.oab);
  const numero = trimmedNumber || legacy.numero;
  const uf = trimmedUf || legacy.uf;

  return {
    id: u.id.toString(),
    name: u.nome_completo,
    email: u.email,
    phone: u.telefone ?? "",
    role: perfilToRole(u.perfil),
    perfil: u.perfil,
    escritorio: u.escritorio?.toString() ?? "",
    oab: numero || uf ? { numero, uf } : undefined,
    especialidades: [],
    tarifaPorHora: undefined,
    timezone: "America/Sao_Paulo",
    idioma: "pt-BR",
    ativo: u.status,
    ultimoLogin: u.ultimo_login ? new Date(u.ultimo_login) : undefined,
    createdAt: new Date(u.datacriacao),
    updatedAt: new Date(u.datacriacao),
    avatar: undefined,
  };

};

const roleLabels = {
  admin: "Administrador",
  advogado: "Advogado",
  estagiario: "Estagiário",
  secretario: "Secretário"
};

const roleVariants = {
  admin: "destructive",
  advogado: "default",
  estagiario: "secondary",
  secretario: "outline"
} as const;

export default function Usuarios() {
  const [users, setUsers] = useState<User[]>([]);
  const [perfilNames, setPerfilNames] = useState<Record<number, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [planMeta, setPlanMeta] = useState<{ inactiveByPlanLimit: number; limit: number | null } | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [userToResetPassword, setUserToResetPassword] = useState<User | null>(null);
  const [userToToggleStatus, setUserToToggleStatus] = useState<User | null>(null);
  const [togglingStatusUserId, setTogglingStatusUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const activeUsersCount = users.filter((u) => u.ativo).length;
  const isLimitReached = planMeta?.limit !== null && activeUsersCount >= (planMeta?.limit ?? 0);

  const handleNewUserClick = () => {
    if (isLimitReached) {
      setShowUpgradeDialog(true);
    } else {
      navigate("/configuracoes/usuarios/novo");
    }
  };


  const resolvePerfilNome = (perfilId: number | null | undefined): string => {
    if (typeof perfilId !== "number") {
      return "Sem perfil";
    }

    const nome = perfilNames[perfilId];

    if (typeof nome === "string" && nome.trim().length > 0) {
      return nome.trim();
    }

    return `Perfil ${perfilId}`;
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const [response, perfisResponse] = await Promise.all([
          fetch(joinUrl(apiUrl, "/api/usuarios/empresa"), {
            headers: { Accept: "application/json" },
          }),
          fetch(joinUrl(apiUrl, "/api/perfis"), {
            headers: { Accept: "application/json" },
          }),
        ]);

        if (!response.ok) {
          throw new Error("Failed to fetch users");
        }
        const json = await response.json();
        const data: ApiUsuario[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.rows)
            ? json.rows
            : Array.isArray(json?.data?.rows)
              ? json.data.rows
              : Array.isArray(json?.data)
                ? json.data
                : [];
        setUsers(data.map(mapApiUserToUser));

        if (json?._meta) {
          setPlanMeta({
            inactiveByPlanLimit: json._meta.inactiveByPlanLimit ?? 0,
            limit: json._meta.limit ?? null,
          });
        }


        if (perfisResponse.ok) {
          try {
            const perfisJson = await perfisResponse.json();
            const perfis = extractArray<ApiPerfil>(perfisJson);
            const mappedNames = perfis.reduce<Record<number, string>>((acc, perfil) => {
              if (typeof perfil.id === "number" && typeof perfil.nome === "string") {
                const trimmed = perfil.nome.trim();

                if (trimmed.length > 0) {
                  acc[perfil.id] = trimmed;
                }
              }

              return acc;
            }, {});

            setPerfilNames(mappedNames);
          } catch (error) {
            console.error("Erro ao processar perfis:", error);
          }
        } else {
          console.error("Erro ao carregar perfis: resposta inválida");
        }
      } catch (error) {
        console.error("Erro ao buscar usuários:", error);
      }
    };

    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "todos" || user.role === roleFilter;
    const matchesStatus = statusFilter === "todos" ||
      (statusFilter === "ativo" && user.ativo) ||
      (statusFilter === "inativo" && !user.ativo);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    setSelectedUsers(
      selectedUsers.length === filteredUsers.length
        ? []
        : filteredUsers.map(user => user.id)
    );
  };

  const formatLastLogin = (date?: Date) => {
    if (!date) return "Nunca";
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const handleResetPassword = async () => {
    if (!userToResetPassword) return;

    const user = userToResetPassword;
    setResettingUserId(user.id);

    try {
      const response = await fetch(
        joinUrl(apiUrl, `/api/usuarios/${user.id}/reset-password`),
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      let payload: unknown = null;

      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      if (!response.ok) {
        const message =
          typeof payload === "object" && payload && "error" in payload && typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "Não foi possível redefinir a senha.";

        throw new Error(message);
      }

      const successMessage =
        typeof payload === "object" && payload && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
          ? (payload as { message: string }).message
          : `Enviamos as instruções de acesso para ${user.email}.`;

      toast({
        title: "Senha redefinida",
        description: successMessage,
      });
      setUserToResetPassword(null);
    } catch (error) {
      console.error("Erro ao resetar senha", error);
      toast({
        title: "Erro ao resetar senha",
        description: error instanceof Error ? error.message : "Não foi possível redefinir a senha do usuário.",
        variant: "destructive",
      });
    } finally {
      setResettingUserId(null);
    }
  };

  const handleToggleStatus = async () => {
    if (!userToToggleStatus) return;

    const user = userToToggleStatus;
    const newStatus = !user.ativo;
    setTogglingStatusUserId(user.id);

    try {
      const response = await fetch(
        joinUrl(apiUrl, `/api/usuarios/${user.id}/status`),
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: newStatus,
          }),
        }
      );



      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          typeof payload === "object" && payload && "error" in payload && typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : `Não foi possível ${newStatus ? "ativar" : "desativar"} o usuário.`;
        throw new Error(message);
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, ativo: newStatus } : u
        )
      );

      toast({
        title: newStatus ? "Usuário ativado" : "Usuário desativado",
        description: `${user.name} foi ${newStatus ? "ativado" : "desativado"} com sucesso.`,
      });
      setUserToToggleStatus(null);
    } catch (error) {
      console.error("Erro ao alterar status do usuário", error);
      toast({
        title: "Erro ao alterar status",
        description: error instanceof Error ? error.message : "Não foi possível alterar o status do usuário.",
        variant: "destructive",
      });
    } finally {
      setTogglingStatusUserId(null);
    }
  };

  return (

    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Usuários</h1>
          <p className="text-muted-foreground">Gerencie usuários, roles e permissões</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button size="sm" onClick={handleNewUserClick}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>

        </div>
      </div>

      {planMeta && planMeta.inactiveByPlanLimit > 0 && (
        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">Usuários inativos por limite do plano</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            {planMeta.inactiveByPlanLimit} usuário(s) estão inativos devido ao limite do seu plano atual
            {planMeta.limit !== null && ` (${planMeta.limit} usuários permitidos)`}.{" "}
            <Link to="/meu-plano" className="font-medium underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100">
              Faça upgrade para reativá-los.
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os roles</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="advogado">Advogado</SelectItem>
                <SelectItem value="estagiario">Estagiário</SelectItem>
                <SelectItem value="secretario">Secretário</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {selectedUsers.length > 0 && (
            <div className="bg-muted/50 p-4 rounded-lg mb-4 flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {selectedUsers.length} usuário(s) selecionado(s)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Convidar
                </Button>
                <Button variant="outline" size="sm">
                  <UserX className="h-4 w-4 mr-2" />
                  Desativar
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Escritório</TableHead>
                <TableHead>OAB</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último Login</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={() => handleSelectUser(user.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback>
                          {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge>
                      {resolvePerfilNome((user as { perfil?: number | null }).perfil ?? null)}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.escritorio}</TableCell>
                  <TableCell>
                    {user.oab
                      ? [user.oab.numero, user.oab.uf].filter((value) => value).join("/") || "-"
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.ativo ? "default" : "secondary"}>
                      {user.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {formatLastLogin(user.ultimoLogin)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => navigate(`/configuracoes/usuarios/${user.id}/editar`)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => navigate(`/configuracoes/usuarios/${user.id}`)}>
                          Ver Perfil
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={resettingUserId === user.id}
                          onSelect={(event) => {
                            event.preventDefault();
                            setUserToResetPassword(user);
                          }}
                        >
                          <KeyRound className="h-4 w-4 mr-2" />
                          Reset Senha
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            setUserToToggleStatus(user);
                          }}
                          className={user.ativo ? "text-destructive focus:text-destructive" : "text-green-600 focus:text-green-600"}
                        >
                          {user.ativo ? (
                            <>
                              <UserX className="h-4 w-4 mr-2" />
                              Desativar
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-4 w-4 mr-2" />
                              Ativar
                            </>
                          )}
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum usuário encontrado
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limite de usuários atingido</AlertDialogTitle>
            <AlertDialogDescription>
              Seu plano atual permite apenas {planMeta?.limit} usuário(s) ativo(s).
              Para adicionar mais usuários, faça upgrade para um plano com maior capacidade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/meu-plano")}>
              Ver planos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Reset de Senha */}
      <AlertDialog open={!!userToResetPassword} onOpenChange={(open) => !open && setUserToResetPassword(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30">
              <KeyRound className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle className="text-center text-xl">
              Redefinir senha
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-center space-y-3">
                {userToResetPassword && (
                  <div className="flex flex-col items-center gap-3 py-2">
                    <Avatar className="h-14 w-14 ring-2 ring-amber-200 dark:ring-amber-800">
                      <AvatarImage src={userToResetPassword.avatar} alt={userToResetPassword.name} />
                      <AvatarFallback className="bg-gradient-to-br from-amber-400 to-orange-500 text-white text-lg font-semibold">
                        {userToResetPassword.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                      <span className="block font-medium text-foreground">{userToResetPassword.name}</span>
                      <span className="block text-sm text-muted-foreground">{userToResetPassword.email}</span>
                    </div>
                  </div>
                )}
                <span className="block text-sm text-muted-foreground">
                  Uma nova senha temporária será enviada para o e-mail do usuário.
                  O usuário precisará alterar a senha no primeiro acesso.
                </span>
              </div>
            </AlertDialogDescription>

          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={resettingUserId !== null}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetPassword}
              disabled={resettingUserId !== null}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              {resettingUserId !== null ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar nova senha
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Ativar/Desativar Usuário */}
      <AlertDialog open={!!userToToggleStatus} onOpenChange={(open) => !open && setUserToToggleStatus(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader className="space-y-4">
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${userToToggleStatus?.ativo
              ? "bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30"
              : "bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30"
              }`}>
              {userToToggleStatus?.ativo ? (
                <UserX className="h-8 w-8 text-red-600 dark:text-red-400" />
              ) : (
                <UserCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
              )}
            </div>
            <AlertDialogTitle className="text-center text-xl">
              {userToToggleStatus?.ativo ? "Desativar usuário" : "Ativar usuário"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-center space-y-3">
                {userToToggleStatus && (
                  <div className="flex flex-col items-center gap-3 py-2">
                    <Avatar className={`h-14 w-14 ring-2 ${userToToggleStatus.ativo
                      ? "ring-red-200 dark:ring-red-800"
                      : "ring-green-200 dark:ring-green-800"
                      }`}>
                      <AvatarImage src={userToToggleStatus.avatar} alt={userToToggleStatus.name} />
                      <AvatarFallback className={`text-white text-lg font-semibold ${userToToggleStatus.ativo
                        ? "bg-gradient-to-br from-red-400 to-rose-500"
                        : "bg-gradient-to-br from-green-400 to-emerald-500"
                        }`}>
                        {userToToggleStatus.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                      <span className="block font-medium text-foreground">{userToToggleStatus.name}</span>
                      <span className="block text-sm text-muted-foreground">{userToToggleStatus.email}</span>
                    </div>
                  </div>
                )}
                <span className="block text-sm text-muted-foreground">
                  {userToToggleStatus?.ativo
                    ? "O usuário perderá acesso ao sistema e não poderá fazer login até ser reativado."
                    : "O usuário terá seu acesso restaurado e poderá fazer login normalmente."
                  }
                </span>
              </div>
            </AlertDialogDescription>

          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={togglingStatusUserId !== null}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleStatus}
              disabled={togglingStatusUserId !== null}
              className={userToToggleStatus?.ativo
                ? "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white"
                : "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
              }
            >
              {togglingStatusUserId !== null ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : userToToggleStatus?.ativo ? (
                <>
                  <UserX className="mr-2 h-4 w-4" />
                  Desativar usuário
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Ativar usuário
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );



}
