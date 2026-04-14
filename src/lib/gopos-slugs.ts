/**
 * GOPOS API field slugs mapped to T1/T2/T5 rows & columns.
 * Source of truth: src/server/gopos-api.ts OrdersSales type + docs from client.
 * Placeholder mapping — confirm with domain owner before treating as authoritative.
 */

export const GOPOS_T1_COL_SLUGS: Record<string, string> = {
  "01": "month_01",
  "02": "month_02",
  "03": "month_03",
  "04": "month_04",
  "05": "month_05",
  "06": "month_06",
  "07": "month_07",
  "08": "month_08",
  "09": "month_09",
  "10": "month_10",
  "11": "month_11",
  "12": "month_12",
  suma: "sum_total",
  srednia: "avg_month",
};

export const GOPOS_T2_COL_SLUGS: Record<string, string> = {
  TM: "this_month",
  MR: "month_ref",
  M1: "m_minus_1",
  M2: "m_minus_2",
  M3: "m_minus_3",
  M4: "m_minus_4",
  M5: "m_minus_5",
  M6: "m_minus_6",
  M7: "m_minus_7",
  M8: "m_minus_8",
  M9: "m_minus_9",
  M10: "m_minus_10",
  M11: "m_minus_11",
};

export const GOPOS_ROW_SLUGS: Record<string, string> = {
  // T1 rows
  "2026": "net_total_money",
  "2026vs2025": "net_total_money_yoy",
  "2025": "net_total_money_ly",
  "2025vs2024": "net_total_money_ly_yoy",
  "2024": "net_total_money_ay",
  "2024vs2023": "net_total_money_ay_yoy",
  // T2 rows
  "avg-sales": "avg_sales",
  "customers-count": "transaction_count",
  "other-sales-qty": "other_sales_quantity",
  "customers-yoy": "customers_yoy_pct",
  "sales-pizza-total": "pizza_sales_total",
  "pizzas-yoy": "pizzas_yoy_pct",
  "drinks-sales": "drinks_sales",
  "drinks-pct": "drinks_sales_pct",
  "addons-sales": "addons_sales",
  "starters-sales": "starters_sales",
  "avg-bill": "avg_bill",
  // T5 rows
  total: "ytd_total",
  pizza: "ytd_pizza",
  drinks: "ytd_drinks",
};
