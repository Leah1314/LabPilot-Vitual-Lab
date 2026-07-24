/**
 * Formatting helpers. The house rule from prompt.md: a percentage is never
 * rendered without its denominator, so `percent` deliberately returns both.
 */

export function percentOf(part: number, whole: number): string {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

/** "81% of 47" — the only sanctioned way to show a proportion. */
export function percentWithDenominator(part: number, whole: number): string {
  if (!whole) return "no phenotyped isolates";
  return `${percentOf(part, whole)} of ${whole}`;
}

export function formatYearRange(range?: [number, number]): string | null {
  if (!range) return null;
  return range[0] === range[1] ? `${range[0]}` : `${range[0]}–${range[1]}`;
}

/** p-values below 1e-4 read better in exponent form. */
export function formatPValue(p: number): string {
  if (p === 0) return "<1e-16";
  if (p < 1e-4) return p.toExponential(1).replace("e-", "e−");
  return p.toFixed(4);
}

export function formatSeconds(s: number | null): string | null {
  if (s === null) return null;
  if (s < 90) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export function formatInteger(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Ratio of raw genome rows to deduplicated strains. Values well above 1 mean
 * the raw count is inflated by clonal oversampling.
 */
export function dedupFactor(raw?: number, dedup?: number): number | null {
  if (!raw || !dedup) return null;
  return raw / dedup;
}
