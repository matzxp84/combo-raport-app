import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import nodemailer from "nodemailer";
import { render as renderEmailMd } from "emailmd";

import { getLocations } from "./locations-store.ts";
import {
  fetchOrders,
  extractOrdersSales,
  type OrdersSales,
} from "./gopos-api.ts";
import { getAuthedUser, appendLog } from "./auth.ts";

// ── types ──────────────────────────────────────────────────────────────────
export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  user: string;
  pass: string;
  from: string;
};

export type Schedule = {
  enabled: boolean;
  /** 1-28 for monthly; 0 (sun) - 6 (sat) for weekly */
  day: number;
  hour: number;
  minute: number;
  /** ISO ts */
  lastRunAt: string | null;
};

export type EmailStore = {
  smtp: SmtpConfig;
  schedules: {
    monthly: Schedule;
    weekly: Schedule;
  };
  templates: {
    monthly: string;
    weekly: string;
  };
  /** list of extra non-user emails */
  customRecipients: string[];
  /** if non-null: only these user ids. null = all users */
  selectedUserIds: string[] | null;
};

// ── storage ────────────────────────────────────────────────────────────────
const DATA_PATH = resolve(
  process.env.EMAIL_DATA_PATH || resolve(process.cwd(), "data", "email.json"),
);

const DEFAULT_MONTHLY_TEMPLATE = `---
preheader: "Combo Raport — raport miesięczny {{period_label}}"
brand_color: "#0ea5e9"
button_color: "#0ea5e9"
---

::: header
**Combo Raport** — raport miesięczny
:::

# Raport za {{period_label}} :bar_chart:

Zakres danych: **{{period_start}} 00:00:00 – {{period_end}} 23:59:59**
Wygenerowano: {{generated_at}}

## Podsumowanie

{{summary_table}}

## Lokalizacje

{{locations_table}}

::: callout bg=#f0f9ff border-radius=8px
Raport wygenerowany automatycznie na podstawie danych GoPos.
:::

::: footer
Combo Raport · raport automatyczny
:::
`;

const DEFAULT_WEEKLY_TEMPLATE = `---
preheader: "Combo Raport — raport tygodniowy {{period_label}}"
brand_color: "#8b5cf6"
button_color: "#8b5cf6"
---

::: header
**Combo Raport** — raport tygodniowy
:::

# Tydzień {{period_label}} :calendar:

Zakres danych: **{{period_start}} 00:00:00 – {{period_end}} 23:59:59**
Wygenerowano: {{generated_at}}

## Podsumowanie

{{summary_table}}

## Lokalizacje

{{locations_table}}

::: footer
Combo Raport · raport automatyczny
:::
`;

function defaultStore(): EmailStore {
  return {
    smtp: {
      host: "mail.gabe107.mikr.dev",
      port: 587,
      secure: false,
      requireTLS: true,
      user: "admin@gabe107.mikr.dev",
      pass: "Adderwear3@Exclude3@Sttitude%",
      from: "Combo Raport <admin@gabe107.mikr.dev>",
    },
    schedules: {
      monthly: { enabled: true, day: 1, hour: 0, minute: 0, lastRunAt: null },
      weekly: { enabled: true, day: 1, hour: 0, minute: 0, lastRunAt: null },
    },
    templates: {
      monthly: DEFAULT_MONTHLY_TEMPLATE,
      weekly: DEFAULT_WEEKLY_TEMPLATE,
    },
    customRecipients: [],
    selectedUserIds: null,
  };
}

let store: EmailStore | null = null;

function ensureDir(file: string) {
  mkdirSync(dirname(file), { recursive: true });
}

function loadStore(): EmailStore {
  if (store) return store;
  ensureDir(DATA_PATH);
  if (existsSync(DATA_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(DATA_PATH, "utf-8")) as Partial<EmailStore>;
      const def = defaultStore();
      store = {
        smtp: { ...def.smtp, ...(raw.smtp ?? {}) },
        schedules: {
          monthly: { ...def.schedules.monthly, ...(raw.schedules?.monthly ?? {}) },
          weekly: { ...def.schedules.weekly, ...(raw.schedules?.weekly ?? {}) },
        },
        templates: {
          monthly: raw.templates?.monthly ?? def.templates.monthly,
          weekly: raw.templates?.weekly ?? def.templates.weekly,
        },
        customRecipients: raw.customRecipients ?? [],
        selectedUserIds: raw.selectedUserIds ?? null,
      };
    } catch {
      store = defaultStore();
    }
  } else {
    store = defaultStore();
  }
  persist();
  return store;
}

