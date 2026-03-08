import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Shield, UserCheck, UserX, Users, Eye, Pencil, Key, Building2 } from "lucide-react";

import { routes } from "@/config/routes";
import { getApiUrl } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type ApiUser = {
  id?: number | string;
  nome_completo?: string | null;
  email?: string | null;
  perfil?: string | number | null;
  idperfil?: string | number | null;
  perfil_nome?: string | null;
  empresa?: number | string | null;
  empresa_id?: number | string | null;
  empresa_nome?: string | null;
  status?: boolean | number | string | null;
  ultimo_login?: string | null;
};

type ApiProfile = {
  id?: number | string | null;
  nome?: string | null;
  descricao?: string | null;
  ativo?: boolean | number | string | null;
};

type DisplayUser = {
  id: string;
  displayName: string;
  email: string;
  companyName: string;
  role: string;
  roleNormalized: string;
  isActive: boolean;
  lastLogin: string | null;
  searchText: string;
};

type EditFormState = {
  displayName: string;
  email: string;
  companyId: string;
  roleId: string;
  isActive: boolean;
};

const getNormalizedId = (user: ApiUser, index: number) => {
  const rawId = user.id;
  if (typeof rawId === "number" || typeof rawId === "string") {
    return String(rawId);
  }

  return `user-${index}`;
};

const normalizeStatus = (status: ApiUser["status"]): boolean => {
  if (typeof status === "boolean") {
    return status;
  }

  if (typeof status === "number") {
    return status !== 0;
  }

  if (typeof status === "string") {
    const normalized = status.trim().toLowerCase();
    if (["false", "0", "inativo", "inactive", "nao", "não", "no", "n"].includes(normalized)) {
      return false;
    }

    if (["true", "1", "ativo", "active", "sim", "yes", "y", "s"].includes(normalized)) {
      return true;
    }
  }

  return Boolean(status);
};

const resolveRoleBadgeVariant = (role: string): BadgeProps["variant"] => {
  const normalized = role.trim().toLowerCase();

  if (!normalized || normalized === "sem perfil") {
    return "outline";
  }

  if (normalized.includes("admin")) {
    return "default";
  }

  if (normalized.includes("suporte") || normalized.includes("support")) {
    return "outline";
  }

  if (normalized.includes("finance") || normalized.includes("gestor")) {
    return "secondary";
  }

  return "secondary";
};

type ApiCompany = {
  id?: number | string | null;
  nome_empresa?: string | null;
  nome?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  empresa_nome?: string | null;
  email?: string | null;
};

type SelectOption = {
  id: string;
  label: string;
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const isAllDigits = (value: string) => /^\d+$/.test(value);

const extractIdLikeValue = (value: unknown): string | null => {
  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return String(value);
    }

    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    if (isAllDigits(trimmed)) {
      return trimmed;
    }
  }

  return null;
};

const extractCollection = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object") {
    const record = payload as { rows?: unknown; data?: unknown };

    if (Array.isArray(record.rows)) {
      return record.rows as T[];
    }

    if (Array.isArray(record.data)) {
      return record.data as T[];
    }

    if (record.data && typeof record.data === "object") {
      const nested = record.data as { rows?: unknown };

      if (Array.isArray(nested.rows)) {
        return nested.rows as T[];
      }
    }
  }

  return [];
};

const extractCompanyIdFromValue = (
  value: ApiUser["empresa"] | ApiUser["empresa_id"],
): string | null => {
  return extractIdLikeValue(value);
};

const extractCompanyIdFromUser = (user: ApiUser | undefined): string | null => {
  if (!user) {
    return null;
  }

  return (
    extractCompanyIdFromValue(user.empresa_id) ??
    extractCompanyIdFromValue(user.empresa)
  );
};

const extractProfileIdFromValue = (
  value: ApiUser["idperfil"] | ApiUser["perfil"],
): string | null => {
  return extractIdLikeValue(value);
};

const extractProfileIdFromUser = (user: ApiUser | undefined): string | null => {
  if (!user) {
    return null;
  }

  return (
    extractProfileIdFromValue(user.idperfil) ?? extractProfileIdFromValue(user.perfil)
  );
};

const extractProfileNameCandidate = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (isAllDigits(trimmed)) {
    return null;
  }

  return trimmed;
};

