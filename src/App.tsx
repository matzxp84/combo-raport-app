import { useEffect, useMemo, useState } from "react";
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
  SidebarSeparator,
  SidebarInset,
} from "@/components/ui/sidebar";
import {
  UserCircle,
  Home,
  ArrowUp,
  ArrowUpDown,
  ArrowDown,
  ArrowUp as ArrowUpIcon,
  Columns3,
  User,
  Settings,
  LogOut,
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

function DarkModeToggle() {
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
}: {
  data?: KpiRow[];
  showIds?: boolean;
  hidePercent?: boolean;
  hidePln?: boolean;
  apiTM?: Record<string, string>;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "month-0", desc: true }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [expanded, setExpanded] = useState(false);

  const columns: ColumnDef<KpiRow>[] = useMemo(() => [
    {
      accessorKey: "label",
      header: () => <span className="text-xs text-muted-foreground">Wskaźnik</span>,
      enableSorting: false,
      cell: ({ row, getValue }) => {
        const labelId = showIds ? formatRowIndexId(row.index) : undefined;
        const slug = GOPOS_ROW_SLUGS[row.original.id];
        return (
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
  ], [showIds, hidePercent, hidePln, apiTM]);

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
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Columns3 className="size-3.5 mr-1" /> Kolumny
            </Button>
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
  const columns: ColumnDef<YtdRow>[] = [
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
  ];
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
}: {
  data?: ReportRow[];
  showIds?: boolean;
  hidePercent?: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [expanded, setExpanded] = useState(false);

  const columns: ColumnDef<ReportRow>[] = useMemo(() => [
    {
      accessorKey: "label",
      header: () => <span className="text-xs text-muted-foreground">Wiersz</span>,
      enableSorting: false,
      cell: ({ getValue, row }) => {
        const label = getValue() as string;
        const displayId = getDisplayRowId(label, row.original.id);
        const slug = GOPOS_ROW_SLUGS[row.original.id];
        return (
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
      sortingFn: (a, b) => parseNumericForSort(a.original.cells[12]?.value ?? "") - parseNumericForSort(b.original.cells[12]?.value ?? ""),
      header: ({ column }) => (
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
      cell: ({ row }) => (
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
      sortingFn: (a, b) => parseNumericForSort(a.original.cells[13]?.value ?? "") - parseNumericForSort(b.original.cells[13]?.value ?? ""),
      header: ({ column }) => (
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
      cell: ({ row }) => (
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
  ], [showIds, hidePercent]);

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
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Columns3 className="size-3.5 mr-1" /> Kolumny
            </Button>
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

function ListLocationMultiSelect({
  selectedListNames,
  setSelectedListNames,
  nameAlias,
  setNameAlias,
}: {
  selectedListNames: string[];
  setSelectedListNames: (v: string[]) => void;
  nameAlias: string;
  setNameAlias: (v: string) => void;
}) {
  const isSingleList = selectedListNames.length === 1;
  const currentListName = isSingleList ? selectedListNames[0] : "";
  const currentAliases = LIST_NAME_TO_ALIASES[currentListName] ?? [];

  const toggleList = (listName: string) => {
    const isCurrentlySelected = selectedListNames.includes(listName);
    const next = isCurrentlySelected
      ? selectedListNames.filter((n) => n !== listName)
      : [...selectedListNames, listName];
    setSelectedListNames(next);
    if (next.length === 1) {
      const aliases = LIST_NAME_TO_ALIASES[next[0]] ?? [];
      setNameAlias(aliases[0]?.nameAlias ?? "");
    } else if (next.length === 0) {
      setNameAlias("");
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Lista:</span>
        <div className="flex flex-wrap gap-3">
          {LIST_OPTIONS.map((option) => {
            const checked = selectedListNames.includes(option.name);
            return (
              <label
                key={option.id}
                className="flex items-center gap-1.5 cursor-pointer text-sm"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleList(option.name)}
                />
                <span>{checked ? "* " : ""}{option.name} ({option.id})</span>
              </label>
            );
          })}
        </div>
      </div>
      {isSingleList && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Lokalizacja:</span>
          <select
            className="h-8 rounded border border-border bg-background px-2 text-sm max-w-xs disabled:opacity-60"
            value={nameAlias}
            onChange={(e) => setNameAlias(e.target.value)}
            disabled={currentAliases.length === 0}
          >
            {currentAliases.length === 0 ? (
              <option value="">Brak lokalizacji dla tej listy</option>
            ) : (
              currentAliases.map((option) => (
                <option key={option.organizationId} value={option.nameAlias}>
                  {option.nameAlias}
                </option>
              ))
            )}
          </select>
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
      if (!existing) {
        byId.set(row.id, { ...row, cells: row.cells.map((c) => ({ ...c })) });
        continue;
      }
      const merged: CellValue[] = existing.cells.map((ec, i) => {
        const c = row.cells[i];
        if (!c) return ec;
        const num = parsePolishNumber(ec.value);
        const num2 = parsePolishNumber(c.value);
        if (num != null && num2 != null) {
          return { value: formatPolishNumber(num + num2), highlight: ec.highlight };
        }
        if (ec.value.endsWith("%") && c.value.endsWith("%")) {
          const n1 = parsePolishNumber(ec.value);
          const n2 = parsePolishNumber(c.value);
          if (n1 != null && n2 != null) {
            return { value: formatPolishNumber((n1 + n2) / 2) + "%", highlight: ec.highlight };
          }
        }
        return ec;
      });
      byId.set(row.id, { ...existing, cells: merged });
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const order = ["2026", "2026vs2025", "2025", "2025vs2024", "2024", "2024vs2023", "2023"];
    return order.indexOf(a.id) - order.indexOf(b.id) || a.id.localeCompare(b.id);
  });
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

function mergeKpiRows(rowsArrays: KpiRow[][]): KpiRow[] {
  const byId = new Map<string, KpiRow>();
  for (const rows of rowsArrays) {
    for (const row of rows) {
      if (!T2_ALLOWED_ROW_IDS.has(row.id)) continue;
      const existing = byId.get(row.id);
      if (!existing) {
        byId.set(row.id, { ...row, cells: [...row.cells] });
        continue;
      }
      const merged = existing.cells.map((ev, i) => {
        const v = row.cells[i];
        if (v === "-" || v === undefined) return ev;
        const n1 = parsePolishNumber(ev);
        const n2 = parsePolishNumber(v);
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
      if (!existing) {
        byId.set(row.id, { ...row });
        continue;
      }
      const raw1 = existing.ytd.replace(/\s*zł\s*$/, "");
      const raw2 = row.ytd.replace(/\s*zł\s*$/, "");
      const n1 = parsePolishNumber(raw1);
      const n2 = parsePolishNumber(raw2);
      if (n1 != null && n2 != null) {
        const suffix = hasZloty(existing.ytd) || hasZloty(row.ytd) ? " zł" : "";
        byId.set(row.id, { ...existing, ytd: `${formatPolishNumber(n1 + n2)}${suffix}` });
      } else {
        byId.set(row.id, existing);
      }
    }
  }
  return Array.from(byId.values());
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
  const [t1SelectedLists, setT1SelectedLists] = useState<string[]>([initialListName]);
  const [t1NameAlias, setT1NameAlias] = useState<string>(initialNameAlias);
  const [t2SelectedLists, setT2SelectedLists] = useState<string[]>([initialListName]);
  const [t2NameAlias, setT2NameAlias] = useState<string>(initialNameAlias);
  const [t5SelectedLists, setT5SelectedLists] = useState<string[]>([initialListName]);
  const [t5NameAlias, setT5NameAlias] = useState<string>(initialNameAlias);

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

  const t1SingleList = t1SelectedLists.length === 1 ? t1SelectedLists[0] : "";
  const t1Aliases = useMemo(
    () => LIST_NAME_TO_ALIASES[t1SingleList] ?? [],
    [t1SingleList]
  );
  const t1OrgId = t1Aliases.find((a) => a.nameAlias === t1NameAlias)?.organizationId;

  const t2SingleList = t2SelectedLists.length === 1 ? t2SelectedLists[0] : "";
  const t2Aliases = useMemo(
    () => LIST_NAME_TO_ALIASES[t2SingleList] ?? [],
    [t2SingleList]
  );
  const t2OrgId = t2Aliases.find((a) => a.nameAlias === t2NameAlias)?.organizationId;

  const t5SingleList = t5SelectedLists.length === 1 ? t5SelectedLists[0] : "";
  const t5Aliases = LIST_NAME_TO_ALIASES[t5SingleList] ?? [];
  const t5OrgId = t5Aliases.find((a) => a.nameAlias === t5NameAlias)?.organizationId;

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
    if (t1SelectedLists.length === 0) return;
    const load = async () => {
      setDataError((e) => ({ ...e, t1: false }));
      if (t1SelectedLists.length === 1 && t1OrgId) {
        const listId = LIST_ID_BY_NAME[t1SelectedLists[0]] ?? "L1";
        const res = await loggedFetch(`${T1_DATA_BASE}/T1${listId}${t1OrgId}.json`, { tableId: "T1", sink: pushLog });
        const r = res && res.ok ? await res.json() : null;
        if (!cancelled && Array.isArray(r)) setT1Data(r);
        else if (!cancelled) setDataError((e) => ({ ...e, t1: true }));
      } else if (t1SelectedLists.length > 1) {
        const results: ReportRow[][] = [];
        for (const listName of t1SelectedLists) {
          const aliases = LIST_NAME_TO_ALIASES[listName] ?? [];
          const orgId = aliases[0]?.organizationId;
          if (!orgId) continue;
          const listId = LIST_ID_BY_NAME[listName] ?? "L1";
          const res = await loggedFetch(`${T1_DATA_BASE}/T1${listId}${orgId}.json`, { tableId: "T1", sink: pushLog });
          const r = res && res.ok ? await res.json() : null;
          if (Array.isArray(r)) results.push(r);
        }
        if (!cancelled && results.length > 0) setT1Data(mergeReportRows(results));
        else if (!cancelled && results.length === 0) setDataError((e) => ({ ...e, t1: true }));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [t1SelectedLists, t1OrgId, pushLog]);

  useEffect(() => {
    let cancelled = false;
    if (t2SelectedLists.length === 0) return;
    const orgId = t2OrgId ?? t2Aliases[0]?.organizationId;
    const load = async () => {
      setT2ApiTM({});
      setDataError((e) => ({ ...e, t2: false }));
      if (t2SelectedLists.length === 1 && orgId) {
        const listId = LIST_ID_BY_NAME[t2SelectedLists[0]] ?? "L1";
        const url = `${T2_DATA_BASE}/T2${listId}${orgId}.json`;
        const res = await loggedFetch(url, { tableId: "T2", sink: pushLog });
        const r = res && res.ok ? await res.json() : null;
        if (!cancelled && Array.isArray(r))
          setT2Data(r.filter((row) => T2_ALLOWED_ROW_IDS.has(row.id)));
        else if (!cancelled) setDataError((e) => ({ ...e, t2: true }));
      } else if (t2SelectedLists.length > 1) {
        const results: KpiRow[][] = [];
        for (const listName of t2SelectedLists) {
          const aliases = LIST_NAME_TO_ALIASES[listName] ?? [];
          const oid = aliases[0]?.organizationId;
          if (!oid) continue;
          const listId = LIST_ID_BY_NAME[listName] ?? "L1";
          const res = await loggedFetch(`${T2_DATA_BASE}/T2${listId}${oid}.json`, { tableId: "T2", sink: pushLog });
          const r = res && res.ok ? await res.json() : null;
          if (Array.isArray(r)) results.push(r);
        }
        if (!cancelled && results.length > 0)
          setT2Data(mergeKpiRows(results).filter((row) => T2_ALLOWED_ROW_IDS.has(row.id)));
        else if (!cancelled && results.length === 0) setDataError((e) => ({ ...e, t2: true }));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [t2SelectedLists, t2OrgId, t2Aliases, pushLog]);

  useEffect(() => {
    let cancelled = false;
    if (t5SelectedLists.length === 0) return;
    const load = async () => {
      setDataError((e) => ({ ...e, t5: false }));
      if (t5SelectedLists.length === 1 && t5OrgId) {
        const listId = LIST_ID_BY_NAME[t5SelectedLists[0]] ?? "L1";
        const res = await loggedFetch(`${DATA_BASE}/T5${listId}${t5OrgId}.json`, { tableId: "T5", sink: pushLog });
        const r = res && res.ok ? await res.json() : null;
        if (!cancelled && Array.isArray(r)) setT5Data(r);
        else if (!cancelled) setDataError((e) => ({ ...e, t5: true }));
      } else if (t5SelectedLists.length > 1) {
        const results: YtdRow[][] = [];
        for (const listName of t5SelectedLists) {
          const aliases = LIST_NAME_TO_ALIASES[listName] ?? [];
          const orgId = aliases[0]?.organizationId;
          if (!orgId) continue;
          const listId = LIST_ID_BY_NAME[listName] ?? "L1";
          const res = await loggedFetch(`${DATA_BASE}/T5${listId}${orgId}.json`, { tableId: "T5", sink: pushLog });
          const r = res && res.ok ? await res.json() : null;
          if (Array.isArray(r)) results.push(r);
        }
        if (!cancelled && results.length > 0) setT5Data(mergeYtdRows(results));
        else if (!cancelled && results.length === 0) setDataError((e) => ({ ...e, t5: true }));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [t5SelectedLists, t5OrgId, pushLog]);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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

  return (
    <SidebarProvider defaultOpen={false}>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/vite.svg" alt="Logo" className="size-6" />
            <span className="font-semibold text-sm">Combo Raport</span>
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Sekcje raportu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={
                      <a href="#t1">
                        <span>T1 — Wolumen miesięczny</span>
                      </a>
                    }
                  />
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={
                      <a href="#t2">
                        <span>T2 — KPI miesięczne</span>
                      </a>
                    }
                  />
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={
                      <a href="#t5">
                        <span>T5 — Sprzedaż YTD</span>
                      </a>
                    }
                  />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {showAdminNav && (
            <SidebarGroup>
              <SidebarGroupLabel>Administracja</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => onGoAdmin?.()}
                    >
                      <span>Panel admina</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <img src="/vite.svg" alt="Logo" className="size-8" />
            <span className="font-semibold text-lg">Combo Raport</span>
          </div>
          <div className="flex items-center gap-2">
            <DarkModeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Konto użytkownika"
                  className="rounded-full"
                >
                  <UserCircle className="size-5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  {authUser?.name ?? "Gość"}
                  <div className="text-xs font-normal text-muted-foreground">
                    {authUser?.email}
                  </div>
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
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="w-full px-[5%] py-10 flex flex-col gap-8">
        <section id="t1" data-table-id={TABLE_IDS.T1}>
          <h1 className="text-xl font-semibold mb-1">
            Informacje o wolumenie miesięcznym (T1)
          </h1>
          <p className="text-sm text-muted-foreground mb-2">
            Zestawienie miesięczne „net_total_money”: „Wartość sprzedaży netto”, z ostatnich 2 lat.
          </p>
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <ListLocationMultiSelect
              selectedListNames={t1SelectedLists}
              setSelectedListNames={setT1SelectedLists}
              nameAlias={t1NameAlias}
              setNameAlias={setT1NameAlias}
            />
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
            <T1VolumeChart data={t1Display} />
          </div>
          <ReportTable
            data={t1Display}
            showIds={t1Visibility.showId}
            hidePercent={!t1Visibility.showPercent}
          />
          <TableConsole tableId="T1" />
        </section>
        <section id="t2" data-table-id={TABLE_IDS.T2}>
          <h2 className="text-xl font-semibold mb-1">
            Kluczowe wskaźniki miesięczne (T2)
          </h2>
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <ListLocationMultiSelect
              selectedListNames={t2SelectedLists}
              setSelectedListNames={setT2SelectedLists}
              nameAlias={t2NameAlias}
              setNameAlias={setT2NameAlias}
            />
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
            <T2KpiChart
              data={t2Display.filter((r) => T2_ALLOWED_ROW_IDS.has(r.id)).map((r) => ({
                ...r,
                label: KPI_LABELS_T2_T3[r.id] ?? r.label,
              }))}
              monthLabels={KPI_MONTH_COLUMNS.map((c) => formatKpiMonthDisplay(c.from))}
            />
          </div>
          <KpiMonthlyTable
            showIds={t2Visibility.showId}
            hidePercent={!t2Visibility.showPercent}
            hidePln={!t2Visibility.showPln}
            apiTM={t2ApiTM}
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
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div id="t5" data-table-id={TABLE_IDS.T5}>
            <h2 className="text-xl font-semibold mb-1">
              Sprzedaż od początku tego roku (T5)
            </h2>
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <ListLocationMultiSelect
                selectedListNames={t5SelectedLists}
                setSelectedListNames={setT5SelectedLists}
                nameAlias={t5NameAlias}
                setNameAlias={setT5NameAlias}
              />
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
      <footer className="border-t border-border bg-muted/30 px-4 py-4 mt-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Combo Raport. Dane wyłącznie informacyjne.</span>
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Home className="size-3.5" />
              <span>Strona główna</span>
            </a>
            <span>·</span>
            <span>Wersja 0.0.1</span>
            <span>·</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={scrollToTop}
              className="h-7 gap-1.5 px-2"
              aria-label="Wróć na górę"
            >
              <ArrowUp className="size-3.5" />
              <span>Góra</span>
            </Button>
          </div>
        </div>
      </footer>
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
