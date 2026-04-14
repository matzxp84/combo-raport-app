import { useContext } from "react";
import { LogContext } from "./LogContext";
import type { LogEntry, TableId } from "@/lib/logTypes";

export function useLogContext() {
  const ctx = useContext(LogContext);
  if (!ctx) throw new Error("useLogContext must be used within LogProvider");
  return ctx;
}

export function useTableLogs(tableId: TableId): LogEntry[] {
  return useLogContext().logs[tableId] ?? [];
}
