import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { parseCellValue } from "@/lib/parseCellValue";

type KpiRow = { id: string; label: string; cells: string[] };

type Props = {
  data: KpiRow[];
  monthLabels: string[];
};

export function T2KpiChart({ data, monthLabels }: Props) {
  const [selectedId, setSelectedId] = useState<string>(data[0]?.id ?? "");

  const selected = data.find((r) => r.id === selectedId) ?? data[0];

  const chartData = useMemo(() => {
    if (!selected) return [];
    return monthLabels
      .map((label, i) => ({
        month: label,
        value: parseCellValue(selected.cells[i]),
      }))
      .filter((d) => d.value != null)
      .reverse();
  }, [selected, monthLabels]);

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Wskaźnik:</label>
        <select
          value={selectedId || (data[0]?.id ?? "")}
          onChange={(e) => setSelectedId(e.target.value)}
          className="h-7 rounded border border-border bg-background px-2 text-xs"
        >
          {data.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div className="w-full h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--chart-1, #10b981)"
              strokeWidth={2}
              dot={{ r: 3 }}
              name={selected?.label ?? ""}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
