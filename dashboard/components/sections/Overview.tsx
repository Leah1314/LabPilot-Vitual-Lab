"use client";

import type { DashboardData } from "@/lib/contracts";
import { isOutbreakArtefact } from "@/lib/contracts";
import { formatInteger, percentOf } from "@/lib/format";
import type { SectionId } from "../Sidebar";

/**
 * Headline counts.
 *
 * Every tile carries its denominator in the hint line. The reference dashboard
 * this follows showed "AMR prevalence 87%" as a bare weighted mean with no
 * denominator and a "virulence score" invented from a keyword match plus a
 * magic constant — neither survives prompt.md §8, so neither is here.
 */
function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "amber";
}) {
  return (
    <div className="border border-hairline bg-card p-5">
      <p className="eyebrow">{label}</p>
      <p
        className={`display mt-1.5 text-3xl ${tone === "amber" ? "text-amber" : "text-ink"}`}
      >
        <span className="tabular">{value}</span>
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>
    </div>
  );
}

export function Overview({
  data,
  onNavigate,
}: {
  data: DashboardData;
  onNavigate: (id: SectionId) => void;
}) {
  const totalGenes = data.clusters.reduce((n, c) => n + c.summary.n_genes, 0);
  const resistant = data.clusters.reduce((n, c) => n + c.resistant, 0);
  const phenotyped = data.clusters.reduce((n, c) => n + c.phenotyped, 0);
  const artefacts = data.clusters.filter((c) => isOutbreakArtefact(c.summary));
  const scored = data.clusters
    .map((c) => c.observation?.eval_score)
    .filter((s): s is number => typeof s === "number" && s > 0);
  const meanScore = scored.length
    ? scored.reduce((a, b) => a + b, 0) / scored.length
    : null;

  const withProvenance = data.clusters.filter(
    (c) => c.summary.n_strains_dedup !== undefined,
  );
  const rawTotal = withProvenance.reduce(
    (n, c) => n + (c.summary.n_genomes_raw ?? 0),
    0,
  );
  const dedupTotal = withProvenance.reduce(
    (n, c) => n + (c.summary.n_strains_dedup ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Overview</p>
        <h2 className="display mt-1.5 text-2xl text-ink">
          {data.clusters.length} clusters across {data.speciesTally.length}{" "}
          species
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Genes clustered"
          value={formatInteger(totalGenes)}
          hint={`Across ${data.clusters.length} clusters`}
        />
        <Tile
          label="Lab-measured resistant"
          value={`${resistant}`}
          hint={
            phenotyped > 0
              ? `${percentOf(resistant, phenotyped)} of ${phenotyped} phenotyped isolates`
              : "No phenotyped isolates in this dataset"
          }
        />
        <Tile
          label="Distinct strains"
          value={
            withProvenance.length > 0 ? formatInteger(dedupTotal) : "unreported"
          }
          hint={
            withProvenance.length > 0
              ? `After deduplication, from ${formatInteger(rawTotal)} raw genome rows`
              : "This source reported no lineage provenance"
          }
        />
        <Tile
          label="Possible artefacts"
          value={`${artefacts.length}`}
          hint={
            artefacts.length > 0
              ? `Confined to one country or one year, of ${data.clusters.length} clusters`
              : "No cluster is confined to a single country or year"
          }
          tone={artefacts.length > 0 ? "amber" : undefined}
        />
      </div>

      {withProvenance.length === 0 && (
        <p className="border-l-2 border-amber bg-amber-tint px-3 py-2 text-xs leading-relaxed text-amber">
          <strong className="font-semibold">No lineage deduplication.</strong>{" "}
          This source did not report <span className="tabular">n_strains_dedup</span>,{" "}
          <span className="tabular">n_countries</span> or{" "}
          <span className="tabular">year_range</span>. Public genome databases are
          heavily oversampled for outbreak strains, so counts here may reflect one
          clone sequenced many times rather than a general pattern. daytona.md §3.2
          treats this as the check that decides whether the science holds up.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border border-hairline bg-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="display text-lg text-ink">Species</h3>
            <button
              type="button"
              onClick={() => onNavigate("genes")}
              className="eyebrow cursor-pointer border-b border-dashed border-muted pb-0.5 !text-violet hover:border-violet"
            >
              Gene products
            </button>
          </div>
          <ul className="mt-3 space-y-1.5">
            {data.speciesTally.slice(0, 6).map((s) => (
              <li
                key={s.name}
                className="flex items-baseline justify-between gap-3 border-b border-hairline/70 pb-1.5 text-sm"
              >
                <em className="min-w-0 truncate not-italic text-ink">{s.name}</em>
                <span className="tabular shrink-0 text-xs text-muted">
                  {s.genes} genes
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border border-hairline bg-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="display text-lg text-ink">Observations</h3>
            <button
              type="button"
              onClick={() => onNavigate("observations")}
              className="eyebrow cursor-pointer border-b border-dashed border-muted pb-0.5 !text-violet hover:border-violet"
            >
              All {data.clusters.filter((c) => c.observation).length}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            {meanScore !== null ? (
              <>
                Mean faithfulness{" "}
                <span className="tabular text-ink">{meanScore.toFixed(2)}</span>{" "}
                across <span className="tabular">{scored.length}</span> scored
                observations.
              </>
            ) : (
              "None of these observations carries a faithfulness score yet."
            )}
          </p>
          <ul className="mt-3 space-y-2">
            {data.clusters
              .filter((c) => c.observation)
              .slice(0, 3)
              .map((c) => (
                <li key={c.cluster_id} className="border border-hairline p-3">
                  <p className="text-sm font-medium text-ink">
                    {c.observation!.headline}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                    {c.observation!.observation}
                  </p>
                </li>
              ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
