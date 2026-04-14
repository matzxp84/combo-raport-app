import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
};

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
};

export const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = "combo-auth-token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const authFetch = useCallback(
    async (input: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const t = token ?? localStorage.getItem(TOKEN_KEY);
      if (t) headers.set("Authorization", `Bearer ${t}`);
      if (init?.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      return fetch(input, { ...init, headers });
    },
    [token],
  );

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!token) {
        setLoading(false);
        setUser(null);
        return;
      }
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("unauthorized");
        const data = (await res.json()) as { user: AuthUser };
        if (!cancelled) setUser(data.user);
      } catch {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false as const, error: data.error ?? "Błąd logowania" };
    }
    const data = (await res.json()) as { token: string; user: AuthUser };
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return { ok: true as const };
  }, []);

  const logout = useCallback(() => {
    const t = token;
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    if (t) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
      }).catch(() => {});
    }
  }, [token]);

  const value = useMemo<AuthState>(
    () => ({ user, token, loading, login, logout, authFetch }),
    [user, token, loading, login, logout, authFetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
