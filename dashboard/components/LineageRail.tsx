/**
 * Raw genome rows versus distinct strains, on one axis and in one unit.
 *
 * The dashed extent is what the database contains; the solid bar is what
 * survives collapsing identical resistance profiles. The unfilled remainder
 * is clonal oversampling, drawn at the same scale across every cluster so the
 * worst offender is obvious at a glance rather than a ratio in a footnote.
 */
export function LineageRail({
  raw,
  dedup,
  scaleMax,
}: {
  raw: number;
  dedup: number;
  scaleMax: number;
}) {
  const rawPct = scaleMax > 0 ? (raw / scaleMax) * 100 : 0;
  const dedupPct = scaleMax > 0 ? (dedup / scaleMax) * 100 : 0;

  return (
    <div
      className="lineage-track"
      role="img"
      aria-label={`${dedup} distinct strains of ${raw} raw genome rows, drawn to a shared scale of ${scaleMax}.`}
    >
      <div className="lineage-raw" style={{ width: `${rawPct}%` }} />
      <div className="lineage-dedup" style={{ width: `${dedupPct}%` }} />
    </div>
  );
}
