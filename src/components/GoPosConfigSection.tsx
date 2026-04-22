import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/useAuth";

type GoPosFormState = {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  tokenBufferSeconds: number;
};

export function GoPosConfigSection() {
  const { authFetch } = useAuth();
  const [form, setForm] = useState<GoPosFormState>({
    clientId: "",
    clientSecret: "",
    baseUrl: "https://app.gopos.io",
    tokenBufferSeconds: 300,
  });
  const [source, setSource] = useState<"file" | "env" | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await authFetch("/api/admin/gopos/config");
      if (!res.ok) throw new Error("Błąd ładowania konfiguracji");
      const data = (await res.json()) as GoPosFormState & { source: "file" | "env" };
      setForm({ clientId: data.clientId, clientSecret: data.clientSecret, baseUrl: data.baseUrl, tokenBufferSeconds: data.tokenBufferSeconds });
      setSource(data.source);
    } catch (e) {
      setStatus({ ok: false, msg: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await authFetch("/api/admin/gopos/config", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Błąd zapisu");
      setStatus({ ok: true, msg: "Zapisano." });
      load();
    } catch (e) {
      setStatus({ ok: false, msg: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">GoPos API — dane uwierzytelniające</h2>
        {source && (
          <span className="text-xs text-muted-foreground">
            {source === "file" ? "Źródło: plik (data/gopos.json)" : "Źródło: zmienne środowiskowe (.env)"}
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Ładowanie…</p>}

      {!loading && (
        <form onSubmit={onSave} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gopos-client-id">Client ID</Label>
              <Input
                id="gopos-client-id"
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gopos-client-secret">Client Secret</Label>
              <Input
                id="gopos-client-secret"
                type="password"
                value={form.clientSecret}
                onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                placeholder="pozostaw ••••••• aby nie zmieniać"
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gopos-base-url">Base URL</Label>
              <Input
                id="gopos-base-url"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="https://app.gopos.io"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gopos-token-buffer">Token Buffer (sekundy)</Label>
              <Input
                id="gopos-token-buffer"
                type="number"
                min={0}
                max={3600}
                value={form.tokenBufferSeconds}
                onChange={(e) => setForm({ ...form, tokenBufferSeconds: Number(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Zapisywanie…" : "Zapisz"}
            </Button>
            {status && (
              <p className={`text-sm ${status.ok ? "text-emerald-500" : "text-destructive"}`}>
                {status.msg}
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Dane zapisywane są w <code>data/gopos.json</code> na serwerze i mają
            pierwszeństwo przed zmiennymi środowiskowymi. Po zmianie tokeny OAuth2
            zostaną odświeżone przy następnym zapytaniu do API.
          </p>
        </form>
      )}
    </section>
  );
}
