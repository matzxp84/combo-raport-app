import { getAuthHeaders } from "./gopos-auth.ts";

const BASE_URL = process.env.GOPOS_BASE_URL ?? "https://app.gopos.io";

type RawMoney = { amount?: number | string } | number | string | null | undefined;
type RawSales = Record<string, RawMoney>;

export type OrdersSales = {
  transaction_count: number;
  total_money: number;
  net_total_money: number;
  discount_money: number;
  sub_total_money: number;
  tax_money: number;
  net_profit_money: number;
  net_production_money: number;
  average_money: number;
  average_net_money: number;
};

export type CategoryRow = {
  name: string;
  quantity: number;
  total_money: number;
  net_total_money: number;
};

function getAmount(sales: RawSales, key: string): number {
  const camel = key
    .split("_")
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");
  const raw = sales[key] ?? sales[camel];
  if (raw == null) return 0;
  if (typeof raw === "object") {
    const amt = (raw as { amount?: number | string }).amount;
    return typeof amt === "string" ? parseFloat(amt) || 0 : Number(amt ?? 0);
  }
  return typeof raw === "string" ? parseFloat(raw) || 0 : Number(raw);
}

function getNumber(sales: RawSales, key: string): number {
  const raw = sales[key];
  if (raw == null) return 0;
  if (typeof raw === "object") return Number((raw as { amount?: number }).amount ?? 0);
  return typeof raw === "string" ? parseFloat(raw) || 0 : Number(raw);
}

function formatDateRange(dateFrom: string, dateTo: string): string {
  // Legacy format uses 00:30 offset (POS day start).
  return `${dateFrom} 00:30:00,${dateTo} 00:30:00`;
}

export async function fetchOrders(
  organizationId: string,
  dateFrom: string,
  dateTo: string
): Promise<unknown> {
  const headers = await getAuthHeaders(organizationId);
  const params = new URLSearchParams({
    organization_id: organizationId,
    date_range: formatDateRange(dateFrom, dateTo),
  });
  const url = `${BASE_URL}/api/v3/reports/orders?${params.toString()}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`orders ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function fetchOrderItems(
  organizationId: string,
  dateFrom: string,
  dateTo: string
): Promise<unknown> {
  const headers = await getAuthHeaders(organizationId);
  const params = new URLSearchParams({
    organization_id: organizationId,
    date_range: formatDateRange(dateFrom, dateTo),
    groups: "NONE,PRODUCT_CATEGORY",
  });
  const url = `${BASE_URL}/api/v3/reports/order_items?${params.toString()}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`order_items ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

type ReportsResponse = {
  reports?: Array<{
    data?: Array<{ aggregate?: { sales?: RawSales } }>;
    sub_report?: Array<{
      aggregate?: { sales?: RawSales };
      group_by_type?: string;
      group_by_value?: { name?: string };
    }>;
    aggregate?: { sales?: RawSales };
  }>;
};

export function extractOrdersSales(data: unknown): OrdersSales | null {
  const d = data as ReportsResponse;
  const reports = d?.reports ?? [];
  if (!reports.length) return null;
  const first = reports[0];
  const dataList = first.data ?? first.sub_report ?? [];
  let agg: { sales?: RawSales } | undefined;
  if (dataList.length > 0) agg = dataList[0].aggregate;
  if (!agg) agg = first.aggregate;
  const sales = agg?.sales;
  if (!sales) return null;
  return {
    transaction_count: getNumber(sales, "transaction_count"),
    total_money: getAmount(sales, "total_money"),
    net_total_money: getAmount(sales, "net_total_money"),
    discount_money: getAmount(sales, "discount_money"),
    sub_total_money: getAmount(sales, "sub_total_money"),
    tax_money: getAmount(sales, "tax_money"),
    net_profit_money: getAmount(sales, "net_profit_money"),
    net_production_money: getAmount(sales, "net_production_money"),
    average_money: getAmount(sales, "average_money"),
    average_net_money: getAmount(sales, "average_net_money"),
  };
}

export function extractCategoriesFromItems(data: unknown): CategoryRow[] {
  const d = data as ReportsResponse;
  const out: CategoryRow[] = [];
  for (const report of d?.reports ?? []) {
    for (const sub of report.sub_report ?? []) {
      if (sub.group_by_type !== "PRODUCT_CATEGORY") continue;
      const sales = sub.aggregate?.sales;
      if (!sales) continue;
      out.push({
        name: sub.group_by_value?.name ?? "—",
        quantity: getNumber(sales, "product_quantity") || getNumber(sales, "transaction_count"),
        total_money: getAmount(sales, "total_money"),
        net_total_money: getAmount(sales, "net_total_money"),
      });
    }
  }
  return out;
}

export type MonthRange = {
  dateFrom: string; // YYYY-MM-DD (inclusive)
  dateTo: string; // YYYY-MM-DD (exclusive, next month start)
};

export function monthRange(year: number, monthIndex0: number): MonthRange {
  const y1 = monthIndex0 === 11 ? year + 1 : year;
  const m1 = monthIndex0 === 11 ? 0 : monthIndex0 + 1;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return {
    dateFrom: `${year}-${pad(monthIndex0 + 1)}-01`,
    dateTo: `${y1}-${pad(m1 + 1)}-01`,
  };
}

export function ytdRange(year: number, today = new Date()): MonthRange {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
  return {
    dateFrom: `${year}-01-01`,
    dateTo: `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`,
  };
}
