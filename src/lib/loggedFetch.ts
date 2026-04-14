import type { TableId, LogEntry, LogLevel } from "./logTypes";

export type LogSink = (entry: LogEntry) => void;

type LoggedFetchOptions = {
  tableId: TableId;
  sink: LogSink;
  init?: RequestInit;
};

let idCounter = 0;
const nextId = () => `log-${Date.now()}-${++idCounter}`;

export async function loggedFetch(
  url: string,
  { tableId, sink, init }: LoggedFetchOptions,
): Promise<Response | null> {
  const start = performance.now();
  const method = init?.method ?? "GET";
  try {
    const res = await fetch(url, init);
    const duration = Math.round(performance.now() - start);
    const level: LogLevel = res.ok ? "success" : "error";
    sink({
      id: nextId(),
      tableId,
      timestamp: new Date(),
      method,
      url,
      status: res.status,
      statusText: res.statusText || (res.ok ? "OK" : "ERROR"),
      durationMs: duration,
      level,
    });
    return res;
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    sink({
      id: nextId(),
      tableId,
      timestamp: new Date(),
      method,
      url,
      status: 0,
      statusText: err instanceof Error ? err.message : "Network error",
      durationMs: duration,
      level: "error",
    });
    return null;
  }
}
