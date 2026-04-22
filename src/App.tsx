import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useTheme } from "@/components/theme-provider";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarInset,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  UserCircle,
  ArrowUpDown,
  ArrowDown,
  ArrowUp as ArrowUpIcon,
  Columns3,
  User,
  Settings,
  LogOut,
  BarChart3,
  TrendingUp,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FetchButton } from "@/components/fetch-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  InfoTooltipContent,
} from "@/components/ui/tooltip";
import { loggedFetch } from "@/lib/loggedFetch";
import { useLogContext } from "@/contexts/useLog";
import { useAuth } from "@/contexts/useAuth";
import { LoginPage } from "@/components/LoginPage";
import { AdminPanel } from "@/components/AdminPanel";
import { TableConsole } from "@/components/TableConsole";
import { GOPOS_ROW_SLUGS, GOPOS_T1_COL_SLUGS, GOPOS_T2_COL_SLUGS } from "@/lib/gopos-slugs";
import { T1VolumeChart } from "@/components/charts/T1VolumeChart";
import { T2KpiChart } from "@/components/charts/T2KpiChart";
import { T5YtdChart } from "@/components/charts/T5YtdChart";

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

function DarkModeToggle({ sidebar }: { sidebar?: boolean } = {}) {
  const { theme, setTheme } = useTheme();
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY);
    const update = () => setSystemPrefersDark(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, []);

  const resolvedTheme = useMemo(() => {
    if (theme === "system") return systemPrefersDark ? "dark" : "light";
    return theme;
  }, [systemPrefersDark, theme]);

  const isDark = resolvedTheme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");

  if (sidebar) {
    return (
      <SidebarMenuButton tooltip={isDark ? "Tryb jasny" : "Tryb ciemny"} onClick={toggle}>
        {isDark
          ? <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
          : <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        }
        <span>{isDark ? "Tryb jasny" : "Tryb ciemny"}</span>
      </SidebarMenuButton>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Dark mode</span>
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        aria-label="Toggle dark mode"
      />
    </div>
  );
}

type MonthDef = { label: string; id: string };
const MONTHS: MonthDef[] = [
  { label: "Styczeń", id: "01" },
  { label: "Luty", id: "02" },
  { label: "Marzec", id: "03" },
  { label: "Kwiecień", id: "04" },
  { label: "Maj", id: "05" },
  { label: "Czerwiec", id: "06" },
  { label: "Lipiec", id: "07" },
  { label: "Sierpień", id: "08" },
  { label: "Wrzesień", id: "09" },
  { label: "Październik", id: "10" },
  { label: "Listopad", id: "11" },
  { label: "Grudzień", id: "12" },
];

function getDisplayRowId(label: string, fallbackId: string): string {
  // Example: 2026 -> TY, 2025 -> LY, 2024 -> AY
  const yearOnlyMatch = label.match(/^(\d{4})$/);
  if (yearOnlyMatch) {
    const year = yearOnlyMatch[1];
    if (year === "2026") return "TY";
    if (year === "2025") return "LY";
    if (year === "2024") return "AY";
    return year.slice(-2);
  }

  // Example: 2026 vs 2025 -> VS1, 2025 vs 2024 -> VS2 (custom mapping)
  const yearVsMatch = label.match(/^(\d{4})\s+vs\s+(\d{4})$/);
  if (yearVsMatch) {
    if (yearVsMatch[1] === "2026" && yearVsMatch[2] === "2025") {
      return "VS1";
    }
    if (yearVsMatch[1] === "2025" && yearVsMatch[2] === "2024") {
      return "VS2";
    }
    return `${yearVsMatch[1].slice(-1)}V${yearVsMatch[2].slice(-1)}`;
  }

  return fallbackId;
}

function getBaseYearTwoDigits(label: string, fallbackId: string): string {
  // Reuse display ID logic for base prefix in T1 cell IDs.
  // Examples:
  //  - "2026"          -> "TY"
  //  - "2025"          -> "LY"
  //  - "2024"          -> "AY"
  //  - "2026 vs 2025"  -> "VS1"
  //  - "2025 vs 2024"  -> "VS2"
  const displayId = getDisplayRowId(label, fallbackId);
  if (displayId && displayId !== fallbackId) return displayId;

  // Fallbacks for any unexpected labels:
  // try to derive two-digit year from label or id.
  const yearVsMatch = label.match(/^(\d{4})\s+vs\s+(\d{4})$/);
  if (yearVsMatch) return yearVsMatch[1].slice(-2);

  const yearOnlyMatch = label.match(/^(\d{4})$/);
  if (yearOnlyMatch) return yearOnlyMatch[1].slice(-2);

  const fallbackYearMatch = fallbackId.match(/^(\d{4})/);
  if (fallbackYearMatch) return fallbackYearMatch[1].slice(-2);

  return fallbackId.slice(-2);
}

/** T1 month cell ID: TY+03 -> TYLM, TY+04 -> TYTM, TY+05 -> TYNM, otherwise base+monthId. */
function getT1MonthCellId(baseYearTwoDigits: string, monthId: string): string {
  if (baseYearTwoDigits === "TY" && monthId === "03") return "TYLM";
  if (baseYearTwoDigits === "TY" && monthId === "04") return "TYTM";
  if (baseYearTwoDigits === "TY" && monthId === "05") return "TYNM";
  return `${baseYearTwoDigits}${monthId}`;
}

type CellValue = {
  value: string;
  highlight?: boolean;
  highlightBg?: boolean;
  fromApi?: boolean;
};

type ReportRow = {
  id: string;
  label: string;
  cells: CellValue[];
};

const reportData: ReportRow[] = [
  {
    id: "2026",
    label: "2026",
    cells: [
      { value: "-" },
      { value: "-" },
      { value: "-" },
      { value: "-" },
      { value: "-" },
      { value: "-" },
      { value: "-" },
      { value: "-" },
      { value: "-" },
      { value: "-" },
      { value: "-" },
      { value: "-" },
      { value: "-" },
      { value: "-" },
    ],
  },
  {
    id: "2026vs2025",
    label: "2026 vs 2025",
    cells: [
      { value: "95%" },
      { value: "83%" },
      { value: "0%" },
      { value: "0%" },
      { value: "0%" },
      { value: "0%" },
      { value: "0%" },
      { value: "0%" },
      { value: "0%" },
      { value: "0%" },
      { value: "0%" },
      { value: "0%" },
      { value: "17%" },
      { value: "68%" },
    ],
  },
  {
    id: "2025",
    label: "2025",
    cells: [
      { value: "93 165" },
      { value: "95 511" },
      { value: "104 784" },
      { value: "88 060" },
      { value: "104 235" },
      { value: "109 205" },
      { value: "91 881" },
      { value: "99 332" },
      { value: "90 671" },
      { value: "99 167" },
      { value: "92 313" },
      { value: "92 220" },
      { value: "1 160 543" },
      { value: "96 712" },
    ],
  },
  {
    id: "2025vs2024",
    label: "2025 vs 2024",
    cells: [
      { value: "116%" },
      { value: "113%" },
      { value: "123%" },
      { value: "96%" },
      { value: "112%" },
      { value: "111%" },
      { value: "108%" },
      { value: "102%" },
      { value: "102%" },
      { value: "99%" },
      { value: "96%" },
      { value: "79%" },
      { value: "104%" },
      { value: "104%" },
    ],
  },
  {
    id: "2024",
    label: "2024",
    cells: [
      { value: "80 077" },
      { value: "84 717" },
      { value: "85 118" },
      { value: "91 842" },
      { value: "92 730" },
      { value: "98 218" },
      { value: "85 418" },
      { value: "96 921" },
      { value: "88 714" },
      { value: "99 855" },
      { value: "95 969" },
      { value: "117 031" },
      { value: "1 116 608" },
      { value: "93 051" },
    ],
  },
  {
    id: "2024vs2023",
    label: "2024 vs 2023",
    cells: [
      { value: "X", highlight: true },
      { value: "X", highlight: true },
      { value: "X", highlight: true },
      { value: "X", highlight: true },
      { value: "X", highlight: true },
      { value: "X", highlight: true },
      { value: "401 213%", highlight: true, highlightBg: true },
      { value: "X", highlight: true },
      { value: "X", highlight: true },
      { value: "377%", highlight: true },
      { value: "117%" },
      { value: "126%" },
      { value: "554%", highlight: true },
      { value: "185%", highlight: true },
    ],
  },
];

function CellContent({
  cell,
  hidePercent = false,
}: {
  cell: CellValue;
  hidePercent?: boolean;
}) {
  let displayValue = cell.value;
  if (hidePercent && typeof displayValue === "string" && displayValue.endsWith("%")) {
    displayValue = displayValue.slice(0, -1);
  }
  return (
    <span
      className={`
        text-right tabular-nums
        ${cell.fromApi ? "text-emerald-500 dark:text-emerald-400 font-semibold" : ""}
        ${cell.highlight && !cell.fromApi ? "text-amber-500 dark:text-amber-400" : ""}
        ${cell.highlightBg ? "bg-amber-500/15 dark:bg-amber-500/20 rounded px-1" : ""}
      `}
    >
      {displayValue}
    </span>
  );
}

