import type { IncomingMessage, ServerResponse } from "node:http";
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type Role = "admin" | "user";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
  createdAt: string;
};

export type LogType = "login" | "report" | "api";
export type LogStatus = "ok" | "fail";

export type LogEntry = {
  id: string;
  ts: string;
  type: LogType;
  actor: string;
  status: LogStatus;
  message: string;
};

type Store = {
  users: User[];
  logs: LogEntry[];
  jwtSecret: string;
};

const DATA_PATH = resolve(
  process.env.AUTH_DATA_PATH || resolve(process.cwd(), "data", "auth.json"),
);
const MAX_LOGS = 2000;
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

let store: Store | null = null;

function ensureDir(file: string) {
  mkdirSync(dirname(file), { recursive: true });
}

function loadStore(): Store {
  if (store) return store;
  ensureDir(DATA_PATH);
  if (existsSync(DATA_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
      store = {
        users: raw.users ?? [],
        logs: raw.logs ?? [],
        jwtSecret: raw.jwtSecret ?? randomBytes(32).toString("hex"),
      };
    } catch {
      store = freshStore();
    }
  } else {
    store = freshStore();
  }
  seedIfEmpty(store);
  persist();
  return store;
}

function freshStore(): Store {
  return { users: [], logs: [], jwtSecret: randomBytes(32).toString("hex") };
}

function persist() {
  if (!store) return;
  ensureDir(DATA_PATH);
  writeFileSync(DATA_PATH, JSON.stringify(store, null, 2), "utf-8");
}

function seedIfEmpty(s: Store) {
  if (s.users.length > 0) return;
  const now = new Date().toISOString();
  s.users.push({
    id: randomId(),
    name: "Admin",
    email: "matfl@tuta.com",
    role: "admin",
    passwordHash: hashPassword("pułtusk"),
    createdAt: now,
  });
  s.users.push({
    id: randomId(),
    name: "Daniel Piekarski",
    email: "daniel.piekarski@t-pizza.pl",
    role: "user",
    passwordHash: hashPassword("daniel"),
    createdAt: now,
  });
}

function randomId(): string {
  return randomBytes(8).toString("hex");
}

// ── password hashing (scrypt — no native deps) ─────────────────────────────
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ── JWT (HS256, hand-rolled — zero deps) ───────────────────────────────────
function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlJson(obj: unknown): string {
  return b64url(JSON.stringify(obj));
}

