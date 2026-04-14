import { useTableLogs } from "@/contexts/useLog";
import type { LogEntry, TableId } from "@/lib/logTypes";

function formatTime(d: Date): string {
  return d.toTimeString().slice(0, 8);
}

function levelClass(level: LogEntry["level"]): string {
  if (level === "success") return "text-green-500";
  if (level === "error") return "text-red-500";
  return "text-muted-foreground";
}

export function TableConsole({ tableId }: { tableId: TableId }) {
  const logs = useTableLogs(tableId);

  return (
    <div className="mt-2 rounded-md border border-border bg-muted/30">
      <div className="flex items-center justify-between px-2 py-1 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">
          Logi zapytań ({tableId})
        </span>
        <span className="text-xs text-muted-foreground">{logs.length}</span>
      </div>
      <div
        className="h-32 overflow-y-auto scroll-smooth px-2 py-1 font-mono text-xs"
        aria-live="polite"
      >
        {logs.length === 0 ? (
          <div className="text-muted-foreground italic">
            Brak logów — wykonaj zapytanie, aby zobaczyć wpisy.
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className={levelClass(log.level)}>
              [{formatTime(log.timestamp)}] [{log.tableId}] {log.method} {log.url} →{" "}
              {log.status} {log.statusText} ({log.durationMs}ms)
            </div>
          ))
        )}
      </div>
    </div>
  );
}