const resolveProfileNameFromUser = (
  user: ApiUser | undefined,
  profileNames: Record<string, string>,
): { id: string | null; name: string } => {
  const profileId = extractProfileIdFromUser(user);

  if (profileId) {
    const mappedName = profileNames[profileId];

    if (isNonEmptyString(mappedName)) {
      return { id: profileId, name: mappedName.trim() };
    }
  }

  const nameCandidates: Array<unknown> = [];
  const perfilNome = (user as { perfil_nome?: unknown })?.perfil_nome;

  if (isNonEmptyString(perfilNome)) {
    nameCandidates.push(perfilNome);
  }

  if (typeof user?.perfil === "string") {
    nameCandidates.push(user.perfil);
  }

  for (const candidate of nameCandidates) {
    const name = extractProfileNameCandidate(candidate);

    if (name && (!profileId || name !== profileId)) {
      return { id: profileId, name };
    }
  }

  if (profileId) {
    return { id: profileId, name: `Perfil ${profileId}` };
  }

  return { id: null, name: "Sem perfil" };
};

const parseCompanyPayload = (payload: unknown): ApiCompany | null => {
  if (payload == null) {
    return null;
  }

  if (Array.isArray(payload)) {
    const first = payload.find((item) => item && typeof item === "object");
    return (first as ApiCompany) ?? null;
  }

  if (typeof payload === "object") {
    if ("rows" in payload) {
      const rows = (payload as { rows?: unknown }).rows;
      if (Array.isArray(rows)) {
        const first = rows.find((item) => item && typeof item === "object");
        if (first) {
          return first as ApiCompany;
        }
      }
    }

    if ("data" in payload) {
      const data = (payload as { data?: unknown }).data;
      if (Array.isArray(data)) {
        const first = data.find((item) => item && typeof item === "object");
        if (first) {
          return first as ApiCompany;
        }
      }

      if (data && typeof data === "object" && "rows" in data) {
        const nestedRows = (data as { rows?: unknown }).rows;
        if (Array.isArray(nestedRows)) {
          const first = nestedRows.find((item) => item && typeof item === "object");
          if (first) {
            return first as ApiCompany;
          }
        }
      }
    }

    return payload as ApiCompany;
  }

  return null;
};

const extractProfilesFromPayload = (payload: unknown): ApiProfile[] => {
  return extractCollection<ApiProfile>(payload);
};

