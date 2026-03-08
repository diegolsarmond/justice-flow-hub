import { getApiUrl } from "@/lib/api";

const JSON_HEADERS: Record<string, string> = {
  Accept: "application/json",
};

export async function fetchUnreadProcessosCount(): Promise<number> {
  const response = await fetch(getApiUrl("processos/unread-count"), {
    method: "GET",
    headers: JSON_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar contador de processos (${response.status}).`);
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