function b64urlDecode(str: string): Buffer {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function signToken(payload: Record<string, unknown>): string {
  const s = loadStore();
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { iat: now, exp: now + TOKEN_TTL_SECONDS, ...payload };
  const head = b64urlJson(header);
  const data = `${head}.${b64urlJson(body)}`;
  const sig = b64url(createHmac("sha256", s.jwtSecret).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyToken(token: string): null | { sub: string; role: Role; email: string } {
  const s = loadStore();
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  const expected = b64url(createHmac("sha256", s.jwtSecret).update(`${head}.${body}`).digest());
  if (expected.length !== sig.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf-8"));
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── helpers ────────────────────────────────────────────────────────────────
function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (!raw) return resolvePromise({});
      try {
        resolvePromise(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function getToken(req: IncomingMessage): string | null {
  const header = req.headers["authorization"];
  if (typeof header === "string" && header.startsWith("Bearer ")) return header.slice(7);
  return null;
}

export function getAuthedUser(req: IncomingMessage): User | null {
  const token = getToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const s = loadStore();
  return s.users.find((u) => u.id === payload.sub) ?? null;
}

function publicUser(u: User) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt };
}

export function appendLog(entry: Omit<LogEntry, "id" | "ts">) {
  const s = loadStore();
  s.logs.unshift({ id: randomId(), ts: new Date().toISOString(), ...entry });
  if (s.logs.length > MAX_LOGS) s.logs.length = MAX_LOGS;
  persist();
}

// ── HTTP handlers ──────────────────────────────────────────────────────────
export async function handleAuthRoute(
  path: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const s = loadStore();

  if (path === "/login" && req.method === "POST") {
    try {
      const body = (await readJsonBody(req)) as { email?: string; password?: string };
      const email = (body.email ?? "").trim().toLowerCase();
      const password = body.password ?? "";
      const user = s.users.find((u) => u.email.toLowerCase() === email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        appendLog({ type: "login", actor: email || "-", status: "fail", message: "bad credentials" });
        json(res, 401, { error: "invalid credentials" });
        return true;
      }
      appendLog({ type: "login", actor: user.email, status: "ok", message: "login ok" });
      const token = signToken({ sub: user.id, role: user.role, email: user.email });
      json(res, 200, { token, user: publicUser(user) });
    } catch {
      json(res, 400, { error: "bad request" });
    }
    return true;
  }

  if (path === "/me" && req.method === "GET") {
    const user = getAuthedUser(req);
    if (!user) return json(res, 401, { error: "unauthorized" }), true;
    json(res, 200, { user: publicUser(user) });
    return true;
  }

  if (path === "/logout" && req.method === "POST") {
    const user = getAuthedUser(req);
    if (user) appendLog({ type: "login", actor: user.email, status: "ok", message: "logout" });
    json(res, 200, { ok: true });
    return true;
  }

  return false;
}

export async function handleAdminRoute(
  path: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const user = getAuthedUser(req);
  if (!user || user.role !== "admin") {
    json(res, 403, { error: "forbidden" });
    return true;
  }
  const s = loadStore();

  if (path === "/users" && req.method === "GET") {
    json(res, 200, { users: s.users.map(publicUser) });
    return true;
  }

  if (path === "/users" && req.method === "POST") {
    try {
      const body = (await readJsonBody(req)) as {
        name?: string;
        email?: string;
        password?: string;
        role?: Role;
      };
      const name = (body.name ?? "").trim();
      const email = (body.email ?? "").trim();
      const password = body.password ?? "";
      const role: Role = body.role === "admin" ? "admin" : "user";
      if (!name || !email || !password) {
        json(res, 400, { error: "name, email, password required" });
        return true;
      }
      if (s.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        json(res, 409, { error: "email already exists" });
        return true;
      }
      const u: User = {
        id: randomId(),
        name,
        email,
        role,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
      };
      s.users.push(u);
      persist();
      json(res, 201, { user: publicUser(u) });
    } catch {
      json(res, 400, { error: "bad request" });
    }
    return true;
  }

  const userMatch = path.match(/^\/users\/([^/]+)$/);
  if (userMatch) {
    const id = userMatch[1];
    const target = s.users.find((u) => u.id === id);
    if (!target) {
      json(res, 404, { error: "not found" });
      return true;
    }
    if (req.method === "PATCH") {
      try {
        const body = (await readJsonBody(req)) as {
          name?: string;
          email?: string;
          password?: string;
          role?: Role;
        };
        if (typeof body.name === "string" && body.name.trim()) target.name = body.name.trim();
        if (typeof body.email === "string" && body.email.trim()) {
          const newEmail = body.email.trim();
          if (
            s.users.some(
              (u) => u.id !== target.id && u.email.toLowerCase() === newEmail.toLowerCase(),
            )
          ) {
            json(res, 409, { error: "email already exists" });
            return true;
          }
          target.email = newEmail;
        }
        if (typeof body.password === "string" && body.password) {
          target.passwordHash = hashPassword(body.password);
        }
        if (body.role === "admin" || body.role === "user") target.role = body.role;
        persist();
        json(res, 200, { user: publicUser(target) });
      } catch {
        json(res, 400, { error: "bad request" });
      }
      return true;
    }
    if (req.method === "DELETE") {
      if (target.id === user.id) {
        json(res, 400, { error: "cannot delete self" });
        return true;
      }
      s.users = s.users.filter((u) => u.id !== id);
      persist();
      json(res, 200, { ok: true });
      return true;
    }
  }

  if (path === "/logs" && req.method === "GET") {
    const url = new URL(req.url ?? "", "http://localhost");
    const type = url.searchParams.get("type");
    const limit = Math.min(500, Number(url.searchParams.get("limit") ?? 200) || 200);
    const filtered = type ? s.logs.filter((l) => l.type === type) : s.logs;
    json(res, 200, { logs: filtered.slice(0, limit) });
    return true;
  }

  return false;
}

export function requireAuth(req: IncomingMessage, res: ServerResponse): User | null {
  const user = getAuthedUser(req);
  if (!user) {
    json(res, 401, { error: "unauthorized" });
    return null;
  }
  return user;
}

// Eagerly init store so the admin seed exists on first import.
loadStore();
