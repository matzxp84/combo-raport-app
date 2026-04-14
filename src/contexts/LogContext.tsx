import { createContext, useCallback, useMemo, useState, type ReactNode } from "react";
import type { LogEntry, TableId } from "@/lib/logTypes";

const MAX_LOGS_PER_TABLE = 50;

type LogContextValue = {
  logs: Record<TableId, LogEntry[]>;
  pushLog: (entry: LogEntry) => void;
  clearLogs: (tableId?: TableId) => void;
};

// eslint-disable-next-line react-refresh/only-export-components
export const LogContext = createContext<LogContextValue | null>(null);

const emptyLogs: Record<TableId, LogEntry[]> = { T1: [], T2: [], T5: [] };

export function LogProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<Record<TableId, LogEntry[]>>(emptyLogs);

  const pushLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => {
      const existing = prev[entry.tableId] ?? [];
      const next = [entry, ...existing].slice(0, MAX_LOGS_PER_TABLE);
      return { ...prev, [entry.tableId]: next };
    });
  }, []);

  const clearLogs = useCallback((tableId?: TableId) => {
    setLogs((prev) => {
      if (!tableId) return emptyLogs;
      return { ...prev, [tableId]: [] };
    });
  }, []);

  const value = useMemo(() => ({ logs, pushLog, clearLogs }), [logs, pushLog, clearLogs]);

  return <LogContext.Provider value={value}>{children}</LogContext.Provider>;
}
