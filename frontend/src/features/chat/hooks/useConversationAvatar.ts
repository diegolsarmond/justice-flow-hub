import { useEffect, useState } from "react";
import { authFetch } from "@/features/auth/authFetch";
import { getApiUrl } from "@/lib/api";

/**
 * Retorna a URL do avatar da conversa. Para data: e blob: usa direto.
 * Para http/https usa o proxy autenticado (evita CORS/auth na UAZAPI).
 */
export function useConversationAvatar(
  conversationId: string | undefined,
  rawAvatar: string | undefined | null,
): string | null {
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);

  const needsProxy =
    typeof rawAvatar === "string" &&
    rawAvatar.trim().length > 0 &&
    (rawAvatar.startsWith("http://") || rawAvatar.startsWith("https://"));

  useEffect(() => {
    if (!needsProxy || !conversationId?.trim()) {
      setProxyUrl(null);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const baseProxy = getApiUrl(`conversations/${encodeURIComponent(conversationId)}/avatar`);
    const rawTrimmed = typeof rawAvatar === "string" ? rawAvatar.trim() : "";
    const proxyApiUrl =
      rawTrimmed && (rawTrimmed.startsWith("http://") || rawTrimmed.startsWith("https://"))
        ? `${baseProxy}?url=${encodeURIComponent(rawTrimmed)}`
        : baseProxy;

    authFetch(proxyApiUrl, { signal: controller.signal })
      .then((res) => {
        // 204 = no avatar available; any non-2xx = error
        if (!isMounted || !res.ok || res.status === 204) return null;
        return res.blob();
      })
      .then((blob) => {
        if (!isMounted || !blob || blob.size === 0) return;
        const url = URL.createObjectURL(blob);
        setProxyUrl(url);
      })
      .catch(() => {
        setProxyUrl(null);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [needsProxy, conversationId, rawAvatar]);

  // Revogar object URL ao desmontar ou quando mudar
  useEffect(() => {
    return () => {
      if (proxyUrl) URL.revokeObjectURL(proxyUrl);
    };
  }, [proxyUrl]);

  if (!rawAvatar || typeof rawAvatar !== "string") return null;
  const trimmed = rawAvatar.trim();
  if (!trimmed) return null;

  // data: ou blob: - usa direto
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  // http/https - usa proxy (carregado via hook)
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return proxyUrl ?? null;
  }

  return null;
}
