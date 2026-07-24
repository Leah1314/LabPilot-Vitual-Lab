"use client";

import type { ClusterView } from "@/lib/contracts";
import { isOutbreakArtefact } from "@/lib/contracts";
import { formatYearRange, percentOf } from "@/lib/format";

/**
 * The same clusters as the cards, as a table.
 *
 * Not decoration: a chart that encodes anything in colour or bar length owes
 * readers a text equivalent, and this is it. It is also simply the faster way
 * to compare eight clusters on one number.
 */
export function ClusterTable({
  clusters,
  onSelect,
}: {
  clusters: ClusterView[];
  onSelect: (clusterId: string) => void;
}) {
  return (
    <div className="overflow-x-auto border border-hairline bg-card">
      <table className="w-full min-w-[46rem] text-sm">
        <caption className="sr-only">
          Clusters with gene counts, lab-measured resistant and susceptible
          counts, deduplicated strain support, country spread and year range.
        </caption>
        <thead>
          <tr className="border-b border-hairline">
            <th scope="col" className="eyebrow px-4 py-2 text-left">
              Cluster
            </th>
            <th scope="col" className="eyebrow px-3 py-2 text-right">
              Genes
            </th>
            <th scope="col" className="eyebrow px-3 py-2 text-right">
              Resistant
            </th>
            <th scope="col" className="eyebrow px-3 py-2 text-right">
              Susceptible
            </th>
            <th scope="col" className="eyebrow px-3 py-2 text-right">
              Strains
            </th>
            <th scope="col" className="eyebrow px-3 py-2 text-right">
              Countries
            </th>
            <th scope="col" className="eyebrow px-4 py-2 text-right">
              Years
            </th>
          </tr>
        </thead>
        <tbody>
          {clusters.map((c) => {
            const artefact = isOutbreakArtefact(c.summary);
            const dominant = Object.entries(c.summary.species_breakdown ?? {}).sort(
              (a, b) => b[1] - a[1],
            )[0]?.[0];
            return (
              <tr
                key={c.cluster_id}
                className={`border-b border-hairline/70 ${artefact ? "bg-amber-tint/50" : ""}`}
              >
                <th scope="row" className="px-4 py-2.5 text-left font-normal">
                  <button
                    type="button"
                    onClick={() => onSelect(c.cluster_id)}
                    className="cursor-pointer text-left hover:underline"
                  >
                    <span className="tabular text-muted">{c.cluster_id}</span>{" "}
                    <span className="text-ink">
                      {c.observation?.headline ?? dominant ?? "Cluster"}
                    </span>
                  </button>
                  {artefact && (
                    <span className="ml-2 whitespace-nowrap border border-amber/40 px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wider text-amber">
                      artefact
                    </span>
                  )}
                </th>
                <td className="tabular px-3 py-2.5 text-right text-ink">
                  {c.summary.n_genes}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="tabular text-ink">{c.resistant}</span>
                  <span className="ml-1 text-xs text-muted">
                    {percentOf(c.resistant, c.phenotyped)} of {c.phenotyped}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="tabular text-ink">{c.susceptible}</span>
                  <span className="ml-1 text-xs text-muted">
                    {percentOf(c.susceptible, c.phenotyped)} of {c.phenotyped}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {c.summary.n_strains_dedup !== undefined ? (
                    <>
                      <span className="tabular text-ink">
                        {c.summary.n_strains_dedup}
                      </span>
                      {c.summary.n_genomes_raw !== undefined && (
                        <span className="tabular ml-1 text-xs text-muted">
                          /{c.summary.n_genomes_raw}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td className="tabular px-3 py-2.5 text-right text-muted">
                  {c.summary.n_countries ?? "—"}
                </td>
                <td className="tabular px-4 py-2.5 text-right text-muted">
                  {formatYearRange(c.summary.year_range) ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-hairline px-4 py-3 text-xs leading-relaxed text-muted">
        Strains shows the deduplicated count over raw genome rows. An em dash
        means the source did not report that field. Shaded rows sit in a single
        country or year.
      </p>
    </div>
  );
}
