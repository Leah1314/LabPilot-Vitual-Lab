import type { CooccurrenceFile } from "@/lib/contracts";
import { isOutbreakArtefact } from "@/lib/contracts";
import { formatPValue, formatYearRange } from "@/lib/format";

/**
 * Ranked gene pairs. Deduplicated strain count is the primary support column;
 * the raw genome count sits beside it in muted type so the gap is always on
 * screen rather than a tooltip away.
 */
export function CooccurrenceTable({ data }: { data: CooccurrenceFile }) {
  const pairs = [...data.pairs].sort((a, b) => b.lift - a.lift);

  return (
    <section
      aria-labelledby="cooc-heading"
      className="border border-hairline bg-card"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline p-5">
        <div>
          <p className="eyebrow">Pairwise co-occurrence</p>
          <h2 id="cooc-heading" className="display mt-1.5 text-lg text-ink">
            <em className="not-italic">{data.organism}</em>
          </h2>
        </div>
        <p className="text-xs text-muted">
          Ranked by lift · minimum support {data.min_support} strains · FDR-adjusted
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <caption className="sr-only">
            Gene pairs ranked by lift, with deduplicated strain support,
            adjusted p-value, country spread and collection year range.
          </caption>
          <thead>
            <tr className="border-b border-hairline">
              <th scope="col" className="eyebrow px-5 py-2 text-left">
                Gene pair
              </th>
              <th scope="col" className="eyebrow px-3 py-2 text-right">
                Lift
              </th>
              <th scope="col" className="eyebrow px-3 py-2 text-right">
                Jaccard
              </th>
              <th scope="col" className="eyebrow px-3 py-2 text-right">
                p adj
              </th>
              <th scope="col" className="eyebrow px-3 py-2 text-right">
                Strains
              </th>
              <th scope="col" className="eyebrow px-3 py-2 text-right">
                Countries
              </th>
              <th scope="col" className="eyebrow px-5 py-2 text-right">
                Years
              </th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p) => {
              const artefact = isOutbreakArtefact(p);
              return (
                <tr
                  key={`${p.gene_a}-${p.gene_b}`}
                  className={`border-b border-hairline/70 ${
                    artefact ? "bg-amber-tint/50" : ""
                  }`}
                >
                  <th scope="row" className="px-5 py-2.5 text-left font-normal">
                    <span className="tabular text-ink">{p.gene_a}</span>
                    <span className="mx-1.5 text-muted">+</span>
                    <span className="tabular text-ink">{p.gene_b}</span>
                    {artefact && (
                      <span className="ml-2 whitespace-nowrap border border-amber/40 px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wider text-amber">
                        single{" "}
                        {p.n_countries <= 1 ? "country" : "year"}
                      </span>
                    )}
                  </th>
                  <td className="tabular px-3 py-2.5 text-right text-ink">
                    {p.lift.toFixed(2)}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right text-muted">
                    {p.jaccard.toFixed(2)}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right text-muted">
                    {formatPValue(p.p_adj)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="tabular text-ink">{p.n_strains_dedup}</span>
                    <span className="tabular ml-1 text-xs text-muted">
                      /{p.n_genomes_raw}
                    </span>
                  </td>
                  <td className="tabular px-3 py-2.5 text-right text-muted">
                    {p.n_countries}
                  </td>
                  <td className="tabular px-5 py-2.5 text-right text-muted">
                    {formatYearRange(p.year_range)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-hairline px-5 py-3 text-xs leading-relaxed text-muted">
        Strains column shows deduplicated count over raw genome rows. Lift is
        computed on deduplicated strains. Shaded rows sit in a single country or
        a single collection year and should be read as one clonal or
        plasmid-linked event.
      </p>
    </section>
  );
}
