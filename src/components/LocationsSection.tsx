import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
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

type FranchiseeContact = {
  name: string;
  phone: string;
  email: string;
  notes: string;
};

type ManagedLocation = {
  id: string;
  list_id: string;
  organization_id: string;
  name: string;
  name_alias: string;
  company_id: string;
  slug: string;
  status: "active" | "closed";
  franchise: boolean;
  franchisee: FranchiseeContact | null;
};

const LISTS = [
  { id: "L1", name: "Rafał Lubak" },
  { id: "L2", name: "Rafał Wieczorek" },
  { id: "L3", name: "Andrzej Chmielewski" },
];

const EMPTY_FRANCHISEE: FranchiseeContact = { name: "", phone: "", email: "", notes: "" };

type EditState = ManagedLocation & { _franchiseeStr?: string };

function emptyNew(): Omit<ManagedLocation, "id"> {
  return {
    list_id: "L1",
    organization_id: "",
    name: "",
    name_alias: "",
    company_id: "",
    slug: "",
    status: "active",
    franchise: false,
    franchisee: null,
  };
}

export function LocationsSection() {
  const { authFetch } = useAuth();
  const [locations, setLocations] = useState<ManagedLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLoc, setNewLoc] = useState(emptyNew());
  const [filterList, setFilterList] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [savingMsg, setSavingMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<{ ok: number; fail: Array<{ org_id: string; alias: string; error: string }> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await authFetch("/api/admin/locations");
      if (!res.ok) throw new Error("Błąd ładowania lokalizacji");
      const data = (await res.json()) as { locations: ManagedLocation[] };
      setLocations(data.locations);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  async function onDelete(id: string, name: string) {
    if (!confirm(`Usunąć lokalizację "${name}"?`)) return;
    const res = await authFetch(`/api/admin/locations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(d.error ?? "Błąd usuwania");
      return;
    }
    load();
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSavingMsg(null);
    const payload: Partial<ManagedLocation> = {
      list_id: editing.list_id,
      name: editing.name,
      name_alias: editing.name_alias,
      company_id: editing.company_id,
      slug: editing.slug,
      status: editing.status,
      franchise: editing.franchise,
      franchisee: editing.franchise ? (editing.franchisee ?? EMPTY_FRANCHISEE) : null,
    };
    const res = await authFetch(`/api/admin/locations/${editing.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) { setErr(d.error ?? "Błąd zapisu"); return; }
    setSavingMsg("Zapisano.");
    setEditing(null);
    load();
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setSavingMsg(null);
    const res = await authFetch("/api/admin/locations", {
      method: "POST",
      body: JSON.stringify(newLoc),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) { setErr(d.error ?? "Błąd dodawania"); return; }
    setNewLoc(emptyNew());
    setAdding(false);
    load();
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setErr(null);
    setSavingMsg(null);
    try {
      const text = await file.text();
      const isCsv = file.name.endsWith(".csv");
      const res = await authFetch("/api/admin/locations/import", {
        method: "POST",
        headers: { "Content-Type": isCsv ? "text/csv" : "application/json" },
        body: text,
      });
      const d = (await res.json().catch(() => ({}))) as { added?: number; skipped?: number; errors?: string[]; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Błąd importu");
      const parts = [`Dodano: ${d.added ?? 0}`, `Pominięto (duplikaty): ${d.skipped ?? 0}`];
      if (d.errors?.length) parts.push(`Błędy: ${d.errors.length}`);
      setSavingMsg(parts.join(" · "));
      if (d.errors?.length) setErr(d.errors.join("\n"));
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    setRefreshResult(null);
    setErr(null);
    setSavingMsg(null);
    try {
      const res = await authFetch("/api/admin/locations/refresh", { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { ok?: number; fail?: Array<{ org_id: string; alias: string; error: string }>; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Błąd odświeżania");
      setRefreshResult({ ok: d.ok ?? 0, fail: d.fail ?? [] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  const visible = locations.filter((l) => {
    if (filterList !== "all" && l.list_id !== filterList) return false;
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          value={filterList}
          onChange={(e) => setFilterList(e.target.value)}
        >
          <option value="all">Wszystkie listy</option>
          {LISTS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">Wszystkie statusy</option>
          <option value="active">Aktywna</option>
          <option value="closed">Zamknięta</option>
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{visible.length} lokalizacji</span>
        <Button
          size="sm"
          variant="outline"
          disabled={refreshing}
          onClick={onRefresh}
        >
          {refreshing ? "Sprawdzanie…" : "Odśwież"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={importing}
          onClick={() => fileInputRef.current?.click()}
        >
          {importing ? "Importowanie…" : "Dodaj z pliku"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv"
          className="hidden"
          onChange={onImportFile}
        />
        <Button size="sm" onClick={() => setAdding(true)}>+ Dodaj</Button>
      </div>

      {err && <pre className="whitespace-pre-wrap text-sm text-destructive">{err}</pre>}
      {savingMsg && <p className="text-sm text-emerald-500">{savingMsg}</p>}
      {loading && <p className="text-sm text-muted-foreground">Ładowanie…</p>}

      {refreshResult && (
        <div className={`rounded-lg border p-3 text-sm ${refreshResult.fail.length > 0 ? "border-destructive/40 bg-destructive/5" : "border-emerald-500/30 bg-emerald-500/5"}`}>
          <div className="flex items-center justify-between">
            <span className={refreshResult.fail.length > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}>
              OK: {refreshResult.ok}{refreshResult.fail.length > 0 ? ` · Błędy: ${refreshResult.fail.length}` : " — wszystkie lokalizacje dostępne"}
            </span>
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setRefreshResult(null)}>✕</button>
          </div>
          {refreshResult.fail.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {refreshResult.fail.map((f) => (
                <li key={f.org_id} className="text-xs text-destructive">
                  <span className="font-medium">{f.alias}</span> ({f.org_id}) — {f.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* table */}
      <section className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alias</TableHead>
              <TableHead>Org ID</TableHead>
              <TableHead>Lista</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Franczyza</TableHead>
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Brak wyników
                </TableCell>
              </TableRow>
            )}
            {visible.map((loc) => (
              <TableRow key={loc.id} className={loc.status === "closed" ? "opacity-50" : undefined}>
                <TableCell className="font-medium">{loc.name_alias}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{loc.organization_id}</TableCell>
                <TableCell className="text-xs">{LISTS.find((l) => l.id === loc.list_id)?.name ?? loc.list_id}</TableCell>
                <TableCell>
                  <span className={`text-xs font-medium ${loc.status === "active" ? "text-emerald-500" : "text-muted-foreground"}`}>
                    {loc.status === "active" ? "Aktywna" : "Zamknięta"}
                  </span>
                </TableCell>
                <TableCell className="text-xs">
                  {loc.franchise ? (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-600 dark:text-amber-400">
                      FR{loc.franchisee?.name ? ` · ${loc.franchisee.name}` : ""}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing({ ...loc })}>
                      Edytuj
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => onDelete(loc.id, loc.name_alias)}>
                      Usuń
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {/* add modal */}
      {adding && (
        <LocationModal
          title="Dodaj lokalizację"
          value={newLoc as unknown as EditState}
          onChange={(v) => setNewLoc(v as unknown as Omit<ManagedLocation, "id">)}
          onSubmit={onAdd}
          onClose={() => setAdding(false)}
          submitLabel="Dodaj"
          showOrgId
        />
      )}

      {/* edit modal */}
      {editing && (
        <LocationModal
          title="Edytuj lokalizację"
          value={editing}
          onChange={(v) => setEditing(v)}
          onSubmit={onSaveEdit}
          onClose={() => setEditing(null)}
          submitLabel="Zapisz"
          showOrgId={false}
        />
      )}
    </div>
  );
}

// ─── sub-component: shared modal ─────────────────────────────────────────────

type ModalProps = {
  title: string;
  value: EditState;
  onChange: (v: EditState) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
  submitLabel: string;
  showOrgId: boolean;
};

function LocationModal({ title, value, onChange, onSubmit, onClose, submitLabel, showOrgId }: ModalProps) {
  const set = (patch: Partial<EditState>) => onChange({ ...value, ...patch });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10"
      onClick={onClose}
    >
      <form
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <h2 className="mb-5 text-base font-semibold">{title}</h2>

        <div className="flex flex-col gap-4">
          {/* basic */}
          <div className="grid gap-3 sm:grid-cols-2">
            {showOrgId && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="loc-org-id">Organization ID</Label>
                <Input
                  id="loc-org-id"
                  value={value.organization_id}
                  onChange={(e) => set({ organization_id: e.target.value })}
                  placeholder="np. 2830"
                  required
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loc-alias">Alias (krótka nazwa)</Label>
              <Input
                id="loc-alias"
                value={value.name_alias}
                onChange={(e) => set({ name_alias: e.target.value })}
                placeholder="Łomianki Warszawska 125"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loc-name">Pełna nazwa</Label>
              <Input
                id="loc-name"
                value={value.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="TPIZZA Łomianki Warszawska 125 (4875)"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {/* lista */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loc-list">Lista</Label>
              <select
                id="loc-list"
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={value.list_id}
                onChange={(e) => set({ list_id: e.target.value })}
              >
                {LISTS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            {/* status */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loc-status">Status</Label>
              <select
                id="loc-status"
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={value.status}
                onChange={(e) => set({ status: e.target.value as "active" | "closed" })}
              >
                <option value="active">Aktywna</option>
                <option value="closed">Zamknięta</option>
              </select>
            </div>

            {/* company_id */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loc-company">Company ID</Label>
              <Input
                id="loc-company"
                value={value.company_id}
                onChange={(e) => set({ company_id: e.target.value })}
                placeholder="go_3050"
              />
            </div>
          </div>

          {/* slug */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loc-slug">Slug</Label>
            <Input
              id="loc-slug"
              value={value.slug}
              onChange={(e) => set({ slug: e.target.value })}
              placeholder="lomianki"
            />
          </div>

          {/* franchise toggle */}
          <div className="flex items-center gap-2">
            <input
              id="loc-franchise"
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={value.franchise}
              onChange={(e) => set({ franchise: e.target.checked, franchisee: e.target.checked ? (value.franchisee ?? EMPTY_FRANCHISEE) : null })}
            />
            <Label htmlFor="loc-franchise" className="cursor-pointer">Lokal franczyzowy</Label>
          </div>

          {/* franchisee block */}
          {value.franchise && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="mb-3 text-xs font-semibold text-amber-600 dark:text-amber-400">Dane franczyzobiorcy</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fr-name">Imię i nazwisko</Label>
                  <Input
                    id="fr-name"
                    value={value.franchisee?.name ?? ""}
                    onChange={(e) => set({ franchisee: { ...(value.franchisee ?? EMPTY_FRANCHISEE), name: e.target.value } })}
                    placeholder="Jan Kowalski"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fr-phone">Telefon</Label>
                  <Input
                    id="fr-phone"
                    value={value.franchisee?.phone ?? ""}
                    onChange={(e) => set({ franchisee: { ...(value.franchisee ?? EMPTY_FRANCHISEE), phone: e.target.value } })}
                    placeholder="+48 500 000 000"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fr-email">Email</Label>
                  <Input
                    id="fr-email"
                    type="email"
                    value={value.franchisee?.email ?? ""}
                    onChange={(e) => set({ franchisee: { ...(value.franchisee ?? EMPTY_FRANCHISEE), email: e.target.value } })}
                    placeholder="jan@kowalski.pl"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fr-notes">Notatki</Label>
                  <Input
                    id="fr-notes"
                    value={value.franchisee?.notes ?? ""}
                    onChange={(e) => set({ franchisee: { ...(value.franchisee ?? EMPTY_FRANCHISEE), notes: e.target.value } })}
                    placeholder="np. umowa do 2026"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>
    </div>
  );
}
