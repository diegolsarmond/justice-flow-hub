import { supabase } from "@/lib/supabase";

const getStoredAuthToken = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

const buildAuthHeaders = async (headers?: HeadersInit): Promise<HeadersInit> => {
  const token = await getStoredAuthToken();
  if (!token) {
    return headers ?? {};
  }

  const resolved = new Headers(headers);
  resolved.set("Authorization", `Bearer ${token}`);
  return resolved;
};

export const authFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const headers = await buildAuthHeaders(init?.headers);
  return fetch(input, { ...init, headers });
};
