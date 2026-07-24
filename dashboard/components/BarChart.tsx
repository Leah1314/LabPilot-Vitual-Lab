"use client";

import { useId, useState } from "react";
import { percentOf } from "@/lib/format";

export interface BarDatum {
  label: string;
  value: number;
  /** Optional second line in the tooltip. */
  note?: string;
}

/**
 * Horizontal bars for "magnitude by category".
 *
 * One series, so no legend — the title names it. Plain HTML rather than a
 * charting library: the marks are simple, and this keeps the visual language
 * identical to the denominator rails elsewhere on the page.
 */
export function BarChart({
  data,
  unit,
  max,
  emptyMessage = "No data.",
}: {
  data: BarDatum[];
  /** What the numbers count, e.g. "genes". Named so the axis is never bare. */
  unit: string;
  max?: number;
  emptyMessage?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const headingId = useId();

  if (data.length === 0) {
    return <p className="text-sm text-muted">{emptyMessage}</p>;
  }

  const scaleMax = max ?? Math.max(...data.map((d) => d.value));
  const total = data.reduce((n, d) => n + d.value, 0);

  return (
    <div>
      <ul className="space-y-2.5" aria-describedby={headingId}>
        {data.map((d, i) => {
          const pct = scaleMax > 0 ? (d.value / scaleMax) * 100 : 0;
          const active = hover === i;
          return (
            <li
              key={d.label}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              className="relative grid grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-3"
            >
              <span
                className="min-w-0 truncate text-xs text-ink"
                title={d.label}
              >
                {d.label}
              </span>
              <span className="relative block h-3.5 bg-paper">
                <span
                  className="block h-full bg-violet transition-opacity"
                  style={{ width: `${pct}%`, opacity: active ? 1 : 0.85 }}
                />
              </span>
              <span className="tabular text-xs text-ink">{d.value}</span>

              {active && (
                <span
                  role="status"
                  className="pointer-events-none absolute -top-1 left-0 z-10 -translate-y-full border border-hairline bg-card px-2 py-1 text-xs shadow-sm"
                >
                  <span className="block text-ink">{d.label}</span>
                  <span className="block text-muted">
                    <span className="tabular">{d.value}</span> {unit}
                    {total > 0 && (
                      <>
                        {" "}
                        · {percentOf(d.value, total)} of {total}
                      </>
                    )}
                  </span>
                  {d.note && <span className="block text-muted">{d.note}</span>}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p id={headingId} className="mt-3 text-xs text-muted">
        Bar length is {unit} on a shared scale, longest ={" "}
        <span className="tabular">{scaleMax}</span>. Total across all rows{" "}
        <span className="tabular">{total}</span>.
      </p>
    </div>
  );
}
