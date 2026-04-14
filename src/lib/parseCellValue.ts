/**
 * Parse numeric value from a Polish-formatted display string.
 * Examples: "109 684" -> 109684, "77,39" -> 77.39, "95%" -> 95, "1 160 543 zł" -> 1160543
 * Returns null for placeholders "-", "X", "x", or empty/unparseable strings.
 */
export function parseCellValue(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "X" || trimmed === "x") return null;
  const cleaned = trimmed
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "")
    .replace(/zł/gi, "")
    .replace(/%/g, "")
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
