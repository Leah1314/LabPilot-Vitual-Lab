"use client";

import type { Cohort, ClusterView } from "@/lib/contracts";
import { formatInteger } from "@/lib/format";

interface CohortPanelProps {
  cohort: Cohort;
  clusters: ClusterView[];
  speciesFilter: string | null;
  onSpeciesFilter: (species: string | null) => void;
  highlightedCluster: string | null;
  onHighlight: (clusterId: string | null) => void;
}

export function CohortPanel({
  cohort,
  clusters,
  speciesFilter,
  onSpeciesFilter,
  highlightedCluster,
  onHighlight,
}: CohortPanelProps) {
  const totalGenomes = cohort.organisms.reduce((n, o) => n + o.n_genomes, 0);

  return (
    <aside className="space-y-6">
      <section className="border border-hairline bg-card p-5">
        <p className="eyebrow">Cohort</p>
        <p className="display mt-1.5 text-2xl text-ink">
          <span className="tabular">{formatInteger(totalGenomes)}</span>
          <span className="ml-1.5 font-sans text-xs font-normal text-muted">
            genomes
          </span>
        </p>

        <ul className="mt-4 space-y-1">
          {cohort.organisms.map((o) => {
            const active = speciesFilter === o.name;
            return (
              <li key={o.taxon_id}>
                <button
                  type="button"
                  onClick={() => onSpeciesFilter(active ? null : o.name)}
                  aria-pressed={active}
                  className={`flex w-full cursor-pointer items-baseline justify-between gap-2 border px-2 py-1.5 text-left text-sm transition-colors ${
                    active
                      ? "border-violet bg-violet-tint text-violet"
                      : "border-transparent hover:border-hairline hover:bg-paper"
                  }`}
                >
                  <span className="min-w-0 truncate">
                    <em className="not-italic">{o.name}</em>
                    {!o.resistance_reportable && (
                      <span
                        className="ml-1.5 text-amber"
                        title="Too few lab-measured AMR rows. Virulence annotations only — no resistance statistic is quoted for this organism."
                      >
                        ◐
                      </span>
                    )}
                  </span>
                  <span className="tabular shrink-0 text-xs text-muted">
                    {o.n_genomes}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 border-t border-hairline pt-3 text-xs leading-relaxed text-muted">
          <span className="text-amber">◐</span> Virulence annotations only. Too
          few lab-measured susceptibility results to report resistance.
        </p>
      </section>

      <section className="border border-hairline bg-card p-5">
        <p className="eyebrow">Clusters</p>
        <ul className="mt-3 space-y-1">
          {clusters.map((c) => {
            const active = highlightedCluster === c.cluster_id;
            return (
              <li key={c.cluster_id}>
                <a
                  href={`#cluster-${c.cluster_id}`}
                  onClick={() => onHighlight(c.cluster_id)}
                  className={`flex items-baseline justify-between gap-2 border px-2 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-violet bg-violet-tint text-violet"
                      : "border-transparent hover:border-hairline hover:bg-paper"
                  }`}
                >
                  <span className="tabular shrink-0 text-xs text-muted">
                    {c.cluster_id}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {c.observation?.headline ?? "No observation"}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
        {highlightedCluster !== null && (
          <button
            type="button"
            onClick={() => onHighlight(null)}
            className="eyebrow mt-3 cursor-pointer border-b border-dashed border-muted pb-0.5 !text-violet hover:border-violet"
          >
            Clear highlight
          </button>
        )}
      </section>

      <section className="border border-hairline bg-card p-5">
        <p className="eyebrow">Attribution</p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Genome, annotation and susceptibility data from{" "}
          <a
            href="https://www.bv-brc.org"
            className="text-violet underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            BV-BRC
          </a>
          , publicly funded and freely available. Resistance and virulence calls
          originate with {cohort.sources.filter((s) => s !== "BV-BRC").join(", ")}
          , each under its own terms.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Susceptibility rows are filtered to laboratory methods only. BV-BRC&rsquo;s
          own computational predictions are excluded and never presented as
          measurements.
        </p>
      </section>
    </aside>
  );
}
