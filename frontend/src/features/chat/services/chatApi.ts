import type {
  ConversationSummary,
  ContactSuggestion,
  Message,
  NewConversationInput,
  SendMessageInput,
  UpdateConversationPayload,
} from "../types";
import {
  mapClienteRecordToDisplayData,
  type ClienteRecord,
  type ClientDisplayData,
} from "@/lib/client-records";
import { getStoredAuthToken } from "@/features/auth/AuthProvider";
import { authFetch } from "@/features/auth/authFetch";
import { getApiUrl } from "@/lib/api";

const buildConversationPath = (conversationId: string, suffix?: string) => {
  const encodedId = encodeURIComponent(conversationId);
  return suffix ? `conversations/${encodedId}/${suffix}` : `conversations/${encodedId}`;
};

const extractErrorMessage = (rawBody: string, status: number): string => {
  const trimmed = rawBody.trim();
  if (!trimmed) {
    return `Erro de rede (${status})`;
  }

  if (trimmed.startsWith("<")) {
    return "O servidor retornou uma página HTML em vez de dados JSON. Faça login novamente ou recarregue a página.";
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown> | string;
    if (typeof parsed === "string") {
      return parsed;
    }
    const message = parsed?.message ?? parsed?.error;
    if (typeof message === "string" && message.trim().length > 0) {
      return message.trim();
    }
  } catch (error) {
    // Ignore JSON parse errors and fall back to returning the raw text below.
  }

  return trimmed;
};

const parseJson = async <T>(response: Response): Promise<T> => {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = /application\/json|\+json/i.test(contentType);
  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(extractErrorMessage(bodyText, response.status));
  }

  if (response.status === 204 || bodyText.trim().length === 0) {
    return {} as T;
  }

  if (!isJson) {
    throw new Error(
      "Resposta inválida do servidor: conteúdo inesperado recebido. Recarregue a página e tente novamente.",
    );
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch (error) {
    throw new Error(
      "Não foi possível interpretar a resposta do servidor. Recarregue a página e tente novamente.",
    );
  }
};

const extractDataArray = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object") {
    const rows = (payload as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows as T[];
    }

    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data as T[];
    }

    if (data && typeof data === "object") {
      const nestedRows = (data as { rows?: unknown }).rows;
      if (Array.isArray(nestedRows)) {
        return nestedRows as T[];
      }
    }
  }

  return [];
};

const pickFirstNonEmptyString = (
  ...values: Array<string | null | undefined>
): string | undefined => {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return undefined;
};

const getNameFromEmail = (value?: string | null): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const [localPart] = trimmed.split("@");
  if (!localPart) {
    return undefined;
  }
  const normalized = localPart.replace(/[._]+/g, " ").trim();
  return normalized.length > 0 ? normalized : undefined;
};

const withAuthHeaders = (headers?: HeadersInit): HeadersInit | undefined => {
  const token = getStoredAuthToken();
  if (!token) {
    return headers;
  }
  const normalized = new Headers(headers ?? undefined);
  normalized.set("Authorization", `Bearer ${token}`);
  return normalized;
};

export interface FetchConversationsParams {
  limit?: number;
  offset?: number;
  operator?: string;
  sort?: string;
}

export interface FetchConversationsResponse {
  chats: ConversationSummary[];
  total: number;
  hasMore: boolean;
  limit?: number;
  offset?: number;
}

export type ClientOption = ClientDisplayData;