function persist() {
  if (!store) return;
  ensureDir(DATA_PATH);
  writeFileSync(DATA_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function getEmailStore(): EmailStore {
  return loadStore();
}

// ── report data generation ─────────────────────────────────────────────────
export type LocationResult = {
  name: string;
  listName: string;
  nameAlias: string;
  organization_id: string;
  sales: OrdersSales | null;
  error?: string;
};

export async function gatherReport(
  dateFrom: string,
  dateTo: string,
): Promise<LocationResult[]> {
  const results: LocationResult[] = [];
  for (const loc of getLocations().filter((l) => l.status !== "closed")) {
    try {
      const data = await fetchOrders(loc.organization_id, dateFrom, dateTo);
      results.push({
        name: loc.name_alias ?? loc.organization_id,
        listName: loc.list_name ?? "",
        nameAlias: loc.name_alias ?? "",
        organization_id: loc.organization_id,
        sales: extractOrdersSales(data),
      });
    } catch (err) {
      results.push({
        name: loc.name_alias ?? loc.organization_id,
        listName: loc.list_name ?? "",
        nameAlias: loc.name_alias ?? "",
        organization_id: loc.organization_id,
        sales: null,
        error: (err as Error).message,
      });
    }
  }
  return results;
}

function formatMoneyPl(n: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatInt(n: number): string {
  return new Intl.NumberFormat("pl-PL").format(Math.round(n));
}

export function buildSummaryTable(results: LocationResult[]): string {
  let totalNet = 0;
  let totalTx = 0;
  for (const r of results) {
    if (r.sales) {
      totalNet += r.sales.net_total_money;
      totalTx += r.sales.transaction_count;
    }
  }
  const avg = totalTx > 0 ? totalNet / totalTx : 0;
  return [
    "| Wskaźnik | Wartość |",
    "|:---------|--------:|",
    `| Sprzedaż netto (suma) | ${formatMoneyPl(totalNet)} |`,
    `| Liczba transakcji | ${formatInt(totalTx)} |`,
    `| Średni paragon netto | ${formatMoneyPl(avg)} |`,
    `| Lokalizacji aktywnych | ${results.filter((r) => r.sales).length} / ${results.length} |`,
  ].join("\n");
}

export function buildLocationsTable(results: LocationResult[]): string {
  const lines = [
    "| Lokalizacja | Sprzedaż netto | Transakcje | Średni paragon |",
    "|:------------|---------------:|-----------:|---------------:|",
  ];
  for (const r of results) {
    if (r.sales) {
      lines.push(
        `| ${r.name} | ${formatMoneyPl(r.sales.net_total_money)} | ${formatInt(r.sales.transaction_count)} | ${formatMoneyPl(r.sales.average_net_money)} |`,
      );
    } else {
      lines.push(`| ${r.name} | — | — | _${r.error ?? "brak danych"}_ |`);
    }
  }
  return lines.join("\n");
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key) => vars[key] ?? "");
}

// ── period helpers ─────────────────────────────────────────────────────────
function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function previousMonthRange(now = new Date()): { from: string; to: string; label: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based
  const prevMonth0 = m === 0 ? 11 : m - 1;
  const prevYear = m === 0 ? y - 1 : y;
  const firstDay = `${prevYear}-${pad(prevMonth0 + 1)}-01`;
  const lastDate = new Date(Date.UTC(prevYear, prevMonth0 + 1, 0));
  const lastDay = `${prevYear}-${pad(prevMonth0 + 1)}-${pad(lastDate.getUTCDate())}`;
  return { from: firstDay, to: lastDay, label: `${prevYear}-${pad(prevMonth0 + 1)}` };
}

export function previousWeekRange(now = new Date()): { from: string; to: string; label: string } {
  // Previous full Monday-Sunday week
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const daysToLastSunday = dow === 0 ? 7 : dow;
  const lastSunday = new Date(d.getTime() - daysToLastSunday * 86400000);
  const lastMonday = new Date(lastSunday.getTime() - 6 * 86400000);
  const f = (x: Date) => `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
  return { from: f(lastMonday), to: f(lastSunday), label: `${f(lastMonday)} – ${f(lastSunday)}` };
}

// ── rendering ──────────────────────────────────────────────────────────────
export async function renderReportEmail(
  kind: "monthly" | "weekly",
  template: string,
  now = new Date(),
): Promise<{ subject: string; html: string; text: string }> {
  const period = kind === "monthly" ? previousMonthRange(now) : previousWeekRange(now);
  const results = await gatherReport(period.from, period.to);
  const vars: Record<string, string> = {
    period_label: period.label,
    period_start: period.from,
    period_end: period.to,
    generated_at: new Date().toISOString().replace("T", " ").slice(0, 19),
    summary_table: buildSummaryTable(results),
    locations_table: buildLocationsTable(results),
  };
  const md = interpolate(template, vars);
  const { html, text } = renderEmailMd(md);
  const subject =
    kind === "monthly"
      ? `Combo Raport — miesięczny ${period.label}`
      : `Combo Raport — tygodniowy ${period.label}`;
  return { subject, html, text };
}

// ── sending ────────────────────────────────────────────────────────────────
function buildTransport(smtp: SmtpConfig) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    requireTLS: smtp.requireTLS,
    auth: { user: smtp.user, pass: smtp.pass },
  });
}

export async function sendMail(opts: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  const s = loadStore();
  try {
    const transport = buildTransport(s.smtp);
    const info = await transport.sendMail({
      from: s.smtp.from,
      to: opts.to.join(", "),
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ── recipients ─────────────────────────────────────────────────────────────
import { getAllUsersForRecipients } from "./auth.ts";

export function resolveRecipients(): string[] {
  const s = loadStore();
  const users = getAllUsersForRecipients();
  let pool = users;
  if (s.selectedUserIds !== null) {
    const set = new Set(s.selectedUserIds);
    pool = users.filter((u) => set.has(u.id));
  }
  const emails = new Set<string>();
  for (const u of pool) if (u.email.includes("@")) emails.add(u.email);
  for (const e of s.customRecipients) if (e.includes("@")) emails.add(e);
  return Array.from(emails);
}

// ── scheduler ──────────────────────────────────────────────────────────────
async function runJob(kind: "monthly" | "weekly") {
  const s = loadStore();
  const schedule = s.schedules[kind];
  try {
    const { subject, html, text } = await renderReportEmail(kind, s.templates[kind]);
    const to = resolveRecipients();
    if (to.length === 0) {
      appendLog({ type: "report", actor: "scheduler", status: "fail", message: `${kind}: no recipients` });
      return;
    }
    const result = await sendMail({ to, subject, html, text });
    if (result.ok) {
      appendLog({
        type: "report",
        actor: "scheduler",
        status: "ok",
        message: `${kind} sent to ${to.length} recipients (${result.messageId ?? "-"})`,
      });
      schedule.lastRunAt = new Date().toISOString();
      persist();
    } else {
      appendLog({
        type: "report",
        actor: "scheduler",
        status: "fail",
        message: `${kind}: ${result.error}`,
      });
    }
  } catch (err) {
    appendLog({
      type: "report",
      actor: "scheduler",
      status: "fail",
      message: `${kind}: ${(err as Error).message}`,
    });
  }
}

function shouldFire(schedule: Schedule, kind: "monthly" | "weekly", now: Date): boolean {
  if (!schedule.enabled) return false;
  if (now.getHours() !== schedule.hour) return false;
  if (now.getMinutes() !== schedule.minute) return false;
  if (kind === "monthly") {
    if (now.getDate() !== schedule.day) return false;
    const marker = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    if (schedule.lastRunAt && schedule.lastRunAt.startsWith(marker)) return false;
    return true;
  } else {
    if (now.getDay() !== schedule.day) return false;
    if (schedule.lastRunAt) {
      const last = new Date(schedule.lastRunAt);
      if (now.getTime() - last.getTime() < 6 * 86400000) return false;
    }
    return true;
  }
}

let schedulerStarted = false;
export function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  const tick = () => {
    try {
      const s = loadStore();
      const now = new Date();
      if (shouldFire(s.schedules.monthly, "monthly", now)) void runJob("monthly");
      if (shouldFire(s.schedules.weekly, "weekly", now)) void runJob("weekly");
    } catch (err) {
      console.error("[scheduler] tick error:", (err as Error).message);
    }
  };
  setInterval(tick, 60 * 1000);
  // fire a first tick on next macrotask (so store is definitely loaded)
  setTimeout(tick, 2000);
}

// ── HTTP handlers ──────────────────────────────────────────────────────────
function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
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

export async function handleEmailRoute(
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

  if (path === "/config" && req.method === "GET") {
    // don't leak password
    json(res, 200, {
      smtp: { ...s.smtp, pass: s.smtp.pass ? "********" : "" },
      schedules: s.schedules,
      templates: s.templates,
      customRecipients: s.customRecipients,
      selectedUserIds: s.selectedUserIds,
    });
    return true;
  }

  if (path === "/smtp" && req.method === "PUT") {
    const body = (await readJson(req)) as Partial<SmtpConfig>;
    s.smtp = {
      ...s.smtp,
      ...body,
      pass: body.pass && body.pass !== "********" ? body.pass : s.smtp.pass,
      port: typeof body.port === "number" ? body.port : s.smtp.port,
    };
    persist();
    json(res, 200, { ok: true });
    return true;
  }

  const schedMatch = path.match(/^\/schedule\/(monthly|weekly)$/);
  if (schedMatch && req.method === "PUT") {
    const kind = schedMatch[1] as "monthly" | "weekly";
    const body = (await readJson(req)) as Partial<Schedule>;
    s.schedules[kind] = {
      ...s.schedules[kind],
      ...body,
    };
    persist();
    json(res, 200, { schedule: s.schedules[kind] });
    return true;
  }

  const tplMatch = path.match(/^\/template\/(monthly|weekly)$/);
  if (tplMatch && req.method === "PUT") {
    const kind = tplMatch[1] as "monthly" | "weekly";
    const body = (await readJson(req)) as { template?: string };
    if (typeof body.template === "string") {
      s.templates[kind] = body.template;
      persist();
    }
    json(res, 200, { template: s.templates[kind] });
    return true;
  }

  if (path === "/recipients" && req.method === "PUT") {
    const body = (await readJson(req)) as {
      customRecipients?: string[];
      selectedUserIds?: string[] | null;
    };
    if (Array.isArray(body.customRecipients)) {
      s.customRecipients = body.customRecipients.map((e) => e.trim()).filter(Boolean);
    }
    if (body.selectedUserIds === null || Array.isArray(body.selectedUserIds)) {
      s.selectedUserIds = body.selectedUserIds;
    }
    persist();
    json(res, 200, { ok: true });
    return true;
  }

  if (path === "/test" && req.method === "POST") {
    const body = (await readJson(req)) as { to?: string; kind?: "monthly" | "weekly" };
    const kind = body.kind === "weekly" ? "weekly" : "monthly";
    const to = body.to?.trim() || user.email;
    try {
      const { subject, html, text } = await renderReportEmail(kind, s.templates[kind]);
      const result = await sendMail({ to: [to], subject: `[TEST] ${subject}`, html, text });
      if (!result.ok) {
        appendLog({ type: "report", actor: user.email, status: "fail", message: `test ${kind}: ${result.error}` });
        json(res, 500, { error: result.error });
        return true;
      }
      appendLog({
        type: "report",
        actor: user.email,
        status: "ok",
        message: `test ${kind} → ${to} (${result.messageId ?? "-"})`,
      });
      json(res, 200, { ok: true, messageId: result.messageId });
    } catch (err) {
      json(res, 500, { error: (err as Error).message });
    }
    return true;
  }

  if (path === "/preview" && req.method === "POST") {
    const body = (await readJson(req)) as { kind?: "monthly" | "weekly"; template?: string };
    const kind = body.kind === "weekly" ? "weekly" : "monthly";
    const template = body.template ?? s.templates[kind];
    try {
      const { subject, html, text } = await renderReportEmail(kind, template);
      json(res, 200, { subject, html, text });
    } catch (err) {
      json(res, 500, { error: (err as Error).message });
    }
    return true;
  }

  return false;
}

startScheduler();
