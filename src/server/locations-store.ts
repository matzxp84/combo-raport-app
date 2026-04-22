import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import rawConfig from "../config/locations.json";
import { requireAuth } from "./auth.ts";
import { getAccessToken } from "./gopos-auth.ts";

export type FranchiseeContact = {
  name: string;
  phone: string;
  email: string;
  notes: string;
};

export type ManagedLocation = {
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

type LocationsStore = {
  locations: ManagedLocation[];
};

const DATA_PATH = resolve(
  process.env.LOCATIONS_DATA_PATH || resolve(process.cwd(), "data", "locations.json"),
);

function ensureDataDir() {
  const dir = resolve(DATA_PATH, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function seedFromConfig(): ManagedLocation[] {
  return (rawConfig.locations as Array<Record<string, string>>).map((l) => ({
    id: `${l.organization_id}`,
    list_id: l.list_id,
    organization_id: l.organization_id,
    name: l.name,
    name_alias: l.name_alias,
    company_id: l.company_id,
    slug: l.slug,
    status: "active" as const,
    franchise: l.name?.includes("/FR") ?? false,
    franchisee: null,
  }));
}

let _cache: ManagedLocation[] | null = null;

export function getLocations(): ManagedLocation[] {
  if (_cache) return _cache;
  if (!existsSync(DATA_PATH)) {
    _cache = seedFromConfig();
    return _cache;
  }
  try {
    const store = JSON.parse(readFileSync(DATA_PATH, "utf-8")) as LocationsStore;
    _cache = store.locations;
    return _cache;
  } catch {
    _cache = seedFromConfig();
    return _cache;
  }
}

function saveLocations(locs: ManagedLocation[]) {
  ensureDataDir();
  _cache = locs;
  writeFileSync(DATA_PATH, JSON.stringify({ locations: locs }, null, 2), "utf-8");
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function handleLocationsRoute(
  path: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (!path.startsWith("/locations")) return false;

  const user = requireAuth(req, res);
  if (!user) return true;
  if (user.role !== "admin") {
    json(res, 403, { error: "forbidden" });
    return true;
  }

  const sub = path.slice("/locations".length); // "" | "/{id}"
  const idMatch = sub.match(/^\/([^/]+)$/);
  const id = idMatch ? idMatch[1] : null;

  // GET /api/admin/locations
  if (req.method === "GET" && !id) {
    json(res, 200, { locations: getLocations() });
    return true;
  }

  // POST /api/admin/locations
  if (req.method === "POST" && !id) {
    let body: Partial<ManagedLocation>;
    try {
      body = JSON.parse(await readBody(req)) as Partial<ManagedLocation>;
    } catch {
      json(res, 400, { error: "invalid JSON" });
      return true;
    }
    if (!body.organization_id || !body.name_alias) {
      json(res, 400, { error: "organization_id i name_alias są wymagane" });
      return true;
    }
    const locs = getLocations();
    if (locs.some((l) => l.organization_id === body.organization_id)) {
      json(res, 409, { error: "Lokalizacja z tym organization_id już istnieje" });
      return true;
    }
    const newLoc: ManagedLocation = {
      id: randomId(),
      list_id: body.list_id ?? "L1",
      organization_id: body.organization_id,
      name: body.name ?? body.name_alias,
      name_alias: body.name_alias,
      company_id: body.company_id ?? "",
      slug: body.slug ?? body.name_alias.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      status: body.status ?? "active",
      franchise: body.franchise ?? false,
      franchisee: body.franchisee ?? null,
    };
    saveLocations([...locs, newLoc]);
    json(res, 201, { location: newLoc });
    return true;
  }

  // PATCH /api/admin/locations/:id
  if (req.method === "PATCH" && id) {
    let body: Partial<ManagedLocation>;
    try {
      body = JSON.parse(await readBody(req)) as Partial<ManagedLocation>;
    } catch {
      json(res, 400, { error: "invalid JSON" });
      return true;
    }
    const locs = getLocations();
    const idx = locs.findIndex((l) => l.id === id);
    if (idx === -1) {
      json(res, 404, { error: "nie znaleziono" });
      return true;
    }
    const updated: ManagedLocation = {
      ...locs[idx],
      ...(body.list_id !== undefined && { list_id: body.list_id }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.name_alias !== undefined && { name_alias: body.name_alias }),
      ...(body.company_id !== undefined && { company_id: body.company_id }),
      ...(body.slug !== undefined && { slug: body.slug }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.franchise !== undefined && { franchise: body.franchise }),
      ...(body.franchisee !== undefined && { franchisee: body.franchisee }),
    };
    const next = [...locs];
    next[idx] = updated;
    saveLocations(next);
    json(res, 200, { location: updated });
    return true;
  }

  // DELETE /api/admin/locations/:id
  if (req.method === "DELETE" && id) {
    const locs = getLocations();
    const idx = locs.findIndex((l) => l.id === id);
    if (idx === -1) {
      json(res, 404, { error: "nie znaleziono" });
      return true;
    }
    saveLocations(locs.filter((l) => l.id !== id));
    json(res, 200, { ok: true });
    return true;
  }

  // POST /api/admin/locations/import  — merge z JSON/CSV
  if (req.method === "POST" && sub === "/import") {
    let raw: string;
    try {
      raw = await readBody(req);
    } catch {
      json(res, 400, { error: "błąd odczytu body" });
      return true;
    }

    type ImportRow = Partial<ManagedLocation> & { organization_id?: string; name_alias?: string };
    let rows: ImportRow[] = [];

    const ct = (req.headers["content-type"] ?? "").toLowerCase();
    if (ct.includes("text/csv") || raw.trimStart().startsWith("organization_id") || raw.trimStart().startsWith("org")) {
      // CSV: pierwsza linia = nagłówki
      const lines = raw.trim().split(/\r?\n/);
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      for (const line of lines.slice(1)) {
        if (!line.trim()) continue;
        const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
        rows.push(row as ImportRow);
      }
    } else {
      try {
        const parsed = JSON.parse(raw) as ImportRow | ImportRow[];
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        json(res, 400, { error: "Nieprawidłowy format — wymagany JSON (obiekt/tablica) lub CSV" });
        return true;
      }
    }

    const locs = getLocations();
    const added: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const row of rows) {
      const orgId = row.organization_id?.trim();
      const alias = row.name_alias?.trim() || row.name?.trim();
      if (!orgId) { errors.push(`Brak organization_id w wierszu: ${JSON.stringify(row)}`); continue; }
      if (!alias) { errors.push(`Brak name_alias dla org ${orgId}`); continue; }
      if (locs.some((l) => l.organization_id === orgId)) {
        skipped.push(orgId);
        continue;
      }
      const newLoc: ManagedLocation = {
        id: randomId(),
        list_id: row.list_id ?? "L1",
        organization_id: orgId,
        name: row.name?.trim() || alias,
        name_alias: alias,
        company_id: row.company_id?.trim() ?? "",
        slug: row.slug?.trim() || alias.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        status: (row.status === "closed" ? "closed" : "active") as "active" | "closed",
        franchise: row.franchise === true || String(row.franchise) === "true" || alias.includes("/FR"),
        franchisee: row.franchisee ?? null,
      };
      locs.push(newLoc);
      added.push(orgId);
    }

    if (added.length > 0) saveLocations(locs);
    json(res, 200, { added: added.length, skipped: skipped.length, errors, addedIds: added });
    return true;
  }

  // POST /api/admin/locations/refresh — sprawdź dostęp OAuth dla każdej aktywnej lokalizacji
  if (req.method === "POST" && sub === "/refresh") {
    const locs = getLocations().filter((l) => l.status !== "closed");
    const ok: string[] = [];
    const fail: Array<{ org_id: string; alias: string; error: string }> = [];

    await Promise.all(
      locs.map(async (loc) => {
        try {
          await getAccessToken(loc.organization_id);
          ok.push(loc.organization_id);
        } catch (err) {
          fail.push({
            org_id: loc.organization_id,
            alias: loc.name_alias,
            error: (err as Error).message,
          });
        }
      }),
    );

    json(res, 200, { ok: ok.length, fail });
    return true;
  }

  return false;
}
