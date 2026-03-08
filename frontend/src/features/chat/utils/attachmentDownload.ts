import { authFetch } from "@/features/auth/authFetch";

const pickFirstString = (...values: Array<string | null | undefined>) => {
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

interface AttachmentDownloadPayload {
  temporaryUrl?: string | null;
  url?: string | null;
  downloadUrl?: string | null;
  href?: string | null;
  link?: string | null;
  data?: {
    temporaryUrl?: string | null;
    url?: string | null;
    downloadUrl?: string | null;
    href?: string | null;
    link?: string | null;
  } | null;
}

export async function requestTemporaryAttachmentUrl(
  downloadEndpoint?: string | null,
  fallbackUrl?: string | null,
  signal?: AbortSignal,
): Promise<string | undefined> {
  if (!downloadEndpoint) {
    return fallbackUrl ?? undefined;
  }

  try {
    const response = await authFetch(downloadEndpoint, {
      headers: { Accept: "application/json" },
      signal,
    });

    if (!response.ok) {
      return fallbackUrl ?? downloadEndpoint;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!/json/i.test(contentType)) {
      response.body?.cancel?.();
      return fallbackUrl ?? downloadEndpoint;
    }

    const payload = (await response.json()) as AttachmentDownloadPayload;
    const candidate = pickFirstString(
      payload.temporaryUrl,
      payload.url,
      payload.downloadUrl,
      payload.href,
      payload.link,
      payload.data?.temporaryUrl,
      payload.data?.url,
      payload.data?.downloadUrl,
      payload.data?.href,
      payload.data?.link,
    );

    return candidate ?? fallbackUrl ?? downloadEndpoint;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      return undefined;
    }
    console.error("Falha ao solicitar URL temporária do anexo:", error);
    return fallbackUrl ?? downloadEndpoint;
  }
}