const resolveCompanyNameFromData = (company: ApiCompany | null): string | null => {
  if (!company) {
    return null;
  }

  const candidates: Array<unknown> = [
    company.nome_empresa,
    company.empresa_nome,
    company.nome,
    company.razao_social,
    company.nome_fantasia,
  ];

  for (const candidate of candidates) {
    if (isNonEmptyString(candidate)) {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
};

const mapCompanyToOption = (company: ApiCompany, index: number): SelectOption | null => {
  const id =
    extractIdLikeValue(company.id) ??
    extractIdLikeValue((company as { empresa_id?: unknown }).empresa_id) ??
    extractIdLikeValue((company as { empresa?: unknown }).empresa);

  if (!id) {
    return null;
  }

  const name = resolveCompanyNameFromData(company);
  const emailCandidate =
    typeof company.email === "string" && company.email.trim().length > 0
      ? company.email.trim()
      : null;

  const label = name ?? emailCandidate ?? `Empresa ${index + 1}`;

  return { id, label } satisfies SelectOption;
};

const mapProfileToOption = (profile: ApiProfile, index: number): SelectOption | null => {
  const id =
    extractIdLikeValue(profile.id) ??
    extractIdLikeValue((profile as { perfil?: unknown }).perfil);

  if (!id) {
    return null;
  }

  const nameCandidate =
    typeof profile.nome === "string" && profile.nome.trim().length > 0
      ? profile.nome.trim()
      : typeof profile.descricao === "string" && profile.descricao.trim().length > 0
        ? profile.descricao.trim()
        : null;

  const label = nameCandidate ?? `Perfil ${index + 1}`;

  return { id, label } satisfies SelectOption;
};

const resolveCompanyNameFromUser = (
  user: ApiUser | undefined,
  companyNames: Record<string, string>,
): { id: string | null; name: string } => {
  const companyId = extractCompanyIdFromUser(user);

  if (companyId) {
    const mappedName = companyNames[companyId];
    if (isNonEmptyString(mappedName)) {
      return { id: companyId, name: mappedName.trim() };
    }
  }

  const nameCandidates: Array<unknown> = [];

  if (isNonEmptyString(user?.empresa_nome)) {
    nameCandidates.push(user?.empresa_nome);
  }

  if (typeof user?.empresa === "string") {
    nameCandidates.push(user?.empresa);
  }

  for (const candidate of nameCandidates) {
    if (isNonEmptyString(candidate)) {
      const trimmed = candidate.trim();
      if (!companyId || trimmed !== companyId) {
        return { id: companyId, name: trimmed };
      }
    }
  }

  if (companyId) {
    return { id: companyId, name: `Empresa ${companyId}` };
  }

  return { id: null, name: "Sem empresa" };
};

export default function UsersPage() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    displayName: "",
    email: "",
    companyId: "",
    roleId: "",
    isActive: true,
  });
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [companyOptions, setCompanyOptions] = useState<SelectOption[]>([]);
  const [profileOptions, setProfileOptions] = useState<SelectOption[]>([]);
  const [isLoadingCompanyOptions, setIsLoadingCompanyOptions] = useState(false);
  const [isLoadingProfileOptions, setIsLoadingProfileOptions] = useState(false);

  const { toast } = useToast();

  const fetchUsers = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl("admin/users"), {
        signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "Nenhum usuário encontrado."
            : `Erro ao carregar usuários (código ${response.status}).`
        );
      }

      const data = (await response.json()) as unknown;

      if (!Array.isArray(data)) {
        throw new Error("Resposta inesperada do servidor.");
      }

      const sanitizedUsers = data.filter(
        (item): item is ApiUser => typeof item === "object" && item !== null
      );

      if (!signal?.aborted) {
        setUsers(sanitizedUsers);
      }
    } catch (fetchError) {
      if (signal?.aborted) {
        return;
      }

      if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
        return;
      }

      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Não foi possível carregar os usuários.";
      setError(message);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchUsers(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchUsers]);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadProfiles = async () => {
      setIsLoadingProfileOptions(true);
      try {
        const response = await fetch(getApiUrl("perfis"), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Falha ao carregar perfis (${response.status}).`);
        }

        const payload = await response.json();

        if (!isActive) {
          return;
        }

        const profiles = extractProfilesFromPayload(payload);
        const nextProfiles: Record<string, string> = {};
        const nextProfileOptions = profiles
          .map(mapProfileToOption)
          .filter((option): option is SelectOption => option !== null)
          .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

        nextProfileOptions.forEach((option) => {
          nextProfiles[option.id] = option.label;
        });

        setProfileNames((previous) => {
          if (Object.keys(nextProfiles).length === 0) {
            return previous;
          }

          const combined = { ...previous };

          Object.entries(nextProfiles).forEach(([id, label]) => {
            combined[id] = label;
          });

          return combined;
        });
        setProfileOptions(nextProfileOptions);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        console.error("Erro ao carregar perfis:", fetchError);
      } finally {
        if (isActive) {
          setIsLoadingProfileOptions(false);
        }
      }
    };

    void loadProfiles();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadCompanies = async () => {
      setIsLoadingCompanyOptions(true);

      try {
        const response = await fetch(getApiUrl("empresas"), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Falha ao carregar empresas (${response.status}).`);
        }

        const payload = await response.json();

        if (!isActive) {
          return;
        }

        const companies = extractCollection<ApiCompany>(payload);
        const nextCompanyOptions = companies
          .map(mapCompanyToOption)
          .filter((option): option is SelectOption => option !== null)
          .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

        if (nextCompanyOptions.length > 0) {
          setCompanyNames((previous) => {
            const combined = { ...previous };

            nextCompanyOptions.forEach((option) => {
              combined[option.id] = option.label;
            });

            return combined;
          });
        }

        setCompanyOptions(nextCompanyOptions);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        console.error("Erro ao carregar empresas:", fetchError);
      } finally {
        if (isActive) {
          setIsLoadingCompanyOptions(false);
        }
      }
    };

    void loadCompanies();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const companyIds = useMemo(() => {
    const ids = new Set<string>();

    users.forEach((user) => {
      const companyId = extractCompanyIdFromUser(user);
      if (companyId) {
        ids.add(companyId);
      }
    });

    return Array.from(ids);
  }, [users]);

  useEffect(() => {
    const missingIds = companyIds.filter((id) => !companyNames[id]);

    if (missingIds.length === 0) {
      return undefined;
    }

    const controller = new AbortController();
    let isActive = true;

    const loadCompanies = async () => {
      const entries = await Promise.all(
        missingIds.map(async (companyId) => {
          try {
            const response = await fetch(getApiUrl(`empresas/${companyId}`), {
              headers: { Accept: "application/json" },
              signal: controller.signal,
            });

            if (!response.ok) {
              if (response.status === 404) {
                return [companyId, `Empresa ${companyId}`] as const;
              }
              throw new Error(`Falha ao carregar empresa ${companyId} (${response.status}).`);
            }

            const payload = await response.json();
            const companyData = parseCompanyPayload(payload);
            const resolvedName =
              resolveCompanyNameFromData(companyData) ?? `Empresa ${companyId}`;

            return [companyId, resolvedName] as const;
          } catch (fetchError) {
            if (controller.signal.aborted) {
              return null;
            }

            console.error(`Erro ao carregar empresa ${companyId}:`, fetchError);
            return [companyId, `Empresa ${companyId}`] as const;
          }
        }),
      );

      if (!isActive) {
        return;
      }

      setCompanyNames((previous) => {
        const next = { ...previous };

        entries.forEach((entry) => {
          if (!entry) {
            return;
          }

          const [companyId, companyName] = entry;
          next[companyId] = companyName;
        });

        return next;
      });
    };

    void loadCompanies();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [companyIds, companyNames]);

  const normalizedUsers = useMemo<DisplayUser[]>(() => {
    return users.map((user, index) => {
      const id = getNormalizedId(user, index);

      const nameCandidate =
        typeof user.nome_completo === "string" && user.nome_completo.trim().length > 0
          ? user.nome_completo.trim()
          : undefined;
      const emailCandidate =
        typeof user.email === "string" && user.email.trim().length > 0
          ? user.email.trim()
          : undefined;
      const displayName = nameCandidate ?? emailCandidate ?? `Usuário ${index + 1}`;

      const { name: companyName } = resolveCompanyNameFromUser(user, companyNames);
      const { name: profileName } = resolveProfileNameFromUser(user, profileNames);
      const role = profileName;
      const roleNormalized = role.toLowerCase();

      const lastLogin =
        typeof user.ultimo_login === "string" && user.ultimo_login.trim().length > 0
          ? user.ultimo_login
          : null;

      const searchText = [displayName, emailCandidate ?? "", companyName, role]
        .map((part) => part.toLowerCase())
        .join(" ");

      return {
        id,
        displayName,
        email: emailCandidate ?? "",
        companyName,
        role,
        roleNormalized,
        isActive: normalizeStatus(user.status),
        lastLogin,
        searchText,
      } satisfies DisplayUser;
    });
  }, [companyNames, profileNames, users]);

  const usersById = useMemo(() => {
    return new Map(
      users.map((user, index) => {
        return [getNormalizedId(user, index), user] as const;
      })
    );
  }, [users]);

  const viewUser = useMemo(() => {
    if (!viewUserId) {
      return null;
    }

    return normalizedUsers.find((user) => user.id === viewUserId) ?? null;
  }, [normalizedUsers, viewUserId]);

  const editUser = useMemo(() => {
    if (!editUserId) {
      return null;
    }

    return normalizedUsers.find((user) => user.id === editUserId) ?? null;
  }, [normalizedUsers, editUserId]);

  useEffect(() => {
    if (!editUser) {
      setEditForm({
        displayName: "",
        email: "",
        companyId: "",
        roleId: "",
        isActive: true,
      });
      return;
    }

    const rawUser = usersById.get(editUser.id);
    const { id: resolvedCompanyId, name: resolvedCompanyName } = resolveCompanyNameFromUser(
      rawUser,
      companyNames,
    );

    if (
      resolvedCompanyId &&
      resolvedCompanyName &&
      resolvedCompanyName !== "Sem empresa"
    ) {
      setCompanyNames((previous) => {
        if (previous[resolvedCompanyId]) {
          return previous;
        }

        return {
          ...previous,
          [resolvedCompanyId]: resolvedCompanyName,
        };
      });
    }

    const name =
      typeof rawUser?.nome_completo === "string" && rawUser.nome_completo.trim().length > 0
        ? rawUser.nome_completo.trim()
        : editUser.displayName;
    const email =
      typeof rawUser?.email === "string" && rawUser.email.trim().length > 0
        ? rawUser.email.trim()
        : editUser.email;
    const companyId = resolvedCompanyId ?? "";
    const { id: resolvedProfileId, name: resolvedProfileName } = resolveProfileNameFromUser(
      rawUser,
      profileNames,
    );
    if (
      resolvedProfileId &&
      resolvedProfileName &&
      resolvedProfileName !== "Sem perfil"
    ) {
      setProfileNames((previous) => {
        if (previous[resolvedProfileId]) {
          return previous;
        }

        return {
          ...previous,
          [resolvedProfileId]: resolvedProfileName,
        };
      });
    }
    const roleId = resolvedProfileId ?? "";
    const isActive = editUser.isActive;

    setEditForm({
      displayName: name,
      email,
      companyId,
      roleId,
      isActive,
    });
  }, [companyNames, editUser, profileNames, usersById]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    let result = [...normalizedUsers];

    result.sort((a, b) => {
      const companyA = (a.companyName || '').toLowerCase();
      const companyB = (b.companyName || '').toLowerCase();
      const companyCompare = companyA.localeCompare(companyB, 'pt-BR');
      if (companyCompare !== 0) return companyCompare;

      const nameA = (a.displayName || '').toLowerCase();
      const nameB = (b.displayName || '').toLowerCase();
      return nameA.localeCompare(nameB, 'pt-BR');
    });

    if (!term) {
      return result;
    }

    return result.filter((user) => user.searchText.includes(term));
  }, [normalizedUsers, searchTerm]);

  const stats = useMemo(() => {
    const total = normalizedUsers.length;
    let active = 0;
    let admin = 0;
    const roleCounts = new Map<string, number>();

    normalizedUsers.forEach((user) => {
      if (user.isActive) {
        active += 1;
      }

      if (user.roleNormalized.includes("admin")) {
        admin += 1;
      }

      const roleKey = user.role;
      roleCounts.set(roleKey, (roleCounts.get(roleKey) ?? 0) + 1);
    });

    const roleDistribution = Array.from(roleCounts.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }

        return a.role.localeCompare(b.role, "pt-BR");
      });

    return {
      totalUsers: total,
      activeUsers: active,
      adminUsers: admin,
      inactiveUsers: total - active,
      activePercentage: total > 0 ? (active / total) * 100 : 0,
      roleDistribution,
    };
  }, [normalizedUsers]);

  const activePercentageLabel = stats.totalUsers > 0
    ? `${stats.activePercentage.toFixed(1)}% do total`
    : "0% do total";

  const companySelectPlaceholder = isLoadingCompanyOptions
    ? "Carregando empresas..."
    : companyOptions.length === 0
      ? "Nenhuma empresa disponível"
      : "Selecione a empresa";

  const profileSelectPlaceholder = isLoadingProfileOptions
    ? "Carregando perfis..."
    : profileOptions.length === 0
      ? "Nenhum perfil disponível"
      : "Selecione o perfil";

  const extraCompanyOption = useMemo(() => {
    if (!editForm.companyId) {
      return null;
    }

    if (companyOptions.some((option) => option.id === editForm.companyId)) {
      return null;
    }

    const label = companyNames[editForm.companyId];

    if (label && label.trim().length > 0) {
      return { id: editForm.companyId, label: label.trim() } satisfies SelectOption;
    }

    return { id: editForm.companyId, label: `Empresa ${editForm.companyId}` } satisfies SelectOption;
  }, [companyNames, companyOptions, editForm.companyId]);

  const extraProfileOption = useMemo(() => {
    if (!editForm.roleId) {
      return null;
    }

    if (profileOptions.some((option) => option.id === editForm.roleId)) {
      return null;
    }

    const label = profileNames[editForm.roleId];

    if (label && label.trim().length > 0) {
      return { id: editForm.roleId, label: label.trim() } satisfies SelectOption;
    }

    return { id: editForm.roleId, label: `Perfil ${editForm.roleId}` } satisfies SelectOption;
  }, [editForm.roleId, profileNames, profileOptions]);

  const handleRetry = useCallback(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleOpenViewUser = useCallback((userId: string) => {
    setViewUserId(userId);
  }, []);

  const handleOpenEditUser = useCallback((userId: string) => {
    setEditUserId(userId);
  }, []);

  const handleEditFormChange = useCallback(<Key extends keyof EditFormState>(key: Key, value: EditFormState[Key]) => {
    setEditForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }, []);

  const handleResetPassword = useCallback(
    async (userId: string) => {
      setResettingUserId(userId);

      try {
        const response = await fetch(getApiUrl(`users/${userId}/reset-password`), {
          method: "POST",
          headers: { Accept: "application/json" },
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const errorMessage =
            payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error: string }).error
              : `Falha ao redefinir a senha (código ${response.status}).`;

          toast({
            title: "Erro ao redefinir senha",
            description: errorMessage,
            variant: "destructive",
          });
          return;
        }

        const successMessage =
          payload && typeof payload === "object" && typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : "Senha redefinida com sucesso.";

        toast({
          title: "Senha redefinida",
          description: successMessage,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível redefinir a senha.";
        toast({
          title: "Erro ao redefinir senha",
          description: message,
          variant: "destructive",
        });
      } finally {
        setResettingUserId((current) => (current === userId ? null : current));
      }
    },
    [toast],
  );

  const handleSubmitEditForm = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!editUserId) {
        return;
      }

      const normalizedName = editForm.displayName.trim();
      const normalizedEmail = editForm.email.trim();
      const normalizedCompanyId = editForm.companyId.trim();
      const normalizedRoleId = editForm.roleId.trim();
      const normalizedCompanyName =
        normalizedCompanyId.length > 0
          ? (companyNames[normalizedCompanyId]?.trim() ?? `Empresa ${normalizedCompanyId}`)
          : "";
      const normalizedRoleName =
        normalizedRoleId.length > 0
          ? (profileNames[normalizedRoleId]?.trim() ?? `Perfil ${normalizedRoleId}`)
          : "";

      setUsers((previous) =>
        previous.map((user, index) => {
          if (getNormalizedId(user, index) !== editUserId) {
            return user;
          }

          return {
            ...user,
            nome_completo: normalizedName.length > 0 ? normalizedName : null,
            email: normalizedEmail.length > 0 ? normalizedEmail : null,
            empresa_id: normalizedCompanyId.length > 0 ? normalizedCompanyId : null,
            empresa: normalizedCompanyName.length > 0 ? normalizedCompanyName : null,
            empresa_nome: normalizedCompanyName.length > 0 ? normalizedCompanyName : null,
            idperfil: normalizedRoleId.length > 0 ? normalizedRoleId : null,
            perfil: normalizedRoleName.length > 0 ? normalizedRoleName : null,
            perfil_nome: normalizedRoleName.length > 0 ? normalizedRoleName : null,
            status: editForm.isActive,
          } satisfies ApiUser;
        })
      );

      toast({
        title: "Usuário atualizado",
        description: "As informações do usuário foram atualizadas localmente.",
      });

      setEditUserId(null);
    },
    [companyNames, editForm, editUserId, profileNames, toast]
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Usuários
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestão de acesso e permissões do sistema
          </p>
        </div>
        <Button asChild className="w-full md:w-auto shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
          <Link to={routes.admin.newUser}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Usuários</CardTitle>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">Base total cadastrada</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Usuários Ativos</CardTitle>
            <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {isLoading ? "--" : activePercentageLabel}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Administradores</CardTitle>
            <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : stats.adminUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">Privilégios elevados</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Usuários Inativos</CardTitle>
            <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
              <UserX className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : stats.inactiveUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">Acesso revogado</p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card className="border-muted/60 shadow-sm">
        <CardHeader>
          <CardTitle>Diretório de Usuários</CardTitle>
          <CardDescription>Visualize e gerencie todos os usuários do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background/50 focus:bg-background transition-colors"
              />
            </div>
          </div>

          {error ? (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>Erro ao carregar usuários</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <Button variant="outline" size="sm" className="ml-2 h-7 text-xs bg-background/50 border-destructive/20 hover:bg-destructive/10" onClick={handleRetry}>
                  Tentar novamente
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="rounded-lg border bg-background/50 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último Acesso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs mt-2 block">Carregando diretório...</span>
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="h-8 w-8 text-muted-foreground/30" />
                        <p>{searchTerm
                          ? "Nenhum usuário encontrado para os termos informados."
                          : "Nenhum usuário cadastrado até o momento."}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const lastLoginDate = user.lastLogin ? new Date(user.lastLogin) : null;
                    const hasValidLastLogin =
                      lastLoginDate instanceof Date && !Number.isNaN(lastLoginDate.getTime());

                    return (
                      <TableRow key={user.id} className="group hover:bg-muted/50 transition-colors">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {user.displayName}
                            </span>
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {user.email || "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium text-sm text-foreground/80">{user.companyName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={resolveRoleBadgeVariant(user.role)} className="uppercase text-[10px] tracking-wider">
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.isActive ? (
                            <div className="flex items-center gap-1.5">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                              </span>
                              <span className="text-xs font-medium text-muted-foreground">Ativo</span>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground border-destructive/20 text-destructive text-[10px]">
                              Inativo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasValidLastLogin ? (
                            <div className="flex flex-col text-xs text-muted-foreground">
                              <span>{lastLoginDate!.toLocaleDateString("pt-BR")}</span>
                              <span className="opacity-70">
                                {lastLoginDate!.toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Nunca acessou</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              onClick={() => handleOpenViewUser(user.id)}
                              title="Ver Perfil"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                              onClick={() => handleOpenEditUser(user.id)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                              onClick={() => handleResetPassword(user.id)}
                              disabled={resettingUserId === user.id}
                              title="Redefinir senha"
                            >
                              <Key className={`h-4 w-4 ${resettingUserId === user.id ? 'animate-spin' : ''}`} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* User Management Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-muted/60 shadow-sm">
          <CardHeader>
            <CardTitle>Gerenciamento de Acesso</CardTitle>
            <CardDescription>Ferramentas administrativas para controle de permissões em massa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start h-auto py-3 px-4" variant="outline">
              <Shield className="h-5 w-5 mr-3 text-muted-foreground" />
              <div className="text-left">
                <span className="block font-medium text-foreground">Gerenciar Permissões</span>
                <span className="block text-xs text-muted-foreground font-normal">Configurar níveis de acesso e roles</span>
              </div>
            </Button>
            <Button className="w-full justify-start h-auto py-3 px-4" variant="outline">
              <UserCheck className="h-5 w-5 mr-3 text-muted-foreground" />
              <div className="text-left">
                <span className="block font-medium text-foreground">Ativar Usuários em Lote</span>
                <span className="block text-xs text-muted-foreground font-normal">Reativar acesso para múltiplos usuários</span>
              </div>
            </Button>
            <Button className="w-full justify-start h-auto py-3 px-4" variant="outline">
              <UserX className="h-5 w-5 mr-3 text-muted-foreground" />
              <div className="text-left">
                <span className="block font-medium text-foreground">Revisar Usuários Inativos</span>
                <span className="block text-xs text-muted-foreground font-normal">Auditoria de contas sem acesso recente</span>
              </div>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-muted/60 shadow-sm">
          <CardHeader>
            <CardTitle>Distribuição por Função</CardTitle>
            <CardDescription>Visão geral dos perfis de acesso cadastrados</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-40 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Carregando estatísticas...</p>
              </div>
            ) : stats.roleDistribution.length === 0 ? (
              <div className="h-40 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Nenhum dado disponível.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.roleDistribution.map(({ role, count }) => (
                  <div key={role} className="flex justify-between items-center group">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${resolveRoleBadgeVariant(role) === 'default' ? 'bg-primary' : 'bg-muted-foreground'}`}></div>
                      <span className="text-sm font-medium">{role}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/60 rounded-full transition-all duration-500"
                          style={{ width: `${(count / stats.totalUsers) * 100}%` }}
                        />
                      </div>
                      <Badge variant="secondary" className="font-mono text-xs w-10 justify-center">{count}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(viewUser)} onOpenChange={(open) => (!open ? setViewUserId(null) : undefined)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {viewUser ? `Perfil de ${viewUser.displayName}` : "Perfil do usuário"}
            </DialogTitle>
            <DialogDescription>
              Visualize os dados cadastrais do usuário selecionado.
            </DialogDescription>
          </DialogHeader>

          {viewUser ? (
            <div className="space-y-6 pt-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                  {viewUser.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold">{viewUser.displayName}</h3>
                  <p className="text-sm text-muted-foreground">{viewUser.email || "Sem e-mail cadastrado"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Empresa</p>
                  <p className="font-medium text-sm">{viewUser.companyName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Perfil</p>
                  <Badge variant={resolveRoleBadgeVariant(viewUser.role)}>{viewUser.role}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Status</p>
                  {viewUser.isActive ? (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium text-sm">
                      <UserCheck className="h-4 w-4" /> Ativo
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                      <UserX className="h-4 w-4" /> Inativo
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Último Acesso</p>
                  {(() => {
                    if (!viewUser.lastLogin) {
                      return <p className="font-medium text-sm text-muted-foreground italic">Nunca acessou</p>;
                    }

                    const lastLoginDate = new Date(viewUser.lastLogin);
                    if (Number.isNaN(lastLoginDate.getTime())) {
                      return <p className="font-medium text-sm">Data inválida</p>;
                    }

                    return (
                      <p className="font-medium text-sm">
                        {lastLoginDate.toLocaleDateString("pt-BR")} às {lastLoginDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    );
                  })()}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editUser)} onOpenChange={(open) => (!open ? setEditUserId(null) : undefined)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editUser ? `Editar ${editUser.displayName}` : "Editar usuário"}
            </DialogTitle>
            <DialogDescription>
              Atualize as informações básicas do usuário. As alterações são aplicadas imediatamente.
            </DialogDescription>
          </DialogHeader>

          {editUser ? (
            <form className="space-y-5 py-4" onSubmit={handleSubmitEditForm}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit-user-name">Nome completo</Label>
                  <Input
                    id="edit-user-name"
                    value={editForm.displayName}
                    onChange={(event) => handleEditFormChange("displayName", event.target.value)}
                    placeholder="Nome do usuário"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit-user-email">E-mail</Label>
                  <Input
                    id="edit-user-email"
                    type="email"
                    value={editForm.email}
                    onChange={(event) => handleEditFormChange("email", event.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label htmlFor="edit-user-company">Empresa</Label>
                  <Select
                    value={editForm.companyId}
                    onValueChange={(value) => handleEditFormChange("companyId", value)}
                    disabled={isLoadingCompanyOptions && companyOptions.length === 0}
                  >
                    <SelectTrigger id="edit-user-company">
                      <SelectValue placeholder={companySelectPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {extraCompanyOption ? (
                        <SelectItem value={extraCompanyOption.id}>
                          {extraCompanyOption.label}
                        </SelectItem>
                      ) : null}
                      {companyOptions.length === 0 && !extraCompanyOption ? (
                        <SelectItem disabled value="__no_companies__">
                          Nenhuma empresa disponível
                        </SelectItem>
                      ) : null}
                      {companyOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label htmlFor="edit-user-role">Perfil</Label>
                  <Select
                    value={editForm.roleId}
                    onValueChange={(value) => handleEditFormChange("roleId", value)}
                    disabled={isLoadingProfileOptions && profileOptions.length === 0}
                  >
                    <SelectTrigger id="edit-user-role">
                      <SelectValue placeholder={profileSelectPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {extraProfileOption ? (
                        <SelectItem value={extraProfileOption.id}>
                          {extraProfileOption.label}
                        </SelectItem>
                      ) : null}
                      {profileOptions.length === 0 && !extraProfileOption ? (
                        <SelectItem disabled value="__no_profiles__">
                          Nenhum perfil disponível
                        </SelectItem>
                      ) : null}
                      {profileOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
                <div className="space-y-0.5">
                  <Label className="text-base" htmlFor="edit-user-status">
                    Acesso Ativo
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Desative para bloquear o login deste usuário.
                  </p>
                </div>
                <Switch
                  id="edit-user-status"
                  checked={editForm.isActive}
                  onCheckedChange={(checked) => handleEditFormChange("isActive", checked)}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditUserId(null)}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar alterações</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}