interface ClientesApiResponse {
  data?: ClienteRecord[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export interface FetchClientOptionsParams {
  page?: number;
  pageSize?: number;
}

export interface FetchClientOptionsResult {
  clients: ClientOption[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_CLIENTS_PAGE_SIZE = 20;

export const fetchConversations = async (
  params?: FetchConversationsParams,
): Promise<FetchConversationsResponse> => {
  const url = new URL(getApiUrl("conversations"));
  if (typeof params?.limit === "number") {
    url.searchParams.set("limit", String(params.limit));
  }
  if (typeof params?.offset === "number") {
    url.searchParams.set("offset", String(params.offset));
  }
  if (params?.operator) {
    url.searchParams.set("operator", params.operator);
  }
  if (params?.sort) {
    url.searchParams.set("sort", params.sort);
  }
  const response = await authFetch(url.toString());
  return parseJson<FetchConversationsResponse>(response);
};

export type ProviderMessageRecord = Record<string, unknown>;

export interface ConversationMessagePage {
  messages: Message[];
  nextCursor?: string | null;
  nextOffset?: number | null;
  hasMore?: boolean;
}

export interface FindChatMessagesParams {
  conversationId: string;
  limit?: number;
  cursor?: string | null;
  offset?: number;
  lastMessageDate?: string | null;
}

export interface FindChatMessagesResponse {
  messages: Message[];
  cursor?: string | null;
  hasMore?: boolean;
  nextOffset?: number | null;
  lastMessageDate?: string | null;
}

export const findChatMessages = async (
  params: FindChatMessagesParams,
): Promise<FindChatMessagesResponse> => {
  const { conversationId, limit, cursor, offset } = params;

  if (typeof conversationId !== "string" || conversationId.trim().length === 0) {
    throw new Error("conversationId é obrigatório para carregar as mensagens.");
  }

  const page = await fetchConversationMessages(conversationId, {
    limit,
    cursor: typeof cursor === "string" && cursor.trim().length > 0 ? cursor : undefined,
    offset: typeof offset === "number" ? offset : undefined,
  });

  const messages = Array.isArray(page.messages) ? [...page.messages] : [];
  const lastMessageDate =
    messages.length > 0 && typeof messages[messages.length - 1]?.timestamp === "string"
      ? messages[messages.length - 1]!.timestamp
      : null;
  const nextOffset =
    typeof page.nextOffset === "number" && Number.isFinite(page.nextOffset)
      ? page.nextOffset
      : null;

  return {
    messages,
    cursor: page.nextCursor ?? null,
    hasMore:
      typeof page.hasMore === "boolean"
        ? page.hasMore
        : Boolean(page.nextCursor ?? nextOffset ?? undefined),
    nextOffset,
    lastMessageDate,
  };
};

interface FetchConversationMessagesOptions {
  cursor?: string | null;
  offset?: number | null;
  limit?: number;
  order?: "asc" | "desc";
}

export const fetchConversationMessages = async (
  conversationId: string,
  options?: FetchConversationMessagesOptions,
): Promise<ConversationMessagePage> => {
  const url = new URL(getApiUrl(`conversations/${encodeURIComponent(conversationId)}/messages`));
  if (options?.cursor) {
    url.searchParams.set("cursor", options.cursor);
  }
  if (typeof options?.offset === "number") {
    url.searchParams.set("offset", String(options.offset));
  }
  if (typeof options?.limit === "number") {
    url.searchParams.set("limit", String(options.limit));
  }
  if (options?.order === "asc" || options?.order === "desc") {
    url.searchParams.set("order", options.order);
  }
  const response = await authFetch(url.toString());
  return parseJson<ConversationMessagePage>(response);
};

export type SyncConversationMessagesResponse = ConversationMessagePage;

interface SyncConversationMessagesOptions {
  limit?: number;
  offset?: number | null;
  cursor?: string | null;
  order?: "asc" | "desc";
}

export const syncConversationMessages = async (
  conversationId: string,
  options?: SyncConversationMessagesOptions,
): Promise<SyncConversationMessagesResponse> => {
  const { limit, offset, cursor, order } = options ?? {};
  const payload: Record<string, number | string> = {};

  if (typeof limit === "number" && Number.isFinite(limit)) {
    payload.limit = Math.trunc(limit);
  }

  const resolvedOffset =
    typeof offset === "number" && Number.isFinite(offset) ? Math.trunc(offset) : undefined;

  if (typeof resolvedOffset === "number") {
    payload.offset = resolvedOffset;
  }

  if (typeof cursor === "string" && cursor.trim().length > 0) {
    payload.cursor = cursor.trim();
  }

  if (order === "asc" || order === "desc") {
    payload.order = order;
  }

  const response = await authFetch(getApiUrl("conversations/providers/uaz/sync"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, ...payload }),
  });
  return parseJson<SyncConversationMessagesResponse>(response);
};

export const sendConversationMessage = async (
  conversationId: string,
  payload: SendMessageInput,
): Promise<Message> => {
  const response = await authFetch(getApiUrl(buildConversationPath(conversationId, "messages")), {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return parseJson<Message>(response);
};

export interface ReactToMessagePayload {
  messageId: string;
  reaction: string;
  conversationId?: string;
}

export const reactToMessage = async (payload: ReactToMessagePayload): Promise<Message> => {
  const response = await authFetch(getApiUrl("message/reaction"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<Message>(response);
};

export interface EditMessagePayload {
  messageId: string;
  content: string;
  conversationId?: string;
}

export const editMessage = async (payload: EditMessagePayload): Promise<Message> => {
  const response = await authFetch(getApiUrl("message/edit"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<Message>(response);
};

export const markConversationRead = async (conversationId: string) => {
  const response = await authFetch(getApiUrl(buildConversationPath(conversationId, "read")), {
    method: "POST",
  });
  await parseJson(response);
};

export const setTypingState = async (conversationId: string, isTyping: boolean) => {
  const response = await authFetch(getApiUrl(buildConversationPath(conversationId, "typing")), {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ isTyping }),
  });
  await parseJson(response);
};

export const createConversation = async (
  payload: NewConversationInput,
): Promise<ConversationSummary> => {
  const response = await authFetch(getApiUrl(`conversations`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<ConversationSummary>(response);
};

export const updateConversation = async (
  conversationId: string,
  payload: UpdateConversationPayload,
): Promise<ConversationSummary> => {
  const response = await authFetch(getApiUrl(buildConversationPath(conversationId)), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<ConversationSummary>(response);
};

export const toggleConversationMute = async (
  conversationId: string,
  muted: boolean,
): Promise<ConversationSummary> => {
  const response = await authFetch(getApiUrl("chat/mute"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, muted }),
  });
  return parseJson<ConversationSummary>(response);
};

export const toggleConversationArchive = async (
  conversationId: string,
  archived: boolean,
): Promise<ConversationSummary> => {
  const response = await authFetch(getApiUrl("chat/archive"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, archived }),
  });
  return parseJson<ConversationSummary>(response);
};

export const toggleConversationPin = async (
  conversationId: string,
  pinned: boolean,
): Promise<ConversationSummary> => {
  const response = await authFetch(getApiUrl("chat/pin"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, pinned }),
  });
  return parseJson<ConversationSummary>(response);
};

export interface FetchContactSuggestionsParams {
  credentialId?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface FetchContactSuggestionsResponse {
  contacts: ContactSuggestion[];
  total?: number;
  limit?: number;
  offset?: number;
  hasMore?: boolean;
}

export const fetchContactSuggestions = async (
  params?: FetchContactSuggestionsParams,
): Promise<FetchContactSuggestionsResponse> => {
  const url = new URL(getApiUrl("contacts"));
  if (params?.search && params.search.trim().length > 0) {
    url.searchParams.set("search", params.search.trim());
  }
  if (params?.credentialId) {
    url.searchParams.set("credentialId", params.credentialId);
  }
  if (typeof params?.limit === "number") {
    url.searchParams.set("limit", String(params.limit));
  }
  if (typeof params?.offset === "number") {
    url.searchParams.set("offset", String(params.offset));
  }
  const response = await authFetch(url.toString());
  const result = await parseJson<FetchContactSuggestionsResponse>(response);
  const normalizedContacts = Array.isArray(result.contacts)
    ? result.contacts.map((contact) => ({
        ...contact,
        avatar: normalizeContactAvatar(contact.avatar),
      }))
    : [];
  return {
    ...result,
    contacts: normalizedContacts,
  };
};

export const fetchClientOptions = async (
  params?: FetchClientOptionsParams,
): Promise<FetchClientOptionsResult> => {
  const page = params?.page && params.page > 0 ? params.page : 1;
  const pageSize =
    params?.pageSize && params.pageSize > 0 ? params.pageSize : DEFAULT_CLIENTS_PAGE_SIZE;
  const url = new URL(getApiUrl("clientes"));
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));
  const response = await authFetch(url.toString());
  const payload = await parseJson<ClientesApiResponse | ClienteRecord[]>(response);
  const records = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];
  const clients = records.map(mapClienteRecordToDisplayData);
  const total =
    !Array.isArray(payload) && typeof payload?.total === "number"
      ? payload.total
      : clients.length;
  const resolvedPage =
    !Array.isArray(payload) && typeof payload?.page === "number" && payload.page > 0
      ? payload.page
      : page;
  const resolvedPageSize =
    !Array.isArray(payload) && typeof payload?.pageSize === "number" && payload.pageSize > 0
      ? payload.pageSize
      : pageSize;
  return {
    clients,
    total,
    page: resolvedPage,
    pageSize: resolvedPageSize,
  };
};

const normalizeContactAvatar = (value?: string | null): string => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const collapsed = trimmed.replace(/\s+/g, "");
  const normalized = trimmed.toLowerCase();
  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("blob:") ||
    trimmed.includes(";base64,")
  ) {
    return trimmed;
  }
  if (/^[a-z0-9+/=]+$/i.test(collapsed) && collapsed.length >= 16) {
    return `data:image/jpeg;base64,${collapsed}`;
  }
  return trimmed;
};

