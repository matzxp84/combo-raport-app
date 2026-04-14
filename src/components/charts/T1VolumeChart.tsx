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

const MONTH_LABELS = [
  "Sty", "Lut", "Mar", "Kwi", "Maj", "Cze",
  "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru",
];

export function T1VolumeChart({ data }: { data: ReportRow[] }) {
  const chartData = useMemo(() => {
    const ty = data.find((r) => r.id === "2026");
    const ly = data.find((r) => r.id === "2025");
    const ay = data.find((r) => r.id === "2024");
    return MONTH_LABELS.map((label, i) => ({
      month: label,
      TY: parseCellValue(ty?.cells[i]?.value) ?? 0,
      LY: parseCellValue(ly?.cells[i]?.value) ?? 0,
      AY: parseCellValue(ay?.cells[i]?.value) ?? 0,
    }));
  }, [data]);

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
          <Bar dataKey="TY" fill="var(--chart-1, #10b981)" name="2026 (TY)" />
          <Bar dataKey="LY" fill="var(--chart-2, #3b82f6)" name="2025 (LY)" />
          <Bar dataKey="AY" fill="var(--chart-3, #f59e0b)" name="2024 (AY)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
