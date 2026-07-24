import { isOutbreakArtefact, type ClusterSummary } from "@/lib/contracts";
import { dedupFactor, formatYearRange } from "@/lib/format";
import { LineageRail } from "./LineageRail";

/**
 * The honesty affordances from frontend.md §4, rendered only when the pipeline
 * actually supplied the backing field. Nothing here is inferred or defaulted —
 * a missing field means the badge is absent, never that it is assumed clean.
 */
export function ProvenanceRow({
  summary,
  rawScaleMax,
}: {
  summary: ClusterSummary;
  rawScaleMax: number;
}) {
  const { n_genomes_raw, n_strains_dedup, n_countries, year_range } = summary;
  const factor = dedupFactor(n_genomes_raw, n_strains_dedup);
  const years = formatYearRange(year_range);
  const artefact = isOutbreakArtefact(summary);

  const hasAny =
    n_strains_dedup !== undefined ||
    n_countries !== undefined ||
    year_range !== undefined;

  if (!hasAny) {
    return (
      <p className="text-xs text-muted">
        Pipeline did not report lineage provenance for this cluster; counts are
        raw and may be inflated by clonal oversampling.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {n_genomes_raw !== undefined && n_strains_dedup !== undefined && (
        <div>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <p className="eyebrow">Lineage deduplication</p>
            <p className="text-xs text-muted">
              <span className="tabular text-ink">{n_strains_dedup}</span>{" "}
              distinct strains of{" "}
              <span className="tabular">{n_genomes_raw}</span> raw rows
            </p>
          </div>
          <LineageRail
            raw={n_genomes_raw}
            dedup={n_strains_dedup}
            scaleMax={rawScaleMax}
          />
        </div>
      )}

      <dl className="flex flex-wrap gap-x-6 gap-y-2 pt-1 text-xs">
        {n_strains_dedup !== undefined && n_genomes_raw === undefined && (
          <div>
            <dt className="eyebrow">Distinct strains</dt>
            <dd className="tabular mt-0.5 text-sm text-ink">
              {n_strains_dedup}
            </dd>
          </div>
        )}
        {n_countries !== undefined && (
          <div>
            <dt className="eyebrow">Countries</dt>
            <dd className="tabular mt-0.5 text-sm text-ink">{n_countries}</dd>
          </div>
        )}
        {years && (
          <div>
            <dt className="eyebrow">Collection years</dt>
            <dd className="tabular mt-0.5 text-sm text-ink">{years}</dd>
          </div>
        )}
      </dl>

      {artefact && (
        <p className="border-l-2 border-amber bg-amber-tint px-3 py-2 text-xs leading-relaxed text-amber">
          <strong className="font-semibold">Possible outbreak artefact.</strong>{" "}
          This pattern sits in{" "}
          {n_countries !== undefined && n_countries <= 1
            ? "a single country"
            : "a single collection year"}
          , so co-occurrence here is more likely to reflect one clonal expansion
          or a shared mobile element than a general association.
        </p>
      )}

      {factor !== null && factor >= 3 && !artefact && (
        <p className="text-xs leading-relaxed text-muted">
          Raw genome rows outnumber distinct strains {factor.toFixed(1)}:1.
          Percentages computed on raw rows would overstate this pattern.
        </p>
      )}
    </div>
  );
}
