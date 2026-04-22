import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { parseCellValue } from "@/lib/parseCellValue";

type ReportRow = {
  id: string;
  label: string;
  cells: { value: string }[];
};

const DEFAULT_MONTH_LABELS = [
  "Sty", "Lut", "Mar", "Kwi", "Maj", "Cze",
  "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru",
];

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function T1VolumeChart({
  data,
  monthLabels,
}: {
  data: ReportRow[];
  monthLabels?: string[];
}) {
  const labels = monthLabels ?? DEFAULT_MONTH_LABELS;

  const chartData = useMemo(() => {
    return labels.map((label, i) => {
      const point: Record<string, string | number> = { month: label };
      for (const row of data) {
        point[row.label] = parseCellValue(row.cells[i]?.value) ?? 0;
      }
      return point;
    });
  }, [data, labels]);

  return (
    <div className="w-full h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {data.map((row, idx) => (
            <Bar
              key={row.id}
              dataKey={row.label}
              fill={CHART_COLORS[idx % CHART_COLORS.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
