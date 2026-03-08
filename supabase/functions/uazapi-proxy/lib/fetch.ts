import { UAZAPI_FETCH_TIMEOUT_MS } from "./constants.ts";

/** fetch com timeout; ao estourar, o AbortController aborta e a promise rejeita. */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = UAZAPI_FETCH_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}
