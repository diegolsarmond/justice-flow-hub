import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_TIMEOUT_MS, LAST_ACTIVITY_KEY } from "@/hooks/useAutoLogout";
import { ApiError, fetchCurrentUser, loginRequest } from "./api";
import { fetchUserProfile } from "./profileService";
import { sanitizeModuleList } from "./moduleUtils";
import { getSubscriptionStorageKeysToClear } from "./subscriptionStorage";
import type {
  AuthSubscription,
  AuthUser,
  LoginCredentials,
  LoginResponse,
  SubscriptionStatus,
} from "./types";

type RefreshTokenResult = "success" | "unauthorized" | "failed" | "skipped";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  logout: () => void;
  refreshUser: () => Promise<AuthUser>;
  refreshToken: () => Promise<RefreshTokenResult>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

let inMemoryAuthToken: string | null = null;

export const getStoredAuthToken = (): string | null => {
  return inMemoryAuthToken;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef<AuthUser | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const clearAuth = useCallback(() => {
    const previousUser = userRef.current;
    setUser(null);
    setToken(null);
    inMemoryAuthToken = null;
    userRef.current = null;
    setIsLoading(false);

    if (typeof window !== "undefined") {
      try {
        const storage = window.localStorage;
        const keysToClear = getSubscriptionStorageKeysToClear(previousUser);
        for (const key of keysToClear) {
          storage.removeItem(key);
        }
        storage.removeItem(LAST_ACTIVITY_KEY);
      } catch (error) {
        console.warn("Falha ao limpar registro de atividade", error);
      }
    }
  }, []);

  const loadProfile = useCallback(async (userId: string, accessToken: string) => {
    try {
      const profile = await fetchUserProfile(userId);
      if (profile) {
        setUser(profile);
        userRef.current = profile;
        setToken(accessToken);
        inMemoryAuthToken = accessToken;
      } else {
        clearAuth();
      }
    } catch (error) {
      console.warn("Failed to load profile", error);
      clearAuth();
    }
  }, [clearAuth]);

  // Listen to auth state changes
  useEffect(() => {
    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT" || !session) {
          clearAuth();
          return;
        }

        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "INITIAL_SESSION"
        ) {
          inMemoryAuthToken = session.access_token;
          setToken(session.access_token);

          // Use setTimeout to avoid Supabase deadlock warning
          setTimeout(() => {
            loadProfile(session.user.id, session.access_token);
          }, 0);
        }
      },
    );

    // THEN check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        inMemoryAuthToken = session.access_token;
        setToken(session.access_token);
        loadProfile(session.user.id, session.access_token).finally(() => {
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [clearAuth, loadProfile]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await loginRequest(credentials);
    // onAuthStateChange will handle setting the user/token
    return response;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    clearAuth();
  }, [clearAuth]);

  const refreshUser = useCallback(async () => {
    const profile = await fetchCurrentUser();
    setUser(profile);
    userRef.current = profile;
    return profile;
  }, []);

  const refreshAuthToken = useCallback(async (): Promise<RefreshTokenResult> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        clearAuth();
        return "unauthorized";
      }
      inMemoryAuthToken = data.session.access_token;
      setToken(data.session.access_token);
      return "success";
    } catch {
      return "failed";
    }
  }, [clearAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      isLoading,
      login,
      logout,
      refreshUser,
      refreshToken: refreshAuthToken,
    }),
    [user, token, isLoading, login, logout, refreshUser, refreshAuthToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
