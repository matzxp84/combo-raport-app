import { createContext } from "react";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
};

export type AuthState = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
};

export const AuthContext = createContext<AuthState | null>(null);
