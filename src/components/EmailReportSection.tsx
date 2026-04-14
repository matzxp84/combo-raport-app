import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/useAuth";
import type { AuthUser } from "@/contexts/AuthContext";

type Kind = "monthly" | "weekly";

type Schedule = {
  enabled: boolean;
  day: number;
  hour: number;
  minute: number;
  lastRunAt: string | null;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  user: string;
  pass: string;
  from: string;
};

type Config = {
  smtp: SmtpConfig;
  schedules: { monthly: Schedule; weekly: Schedule };
  templates: { monthly: string; weekly: string };
  customRecipients: string[];
  selectedUserIds: string[] | null;
};

const WEEKDAYS = [
  { id: 0, label: "Niedziela" },
  { id: 1, label: "Poniedziałek" },
  { id: 2, label: "Wtorek" },
  { id: 3, label: "Środa" },
  { id: 4, label: "Czwartek" },
  { id: 5, label: "Piątek" },
  { id: 6, label: "Sobota" },
];

export function EmailReportSection() {
  const { authFetch, user: me } = useAuth();
  const [config, setConfig] = useState<Config | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [kind, setKind] = useState<Kind>("monthly");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [testTo, setTestTo] = useState(me?.email ?? "");

  const loadConfig = useCallback(async () => {
    setErr(null);
    const [cRes, uRes] = await Promise.all([
      authFetch("/api/admin/email/config"),
      authFetch("/api/admin/users"),
    ]);
    if (!cRes.ok) {
      setErr("Nie udało się wczytać konfiguracji");
      return;
    }
    setConfig((await cRes.json()) as Config);
    if (uRes.ok) {
      const data = (await uRes.json()) as { users: AuthUser[] };
      setUsers(data.users);
    }
  }, [authFetch]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConfig();
  }, [loadConfig]);

  const schedule = config?.schedules[kind];
  const template = config?.templates[kind] ?? "";

  async function saveSmtp() {
    if (!config) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await authFetch("/api/admin/email/smtp", {
      method: "PUT",
      body: JSON.stringify(config.smtp),
    });
    setBusy(false);
    if (res.ok) setMsg("SMTP zapisane");
    else setErr("Błąd zapisu SMTP");
  }

  async function saveSchedule() {
    if (!config || !schedule) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await authFetch(`/api/admin/email/schedule/${kind}`, {
      method: "PUT",
      body: JSON.stringify(schedule),
    });
    setBusy(false);
    if (res.ok) setMsg("Harmonogram zapisany");
    else setErr("Błąd zapisu harmonogramu");
  }

  async function saveTemplate() {
    if (!config) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await authFetch(`/api/admin/email/template/${kind}`, {
      method: "PUT",
      body: JSON.stringify({ template }),
    });
    setBusy(false);
    if (res.ok) setMsg("Szablon zapisany");
    else setErr("Błąd zapisu szablonu");
  }

  async function saveRecipients() {
    if (!config) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await authFetch("/api/admin/email/recipients", {
      method: "PUT",
      body: JSON.stringify({
        customRecipients: config.customRecipients,
        selectedUserIds: config.selectedUserIds,
      }),
    });
    setBusy(false);
    if (res.ok) setMsg("Odbiorcy zapisani");
    else setErr("Błąd zapisu odbiorców");
  }

  async function onPreview() {
    if (!config) return;
    setBusy(true);
    setErr(null);
    const res = await authFetch("/api/admin/email/preview", {
      method: "POST",
      body: JSON.stringify({ kind, template }),
    });
    setBusy(false);
    if (res.ok) {
      const data = (await res.json()) as { subject: string; html: string };
      setPreview(data);
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Błąd podglądu");
    }
  }

  async function onSendTest(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await authFetch("/api/admin/email/test", {
      method: "POST",
      body: JSON.stringify({ kind, to: testTo }),
    });
    setBusy(false);
    if (res.ok) {
      const data = (await res.json()) as { messageId?: string };
      setMsg(`Wysłano test → ${testTo} (${data.messageId ?? "ok"})`);
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Błąd wysyłki");
    }
  }

  function toggleUser(id: string) {
    if (!config) return;
    const current = config.selectedUserIds ?? users.map((u) => u.id);
    const set = new Set(current);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    setConfig({ ...config, selectedUserIds: Array.from(set) });
  }

  function toggleAllUsers() {
    if (!config) return;
    if (config.selectedUserIds === null) {
      setConfig({ ...config, selectedUserIds: [] });
    } else {
      setConfig({ ...config, selectedUserIds: null });
    }
  }

  function addCustomEmail() {
    if (!config || !newEmail.trim()) return;
    setConfig({
      ...config,
      customRecipients: [...config.customRecipients, newEmail.trim()],
    });
    setNewEmail("");
  }

  function removeCustomEmail(idx: number) {
    if (!config) return;
    setConfig({
      ...config,
      customRecipients: config.customRecipients.filter((_, i) => i !== idx),
    });
  }

  const selectedIds = useMemo(
    () => new Set(config?.selectedUserIds ?? users.map((u) => u.id)),
    [config?.selectedUserIds, users],
  );

  if (!config) {
    return <p className="text-sm text-muted-foreground">Ładowanie konfiguracji…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Email raport</h2>
        <div className="flex gap-2">
          <Button
            variant={kind === "monthly" ? "default" : "outline"}
            size="sm"
            onClick={() => setKind("monthly")}
          >
            Miesięczny
          </Button>
          <Button
            variant={kind === "weekly" ? "default" : "outline"}
            size="sm"
            onClick={() => setKind("weekly")}
          >
            Tygodniowy
          </Button>
        </div>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm text-emerald-500">{msg}</p>}

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">SMTP</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label>Host</Label>
            <Input
              value={config.smtp.host}
              onChange={(e) => setConfig({ ...config, smtp: { ...config.smtp, host: e.target.value } })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Port</Label>
            <Input
              type="number"
              value={config.smtp.port}
              onChange={(e) =>
                setConfig({ ...config, smtp: { ...config.smtp, port: Number(e.target.value) } })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>From</Label>
            <Input
              value={config.smtp.from}
              onChange={(e) => setConfig({ ...config, smtp: { ...config.smtp, from: e.target.value } })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>User</Label>
            <Input
              value={config.smtp.user}
              onChange={(e) => setConfig({ ...config, smtp: { ...config.smtp, user: e.target.value } })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              value={config.smtp.pass}
              onChange={(e) => setConfig({ ...config, smtp: { ...config.smtp, pass: e.target.value } })}
            />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={config.smtp.requireTLS}
                onCheckedChange={(v) =>
                  setConfig({ ...config, smtp: { ...config.smtp, requireTLS: Boolean(v) } })
                }
              />
              STARTTLS
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={config.smtp.secure}
                onCheckedChange={(v) =>
                  setConfig({ ...config, smtp: { ...config.smtp, secure: Boolean(v) } })
                }
              />
              SSL (465)
            </label>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={saveSmtp} disabled={busy}>
            Zapisz SMTP
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">
          Harmonogram — {kind === "monthly" ? "miesięczny" : "tygodniowy"}
        </h2>
        {schedule && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={schedule.enabled}
                onCheckedChange={(v) =>
                  setConfig({
                    ...config,
                    schedules: {
                      ...config.schedules,
                      [kind]: { ...schedule, enabled: Boolean(v) },
                    },
                  })
                }
              />
              Włączony
            </label>
            {kind === "monthly" ? (
              <div className="flex flex-col gap-1.5">
                <Label>Dzień miesiąca (1-28)</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={schedule.day}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      schedules: {
                        ...config.schedules,
                        [kind]: { ...schedule, day: Math.max(1, Math.min(28, Number(e.target.value))) },
                      },
                    })
                  }
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label>Dzień tygodnia</Label>
                <select
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                  value={schedule.day}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      schedules: {
                        ...config.schedules,
                        [kind]: { ...schedule, day: Number(e.target.value) },
                      },
                    })
                  }
                >
                  {WEEKDAYS.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label>Godzina</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={schedule.hour}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    schedules: {
                      ...config.schedules,
                      [kind]: { ...schedule, hour: Math.max(0, Math.min(23, Number(e.target.value))) },
                    },
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Minuta</Label>
              <Input
                type="number"
                min={0}
                max={59}
                value={schedule.minute}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    schedules: {
                      ...config.schedules,
                      [kind]: { ...schedule, minute: Math.max(0, Math.min(59, Number(e.target.value))) },
                    },
                  })
                }
              />
            </div>
            <div className="sm:col-span-4 text-xs text-muted-foreground">
              Ostatnie uruchomienie: {schedule.lastRunAt ? new Date(schedule.lastRunAt).toLocaleString("pl-PL") : "nigdy"}
            </div>
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={saveSchedule} disabled={busy}>
            Zapisz harmonogram
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Odbiorcy</h2>
        <div className="mb-3 flex items-center gap-2">
          <Checkbox
            checked={config.selectedUserIds === null}
            onCheckedChange={toggleAllUsers}
          />
          <span className="text-sm">Wysyłaj do wszystkich użytkowników (domyślne)</span>
        </div>
        {config.selectedUserIds !== null && (
          <div className="mb-3 grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedIds.has(u.id)}
                  onCheckedChange={() => toggleUser(u.id)}
                />
                <span>
                  {u.name} <span className="text-muted-foreground">({u.email})</span>
                </span>
              </label>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label>Dodatkowe adresy email</Label>
          <div className="flex flex-wrap gap-2">
            {config.customRecipients.map((e, i) => (
              <span
                key={`${e}-${i}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs"
              >
                {e}
                <button
                  type="button"
                  onClick={() => removeCustomEmail(i)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newEmail}
              placeholder="np. raporty@firma.pl"
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <Button type="button" variant="outline" onClick={addCustomEmail}>
              Dodaj
            </Button>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={saveRecipients} disabled={busy}>
            Zapisz odbiorców
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">
          Szablon — {kind === "monthly" ? "miesięczny" : "tygodniowy"}
        </h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Format: email.md (Markdown + dyrektywy). Dostępne zmienne:{" "}
          <code>{"{{period_label}}"}</code>, <code>{"{{period_start}}"}</code>,{" "}
          <code>{"{{period_end}}"}</code>, <code>{"{{generated_at}}"}</code>,{" "}
          <code>{"{{summary_table}}"}</code>, <code>{"{{locations_table}}"}</code>.
        </p>
        <Textarea
          className="min-h-[320px] font-mono text-xs"
          value={template}
          onChange={(e) =>
            setConfig({
              ...config,
              templates: { ...config.templates, [kind]: e.target.value },
            })
          }
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onPreview} disabled={busy}>
            Podgląd
          </Button>
          <Button size="sm" onClick={saveTemplate} disabled={busy}>
            Zapisz szablon
          </Button>
        </div>
      </section>

      {preview && (
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Podgląd: {preview.subject}</h2>
            <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
              Zamknij
            </Button>
          </div>
          <iframe
            title="preview"
            srcDoc={preview.html}
            className="h-[500px] w-full rounded border border-border bg-white"
          />
        </section>
      )}

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Wyślij testowy email</h2>
        <form onSubmit={onSendTest} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label>Adres docelowy</Label>
            <Input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={busy}>
            Wyślij test ({kind})
          </Button>
        </form>
      </section>
    </div>
  );
}