interface ApiUser {
  id?: number | string | null;
  id_usuario?: number | string | null;
  idUsuario?: number | string | null;
  idusuario?: number | string | null;
  usuario_id?: number | string | null;
  usuarioId?: number | string | null;
  user_id?: number | string | null;
  userId?: number | string | null;
  codigo?: number | string | null;
  nome_completo?: string | null;
  nome?: string | null;
  nome_usuario?: string | null;
  nomeusuario?: string | null;
  nomeUsuario?: string | null;
  nome_usuario_completo?: string | null;
  email?: string | null;
  perfil?: string | number | null;
  perfil_nome?: string | null;
  perfil_nome_exibicao?: string | null;
  perfil_descricao?: string | null;
  perfilDescricao?: string | null;
  funcao?: string | null;
  cargo?: string | null;
  papel?: string | null;
}

export interface ChatResponsibleOption {
  id: string;
  name: string;
  role?: string;
}

const extractUserArray = (payload: unknown): ApiUser[] => {
  const direct = extractDataArray<ApiUser>(payload);
  if (direct.length > 0) {
    return direct;
  }

  const visited = new Set<object>();
  const queue: unknown[] = [];

  if (payload && typeof payload === "object") {
    queue.push(payload);
  }

  const candidateKeys = [
    "usuarios",
    "usuarios_empresa",
    "usuariosEmpresa",
    "usuariosEmpresaRows",
    "lista",
    "list",
    "items",
    "result",
    "results",
    "response",
    "payload",
    "content",
    "records",
    "values",
    "body",
    "data",
    "rows",
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (Array.isArray(current)) {
      const objects = current.filter(
        (item): item is ApiUser => Boolean(item && typeof item === "object"),
      );
      if (objects.length > 0) {
        return objects;
      }
      continue;
    }

    if (typeof current !== "object") {
      continue;
    }

    if (visited.has(current as object)) {
      continue;
    }
    visited.add(current as object);

    const extracted = extractDataArray<ApiUser>(current);
    if (extracted.length > 0) {
      return extracted;
    }

    for (const key of candidateKeys) {
      if (key in (current as Record<string, unknown>)) {
        queue.push((current as Record<string, unknown>)[key]);
      }
    }

    for (const value of Object.values(current as Record<string, unknown>)) {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return [];
};

const extractUserId = (user: ApiUser): string | undefined => {
  const candidates: Array<number | string | null | undefined> = [
    user.id,
    user.id_usuario,
    user.idUsuario,
    user.idusuario,
    user.usuario_id,
    user.usuarioId,
    user.user_id,
    user.userId,
    user.codigo,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(Math.trunc(candidate));
    }
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return undefined;
};

export const fetchChatResponsibles = async (): Promise<ChatResponsibleOption[]> => {
  const response = await authFetch(getApiUrl("usuarios/empresa"), {
    headers: { Accept: "application/json" },
  });
  const payload = await parseJson<unknown>(response);
  const data = extractUserArray(payload);
  const options: ChatResponsibleOption[] = [];
  const seen = new Set<string>();

  for (const user of data) {
    if (!user) {
      continue;
    }
    const id = extractUserId(user);
    if (!id || seen.has(id)) {
      continue;
    }
    const name =
      pickFirstNonEmptyString(
        user.nome_completo,
        user.nome,
        user.nome_usuario,
        user.nomeusuario,
        user.nomeUsuario,
        user.nome_usuario_completo,
      ) ??
      getNameFromEmail(user.email);
    if (!name) {
      continue;
    }

    const roleValue =
      pickFirstNonEmptyString(
        typeof user.perfil === "string" ? user.perfil : undefined,
        user.perfil_nome,
        user.perfil_nome_exibicao,
        user.perfil_descricao,
        user.perfilDescricao,
        user.funcao,
        user.cargo,
        user.papel,
      ) ??
      (typeof user.perfil === "number" && Number.isFinite(user.perfil)
        ? String(user.perfil)
        : undefined);

    seen.add(id);
    options.push({ id, name, role: roleValue });
  }

  return options.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
};

interface ApiEtiqueta {
  id: number | string;
  nome?: string | null;
  descricao?: string | null;
  nome_etiqueta?: string | null;
  etiqueta?: string | null;
}

export const fetchChatTags = async (): Promise<string[]> => {
  const response = await authFetch(getApiUrl("etiquetas"), {
    headers: { Accept: "application/json" },
  });
  const payload = await parseJson<unknown>(response);
  const data = extractDataArray<ApiEtiqueta>(payload);
  const tags = new Set<string>();

  for (const item of data) {
    if (!item) {
      continue;
    }
    const name = pickFirstNonEmptyString(item.nome, item.descricao, item.nome_etiqueta, item.etiqueta);
    if (!name) {
      continue;
    }
    tags.add(name);
  }

  return Array.from(tags).sort((a, b) => a.localeCompare(b, 'pt-BR'));
};
