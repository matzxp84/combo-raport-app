import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { requireAuth } from "./auth.ts";

export type GoPosConfig = {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  tokenBufferSeconds: number;
};

const DATA_PATH = resolve(
  process.env.GOPOS_CONFIG_PATH || resolve(process.cwd(), "data", "gopos.json"),
);

function ensureDataDir() {
  const dir = resolve(DATA_PATH, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function loadGoPosConfig(): GoPosConfig | null {
  if (!existsSync(DATA_PATH)) return null;
  try {
    return JSON.parse(readFileSync(DATA_PATH, "utf-8")) as GoPosConfig;
  } catch {
    return null;
  }
}

function saveGoPosConfig(cfg: GoPosConfig) {
  ensureDataDir();
  writeFileSync(DATA_PATH, JSON.stringify(cfg, null, 2), "utf-8");
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export async function handleGoPosConfigRoute(
  path: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (path !== "/config") return false;

  const user = requireAuth(req, res);
  if (!user) return true;
  if (user.role !== "admin") {
    json(res, 403, { error: "forbidden" });
    return true;
  }

  if (req.method === "GET") {
    const cfg = loadGoPosConfig();
    const envFallback: GoPosConfig = {
      clientId: process.env.GOPOS_CLIENT_ID ?? "",
      clientSecret: process.env.GOPOS_CLIENT_SECRET ?? "",
      baseUrl: process.env.GOPOS_BASE_URL ?? "https://app.gopos.io",
      tokenBufferSeconds: Number(process.env.GOPOS_TOKEN_BUFFER_SECONDS ?? "300"),
    };
    const effective = cfg ?? envFallback;
    json(res, 200, {
      clientId: effective.clientId,
      clientSecret: effective.clientSecret ? "********" : "",
      baseUrl: effective.baseUrl,
      tokenBufferSeconds: effective.tokenBufferSeconds,
      source: cfg ? "file" : "env",
    });
    return true;
  }

  if (req.method === "PUT") {
    let body: Partial<GoPosConfig>;
    try {
      body = JSON.parse(await readBody(req)) as Partial<GoPosConfig>;
    } catch {
      json(res, 400, { error: "invalid JSON" });
      return true;
    }

    const existing = loadGoPosConfig();
    const updated: GoPosConfig = {
      clientId: body.clientId ?? existing?.clientId ?? "",
      clientSecret:
        body.clientSecret && body.clientSecret !== "********"
          ? body.clientSecret
          : existing?.clientSecret ?? "",
      baseUrl: body.baseUrl ?? existing?.baseUrl ?? "https://app.gopos.io",
      tokenBufferSeconds: body.tokenBufferSeconds ?? existing?.tokenBufferSeconds ?? 300,
    };

    if (!updated.clientId || !updated.clientSecret) {
      json(res, 400, { error: "clientId i clientSecret są wymagane" });
      return true;
    }

    saveGoPosConfig(updated);
    json(res, 200, { ok: true });
    return true;
  }

  return false;
}
