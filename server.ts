import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { handleApi } from "./src/server/plugin.ts";

const PORT = Number(process.env.PORT || 4173);
const DIST_DIR = resolve(process.cwd(), "dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

async function tryServeFile(filePath: string, res: ServerResponse): Promise<boolean> {
  try {
    const st = await stat(filePath);
    if (!st.isFile()) return false;
    const ext = extname(filePath).toLowerCase();
    const type = MIME[ext] ?? "application/octet-stream";
    const body = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", type);
    if (ext !== ".html") {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      res.setHeader("Cache-Control", "no-cache");
    }
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

async function handleStatic(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const safe = normalize(url.pathname).replace(/^\/+/, "");
  if (safe.includes("..")) {
    res.statusCode = 400;
    return res.end("bad request");
  }
  const filePath = join(DIST_DIR, safe);
  if (await tryServeFile(filePath, res)) return;
  // SPA fallback
  const indexPath = join(DIST_DIR, "index.html");
  if (await tryServeFile(indexPath, res)) return;
  res.statusCode = 404;
  res.end("not found");
}

const server = createServer(async (req, res) => {
  try {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    const handled = await handleApi(req, res);
    if (handled) return;
    await handleStatic(req, res);
  } catch (err) {
    res.statusCode = 500;
    res.end((err as Error).message);
  }
});

server.listen(PORT, () => {
  console.log(`[combo] listening on :${PORT}`);
});