/** Fixed month columns for T2: label + date range timestamps. */
const KPI_MONTH_COLUMNS = [
  { label: "Kwi 2026", from: "2026-04-01 00:00:00", to: "2026-04-30 23:59:59" },
  { label: "Mar 2026", from: "2026-03-01 00:00:00", to: "2026-03-31 23:59:59" },
  { label: "Lut 2026", from: "2026-02-01 00:00:00", to: "2026-02-28 23:59:59" },
  { label: "Sty 2026", from: "2026-01-01 00:00:00", to: "2026-01-31 23:59:59" },
  { label: "Gru 2025", from: "2025-12-01 00:00:00", to: "2025-12-31 23:59:59" },
  { label: "Lis 2025", from: "2025-11-01 00:00:00", to: "2025-11-30 23:59:59" },
  { label: "Paź 2025", from: "2025-10-01 00:00:00", to: "2025-10-31 23:59:59" },
  { label: "Wrz 2025", from: "2025-09-01 00:00:00", to: "2025-09-30 23:59:59" },
  { label: "Sie 2025", from: "2025-08-01 00:00:00", to: "2025-08-31 23:59:59" },
  { label: "Lip 2025", from: "2025-07-01 00:00:00", to: "2025-07-31 23:59:59" },
  { label: "Cze 2025", from: "2025-06-01 00:00:00", to: "2025-06-30 23:59:59" },
  { label: "Maj 2025", from: "2025-05-01 00:00:00", to: "2025-05-31 23:59:59" },
  { label: "Kwi 2025", from: "2025-04-01 00:00:00", to: "2025-04-30 23:59:59" },
] as const;

const KPI_MONTH_COUNT = KPI_MONTH_COLUMNS.length;

type KpiRow = {
  id: string;
  label: string;
  cells: string[];
};

/** T2: exactly 11 indicators in order A–K. */
const T2_ROW_ORDER = [
  "avg-sales",
  "customers-count",
  "other-sales-qty",
  "customers-yoy",
  "sales-pizza-total",
  "pizzas-yoy",
  "drinks-sales",
  "drinks-pct",
  "addons-sales",
  "starters-sales",
  "avg-bill",
] as const;

/** Display labels for T2. */
const KPI_LABELS_T2_T3_DEF: Record<string, string> = {
  "avg-sales": "Średnia sprzedaż",
  "customers-count": "Ilość klientów",
  "other-sales-qty": "Sprzedaż pozostałe",
  "customers-yoy": "Klienci vs rok poprzedni %",
  "sales-pizza-total": "Pizza",
  "pizzas-yoy": "Pizze vs rok poprzedni %",
  "drinks-sales": "Napoje",
  "drinks-pct": "Sprzedaż napoje %",
  "addons-sales": "Sprzedaż dodatków",
  "starters-sales": "Startery",
  "avg-bill": "Średni rachunek",
};

const KPI_LABELS_T2_T3 = KPI_LABELS_T2_T3_DEF;

const kpiMonthlyData: KpiRow[] = T2_ROW_ORDER.map((id) => ({
  id,
  label: KPI_LABELS_T2_T3_DEF[id] ?? id,
  cells: Array(KPI_MONTH_COUNT).fill("-"),
}));

/**
 * KPI rows mapping for T2:
 * - monetary rows => append "zł" in the cell value
 * - percent rows   => keep "%" as-is
 * - quantity rows  => keep as-is (no "zł")
 */
const KPI_MONEY_ROW_IDS: ReadonlySet<string> = new Set([
  "avg-sales",
  "sales-pizza-total",
  "drinks-sales",
  "addons-sales",
  "starters-sales",
  "avg-bill",
]);

/** T2: only these rows are shown. Rows from JSON are filtered to this set. */
const T2_ALLOWED_ROW_IDS: ReadonlySet<string> = new Set(T2_ROW_ORDER);

/** Renders KPI label with syntax colors: ( ) = opisy, [ ] = slug.
 * For T2: ID shown under label without ' - ' separator (row IDs: ID:A, ID:B, etc.). */
function KpiLabelCell({ label, labelId }: { label: string; labelId?: string }) {
  const openParen = label.indexOf(" (");
  if (openParen === -1) {
    return (
      <>
        <span className="font-medium">{label}</span>
        {labelId && (
          <span className="text-muted-foreground text-xs block">{`ID:${labelId}`}</span>
        )}
      </>
    );
  }
  const main = label.slice(0, openParen);
  const openBracket = label.indexOf(" [", openParen);
  const parenPart = openBracket === -1 ? label.slice(openParen) : label.slice(openParen, openBracket);
  const slugPart = openBracket === -1 ? "" : label.slice(openBracket);
  return (
    <>
      <span className="font-medium">{main}</span>
      {labelId && (
        <span className="text-muted-foreground text-xs block">{`ID:${labelId}`}</span>
      )}
      <span className="text-syntax-opisy text-sm">{parenPart}</span>
      {slugPart && (
        <span className="text-syntax-slug text-sm font-mono">{slugPart}</span>
      )}
    </>
  );
}

/** Ensures row has exactly KPI_MONTH_COUNT cells; pads with "-" if shorter. */
function normalizeKpiCells(cells: string[]): string[] {
  if (cells.length >= KPI_MONTH_COUNT) return cells.slice(0, KPI_MONTH_COUNT);
  return [...cells, ...Array(KPI_MONTH_COUNT - cells.length).fill("-")];
}

function formatRowIndexId(index: number): string {
  // Excel-like letters: 0 -> A, 1 -> B, ... 25 -> Z, 26 -> AA, etc.
  let n = index;
  let out = "";
  while (n >= 0) {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  }
  return out;
}

function formatKpiMonthDisplay(from: string): string {
  // Use start date to derive MM-YYYY label, e.g. "2026-03-01 ..." -> "03-2026".
  const year = from.slice(0, 4);
  const month = from.slice(5, 7);
  if (!year || !month) return from;
  return `${month}-${year}`;
}

function formatKpiMonthId(from: string): string {
  // Use start date to derive technical month IDs for T2.
  const year = from.slice(0, 4);
  const month = from.slice(5, 7);
  if (!year || !month) return "??";

  // Custom IDs for specific months.
  if (month === "04" && year === "2026") {
    return "TM";
  }
  if (month === "04" && year === "2025") {
    return "MR";
  }
  // Compact technical IDs M1..M11 for remaining fixed columns
  if (month === "03" && year === "2026") return "M1";
  if (month === "02" && year === "2026") return "M2";
  if (month === "01" && year === "2026") return "M3";
  if (month === "12" && year === "2025") return "M4";
  if (month === "11" && year === "2025") return "M5";
  if (month === "10" && year === "2025") return "M6";
  if (month === "09" && year === "2025") return "M7";
  if (month === "08" && year === "2025") return "M8";
  if (month === "07" && year === "2025") return "M9";
  if (month === "06" && year === "2025") return "M10";
  if (month === "05" && year === "2025") return "M11";

  // Fallback: MMYY from date.
  return `${month}${year.slice(-2)}`;
}

