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

const TM_YEAR = 2026;
const TM_MONTH_0 = 3; // April

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

export function goposApiPlugin(): Plugin {
  return {
    name: "gopos-api",
    configureServer(server) {
      server.middlewares.use("/api/gopos", async (req, res, next) => {
        try {
          const url = new URL(req.url ?? "", "http://localhost");
          const path = url.pathname;
          const orgId = getOrgId(req);
          if (!orgId) return json(res, 400, { error: "missing ?org=" });
          if (!knownOrg(orgId)) return json(res, 404, { error: "unknown org" });

          if (path === "/t1/current") return await handleT1Current(orgId, res);
          if (path === "/t2/current") return await handleT2Current(orgId, res);
          if (path === "/t5/current") return await handleT5Current(orgId, res);
          return next();
        } catch (err) {
          json(res, 500, { error: (err as Error).message });
        }
      });
    },
  };
}
