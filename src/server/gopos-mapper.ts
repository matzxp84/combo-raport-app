import type { CategoryRow, OrdersSales } from "./gopos-api.ts";

export const PIZZA_CATEGORIES = new Set([
  "PIZZE BESTSELLERY",
  "PIZZE PREMIUM",
  "PIZZE WYJĄTKOWE",
  "PIZZE WŁOSKIE",
  "PIZZE DNIA",
  "PIZZE PROMOCJA",
  "PIZZE WOW",
  "PIZZE PÓL NA PÓŁ",
  "PIZZE SERCE",
  "PIZZA PÓL NA PÓŁ",
  "PIZZA SERCE",
  "Produkty do kategorii promocje",
]);

export const DRINK_CATEGORIES = new Set([
  "NAPOJE ZIMNE",
  "NAPOJE GORĄCE",
  "PIWO",
  "PIWO 0%",
]);

export const ADDON_CATEGORIES = new Set([
  "DODATKI DO PIZZY",
  "DODATKOWE SOSY",
  "RODZAJ CIASTA",
]);

export const STARTER_CATEGORIES = new Set(["STARTERY"]);

export type CategoryAggregate = {
  totalNet: number;
  pizzaNet: number;
  pizzaQty: number;
  drinksNet: number;
  drinksQty: number;
  addonsNet: number;
  startersNet: number;
  othersQty: number;
};