function KpiMonthlyTable({
  data = kpiMonthlyData,
  showIds = false,
  hidePercent = false,
  hidePln = false,
  apiTM,
  chartRows,
  onChartRowToggle,
  chartCols,
  onChartColToggle,
}: {
  data?: KpiRow[];
  showIds?: boolean;
  hidePercent?: boolean;
  hidePln?: boolean;
  apiTM?: Record<string, string>;
  chartRows?: Set<string>;
  onChartRowToggle?: (id: string) => void;
  chartCols?: Set<string>;
  onChartColToggle?: (id: string) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "month-0", desc: true }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [expanded, setExpanded] = useState(false);

  const columns: ColumnDef<KpiRow>[] = useMemo(() => [
    {
      accessorKey: "label",
      header: () => <span className="text-xs text-muted-foreground">Wskaźnik</span>,
      enableSorting: false,
      cell: ({ row, getValue }: { row: { original: KpiRow; index: number }; getValue: () => unknown }) => {
        const labelId = showIds ? formatRowIndexId(row.index) : undefined;
        const slug = GOPOS_ROW_SLUGS[row.original.id];
        return (
          <span className="inline-flex items-start gap-1.5">
            {chartRows && onChartRowToggle && (
              <input
                type="checkbox"
                checked={chartRows.has(row.original.id)}
                onChange={() => onChartRowToggle(row.original.id)}
                className="mt-0.5 size-3 shrink-0 cursor-pointer opacity-40 hover:opacity-70 transition-opacity"
                title="Pokaż na wykresie"
              />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex flex-col leading-tight cursor-help">
                  <KpiLabelCell label={getValue() as string} labelId={labelId} />
                  <SlugBadge slug={slug} />
                </span>
              </TooltipTrigger>
              <InfoTooltipContent side="right">
                <strong className="text-sm">{getValue() as string}</strong>
                <span className="text-xs">Row id: <code>{row.original.id}</code></span>
                {slug && <span className="text-xs">Slug GOPOS: <code>{slug}</code></span>}
              </InfoTooltipContent>
            </Tooltip>
          </span>
        );
      },
    },
    ...KPI_MONTH_COLUMNS.map((col, i) => ({
      id: `month-${i}`,
      accessorFn: (row: KpiRow) => normalizeKpiCells(row.cells)[i] ?? "-",
      sortingFn: (a: { original: KpiRow }, b: { original: KpiRow }) => {
        return parseNumericForSort(normalizeKpiCells(a.original.cells)[i] ?? "") -
          parseNumericForSort(normalizeKpiCells(b.original.cells)[i] ?? "");
      },
      header: ({ column }: { column: { getToggleSortingHandler: () => ((e: unknown) => void) | undefined; getIsSorted: () => false | "asc" | "desc" } }) => {
        const colId = formatKpiMonthId(col.from);
        const slug = GOPOS_T2_COL_SLUGS[colId];
        return (
          <div className="inline-flex flex-col items-end gap-0.5">
            {chartCols && onChartColToggle && (
              <input
                type="checkbox"
                checked={chartCols.has(col.label)}
                onChange={() => onChartColToggle(col.label)}
                className="size-3 cursor-pointer opacity-40 hover:opacity-70 transition-opacity self-center"
                title="Pokaż na wykresie"
              />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={column.getToggleSortingHandler()}
                  className="inline-flex flex-col items-end leading-tight whitespace-nowrap cursor-pointer select-none"
                >
                  <span className="flex items-center">
                    {formatKpiMonthDisplay(col.from)}
                    <SortIndicator state={column.getIsSorted()} />
                  </span>
                  {showIds && (
                    <span className="text-muted-foreground text-xs">ID:{colId}</span>
                  )}
                  <SlugBadge slug={slug} />
                </button>
              </TooltipTrigger>
              <InfoTooltipContent>
                <strong className="text-sm">{formatKpiMonthDisplay(col.from)}</strong>
                <span className="text-xs">ID kolumny: <code>{colId}</code></span>
                <span className="text-xs">Zakres: {col.from.slice(0, 10)} → {col.to.slice(0, 10)}</span>
                {slug && <span className="text-xs">Slug GOPOS: <code>{slug}</code></span>}
              </InfoTooltipContent>
            </Tooltip>
          </div>
        );
      },
      cell: ({ row }: { row: { original: KpiRow; index: number } }) => {
        const cells = normalizeKpiCells(row.original.cells);
        const apiVal = i === 0 ? apiTM?.[row.original.id] : undefined;
        const isApi = apiVal != null && apiVal !== "" && apiVal !== "-";
        let value = isApi ? (apiVal as string) : (cells[i] ?? "-");
        if (hidePercent && typeof value === "string" && value.endsWith("%")) {
          value = value.slice(0, -1);
        }
        const colId = formatKpiMonthId(col.from);
        const rowLetter = formatRowIndexId(row.index);
        const cellId = `${rowLetter}-${colId}`;

        const shouldAppendPln =
          !hidePln &&
          KPI_MONEY_ROW_IDS.has(row.original.id) &&
          value !== "-" &&
          value !== "x";
        const formatted = shouldAppendPln ? `${value} zł` : value;
        const rowSlug = GOPOS_ROW_SLUGS[row.original.id];
        const colSlug = GOPOS_T2_COL_SLUGS[colId];

        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex min-h-[2.25rem] flex-col items-end justify-end gap-0.5 leading-tight overflow-visible cursor-help">
                <span className={`text-right tabular-nums ${isApi ? "text-emerald-500 dark:text-emerald-400 font-semibold" : ""}`}>{formatted}</span>
                {showIds && (
                  <span className="block mt-0.5 text-muted-foreground text-xs">
                    ID:{cellId}
                  </span>
                )}
              </span>
            </TooltipTrigger>
            <InfoTooltipContent>
              <strong className="text-sm">{formatted}</strong>
              <span className="text-xs">Cell ID: <code>{cellId}</code></span>
              <span className="text-xs">Wiersz: {row.original.label}{rowSlug ? ` (${rowSlug})` : ""}</span>
              <span className="text-xs">Kolumna: {formatKpiMonthDisplay(col.from)}{colSlug ? ` (${colSlug})` : ""}</span>
              {isApi && <span className="text-xs text-emerald-500">Wartość z GOPOS API</span>}
            </InfoTooltipContent>
          </Tooltip>
        );
      },
    })),
  ], [showIds, hidePercent, hidePln, apiTM, chartRows, chartCols, onChartRowToggle, onChartColToggle]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions by design
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnPinning: { left: ["label"] } },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: DEFAULT_PAGE_SIZE } },
  });

  useEffect(() => {
    table.setPageSize(expanded ? data.length || DEFAULT_PAGE_SIZE : DEFAULT_PAGE_SIZE);
  }, [expanded, data.length, table]);

  const totalRows = data.length;
  const showExpandButton = totalRows > DEFAULT_PAGE_SIZE;
  const hideableColumns = table.getAllLeafColumns().filter((c) => c.id !== "label");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Columns3 className="size-3.5" /> Kolumny
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Widoczne kolumny</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {hideableColumns.map((col) => {
              const idx = col.id.startsWith("month-") ? Number(col.id.replace("month-", "")) : -1;
              const label = idx >= 0 ? formatKpiMonthDisplay(KPI_MONTH_COLUMNS[idx].from) : col.id;
              return (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(v) => col.toggleVisibility(!!v)}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="w-full overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const isLabel = header.column.id === "label";
                return (
                  <TableHead
                    key={header.id}
                    className={
                      isLabel
                        ? "w-60 max-w-60 whitespace-normal break-words px-2 py-1 text-xs sticky left-0 z-10 bg-card"
                        : "w-24 max-w-24 whitespace-normal break-words px-2 py-1 text-xs text-right align-top"
                    }
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => {
            const rowId = row.original.id;
            return (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const isLabel = cell.column.id === "label";
                  const colId = isLabel
                    ? "label"
                    : cell.column.id.startsWith("month-")
                      ? formatKpiMonthId(KPI_MONTH_COLUMNS[Number(cell.column.id.replace("month-", ""))]?.from ?? "")
                      : cell.column.id;
                  const cellDomId = `t2-cell-${rowId}-${colId}`;
                  return (
                    <TableCell
                      key={cell.id}
                      id={cellDomId}
                      data-cell-id={colId}
                      className={
                        isLabel
                          ? "w-60 max-w-60 whitespace-normal break-words px-2 py-1 sticky left-0 z-[1] bg-card"
                          : "w-24 max-w-24 min-h-10 overflow-visible whitespace-normal break-words px-2 py-1 text-right align-top"
                      }
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
      {showExpandButton && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded
              ? "Zwiń"
              : `Zobacz więcej (${totalRows - DEFAULT_PAGE_SIZE})`}
          </Button>
        </div>
      )}
    </div>
  );
}

type YtdRow = { id: string; category: string; ytd: string; fromApi?: boolean };

const ytdSalesData: YtdRow[] = [
  { id: "total", category: "Łącznie", ytd: "-" },
  { id: "pizza", category: "Pizze", ytd: "-" },
  { id: "other-sales-qty", category: "Pozostałe", ytd: "-" },
  { id: "drinks", category: "Napoje", ytd: "-" },
];

function YtdSalesTable({
  data = ytdSalesData,
  hidePln = false,
  showIds = false,
}: {
  data?: YtdRow[];
  hidePln?: boolean;
  showIds?: boolean;
}) {
  const columns: ColumnDef<YtdRow>[] = useMemo(() => [
    {
      accessorKey: "category",
      header: () => (
        <span className="inline-flex flex-col">
          <span>YTD</span>
          {showIds && <span className="text-muted-foreground text-xs">ID:col</span>}
        </span>
      ),
      cell: ({ getValue, row }) => (
        <span className="inline-flex flex-col gap-0.5">
          <span className="font-medium">{getValue() as string}</span>
          {showIds && (
            <span className="block mt-0.5 text-muted-foreground text-xs">
              ID:{row.original.id}-category
            </span>
          )}
        </span>
      ),
    },
    {
      accessorKey: "ytd",
      header: () => (
        <span className="inline-flex flex-col items-end">
          <span>2026</span>
          {showIds && <span className="text-muted-foreground text-xs">ID:ytd</span>}
        </span>
      ),
      cell: ({ getValue, row }) => {
        let ytd = (getValue() as string) ?? "";
        if (hidePln) ytd = ytd.replace(/\s*zł\s*$/, "");
        const isApi = !!row.original.fromApi;
        return (
          <span className="inline-flex flex-col items-end gap-0.5">
            <span className={`text-right tabular-nums ${isApi ? "text-emerald-500 dark:text-emerald-400 font-semibold" : ""}`}>{ytd}</span>
            {showIds && (
              <span className="block mt-0.5 text-muted-foreground text-xs">
                ID:{row.original.id}-ytd
              </span>
            )}
          </span>
        );
      },
    },
  ], [showIds, hidePln]);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions by design
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id} className={h.id !== "category" ? "whitespace-nowrap text-right" : "whitespace-nowrap"}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => {
            const rowId = row.original.id;
            return (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const colId = cell.column.id;
                  const cellDomId = `t5-cell-${rowId}-${colId}`;
                  return (
                    <TableCell
                      key={cell.id}
                      id={cellDomId}
                      data-cell-id={colId}
                      className={cell.column.id !== "category" ? "text-right" : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

const DEFAULT_PAGE_SIZE = 6;

type SortIndicatorProps = { state: false | "asc" | "desc" };
function SortIndicator({ state }: SortIndicatorProps) {
  if (state === "asc") return <ArrowUpIcon className="inline size-3 ml-1 text-foreground" />;
  if (state === "desc") return <ArrowDown className="inline size-3 ml-1 text-foreground" />;
  return <ArrowUpDown className="inline size-3 ml-1 text-muted-foreground/60" />;
}

function SlugBadge({ slug }: { slug?: string }) {
  if (!slug) return null;
  return (
    <code className="block font-mono text-[10px] text-syntax-slug leading-tight">
      {slug}
    </code>
  );
}

function parseNumericForSort(raw: string): number {
  if (!raw || raw === "-" || raw === "X" || raw === "x") return Number.NEGATIVE_INFINITY;
  const cleaned = raw.replace(/\s/g, "").replace(/%/g, "").replace(/zł/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
}

function ReportTable({
  data = reportData,
  showIds = true,
  hidePercent = false,
  chartRows,
  onChartRowToggle,
  chartRowsAllowed,
  chartCols,
  onChartColToggle,
}: {
  data?: ReportRow[];
  showIds?: boolean;
  hidePercent?: boolean;
  chartRows?: Set<string>;
  onChartRowToggle?: (id: string) => void;
  chartRowsAllowed?: Set<string>;
  chartCols?: Set<string>;
  onChartColToggle?: (id: string) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [expanded, setExpanded] = useState(false);

  const columns: ColumnDef<ReportRow>[] = useMemo(() => [
    {
      accessorKey: "label",
      header: () => <span className="text-xs text-muted-foreground">Wiersz</span>,
      enableSorting: false,
      cell: ({ getValue, row }: { getValue: () => unknown; row: { original: ReportRow } }) => {
        const label = getValue() as string;
        const displayId = getDisplayRowId(label, row.original.id);
        const slug = GOPOS_ROW_SLUGS[row.original.id];
        return (
          <span className="inline-flex items-start gap-1.5">
            {chartRows && onChartRowToggle && (!chartRowsAllowed || chartRowsAllowed.has(row.original.id)) && (
              <input
                type="checkbox"
                checked={chartRows.has(row.original.id)}
                onChange={() => onChartRowToggle(row.original.id)}
                className="mt-0.5 size-3 shrink-0 cursor-pointer opacity-40 hover:opacity-70 transition-opacity"
                title="Pokaż na wykresie"
              />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex flex-col leading-tight cursor-help">
                  <span className="font-medium">{label}</span>
                  {showIds && (
                    <span className="text-muted-foreground text-xs">ID:{displayId}</span>
                  )}
                  <SlugBadge slug={slug} />
                </span>
              </TooltipTrigger>
              <InfoTooltipContent side="right">
                <strong className="text-sm">{label}</strong>
                <span className="text-xs">ID wiersza: <code>{displayId}</code></span>
                {slug && <span className="text-xs">Slug GOPOS: <code>{slug}</code></span>}
                <span className="text-xs text-muted-foreground">Raw id: {row.original.id}</span>
              </InfoTooltipContent>
            </Tooltip>
          </span>
        );
      },
    },
    ...MONTHS.map((month, i) => ({
      id: `month-${i}`,
      accessorFn: (row: ReportRow) => row.cells[i]?.value ?? "-",
      sortingFn: (a: { original: ReportRow }, b: { original: ReportRow }) => {
        return parseNumericForSort(a.original.cells[i]?.value ?? "") -
          parseNumericForSort(b.original.cells[i]?.value ?? "");
      },
      header: ({ column }: { column: { getToggleSortingHandler: () => ((e: unknown) => void) | undefined; getIsSorted: () => false | "asc" | "desc" } }) => {
        const slug = GOPOS_T1_COL_SLUGS[month.id];
        return (
          <div className="inline-flex flex-col items-end gap-0.5">
            {chartCols && onChartColToggle && (
              <input
                type="checkbox"
                checked={chartCols.has(month.id)}
                onChange={() => onChartColToggle(month.id)}
                className="size-3 cursor-pointer opacity-40 hover:opacity-70 transition-opacity self-center"
                title="Pokaż na wykresie"
              />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={column.getToggleSortingHandler()}
                  className="inline-flex flex-col items-end leading-tight cursor-pointer select-none"
                >
                  <span className="flex items-center">
                    {month.label}
                    <SortIndicator state={column.getIsSorted()} />
                  </span>
                  {showIds && (
                    <span className="text-muted-foreground text-xs">ID:{month.id}</span>
                  )}
                  <SlugBadge slug={slug} />
                </button>
              </TooltipTrigger>
              <InfoTooltipContent>
                <strong className="text-sm">{month.label}</strong>
                <span className="text-xs">ID kolumny: <code>{month.id}</code></span>
                {slug && <span className="text-xs">Slug GOPOS: <code>{slug}</code></span>}
              </InfoTooltipContent>
            </Tooltip>
          </div>
        );
      },
      cell: ({ row }: { row: { original: ReportRow } }) => {
        const baseYearTwoDigits = getBaseYearTwoDigits(
          row.original.label,
          row.original.id
        );
        const cellId = getT1MonthCellId(baseYearTwoDigits, month.id);
        const cell = row.original.cells[i];
        const slug = GOPOS_T1_COL_SLUGS[month.id];
        const rowSlug = GOPOS_ROW_SLUGS[row.original.id];
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex flex-col items-end leading-tight cursor-help">
                <CellContent cell={cell} hidePercent={hidePercent} />
                {showIds && (
                  <span className="text-muted-foreground text-xs">ID:{cellId}</span>
                )}
              </span>
            </TooltipTrigger>
            <InfoTooltipContent>
              <strong className="text-sm">{cell?.value ?? "-"}</strong>
              <span className="text-xs">Cell ID: <code>{cellId}</code></span>
              <span className="text-xs">Wiersz: {row.original.label}{rowSlug ? ` (${rowSlug})` : ""}</span>
              <span className="text-xs">Kolumna: {month.label}{slug ? ` (${slug})` : ""}</span>
              {cell?.fromApi && <span className="text-xs text-emerald-500">Wartość z GOPOS API</span>}
            </InfoTooltipContent>
          </Tooltip>
        );
      },
    })),
    {
      id: "suma",
      accessorFn: (row: ReportRow) => row.cells[12]?.value ?? "-",
      sortingFn: (a: { original: ReportRow }, b: { original: ReportRow }) => parseNumericForSort(a.original.cells[12]?.value ?? "") - parseNumericForSort(b.original.cells[12]?.value ?? ""),
      header: ({ column }: { column: { getToggleSortingHandler: () => ((e: unknown) => void) | undefined; getIsSorted: () => false | "asc" | "desc" } }) => (
        <button
          type="button"
          onClick={column.getToggleSortingHandler()}
          className="inline-flex flex-col items-end leading-tight cursor-pointer select-none"
        >
          <span className="flex items-center">
            Suma
            <SortIndicator state={column.getIsSorted()} />
          </span>
          {showIds && <span className="text-muted-foreground text-xs">ID:SUM</span>}
          <SlugBadge slug={GOPOS_T1_COL_SLUGS.suma} />
        </button>
      ),
      cell: ({ row }: { row: { original: ReportRow } }) => (
        <span className="inline-flex flex-col items-end leading-tight">
          <CellContent cell={row.original.cells[12]} hidePercent={hidePercent} />
          {showIds && (
            <span className="text-muted-foreground text-xs">
              ID:{getBaseYearTwoDigits(row.original.label, row.original.id)}SUM
            </span>
          )}
        </span>
      ),
    },
    {
      id: "srednia",
      accessorFn: (row: ReportRow) => row.cells[13]?.value ?? "-",
      sortingFn: (a: { original: ReportRow }, b: { original: ReportRow }) => parseNumericForSort(a.original.cells[13]?.value ?? "") - parseNumericForSort(b.original.cells[13]?.value ?? ""),
      header: ({ column }: { column: { getToggleSortingHandler: () => ((e: unknown) => void) | undefined; getIsSorted: () => false | "asc" | "desc" } }) => (
        <button
          type="button"
          onClick={column.getToggleSortingHandler()}
          className="inline-flex flex-col items-end leading-tight cursor-pointer select-none"
        >
          <span className="flex items-center">
            Średnia
            <SortIndicator state={column.getIsSorted()} />
          </span>
          {showIds && <span className="text-muted-foreground text-xs">ID:AVG</span>}
          <SlugBadge slug={GOPOS_T1_COL_SLUGS.srednia} />
        </button>
      ),
      cell: ({ row }: { row: { original: ReportRow } }) => (
        <span className="inline-flex flex-col items-end leading-tight">
          <CellContent cell={row.original.cells[13]} hidePercent={hidePercent} />
          {showIds && (
            <span className="text-muted-foreground text-xs">
              ID:{getBaseYearTwoDigits(row.original.label, row.original.id)}AVG
            </span>
          )}
        </span>
      ),
    },
  ], [showIds, hidePercent, chartRows, chartRowsAllowed, chartCols, onChartRowToggle, onChartColToggle]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions by design
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnPinning: { left: ["label"] } },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: DEFAULT_PAGE_SIZE } },
  });

  useEffect(() => {
    table.setPageSize(expanded ? data.length || DEFAULT_PAGE_SIZE : DEFAULT_PAGE_SIZE);
  }, [expanded, data.length, table]);

  const totalRows = data.length;
  const showExpandButton = totalRows > DEFAULT_PAGE_SIZE;

  const hideableColumns = table.getAllLeafColumns().filter((c) => c.id !== "label");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Columns3 className="size-3.5" /> Kolumny
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Widoczne kolumny</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {hideableColumns.map((col) => {
              const idx = col.id.startsWith("month-") ? Number(col.id.replace("month-", "")) : -1;
              const label = idx >= 0 ? MONTHS[idx].label : col.id === "suma" ? "Suma" : col.id === "srednia" ? "Średnia" : col.id;
              return (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(v) => col.toggleVisibility(!!v)}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="w-full overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={`whitespace-nowrap ${header.column.id === "label" ? "sticky left-0 z-10 bg-card" : ""}`}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => {
            const rowOriginal = row.original as ReportRow;
            const baseYearTwoDigits = getBaseYearTwoDigits(
              rowOriginal.label,
              rowOriginal.id
            );
            const displayId = getDisplayRowId(
              rowOriginal.label,
              rowOriginal.id
            );
            const isVsRow = displayId === "VS1" || displayId === "VS2";
            const rowBg = isVsRow ? "bg-green-100 dark:bg-green-950/50" : "bg-card";

            return (
              <TableRow
                key={row.id}
                className={
                  isVsRow ? "bg-green-100 dark:bg-green-950/50" : undefined
                }
              >
                {row.getVisibleCells().map((cell) => {
                  const columnId = cell.column.id;

                  let cellDataId: string;
                  let domId: string;

                  if (columnId === "label") {
                    cellDataId = rowOriginal.id;
                    domId = `t1-cell-${rowOriginal.id}-label`;
                  } else if (columnId.startsWith("month-")) {
                    const idx = Number(columnId.replace("month-", ""));
                    const monthCode = MONTHS[idx]?.id ?? "00";
                    cellDataId = getT1MonthCellId(baseYearTwoDigits, monthCode);
                    domId = `t1-cell-${rowOriginal.id}-${cellDataId}`;
                  } else if (columnId === "suma") {
                    cellDataId = `${baseYearTwoDigits}SUM`;
                    domId = `t1-cell-${rowOriginal.id}-${cellDataId}`;
                  } else if (columnId === "srednia") {
                    cellDataId = `${baseYearTwoDigits}AVG`;
                    domId = `t1-cell-${rowOriginal.id}-${cellDataId}`;
                  } else {
                    cellDataId = `${baseYearTwoDigits}-${columnId}`;
                    domId = `t1-cell-${rowOriginal.id}-${cellDataId}`;
                  }

                  const isLabel = cell.column.id === "label";
                  return (
                    <TableCell
                      key={cell.id}
                      id={domId}
                      data-cell-id={cellDataId}
                      className={`${!isLabel ? "text-right" : ""} ${isLabel ? `sticky left-0 z-[1] ${rowBg}` : ""}`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
      {showExpandButton && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded
              ? "Zwiń"
              : `Zobacz więcej (${totalRows - DEFAULT_PAGE_SIZE})`}
          </Button>
        </div>
      )}
    </div>
  );
}

type ListId = "L1" | "L2" | "L3";

type TableId = "T1" | "T2" | "T5";

const TABLE_IDS = {
  T1: "T1", // Informacje o wolumenie miesięcznym
  T2: "T2", // Kluczowe wskaźniki miesięczne
  T5: "T5", // Sprzedaż od początku tego roku
} as const satisfies Record<string, TableId>;

const LIST_OPTIONS: { id: ListId; name: string }[] = [
  { id: "L1", name: "Rafał Lubak" },
  { id: "L2", name: "Rafał Wieczorek" },
  { id: "L3", name: "Andrzej Chmielewski" },
];

const LIST_ID_BY_NAME: Record<string, ListId> = {
  "Rafał Lubak": "L1",
  "Rafał Wieczorek": "L2",
  "Andrzej Chmielewski": "L3",
};

type LocationOption = {
  nameAlias: string;
  organizationId: string;
};

// Static mapping of list names to location options (name_alias + organization_id).
// In a real app these would come from an API (see temp-cra/locations.json).
const LIST_NAME_TO_ALIASES: Record<string, LocationOption[]> = {
  "Rafał Lubak": [
    { nameAlias: "Łomianki Warszawska 125", organizationId: "2830" },
    { nameAlias: "Warszawa Przy Agorze 11D", organizationId: "2822" },
    {
      nameAlias: "Nowy Dwór Mazowiecki Warszawska 36",
      organizationId: "2829",
    },
    { nameAlias: "Siedlce Rynkowa 22", organizationId: "2846" },
    { nameAlias: "Marki Kościuszki 57", organizationId: "2841" },
    {
      nameAlias: "Nakło nad Notecią Mrotecka 35",
      organizationId: "2855",
    },
    { nameAlias: "Toruń Rynek Nowomiejski 2", organizationId: "2811" },
    { nameAlias: "Warszawa Ciołka 25", organizationId: "9367" },
    { nameAlias: "Warszawa Kilińskiego", organizationId: "8097" },
    { nameAlias: "Warszawa Odkryta 41", organizationId: "2851" },
    { nameAlias: "Warszawa Radiowa 18", organizationId: "2827" },
    { nameAlias: "Włocławek Kilińskiego 5", organizationId: "2836" },
    { nameAlias: "Wołomin Wileńska 51", organizationId: "2831" },
    { nameAlias: "Ząbki Powstańców 43", organizationId: "2808" },
    { nameAlias: "Warszawa Bazyliańska 4", organizationId: "2806" },
    { nameAlias: "Łódź Narutowicza 35", organizationId: "2807" },
  ],
  "Rafał Wieczorek": [
    {
      nameAlias: "Bolesławiec Plac Popiełuszki 2",
      organizationId: "2839",
    },
    { nameAlias: "Bytom Jainty 10", organizationId: "2809" },
    { nameAlias: "Chorzów Zjednoczenia 2", organizationId: "2817" },
    { nameAlias: "Częstochowa Śląska 7", organizationId: "2813" },
    { nameAlias: "Gdańsk Dąbrówki 102", organizationId: "2840" },
    { nameAlias: "Gdańsk Dmowskiego 9", organizationId: "2825" },
    { nameAlias: "Gdańsk Stągiewna 6", organizationId: "2810" },
    { nameAlias: "Katowice Poleska 6", organizationId: "2824" },
    { nameAlias: "Katowice Tysiąclecia 31", organizationId: "2849" },
    { nameAlias: "Katowice Warszawska 36", organizationId: "2819" },
    { nameAlias: "Mysłowice Cedrowa 3", organizationId: "5789" },
    {
      nameAlias: "Siemianowice Śląskie Dąbrowskiej 4",
      organizationId: "2828",
    },
    {
      nameAlias: "Tomaszów Mazowiecki Dzieci Polskich 18E",
      organizationId: "2842",
    },
    { nameAlias: "Tychy Bocheńskiego 7", organizationId: "2816" },
    { nameAlias: "Zabrze Roosevelta 20B", organizationId: "2792" },
    { nameAlias: "Zielona Góra Wiejska 2", organizationId: "2832" },
  ],
  "Andrzej Chmielewski": [
    { nameAlias: "Kielce Radomska 18", organizationId: "2826" },
    {
      nameAlias: "Konstancin-Jeziorna Skolimowska 33",
      organizationId: "2844",
    },
    {
      nameAlias: "Lublin Spółdzielczości Pracy 36",
      organizationId: "2823",
    },
    { nameAlias: "Mroków Rejonowa 44A", organizationId: "2856" },
    { nameAlias: "Olsztyn Burskiego 1", organizationId: "2854" },
    { nameAlias: "Olsztyn Jagiellońska 52A", organizationId: "2852" },
    { nameAlias: "Wyszków Pułtuska 109", organizationId: "2853" },
    {
      nameAlias: "Piaseczno Wojska Polskiego 30",
      organizationId: "2838",
    },
    { nameAlias: "Pruszków Działkowa 4a", organizationId: "2815" },
    { nameAlias: "Radom Toruńska 11", organizationId: "2835" },
    { nameAlias: "Radom Żółkiewskiego 4", organizationId: "2821" },
    { nameAlias: "Raszyn Szkolna 1C", organizationId: "2848" },
    { nameAlias: "Warszawa Bazyliańska 4", organizationId: "2806" },
    { nameAlias: "Warszawa Grochowska 12", organizationId: "2793" },
    { nameAlias: "Warszawa Lechicka 18", organizationId: "2805" },
    { nameAlias: "Warszawa Nugat 4", organizationId: "2803" },
    { nameAlias: "Warszawa Rakietników 52", organizationId: "2820" },
    { nameAlias: "Żyrardów Zielińskiej 21C", organizationId: "2837" },
  ],
};

const DATA_BASE = "/data";
const T1_DATA_BASE = "/data/T1";
const T2_DATA_BASE = "/data/T2";

const initialListName = LIST_OPTIONS[0].name;
const initialNameAlias = LIST_NAME_TO_ALIASES[initialListName]?.[0]?.nameAlias ?? "";

type SelectedLocation = {
  nameAlias: string;
  organizationId: string;
  listName: string;
};

const ALL_LOCATIONS: (LocationOption & { listName: string })[] = Object.entries(
  LIST_NAME_TO_ALIASES
).flatMap(([listName, locs]) => locs.map((l) => ({ ...l, listName })));

const LIST_LABEL: Record<string, string> = {
  "Rafał Lubak": "L1",
  "Rafał Wieczorek": "L2",
  "Andrzej Chmielewski": "L3",
};

function LocationPicker({
  values,
  onChange,
}: {
  values: SelectedLocation[];
  onChange: (locs: SelectedLocation[]) => void;
}) {
  const [mode, setMode] = useState<false | "browse" | "search">(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_LOCATIONS;
    return ALL_LOCATIONS.filter(
      (l) => l.nameAlias.toLowerCase().includes(q) || l.organizationId.includes(q)
    );
  }, [query]);

  const byList = useMemo(() => {
    const map = new Map<string, typeof ALL_LOCATIONS>();
    for (const loc of filtered) {
      if (!map.has(loc.listName)) map.set(loc.listName, []);
      map.get(loc.listName)!.push(loc);
    }
    return map;
  }, [filtered]);

  const toggle = useCallback(
    (loc: typeof ALL_LOCATIONS[0]) => {
      const key = `${loc.listName}|${loc.organizationId}`;
      const isSelected = values.some((v) => `${v.listName}|${v.organizationId}` === key);
      if (isSelected) {
        const next = values.filter((v) => `${v.listName}|${v.organizationId}` !== key);
        onChange(next.length > 0 ? next : [{ nameAlias: loc.nameAlias, organizationId: loc.organizationId, listName: loc.listName }]);
      } else {
        onChange([...values, { nameAlias: loc.nameAlias, organizationId: loc.organizationId, listName: loc.listName }]);
      }
    },
    [values, onChange]
  );

  return (
    <div className="w-full rounded-xl border border-border bg-card px-4 py-3 flex flex-col gap-2">
      {/* always-visible summary bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setMode((m) => m === "browse" ? false : "browse")}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${mode === "browse" ? "border-primary bg-primary text-primary-foreground" : "border-primary bg-primary/10 text-primary hover:bg-primary/20"}`}
        >
          {mode === "browse" ? "▲ ZWIŃ" : "▼ WYBIERZ LOKAL"}
        </button>
        <button
          onClick={() => { setMode((m) => m === "search" ? false : "search"); setQuery(""); }}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${mode === "search" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          🔍 WYSZUKAJ LOKAL
        </button>
        <span className="text-xs text-muted-foreground shrink-0">Wybrane ({values.length}):</span>
        {values.map((v) => (
          <span
            key={`${v.listName}|${v.organizationId}`}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            <span className="opacity-60">{LIST_LABEL[v.listName] ?? "?"}</span>
            {v.nameAlias}
            <button
              onClick={() => toggle({ ...v })}
              className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
            >×</button>
          </span>
        ))}
      </div>

      {/* collapsible panel */}
      {mode && (
        <div className="flex flex-col gap-3 pt-2 border-t border-border">
          {mode === "search" && (
            <div className="flex items-center gap-3">
              <input
                autoFocus
                type="text"
                placeholder="Szukaj po nazwie lub ID organizacji…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 flex-1 min-w-48 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Wyczyść
                </button>
              )}
            </div>
          )}

          {mode === "search" && !query && (
            <p className="text-sm text-muted-foreground py-1">Wpisz nazwę lub ID organizacji…</p>
          )}
          {mode === "search" && query && byList.size === 0 && (
            <p className="text-sm text-muted-foreground py-1">Brak wyników dla „{query}"</p>
          )}

          {(mode === "browse" || (mode === "search" && !!query)) && <div className={mode === "search" ? "flex flex-col gap-1.5" : "grid grid-cols-3 gap-4"}>
          {LIST_OPTIONS.map((opt) => {
            const locs = byList.get(opt.name);
            if (!locs || locs.length === 0) return null;
            const allSelected = locs.every((l) => values.some((v) => v.organizationId === l.organizationId && v.listName === l.listName));
            return (
              <div key={opt.id}>
                <div className="mb-2 flex items-center gap-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {opt.id} — {opt.name}
                  </p>
                  <button
                    onClick={() => {
                      const keys = new Set(locs.map((l) => `${l.listName}|${l.organizationId}`));
                      if (allSelected) {
                        const remaining = values.filter((v) => !keys.has(`${v.listName}|${v.organizationId}`));
                        onChange(remaining.length > 0 ? remaining : [{ ...locs[0] }]);
                      } else {
                        const existingKeys = new Set(values.map((v) => `${v.listName}|${v.organizationId}`));
                        const toAdd = locs.filter((l) => !existingKeys.has(`${l.listName}|${l.organizationId}`));
                        onChange([...values, ...toAdd]);
                      }
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    {allSelected ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {locs.map((loc) => {
                    const isActive = values.some(
                      (v) => v.organizationId === loc.organizationId && v.listName === loc.listName
                    );
                    return (
                      <button
                        key={`${loc.listName}-${loc.organizationId}`}
                        onClick={() => toggle(loc)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          isActive
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border bg-background hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <span className={`size-2 rounded-sm shrink-0 border ${isActive ? "bg-primary border-primary" : "border-muted-foreground/40"}`} />
                        {loc.nameAlias}
                        <span className="text-xs text-muted-foreground">#{loc.organizationId}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          </div>}
        </div>
      )}
    </div>
  );
}

type TableVisibility = {
  showId: boolean;
  showPercent: boolean;
  showPln: boolean;
};


function TableVisibilityToggles({
  visibility,
  onVisibilityChange,
  hasId = true,
  hasPercent = true,
  hasPln = true,
}: {
  visibility: TableVisibility;
  onVisibilityChange: (v: TableVisibility) => void;
  hasId?: boolean;
  hasPercent?: boolean;
  hasPln?: boolean;
}) {
  const update = (key: keyof TableVisibility, value: boolean) =>
    onVisibilityChange({ ...visibility, [key]: value });
  return (
    <div className="flex items-center gap-3 flex-wrap text-sm">
      <span className="text-muted-foreground">Pokaż:</span>
      {hasId && (
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Checkbox
            checked={visibility.showId}
            onCheckedChange={(c) => update("showId", c === true)}
          />
          <span>ID</span>
        </label>
      )}
      {hasPercent && (
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Checkbox
            checked={visibility.showPercent}
            onCheckedChange={(c) => update("showPercent", c === true)}
          />
          <span>%</span>
        </label>
      )}
      {hasPln && (
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Checkbox
            checked={visibility.showPln}
            onCheckedChange={(c) => update("showPln", c === true)}
          />
          <span>zł</span>
        </label>
      )}
    </div>
  );
}

/** Ensures all T1 rows from reportData template are present. Fills missing rows with "-" cells. */
function ensureT1RowsComplete(
  fetched: ReportRow[],
  template: ReportRow[]
): ReportRow[] {
  const byId = new Map<string, ReportRow>();
  for (const row of fetched) {
    byId.set(row.id, { ...row, cells: row.cells.map((c) => ({ ...c })) });
  }
  const cellCount = template[0]?.cells.length ?? 14;
  const emptyCell = (): CellValue => ({ value: "-" });
  for (const row of template) {
    if (!byId.has(row.id)) {
      byId.set(row.id, {
        id: row.id,
        label: row.label,
        cells: Array.from({ length: cellCount }, emptyCell),
      });
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const order = ["2026", "2026vs2025", "2025", "2025vs2024", "2024", "2024vs2023", "2023", "2023vs2022", "2022"];
    const ai = order.indexOf(a.id);
    const bi = order.indexOf(b.id);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.id.localeCompare(b.id);
  });
}


function parsePolishNumber(s: string): number | null {
  const cleaned = s.replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
function formatPolishNumber(n: number): string {
  const [int, dec] = n.toFixed(2).split(".");
  const spaced = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return dec === "00" ? spaced : `${spaced},${dec}`;
}
function mergeReportRows(rowsArrays: ReportRow[][]): ReportRow[] {
  const byId = new Map<string, ReportRow>();
  for (const rows of rowsArrays) {
    for (const row of rows) {
      const existing = byId.get(row.id);
      if (!existing) { byId.set(row.id, { ...row, cells: row.cells.map((c) => ({ ...c })) }); continue; }
      const merged: CellValue[] = existing.cells.map((ec, i) => {
        const c = row.cells[i];
        if (!c) return ec;
        const n1 = parsePolishNumber(ec.value), n2 = parsePolishNumber(c.value);
        if (n1 != null && n2 != null) return { value: formatPolishNumber(n1 + n2), highlight: ec.highlight };
        if (ec.value.endsWith("%") && c.value.endsWith("%")) {
          const p1 = parsePolishNumber(ec.value), p2 = parsePolishNumber(c.value);
          if (p1 != null && p2 != null) return { value: formatPolishNumber((p1 + p2) / 2) + "%", highlight: ec.highlight };
        }
        return ec;
      });
      byId.set(row.id, { ...existing, cells: merged });
    }
  }
  const order = ["2026","2026vs2025","2025","2025vs2024","2024","2024vs2023","2023","2023vs2022","2022"];
  return Array.from(byId.values()).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id) || a.id.localeCompare(b.id));
}
function mergeKpiRows(rowsArrays: KpiRow[][]): KpiRow[] {
  const byId = new Map<string, KpiRow>();
  for (const rows of rowsArrays) {
    for (const row of rows) {
      if (!T2_ALLOWED_ROW_IDS.has(row.id)) continue;
      const existing = byId.get(row.id);
      if (!existing) { byId.set(row.id, { ...row, cells: [...row.cells] }); continue; }
      const merged = existing.cells.map((ev, i) => {
        const v = row.cells[i];
        if (v === "-" || v === undefined) return ev;
        const n1 = parsePolishNumber(ev), n2 = parsePolishNumber(v);
        if (n1 != null && n2 != null) return formatPolishNumber(n1 + n2);
        return ev;
      });
      byId.set(row.id, { ...existing, cells: merged });
    }
  }
  return Array.from(byId.values());
}
function mergeYtdRows(rowsArrays: YtdRow[][]): YtdRow[] {
  const byId = new Map<string, YtdRow>();
  const hasZloty = (ytd: string) => ytd.includes(" zł");
  for (const rows of rowsArrays) {
    for (const row of rows) {
      const existing = byId.get(row.id);
      if (!existing) { byId.set(row.id, { ...row }); continue; }
      const raw1 = existing.ytd.replace(/\s*zł\s*$/, ""), raw2 = row.ytd.replace(/\s*zł\s*$/, "");
      const n1 = parsePolishNumber(raw1), n2 = parsePolishNumber(raw2);
      if (n1 != null && n2 != null) {
        const suffix = hasZloty(existing.ytd) || hasZloty(row.ytd) ? " zł" : "";
        byId.set(row.id, { ...existing, ytd: `${formatPolishNumber(n1 + n2)}${suffix}` });
      }
    }
  }
  return Array.from(byId.values());
}

function AppSidebar({
  showAdminNav,
  onGoAdmin,
  authUser,
  logout,
}: {
  showAdminNav: boolean;
  onGoAdmin?: () => void;
  authUser?: { name?: string; email?: string } | null;
  logout: () => void;
}) {
  const { isMobile } = useSidebar();

  const navItems = [
    { href: "#t1", icon: BarChart3, label: "T1 — Wolumen miesięczny" },
    { href: "#t2", icon: TrendingUp, label: "T2 — KPI miesięczne" },
    { href: "#t5", icon: CalendarDays, label: "T5 — Sprzedaż YTD" },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<a href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <img src="/vite.svg" alt="Logo" className="size-5 invert" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-semibold text-sm">Combo Raport</span>
                <span className="text-xs text-sidebar-foreground/60">v0.0.1</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Sekcje raportu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ href, icon: Icon, label }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton tooltip={label} render={<a href={href} />}>
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showAdminNav && (
          <SidebarGroup>
            <SidebarGroupLabel>Administracja</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Panel admina" onClick={() => onGoAdmin?.()}>
                    <ShieldCheck />
                    <span>Panel admina</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DarkModeToggle sidebar />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={authUser?.name ?? "Konto"}
                >
                  <UserCircle className="size-5 shrink-0" />
                  <div className="flex flex-col leading-tight min-w-0">
                    <span className="truncate font-medium text-sm">{authUser?.name ?? "Gość"}</span>
                    <span className="truncate text-xs text-sidebar-foreground/60">{authUser?.email}</span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" className="w-56">
                <DropdownMenuLabel>
                  {authUser?.name ?? "Gość"}
                  <div className="text-xs font-normal text-muted-foreground">{authUser?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <User className="size-4 mr-2" /> Profil
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Settings className="size-4 mr-2" /> Ustawienia
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()}>
                  <LogOut className="size-4 mr-2" /> Wyloguj
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function AppInner({
  onGoAdmin,
  showAdminNav,
}: {
  onGoAdmin?: () => void;
  showAdminNav: boolean;
}) {
  const { user: authUser, logout } = useAuth();
  const { pushLog } = useLogContext();
  const defaultLocation: SelectedLocation = {
    listName: initialListName,
    nameAlias: initialNameAlias,
    organizationId: LIST_NAME_TO_ALIASES[initialListName]?.[0]?.organizationId ?? "",
  };
  const [t1Locations, setT1Locations] = useState<SelectedLocation[]>([defaultLocation]);
  const [t2Locations, setT2Locations] = useState<SelectedLocation[]>([defaultLocation]);
  const [t5Locations, setT5Locations] = useState<SelectedLocation[]>([defaultLocation]);
  const [t1Visibility, setT1Visibility] = useState<TableVisibility>({
    showId: false,
    showPercent: true,
    showPln: true,
  });
  const [t2Visibility, setT2Visibility] = useState<TableVisibility>({
    showId: false,
    showPercent: true,
    showPln: true,
  });
  const [t5Visibility, setT5Visibility] = useState<TableVisibility>({
    showId: false,
    showPercent: true,
    showPln: true,
  });

  // Chart row/col selectors
  const T1_ROW_IDS = ["2026vs2025", "2025vs2024"];
  const T1_COL_IDS = MONTHS.map((m) => m.id);
  const T2_COL_IDS = KPI_MONTH_COLUMNS.map((c) => c.label);

  const [t1ChartRows, setT1ChartRows] = useState<Set<string>>(new Set(T1_ROW_IDS));
  const [t1ChartCols, setT1ChartCols] = useState<Set<string>>(new Set(T1_COL_IDS));
  const [t2ChartRows, setT2ChartRows] = useState<Set<string>>(new Set(T2_ROW_ORDER));
  const [t2ChartCols, setT2ChartCols] = useState<Set<string>>(new Set(T2_COL_IDS));

  function toggleChartSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); }
      else next.add(id);
      return next;
    });
  }

  const t1OrgId = t1Locations[0]?.organizationId;
  const t2OrgId = t2Locations[0]?.organizationId;
  const t5OrgId = t5Locations[0]?.organizationId;
  const [t1Data, setT1Data] = useState<ReportRow[]>(reportData);
  const [t2Data, setT2Data] = useState<KpiRow[]>(kpiMonthlyData);
  const [t5Data, setT5Data] = useState<YtdRow[]>(ytdSalesData);
  const [t2ApiTM, setT2ApiTM] = useState<Record<string, string>>({});

  const TM_YEAR_ID = String(new Date().getFullYear());
  const TM_MONTH_INDEX = new Date().getMonth();

  function applyT1Api(value: string) {
    setT1Data((prev) =>
      prev.map((r) =>
        r.id === TM_YEAR_ID
          ? {
              ...r,
              cells: r.cells.map((c, i) =>
                i === TM_MONTH_INDEX ? { value, fromApi: true } : c
              ),
            }
          : r
      )
    );
  }

  function applyT5Api(rows: Array<{ id: string; category: string; ytd: string }>) {
    setT5Data((prev) => {
      const byId = new Map(rows.map((r) => [r.id, r] as const));
      return prev.map((r) =>
        byId.has(r.id)
          ? { ...r, ytd: byId.get(r.id)!.ytd, fromApi: true }
          : r
      );
    });
  }
  const [dataError, setDataError] = useState<Record<string, boolean>>({
    t1: false,
    t2: false,
    t5: false,
  });

  useEffect(() => {
    let cancelled = false;
    if (t1Locations.length === 0) return;
    const load = async () => {
      setDataError((e) => ({ ...e, t1: false }));
      const results: ReportRow[][] = [];
      for (const loc of t1Locations) {
        const listId = LIST_ID_BY_NAME[loc.listName] ?? "L1";
        const res = await loggedFetch(`${T1_DATA_BASE}/T1${listId}${loc.organizationId}.json`, { tableId: "T1", sink: pushLog });
        const r = res && res.ok ? await res.json() : null;
        if (Array.isArray(r)) results.push(r);
      }
      if (!cancelled && results.length > 0) setT1Data(results.length === 1 ? results[0] : mergeReportRows(results));
      else if (!cancelled) setDataError((e) => ({ ...e, t1: true }));
    };
    load();
    return () => { cancelled = true; };
  }, [t1Locations, pushLog]);

  useEffect(() => {
    let cancelled = false;
    if (t2Locations.length === 0) return;
    const load = async () => {
      setT2ApiTM({});
      setDataError((e) => ({ ...e, t2: false }));
      const results: KpiRow[][] = [];
      for (const loc of t2Locations) {
        const listId = LIST_ID_BY_NAME[loc.listName] ?? "L1";
        const res = await loggedFetch(`${T2_DATA_BASE}/T2${listId}${loc.organizationId}.json`, { tableId: "T2", sink: pushLog });
        const r = res && res.ok ? await res.json() : null;
        if (Array.isArray(r)) results.push(r);
      }
      if (!cancelled && results.length > 0)
        setT2Data((results.length === 1 ? results[0] : mergeKpiRows(results)).filter((row) => T2_ALLOWED_ROW_IDS.has(row.id)));
      else if (!cancelled) setDataError((e) => ({ ...e, t2: true }));
    };
    load();
    return () => { cancelled = true; };
  }, [t2Locations, pushLog]);

  useEffect(() => {
    let cancelled = false;
    if (t5Locations.length === 0) return;
    const load = async () => {
      setDataError((e) => ({ ...e, t5: false }));
      const results: YtdRow[][] = [];
      for (const loc of t5Locations) {
        const listId = LIST_ID_BY_NAME[loc.listName] ?? "L1";
        const res = await loggedFetch(`${DATA_BASE}/T5${listId}${loc.organizationId}.json`, { tableId: "T5", sink: pushLog });
        const r = res && res.ok ? await res.json() : null;
        if (Array.isArray(r)) results.push(r);
      }
      if (!cancelled && results.length > 0) setT5Data(results.length === 1 ? results[0] : mergeYtdRows(results));
      else if (!cancelled) setDataError((e) => ({ ...e, t5: true }));
    };
    load();
    return () => { cancelled = true; };
  }, [t5Locations, pushLog]);

  const t1Base = dataError.t1
    ? reportData.map((r) => ({ ...r, cells: r.cells.map(() => ({ value: "-" })) }))
    : t1Data;
  const t1Display = ensureT1RowsComplete(t1Base, reportData);
  const t2Display = dataError.t2
    ? kpiMonthlyData.map((r) => ({ ...r, cells: Array(KPI_MONTH_COUNT).fill("-") }))
    : t2Data;
  const t5Display = dataError.t5
    ? ytdSalesData.map((r) => ({ ...r, ytd: "-" }))
    : t5Data;

  // Chart-filtered data
  const t1ChartData = t1Display
    .filter((r) => t1ChartRows.has(r.id))
    .map((r) => ({
      ...r,
      cells: r.cells.filter((_, i) => t1ChartCols.has(MONTHS[i]?.id ?? "")),
    }));
  const t1ChartMonthLabels = MONTHS.filter((m) => t1ChartCols.has(m.id)).map((m) => m.label);

  const t2ChartData = t2Display
    .filter((r) => t2ChartRows.has(r.id))
    .map((r) => ({
      ...r,
      label: KPI_LABELS_T2_T3[r.id] ?? r.label,
      cells: r.cells.filter((_, i) => t2ChartCols.has(KPI_MONTH_COLUMNS[i]?.label ?? "")),
    }));
  const t2ChartMonthLabels = KPI_MONTH_COLUMNS
    .filter((c) => t2ChartCols.has(c.label))
    .map((c) => formatKpiMonthDisplay(c.from));

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar
        showAdminNav={showAdminNav}
        onGoAdmin={onGoAdmin}
        authUser={authUser}
        logout={logout}
      />
      <SidebarInset>
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card sticky top-0 z-20">
          <SidebarTrigger />
          <span className="font-semibold text-base">Combo Raport</span>
        </div>
      <main className="flex-1">
        <div className="w-full px-[5%] py-10 flex flex-col gap-8">
        <section id="t1" data-table-id={TABLE_IDS.T1} className="rounded-2xl border border-border bg-card px-6 py-6 shadow-sm">
          <h1 className="text-xl font-semibold mb-1">
            Informacje o wolumenie miesięcznym (T1)
          </h1>
          <p className="text-sm text-muted-foreground mb-2">
            Zestawienie miesięczne „net_total_money”: „Wartość sprzedaży netto”, z ostatnich 2 lat.
          </p>
          <div className="mb-4">
            <LocationPicker values={t1Locations} onChange={setT1Locations} />
          </div>
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <FetchButton table="t1" orgId={t1OrgId} onT1Result={applyT1Api} />
            <TableVisibilityToggles
              visibility={t1Visibility}
              onVisibilityChange={setT1Visibility}
              hasPln={false}
            />
          </div>
          <div className="mb-4 rounded-lg border border-border bg-card p-3">
            <T1VolumeChart data={t1ChartData} monthLabels={t1ChartMonthLabels} />
          </div>
          <ReportTable
            data={t1Display.filter((r) => r.id !== "2024vs2023")}
            showIds={t1Visibility.showId}
            hidePercent={!t1Visibility.showPercent}
            chartRows={t1ChartRows}
            onChartRowToggle={(id) => toggleChartSet(setT1ChartRows, id)}
            chartRowsAllowed={new Set(T1_ROW_IDS)}
            chartCols={t1ChartCols}
            onChartColToggle={(id) => toggleChartSet(setT1ChartCols, id)}
          />
          <TableConsole tableId="T1" />
        </section>
        <section id="t2" data-table-id={TABLE_IDS.T2} className="rounded-2xl border border-border bg-card px-6 py-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-1">
            Kluczowe wskaźniki miesięczne (T2)
          </h2>
          <div className="mb-4">
            <LocationPicker values={t2Locations} onChange={setT2Locations} />
          </div>
          {dataError.t2 && (
            <p className="mb-2 text-sm text-destructive">
              Nie udało się załadować danych T2. Sprawdź wybór listy i lokalizacji.
            </p>
          )}
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <FetchButton table="t2" orgId={t2OrgId} onT2Result={(cells) => setT2ApiTM(cells)} />
            <TableVisibilityToggles
              visibility={t2Visibility}
              onVisibilityChange={setT2Visibility}
            />
          </div>
          <div className="mb-4 rounded-lg border border-border bg-card p-3">
            <T2KpiChart data={t2ChartData} monthLabels={t2ChartMonthLabels} />
          </div>
          <KpiMonthlyTable
            showIds={t2Visibility.showId}
            hidePercent={!t2Visibility.showPercent}
            hidePln={!t2Visibility.showPln}
            apiTM={t2ApiTM}
            chartRows={t2ChartRows}
            onChartRowToggle={(id) => toggleChartSet(setT2ChartRows, id)}
            chartCols={t2ChartCols}
            onChartColToggle={(id) => toggleChartSet(setT2ChartCols, id)}
            data={t2Display
              .filter((r) => T2_ALLOWED_ROW_IDS.has(r.id))
              .sort(
                (a, b) =>
                  (T2_ROW_ORDER as readonly string[]).indexOf(a.id) -
                  (T2_ROW_ORDER as readonly string[]).indexOf(b.id)
              )
              .map((r) => ({
                ...r,
                label: KPI_LABELS_T2_T3[r.id] ?? r.label,
              }))}
          />
          <TableConsole tableId="T2" />
        </section>
        <section id="t5" data-table-id={TABLE_IDS.T5} className="rounded-2xl border border-border bg-card px-6 py-6 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold mb-1">
              Sprzedaż od początku tego roku (T5)
            </h2>
            <div className="mb-4">
              <LocationPicker values={t5Locations} onChange={setT5Locations} />
            </div>
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <FetchButton table="t5" orgId={t5OrgId} onT5Result={applyT5Api} />
            <TableVisibilityToggles
              visibility={t5Visibility}
              onVisibilityChange={setT5Visibility}
              hasId={true}
              hasPercent={false}
            />
            </div>
            <div className="mb-4 rounded-lg border border-border bg-card p-3">
              <T5YtdChart data={t5Display} />
            </div>
            <YtdSalesTable
              data={t5Display}
              hidePln={!t5Visibility.showPln}
              showIds={t5Visibility.showId}
            />
            <TableConsole tableId="T5" />
          </div>
        </section>
        </div>
      </main>
      </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AdminView({ onGoTables }: { onGoTables: () => void }) {
  const { logout, user } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/vite.svg" alt="Logo" className="size-8" />
            <span className="font-semibold text-lg">Combo Raport — Admin</span>
            <span className="text-xs text-muted-foreground ml-2">{user?.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onGoTables}>
              Widok tabel
            </Button>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              <LogOut className="size-4 mr-2" /> Wyloguj
            </Button>
          </div>
        </div>
      </header>
      <AdminPanel />
    </div>
  );
}

export function App() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<"tables" | "admin">("tables");

  useEffect(() => {
    if (user?.role === "admin") setView("admin");
    else if (user) setView("tables");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Ładowanie…
      </div>
    );
  }

  if (!user) return <LoginPage />;

  if (user.role === "admin" && view === "admin") {
    return <AdminView onGoTables={() => setView("tables")} />;
  }

  return (
    <AppInner
      showAdminNav={user.role === "admin"}
      onGoAdmin={user.role === "admin" ? () => setView("admin") : undefined}
    />
  );
}

export default App;
