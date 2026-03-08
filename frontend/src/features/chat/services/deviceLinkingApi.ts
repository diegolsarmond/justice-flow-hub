import { getStoredAuthToken } from "@/features/auth/AuthProvider";
import { authFetch } from "@/features/auth/authFetch";
import { getApiUrl } from "@/lib/api";
import { sanitizeSessionName } from "@/lib/sessionName";

interface ApiEmpresa {
  id?: number | string | null;
  nome_empresa?: string | null;
  nome?: string | null;
  ativo?: boolean | string | number | null;
}

export interface CompanySummary {
  id: number;
  name: string;
  isActive: boolean;
}

export interface UazQrCodeResponse {
  qrCode: string | null;
  status: string;
  expiresAt: string | null;
  messages: string[];
}

const fallbackSessionName = "Jusconnect";

const withAuthHeaders = (headers?: HeadersInit): HeadersInit | undefined => {
  const token = getStoredAuthToken();
  if (!token) {
    return headers;
  }
  const normalized = new Headers(headers ?? undefined);
  normalized.set("Authorization", `Bearer ${token}`);
  return normalized;
};

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toBooleanOrUndefined = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (["1", "true", "sim", "ativo", "yes", "y"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "nao", "não", "inativo", "no", "n"].includes(normalized)) {
      return false;
    }
  }
  return undefined;
};

export const deriveSessionName = (companyName?: string | null): string => {
  const sanitized = sanitizeSessionName(companyName);
  if (sanitized) {
    return sanitized;
  }
  return fallbackSessionName;
};

export const fetchPreferredCompany = async (): Promise<CompanySummary | null> => {
  const response = await authFetch(getApiUrl("empresas"), { headers: { Accept: "application/json" } });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Não foi possível carregar as empresas configuradas.");
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    return null;
  }

  const companies: CompanySummary[] = [];

  for (const item of payload) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as ApiEmpresa;
    const id = toNumberOrNull(record.id);
    const name = normalizeString(record.nome_empresa) ?? normalizeString(record.nome);

    if (id === null || !name) {
      continue;
    }

    const isActive = toBooleanOrUndefined(record.ativo) ?? true;
    companies.push({ id, name, isActive });
  }

  if (companies.length === 0) {
    return null;
  }

  const activeCompany = companies.find((company) => company.isActive);
  return activeCompany ?? companies[0]!;
};

const normalizeQrStatus = (value: unknown): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return "pending";
};

const normalizeQrCode = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
};

const normalizeExpiration = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
};

const normalizeMessages = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : undefined))
      .filter((entry): entry is string => Boolean(entry && entry.length > 0));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  return [];
};

const buildDefaultQrCodeResponse = (
  overrides?: Partial<UazQrCodeResponse>,
): UazQrCodeResponse => ({
  qrCode: null,
  status: "pending",
  expiresAt: null,
  messages: [],
  ...overrides,
});

export const fetchUazQrCode = async (): Promise<UazQrCodeResponse> => {
  const response = await fetch(getApiUrl("conversations/providers/uaz/qr"), {
    headers: withAuthHeaders({ Accept: "application/json" }),

  });

  if (response.status === 204) {
    return buildDefaultQrCodeResponse({
      status: "pending",
      messages: [
        "Aguardando a configuração da instância do WhatsApp. Gere um novo QR Code após habilitar o módulo.",
      ],
    });
  }

  if (!response.ok) {
    if (response.status === 404) {
      return buildDefaultQrCodeResponse({
        status: "unconfigured",
        messages: [
          "Não encontramos nenhuma instância configurada. Solicite a criação ao suporte e tente novamente em seguida.",
        ],
      });
    }

    throw new Error("Não foi possível carregar o QR Code de autenticação.");
  }

  const payload = (await response.json()) as Record<string, unknown> | null;

  if (!payload) {
    return buildDefaultQrCodeResponse();
  }

  return buildDefaultQrCodeResponse({
    qrCode: normalizeQrCode(payload.qrCode),
    status: normalizeQrStatus(payload.status),
    expiresAt: normalizeExpiration(payload.expiresAt),
    messages: normalizeMessages(payload.messages),
  });
};

const parseDisconnectError = async (response: Response): Promise<string> => {
  let message = "Não foi possível desconectar a instância.";

  try {
    const payload = (await response.json()) as Record<string, unknown> | null;
    const error = typeof payload?.error === "string" ? payload.error.trim() : "";
    if (error) {
      return error;
    }
  } catch {}

  if (response.status === 429) {
    return "Muitas tentativas consecutivas. Aguarde antes de tentar novamente.";
  }

  if (response.status === 401) {
    return "Token inválido. Gere novas credenciais com o suporte antes de reconectar.";
  }

  return message;
};

export const disconnectWhatsappInstance = async (): Promise<string | null> => {
  const response = await authFetch(getApiUrl("conversations/providers/uaz/disconnect"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (response.status === 204) {
    return null;
  }

  if (response.status === 404) {
    return "Nenhuma instância ativa para desconectar.";
  }

  if (!response.ok) {
    throw new Error(await parseDisconnectError(response));
  }

  try {
    const payload = (await response.json()) as { message?: unknown } | null;
    const message = typeof payload?.message === "string" ? payload.message.trim() : "";
    return message || null;
  } catch {
    return null;
  }
};

export interface ProvisionInstanceResult {
  success: boolean;
  message: string;
  credentialId?: string;
  status?: string;
  alreadyExists?: boolean;
}

const parseProvisionError = async (response: Response): Promise<string> => {
  let message = "Não foi possível criar a instância.";

  try {
    const payload = (await response.json()) as Record<string, unknown> | null;
    const error = typeof payload?.error === "string" ? payload.error.trim() : "";
    if (error) {
      return error;
    }
  } catch {}

  if (response.status === 429) {
    return "Muitas tentativas consecutivas. Aguarde antes de tentar novamente.";
  }

  if (response.status === 401) {
    return "Token inválido. Faça login novamente.";
  }

  if (response.status === 400) {
    return "Usuário não está associado a uma empresa.";
  }

  return message;
};

export interface ProvisionInstanceOptions {
  force?: boolean;
}

export const provisionWhatsappInstance = async (
  options?: ProvisionInstanceOptions
): Promise<ProvisionInstanceResult> => {
  const response = await authFetch(getApiUrl("conversations/providers/uaz/provision"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ force: options?.force ?? false }),
  });

  if (!response.ok) {
    throw new Error(await parseProvisionError(response));
  }

  const payload = (await response.json()) as Record<string, unknown> | null;

  return {
    success: payload?.success === true,
    message: typeof payload?.message === "string" ? payload.message : "Instância criada.",
    credentialId: typeof payload?.credentialId === "string" ? payload.credentialId : undefined,
    status: typeof payload?.status === "string" ? payload.status : undefined,
    alreadyExists: payload?.alreadyExists === true,
  };
};