export function aggregateCategories(rows: CategoryRow[]): CategoryAggregate {
  const a: CategoryAggregate = {
    totalNet: 0,
    pizzaNet: 0,
    pizzaQty: 0,
    drinksNet: 0,
    drinksQty: 0,
    addonsNet: 0,
    startersNet: 0,
    othersQty: 0,
  };
  for (const r of rows) {
    const net = r.net_total_money ?? 0;
    const qty = r.quantity ?? 0;
    a.totalNet += net;
    if (PIZZA_CATEGORIES.has(r.name)) {
      a.pizzaNet += net;
      a.pizzaQty += qty;
    } else if (DRINK_CATEGORIES.has(r.name)) {
      a.drinksNet += net;
      a.drinksQty += qty;
    } else if (ADDON_CATEGORIES.has(r.name)) {
      a.addonsNet += net;
    } else if (STARTER_CATEGORIES.has(r.name)) {
      a.startersNet += net;
    } else {
      a.othersQty += qty;
    }
  }
  return a;
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  const rounded = Math.round(n * 100) / 100;
  const s = rounded.toFixed(2).replace(".", ",");
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatPercent(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${Math.round(n * 10) / 10}%`;
}

export function formatQuantity(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  const rounded = Math.round(n * 100) / 100;
  const s = rounded.toFixed(2).replace(".", ",");
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatInteger(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  const rounded = Math.round(n);
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// ------- T1 -------

export type T1Cell = { value: string; highlight?: boolean; highlightBg?: boolean };
export type T1Row = { id: string; label: string; cells: T1Cell[] };

/** Month order for the UI (14 cells): Jan..Dec, Łącznie, Średnia. */
export function buildT1Rows(
  monthlyNetByYear: Record<number, (number | null)[]>, // [Jan..Dec], null = no data
  years: number[], // newest first, e.g. [2026, 2025, 2024]
  currentYear: number,
  currentMonthIndex0: number,
): T1Row[] {
  const rows: T1Row[] = [];
  for (let i = 0; i < years.length; i++) {
    const y = years[i];
    const months = monthlyNetByYear[y] ?? Array(12).fill(null);
    // Exclude TM month from sum/avg — that value is API-only.
    const present = months.map((v, m) => {
      if (y === currentYear && m === currentMonthIndex0) return 0;
      return v == null ? 0 : v;
    });
    const sum = present.reduce((a, b) => a + b, 0);
    const nonZero = present.filter((v) => v > 0);
    const avg = nonZero.length > 0 ? sum / nonZero.length : 0;
    const cells: T1Cell[] = months.map((v, m) => {
      const isTM = y === currentYear && m === currentMonthIndex0;
      if (isTM) return { value: "-" };
      if (v == null || v === 0) return { value: "-" };
      return { value: formatInteger(v) };
    });
    cells.push({ value: sum > 0 ? formatInteger(sum) : "-" });
    cells.push({ value: avg > 0 ? formatInteger(avg) : "-" });
    rows.push({ id: String(y), label: String(y), cells });

    const prev = years[i + 1];
    if (prev != null) {
      const prevMonths = monthlyNetByYear[prev] ?? Array(12).fill(null);
      const vsCells: T1Cell[] = [];
      for (let m = 0; m < 12; m++) {
        const cur = months[m];
        const prv = prevMonths[m];
        const isTMcol = y === currentYear && m === currentMonthIndex0;
        if (isTMcol || cur == null || prv == null || prv === 0) {
          vsCells.push({ value: "-" });
        } else {
          const pct = Math.round((cur / prv) * 100);
          vsCells.push({ value: `${pct}%` });
        }
      }
      const prevSum = (prevMonths.filter((v) => v != null) as number[]).reduce((a, b) => a + b, 0);
      vsCells.push({ value: prevSum > 0 && sum > 0 ? `${Math.round((sum / prevSum) * 100)}%` : "-" });
      const prevNonZero = (prevMonths.filter((v) => v != null && v > 0) as number[]);
      const prevAvg = prevNonZero.length > 0 ? prevNonZero.reduce((a, b) => a + b, 0) / prevNonZero.length : 0;
      vsCells.push({ value: prevAvg > 0 && avg > 0 ? `${Math.round((avg / prevAvg) * 100)}%` : "-" });
      rows.push({ id: `${y}vs${prev}`, label: `${y} vs ${prev}`, cells: vsCells });
    }
  }
  return rows;
}

// ------- T2 -------

export type T2Row = { id: string; label: string; cells: string[] };

export type MonthInputs = {
  orders: OrdersSales | null;
  categories: CategoryAggregate | null;
};

/** monthInputs: newest-first array length=13 (Mar2026 ... Mar2025). */
export function buildT2Rows(monthInputs: MonthInputs[]): T2Row[] {
  const calc = monthInputs.map(({ orders, categories }) => {
    const netTotal = orders?.net_total_money ?? 0;
    const txCount = orders?.transaction_count ?? 0;
    const avgNet = orders?.average_net_money ?? 0;
    const pizzaNet = categories?.pizzaNet ?? netTotal;
    const drinksNet = categories?.drinksNet ?? 0;
    const addonsNet = categories?.addonsNet ?? 0;
    const startersNet = categories?.startersNet ?? 0;
    const othersQty = categories?.othersQty ?? 0;
    const totalProd = categories?.totalNet ?? netTotal;
    const drinksPct = totalProd > 0 ? (drinksNet / totalProd) * 100 : null;
    return { avgNet, txCount, pizzaNet, drinksNet, addonsNet, startersNet, othersQty, drinksPct };
  });

  const specs: Array<{ id: string; label: string; fn: (c: (typeof calc)[number]) => string }> = [
    { id: "avg-sales", label: "Średnia sprzedaż", fn: (c) => formatMoney(c.avgNet) },
    { id: "customers-count", label: "Ilość klientów", fn: (c) => formatQuantity(c.txCount) },
    { id: "other-sales-qty", label: "Sprzedaż pozostałe", fn: (c) => formatQuantity(c.othersQty) },
    { id: "customers-yoy", label: "Klienci vs rok poprzedni %", fn: () => "-" },
    { id: "sales-pizza-total", label: "Pizza", fn: (c) => formatMoney(c.pizzaNet) },
    { id: "pizzas-yoy", label: "Pizze vs rok poprzedni %", fn: () => "-" },
    { id: "drinks-sales", label: "Napoje", fn: (c) => formatMoney(c.drinksNet) },
    { id: "drinks-pct", label: "Sprzedaż napoje %", fn: (c) => formatPercent(c.drinksPct) },
    { id: "addons-sales", label: "Sprzedaż dodatków", fn: (c) => formatMoney(c.addonsNet) },
    { id: "starters-sales", label: "Startery", fn: (c) => formatMoney(c.startersNet) },
    { id: "avg-bill", label: "Średni rachunek", fn: (c) => formatMoney(c.avgNet) },
  ];

  return specs.map((s) => ({
    id: s.id,
    label: s.label,
    cells: calc.map((c, i) => (i === 0 ? "-" : s.fn(c))),
  }));
}

// ------- T5 -------

export type T5Row = { id: string; category: string; ytd: string };

export function buildT5Rows(): T5Row[] {
  // T5 is API-only (current state). Static JSON contains placeholders.
  return [
    { id: "total", category: "Łącznie", ytd: "-" },
    { id: "pizza", category: "Pizze", ytd: "-" },
    { id: "other-sales-qty", category: "Pozostałe", ytd: "-" },
    { id: "drinks", category: "Napoje", ytd: "-" },
  ];
}
