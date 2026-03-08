import { getApiUrl } from "@/lib/api";

const JSON_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export interface Intimacao {
  id: number | string;
  siglaTribunal: string | null;
  external_id: string | null;
  numero_processo: string | null;
  nomeOrgao: string | null;
  tipoComunicacao: string | null;
  texto: string | null;
  prazo: string | null;
  data_disponibilizacao: string | null;
  created_at: string | null;
  updated_at: string | null;
  meio: string | null;
  link: string | null;
  tipodocumento: string | null;
  nomeclasse: string | null;
  codigoclasse: string | null;
  numerocomunicacao: string | null;
  ativo: boolean | null;
  hash: string | null;
  status: string | null;
  motivo_cancelamento: string | null;
  data_cancelamento: string | null;
  destinatarios: unknown;
  destinatarios_advogados: unknown;
  idusuario: number | null;
  idempresa: number | null;
  idusuario_leitura: number | null;
  lida_em: string | null;
  nao_lida: boolean | null;
  arquivada: boolean | null;
}

export interface MarkIntimacaoAsReadResponse {
  id: number;
  nao_lida: boolean;
  updated_at: string;
  idusuario_leitura: number | null;
  lida_em: string | null;
}

export interface SyncIntimacoesResponse {
  triggered: boolean;
  message?: string;
}

async function fetchJson<T>(url: string, { signal }: { signal?: AbortSignal } = {}): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: JSON_HEADERS,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar dados (${response.status})`);
  }

  return (await response.json()) as T;
}

export async function fetchIntimacoes(signal?: AbortSignal): Promise<Intimacao[]> {
  const payload = await fetchJson<unknown>(
    getApiUrl("intimacoes?limit=100&order=data_disponibilizacao&orderDirection=desc"),
    { signal }
  );

  // O backend CRUD controller retorna { data: [...], total, page, limit, totalPages }
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const wrapped = payload as { data?: unknown };
    if (Array.isArray(wrapped.data)) {
      return wrapped.data as Intimacao[];
    }
  }

  if (Array.isArray(payload)) {
    return payload as Intimacao[];
  }

  throw new Error("Resposta inválida ao carregar intimações.");
}

export async function archiveIntimacao(
  id: number | string,
): Promise<{ id: number; arquivada: boolean; updated_at: string }>
{
  const response = await fetch(getApiUrl(`intimacoes/${id}/archive`), {
    method: "PATCH",
    headers: JSON_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Falha ao arquivar intimação (${response.status}).`);
  }

  return (await response.json()) as { id: number; arquivada: boolean; updated_at: string };
}

export async function markIntimacaoAsRead(
  id: number | string,
): Promise<MarkIntimacaoAsReadResponse>
{
  const response = await fetch(getApiUrl(`intimacoes/${id}/read`), {
    method: "PATCH",
    headers: JSON_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Falha ao marcar intimação como lida (${response.status}).`);
  }

  return (await response.json()) as MarkIntimacaoAsReadResponse;
}

export async function markAllIntimacoesAsRead(): Promise<{ success: boolean; count: number }> {
  const response = await fetch(getApiUrl("intimacoes/mark-all-read"), {
    method: "PATCH",
    headers: JSON_HEADERS,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao marcar todas como lidas (${response.status}): ${errorText}`);
  }

  return (await response.json()) as { success: boolean; count: number };
}

export async function syncIntimacoes(): Promise<SyncIntimacoesResponse>
{
  const response = await fetch(getApiUrl("intimacoes/sync"), {
    method: "POST",
    headers: JSON_HEADERS,
  });

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error?: unknown }).error)
        : `Não foi possível atualizar as intimações (HTTP ${response.status}).`;
    throw new Error(message);
  }

  const body =
    payload && typeof payload === "object"
      ? (payload as { triggered?: unknown; message?: unknown })
      : null;

  const triggered = Boolean(body?.triggered);
  const message =
    typeof body?.message === "string"
      ? body.message
      : triggered
        ? "Sincronização de intimações concluída com sucesso."
        : "Uma sincronização de intimações já está em andamento.";

  return { triggered, message };
}

export async function fetchUnreadIntimacoesCount(): Promise<number> {
  const response = await fetch(getApiUrl("intimacoes/unread-count"), {
    method: "GET",
    headers: JSON_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar contador de intimações (${response.status}).`);
  }

  const payload = (await response.json()) as { unread?: unknown } | null;
  const value = typeof payload?.unread === "number"
    ? payload.unread
    : typeof payload?.unread === "string"
      ? Number.parseInt(payload.unread, 10)
      : null;
  const normalized = typeof value === "number" && Number.isFinite(value) ? value : null;
  return normalized !== null ? Math.max(0, Math.trunc(normalized)) : 0;
}
