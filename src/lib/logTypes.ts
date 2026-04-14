export type TableId = "T1" | "T2" | "T5";

export type LogLevel = "success" | "error" | "info";

export type LogEntry = {
  id: string;
  tableId: TableId;
  timestamp: Date;
  method: string;
  url: string;
  status: number;
  statusText: string;
  durationMs: number;
  level: LogLevel;
};
