const AUTH_STORAGE_KEY = "jus-connect:auth";

const getStoredAuthToken = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { token?: unknown } | null;
    const token = typeof parsed?.token === "string" ? parsed.token.trim() : "";
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
};

const buildAuthHeaders = (headers?: HeadersInit): HeadersInit => {
  const token = getStoredAuthToken();
  if (!token) {
    return headers ?? {};
  }

  const resolved = new Headers(headers);
  resolved.set("Authorization", `Bearer ${token}`);
  return resolved;
};

export const authFetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const headers = buildAuthHeaders(init?.headers);
  return fetch(input, { ...init, headers });
};
