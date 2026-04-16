import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

import { LOCATIONS } from "../config/locations.ts";
import {
  extractCategoriesFromItems,
  extractOrdersSales,
  fetchOrderItems,
  fetchOrders,
  monthRange,
  ytdRange,
} from "./gopos-api.ts";
import {
  aggregateCategories,
  formatInteger,
  formatMoney,
  formatPercent,
  formatQuantity,
} from "./gopos-mapper.ts";
import {
  appendLog,
  handleAdminRoute,
  handleAuthRoute,
  requireAuth,
} from "./auth.ts";
import { handleEmailRoute } from "./email.ts";

const now = new Date();
const TM_YEAR = now.getFullYear();
const TM_MONTH_0 = now.getMonth();

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function getOrgId(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? "", "http://localhost");
  return url.searchParams.get("org") ?? null;
}

function knownOrg(orgId: string): boolean {
  return LOCATIONS.some((l) => l.organization_id === orgId);
}

async function handleT1Current(orgId: string, res: ServerResponse) {
  const { dateFrom, dateTo } = monthRange(TM_YEAR, TM_MONTH_0);
  try {
    const data = await fetchOrders(orgId, dateFrom, dateTo);
    const sales = extractOrdersSales(data);
    const net = sales?.net_total_money ?? 0;
    json(res, 200, { value: net > 0 ? formatInteger(net) : "0", net });
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
}

async function handleT2Current(orgId: string, res: ServerResponse) {
  const { dateFrom, dateTo } = monthRange(TM_YEAR, TM_MONTH_0);
  try {
    const [ordersData, itemsData] = await Promise.all([
      fetchOrders(orgId, dateFrom, dateTo),
      fetchOrderItems(orgId, dateFrom, dateTo),
    ]);
    const orders = extractOrdersSales(ordersData);
    const cats = aggregateCategories(extractCategoriesFromItems(itemsData));
    const netTotal = orders?.net_total_money ?? 0;
    const avgNet = orders?.average_net_money ?? 0;
    const txCount = orders?.transaction_count ?? 0;
    const pizzaNet = cats.pizzaNet || netTotal;
    const totalProd = cats.totalNet || netTotal;
    const drinksPct = totalProd > 0 ? (cats.drinksNet / totalProd) * 100 : null;
    const cells: Record<string, string> = {
      "avg-sales": formatMoney(avgNet),
      "customers-count": formatQuantity(txCount),
      "other-sales-qty": formatQuantity(cats.othersQty),
      "customers-yoy": "-",
      "sales-pizza-total": formatMoney(pizzaNet),
      "pizzas-yoy": "-",
      "drinks-sales": formatMoney(cats.drinksNet),
      "drinks-pct": formatPercent(drinksPct),
      "addons-sales": formatMoney(cats.addonsNet),
      "starters-sales": formatMoney(cats.startersNet),
      "avg-bill": formatMoney(avgNet),
    };
    json(res, 200, { cells });
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
}

async function handleT5Current(orgId: string, res: ServerResponse) {
  const { dateFrom, dateTo } = ytdRange(TM_YEAR);
  try {
    const [ordersData, itemsData] = await Promise.all([
      fetchOrders(orgId, dateFrom, dateTo),
      fetchOrderItems(orgId, dateFrom, dateTo),
    ]);
    const orders = extractOrdersSales(ordersData);
    const agg = aggregateCategories(extractCategoriesFromItems(itemsData));
    const totalNet = orders?.net_total_money ?? 0;
    const pizzaNet = agg.pizzaNet || totalNet;
    const rows = [
      { id: "total", category: "Łącznie", ytd: totalNet > 0 ? formatMoney(totalNet) : "-" },
      { id: "pizza", category: "Pizze", ytd: pizzaNet > 0 ? formatMoney(pizzaNet) : "-" },
      { id: "other-sales-qty", category: "Pozostałe", ytd: agg.othersQty > 0 ? String(agg.othersQty) : "-" },
      { id: "drinks", category: "Napoje", ytd: agg.drinksNet > 0 ? formatMoney(agg.drinksNet) : "-" },
    ];
    json(res, 200, { rows, totalNetLabel: totalNet > 0 ? `${formatMoney(totalNet)} zł` : "-" });
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
}

export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "", "http://localhost");
  const pathname = url.pathname;

  if (pathname.startsWith("/api/auth/")) {
    return handleAuthRoute(pathname.slice("/api/auth".length), req, res);
  }

  if (pathname.startsWith("/api/admin/email/")) {
    return handleEmailRoute(pathname.slice("/api/admin/email".length), req, res);
  }

  if (pathname.startsWith("/api/admin/")) {
    return handleAdminRoute(pathname.slice("/api/admin".length), req, res);
  }

  if (pathname.startsWith("/api/gopos/")) {
    const user = requireAuth(req, res);
    if (!user) return true;
    const sub = pathname.slice("/api/gopos".length);
    const orgId = getOrgId(req);
    if (!orgId) {
      json(res, 400, { error: "missing ?org=" });
      return true;
    }
    if (!knownOrg(orgId)) {
      json(res, 404, { error: "unknown org" });
      return true;
    }
    try {
      if (sub === "/t1/current") {
        await handleT1Current(orgId, res);
      } else if (sub === "/t2/current") {
        await handleT2Current(orgId, res);
      } else if (sub === "/t5/current") {
        await handleT5Current(orgId, res);
      } else {
        json(res, 404, { error: "unknown gopos route" });
        return true;
      }
      appendLog({
        type: "api",
        actor: user.email,
        status: res.statusCode >= 400 ? "fail" : "ok",
        message: `${sub} org=${orgId} → ${res.statusCode}`,
      });
    } catch (err) {
      appendLog({
        type: "api",
        actor: user.email,
        status: "fail",
        message: `${sub} ${(err as Error).message}`,
      });
      if (!res.headersSent) json(res, 500, { error: (err as Error).message });
    }
    return true;
  }

  return false;
}

export function goposApiPlugin(): Plugin {
  return {
    name: "gopos-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const handled = await handleApi(req, res);
          if (!handled) next();
        } catch (err) {
          json(res, 500, { error: (err as Error).message });
        }
      });
    },
  };
}
