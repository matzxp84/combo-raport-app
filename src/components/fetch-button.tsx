import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import {
  fetchT1Current,
  fetchT2Current,
  fetchT5Current,
} from "@/lib/api/gopos-client";

type Table = "t1" | "t2" | "t5";

export type FetchButtonProps = {
  table: Table;
  orgId?: string;
  disabled?: boolean;
  onT1Result?: (value: string) => void;
  onT2Result?: (cells: Record<string, string>) => void;
  onT5Result?: (rows: Array<{ id: string; category: string; ytd: string }>) => void;
};

export function FetchButton({
  table,
  orgId,
  disabled,
  onT1Result,
  onT2Result,
  onT5Result,
}: FetchButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      if (table === "t1") {
        const r = await fetchT1Current(orgId);
        onT1Result?.(r.value);
      } else if (table === "t2") {
        const r = await fetchT2Current(orgId);
        onT2Result?.(r.cells);
      } else {
        const r = await fetchT5Current(orgId);
        onT5Result?.(r.rows);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || loading || !orgId}
        onClick={onClick}
        className="gap-1.5"
        title={orgId ? `Pobierz live dane dla ${orgId}` : "Wybierz pojedynczą lokalizację"}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        POBIERZ
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
