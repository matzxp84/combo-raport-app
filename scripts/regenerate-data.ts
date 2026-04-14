#!/usr/bin/env tsx
/**
 * Regenerates public/data/T1, T2, T5 JSON files from GoPos API.
 * Run on 1st of month via cron.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { LOCATIONS } from "../src/config/locations.ts";
import {
  extractCategoriesFromItems,
  extractOrdersSales,
  fetchOrderItems,
  fetchOrders,
  monthRange,
  type CategoryRow,
  type OrdersSales,
} from "../src/server/gopos-api.ts";
import {
  aggregateCategories,
  buildT1Rows,
  buildT2Rows,
  buildT5Rows,
  type MonthInputs,
} from "../src/server/gopos-mapper.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");
const OUT_T1 = resolve(PROJECT_ROOT, "public", "data", "T1");
const OUT_T2 = resolve(PROJECT_ROOT, "public", "data", "T2");
const OUT_T5 = resolve(PROJECT_ROOT, "public", "data", "T5");

// UI hardcodes Mar 2026 as TM. We match that.
const TM_YEAR = 2026;
const TM_MONTH_0 = 3; // April
const T1_YEARS = [2026, 2025, 2024]; // newest first

/** Columns newest-first: [Mar 2026, Feb 2026, ..., Mar 2025] */
const T2_MONTH_COLUMNS: Array<{ year: number; m0: number }> = (() => {
  const out: Array<{ year: number; m0: number }> = [];
  let y = TM_YEAR;
  let m = TM_MONTH_0;
  for (let i = 0; i < 13; i++) {
    out.push({ year: y, m0: m });
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return out;
})();

function ensureDirs() {
  for (const d of [OUT_T1, OUT_T2, OUT_T5]) mkdirSync(d, { recursive: true });
}

async function fetchMonthOrders(orgId: string, year: number, m0: number): Promise<OrdersSales | null> {
  const { dateFrom, dateTo } = monthRange(year, m0);
  try {
    const data = await fetchOrders(orgId, dateFrom, dateTo);
    return extractOrdersSales(data);
  } catch (err) {
    console.warn(`  orders ${orgId} ${year}-${m0 + 1}: ${(err as Error).message}`);
    return null;
  }
}

async function fetchMonthItems(orgId: string, year: number, m0: number): Promise<CategoryRow[]> {
  const { dateFrom, dateTo } = monthRange(year, m0);
  try {
    const data = await fetchOrderItems(orgId, dateFrom, dateTo);
    return extractCategoriesFromItems(data);
  } catch (err) {
    console.warn(`  items ${orgId} ${year}-${m0 + 1}: ${(err as Error).message}`);
    return [];
  }
}

async function processLocation(loc: { list_id: string; organization_id: string; name_alias: string }) {
  const orgId = loc.organization_id;
  const fileSuffix = `${loc.list_id}${orgId}`;
  console.log(`[${loc.name_alias}] org=${orgId}`);

  // Fetch orders for all months in T1 years (36 months max)
  const monthlyNet: Record<number, (number | null)[]> = {};
  const ordersByKey: Record<string, OrdersSales | null> = {};
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth0 = now.getMonth();

  for (const y of T1_YEARS) {
    monthlyNet[y] = Array(12).fill(null);
    for (let m = 0; m < 12; m++) {
      if (y > currentYear || (y === currentYear && m > currentMonth0)) continue;
      const orders = await fetchMonthOrders(orgId, y, m);
      ordersByKey[`${y}-${m}`] = orders;
      monthlyNet[y][m] = orders?.net_total_money ?? null;
    }
  }

  // T1
  const t1 = buildT1Rows(monthlyNet, T1_YEARS, TM_YEAR, TM_MONTH_0);
  writeFileSync(resolve(OUT_T1, `T1${fileSuffix}.json`), JSON.stringify(t1, null, 2), "utf-8");

  // T2: 13 months. Fetch items for each (reuse orders).
  const monthInputs: MonthInputs[] = [];
  for (const col of T2_MONTH_COLUMNS) {
    const orders = ordersByKey[`${col.year}-${col.m0}`] ?? null;
    const items = await fetchMonthItems(orgId, col.year, col.m0);
    const categories = aggregateCategories(items);
    monthInputs.push({ orders, categories });
  }
  const t2 = buildT2Rows(monthInputs);
  writeFileSync(resolve(OUT_T2, `T2${fileSuffix}.json`), JSON.stringify(t2, null, 2), "utf-8");

  // T5: API-only (all placeholders in static JSON)
  const t5 = buildT5Rows();
  writeFileSync(resolve(OUT_T5, `T5${fileSuffix}.json`), JSON.stringify(t5, null, 2), "utf-8");
}

async function main() {
  ensureDirs();
  const only = process.env.ONLY_ORG_ID;
  const locs = only ? LOCATIONS.filter((l) => l.organization_id === only) : LOCATIONS;
  console.log(`Processing ${locs.length} location(s)`);
  let ok = 0;
  let fail = 0;
  for (const loc of locs) {
    try {
      await processLocation(loc);
      ok += 1;
    } catch (err) {
      fail += 1;
      console.error(`FAILED ${loc.name_alias}: ${(err as Error).message}`);
    }
  }
  console.log(`Done. ok=${ok} fail=${fail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
