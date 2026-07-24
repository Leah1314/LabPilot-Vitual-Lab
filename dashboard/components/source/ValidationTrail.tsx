"use client";

/**
 * The list of checks that ran, shown verbatim. When a connection fails in a
 * demo the only useful information is which check failed and what came before
 * it, so this stays visible on success too.
 */
export function ValidationTrail({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="mt-4 border border-hairline bg-paper/60 p-3">
      <p className="eyebrow mb-1.5">Checks</p>
      <ul className="space-y-0.5">
        {lines.map((line, i) => (
          <li key={`${i}-${line}`} className="tabular text-xs leading-relaxed text-muted">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
