import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export class GoPosAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoPosAuthError";
  }
}

type TokenCacheEntry = {
  access_token: string;
  expires_at: number;
  cached_at: number;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..", "..");
const CACHE_DIR = resolve(PROJECT_ROOT, ".cache", "token-cache");

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
}

function getConfig() {
  const clientId = process.env.GOPOS_CLIENT_ID;
  const clientSecret = process.env.GOPOS_CLIENT_SECRET;
  const baseUrl = process.env.GOPOS_BASE_URL ?? "https://app.gopos.io";
  const bufferSeconds = Number(process.env.GOPOS_TOKEN_BUFFER_SECONDS ?? "300");
  if (!clientId || !clientSecret) {
    throw new GoPosAuthError(
      "GOPOS_CLIENT_ID / GOPOS_CLIENT_SECRET missing from env"
    );
  }
  return { clientId, clientSecret, baseUrl, bufferSeconds };
}

function getTokenFile(organizationId: string, clientId: string): string {
  const clientHash = createHash("sha256").update(clientId).digest("hex").slice(0, 12);
  return resolve(CACHE_DIR, `token_cache_${organizationId}_${clientHash}.json`);
}

function loadCachedToken(path: string, bufferSeconds: number): string | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as TokenCacheEntry;
    const now = Date.now() / 1000;
    if (data.access_token && data.expires_at > now + bufferSeconds) {
      return data.access_token;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveTokenCache(path: string, token: string, expiresIn: number): void {
  const now = Date.now() / 1000;
  const entry: TokenCacheEntry = {
    access_token: token,
    expires_at: now + expiresIn,
    cached_at: now,
  };
  try {
    writeFileSync(path, JSON.stringify(entry), "utf-8");
  } catch (err) {
    console.warn("[gopos-auth] failed to save token cache:", err);
  }
}

export async function getAccessToken(organizationId: string): Promise<string> {
  ensureCacheDir();
  const { clientId, clientSecret, baseUrl, bufferSeconds } = getConfig();
  const tokenFile = getTokenFile(organizationId, clientId);

  const cached = loadCachedToken(tokenFile, bufferSeconds);
  if (cached) return cached;

  const body = new URLSearchParams({
    grant_type: "organization",
    client_id: clientId,
    client_secret: clientSecret,
    organization_id: organizationId,
  });

  const res = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    let errorJson: Record<string, unknown> = {};
    let errorText = "";
    try {
      errorJson = (await res.json()) as Record<string, unknown>;
    } catch {
      errorText = await res.text().catch(() => "");
    }
    const err = (errorJson.error as string | undefined) ?? "";
    const desc = ((errorJson.error_description as string | undefined) ?? "").toLowerCase();
    if (err === "invalid_grant" && (desc.includes("active grant") || desc.includes("organization"))) {
      if (existsSync(tokenFile)) {
        try {
          unlinkSync(tokenFile);
        } catch {
          /* ignore */
        }
      }
      throw new GoPosAuthError(
        `GoPos: brak aktywnej integracji dla organizacji ${organizationId}. Sprawdź panel GoPos → Integracje / API.`
      );
    }
    throw new GoPosAuthError(
      `OAuth2 token error (${res.status}): ${err || errorText.slice(0, 200) || "unknown"}`
    );
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new GoPosAuthError("No access_token in OAuth2 response");
  }
  const expiresIn = data.expires_in ?? 3600;
  saveTokenCache(tokenFile, data.access_token, expiresIn);
  return data.access_token;
}

export async function getAuthHeaders(organizationId: string): Promise<Record<string, string>> {
  const token = await getAccessToken(organizationId);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}
