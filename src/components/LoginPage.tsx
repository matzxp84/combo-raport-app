import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/useAuth";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await login(email, password);
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <img src="/vite.svg" alt="Logo" className="size-10" />
          <h1 className="text-lg font-semibold">Combo Raport</h1>
          <p className="text-xs text-muted-foreground">Zaloguj się, aby kontynuować</p>
        </div>
        <form className="flex flex-col gap-4" onSubmit={onSubmit} autoComplete="on">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-email">Login</Label>
            <Input
              id="login-email"
              name="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-password">Hasło</Label>
            <Input
              id="login-password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Logowanie…" : "Zaloguj"}
          </Button>
        </form>
      </div>
    </div>
  );
}
