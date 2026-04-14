import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { parseCellValue } from "@/lib/parseCellValue";

type YtdRow = { id: string; category: string; ytd: string };

export function T5YtdChart({ data }: { data: YtdRow[] }) {
  const chartData = useMemo(() => {
    return data.map((row) => ({
      category: row.category,
      YTD: parseCellValue(row.ytd) ?? 0,
    }));
  }, [data]);

  return (
    <div className="w-full h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="category" tick={{ fontSize: 11 }} />
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
          <Area
            type="monotone"
            dataKey="YTD"
            stroke="var(--chart-1, #10b981)"
            fill="var(--chart-1, #10b981)"
            fillOpacity={0.3}
            name="YTD 2026"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
