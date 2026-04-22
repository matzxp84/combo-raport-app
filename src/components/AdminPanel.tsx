import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/useAuth";
import type { AuthUser } from "@/contexts/AuthContext";
import { EmailReportSection } from "@/components/EmailReportSection";
import { GoPosConfigSection } from "@/components/GoPosConfigSection";
import { LocationsSection } from "@/components/LocationsSection";

type AdminUser = AuthUser;

type LogEntry = {
  id: string;
  ts: string;
  type: "login" | "report" | "api";
  actor: string;
  status: "ok" | "fail";
  message: string;
};

type EditState = {
  id: string;
  name: string;
  email: string;
  password: string;
};

type Section = "users" | "email" | "gopos" | "locations" | "logs-login" | "logs-api" | "logs-report";

export function AdminPanel() {
  const { user: me, authFetch } = useAuth();
  const [section, setSection] = useState<Section>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // edit modal state
  const [editing, setEditing] = useState<EditState | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await authFetch("/api/admin/users");
      if (!res.ok) throw new Error("fetch users failed");
      const data = (await res.json()) as { users: AdminUser[] };
      setUsers(data.users);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  const loadLogs = useCallback(
    async (type: LogEntry["type"]) => {
      setLoading(true);
      setErr(null);
      try {
        const res = await authFetch(`/api/admin/logs?type=${type}&limit=200`);
        if (!res.ok) throw new Error("fetch logs failed");
        const data = (await res.json()) as { logs: LogEntry[] };
        setLogs(data.logs);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [authFetch],
  );

  useEffect(() => {
    if (section === "users") loadUsers();
    else if (section === "logs-login") loadLogs("login");
    else if (section === "logs-api") loadLogs("api");
    else if (section === "logs-report") loadLogs("report");
  }, [section, loadUsers, loadLogs]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await authFetch("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: newName,
        email: newEmail,
        password: newPassword,
        role: "user",
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Błąd tworzenia");
      return;
    }
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    loadUsers();
  }

  async function onDelete(id: string) {
    if (!confirm("Usunąć użytkownika?")) return;
    const res = await authFetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Błąd usuwania");
      return;
    }
    loadUsers();
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const payload: Record<string, string> = {
      name: editing.name,
      email: editing.email,
    };
    if (editing.password) payload.password = editing.password;
    const res = await authFetch(`/api/admin/users/${editing.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Błąd zapisu");
      return;
    }
    setEditing(null);
    loadUsers();
  }

  return (
    <div className="flex flex-col gap-6 px-[5%] py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Panel administratora</h1>
        <div className="flex gap-2">
          <Button
            variant={section === "users" ? "default" : "outline"}
            size="sm"
            onClick={() => setSection("users")}
          >
            Użytkownicy
          </Button>
          <Button
            variant={section === "email" ? "default" : "outline"}
            size="sm"
            onClick={() => setSection("email")}
          >
            Email raport
          </Button>
          <Button
            variant={section === "gopos" ? "default" : "outline"}
            size="sm"
            onClick={() => setSection("gopos")}
          >
            GoPos API
          </Button>
          <Button
            variant={section === "locations" ? "default" : "outline"}
            size="sm"
            onClick={() => setSection("locations")}
          >
            Lokalizacje
          </Button>
          <Button
            variant={section === "logs-login" ? "default" : "outline"}
            size="sm"
            onClick={() => setSection("logs-login")}
          >
            Logowania
          </Button>
          <Button
            variant={section === "logs-api" ? "default" : "outline"}
            size="sm"
            onClick={() => setSection("logs-api")}
          >
            API
          </Button>
          <Button
            variant={section === "logs-report" ? "default" : "outline"}
            size="sm"
            onClick={() => setSection("logs-report")}
          >
            Raporty
          </Button>
        </div>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}
      {loading && <p className="text-sm text-muted-foreground">Ładowanie…</p>}

      {section === "email" && <EmailReportSection />}
      {section === "gopos" && <GoPosConfigSection />}
      {section === "locations" && <LocationsSection />}

      {section === "users" && (
        <>
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Dodaj użytkownika</h2>
            <form
              onSubmit={onCreate}
              className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-name">Imię i nazwisko</Label>
                <Input
                  id="new-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Zygmunt Hajzer"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-email">Login / email</Label>
                <Input
                  id="new-email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="zygmunt.hajzer@tpizza.pl"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password">Hasło</Label>
                <Input
                  id="new-password"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit">Dodaj</Button>
            </form>
          </section>

          <section className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imię i nazwisko</TableHead>
                  <TableHead>Login</TableHead>
                  <TableHead>Rola</TableHead>
                  <TableHead>Utworzony</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.role}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleString("pl-PL")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditing({
                              id: u.id,
                              name: u.name,
                              email: u.email,
                              password: "",
                            })
                          }
                        >
                          Edytuj
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onDelete(u.id)}
                          disabled={u.id === me?.id}
                        >
                          Usuń
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </>
      )}

      {(section === "logs-login" || section === "logs-api" || section === "logs-report") && (
        <section className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Czas</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Aktor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Wiadomość</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Brak wpisów
                  </TableCell>
                </TableRow>
              )}
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(l.ts).toLocaleString("pl-PL")}
                  </TableCell>
                  <TableCell>{l.type}</TableCell>
                  <TableCell>{l.actor}</TableCell>
                  <TableCell>
                    <span
                      className={
                        l.status === "ok" ? "text-emerald-500" : "text-destructive"
                      }
                    >
                      {l.status}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[480px] truncate" title={l.message}>
                    {l.message}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setEditing(null)}
        >
          <form
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
            onSubmit={onSaveEdit}
          >
            <h2 className="mb-4 text-base font-semibold">Edytuj użytkownika</h2>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-name">Imię i nazwisko</Label>
                <Input
                  id="edit-name"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-email">Login / email</Label>
                <Input
                  id="edit-email"
                  value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-password">Nowe hasło (opcjonalnie)</Label>
                <Input
                  id="edit-password"
                  type="text"
                  value={editing.password}
                  onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                  placeholder="zostaw puste aby nie zmieniać"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Anuluj
              </Button>
              <Button type="submit">Zapisz</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
