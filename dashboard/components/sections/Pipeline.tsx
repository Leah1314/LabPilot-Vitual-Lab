"use client";

import type { DashboardData } from "@/lib/contracts";
import { formatInteger, formatSeconds } from "@/lib/format";

/**
 * How the numbers on screen were produced.
 *
 * The reference version of this page listed six stages with hardcoded timings
 * ("4m 12s", "94% grounded") regardless of what actually ran. Here a stage
 * reports a measurement only when the source supplied one; otherwise it says
 * so. prompt.md §4 is explicit that a fabricated benchmark is the one thing
 * that can sink the project.
 */
export function Pipeline({ data }: { data: DashboardData }) {
  const s = data.pipeline_stats;

  const stages = [
    {
      n: 1,
      label: "BV-BRC ingest",
      detail:
        "Precomputed sp_gene and lab-measured genome_amr tables, pulled over REST. No annotation is run here.",
      measured: null as string | null,
    },
    {
      n: 2,
      label: "Protein embedding",
      detail:
        "ESM2 inference on a Daytona GPU sandbox. Inference only — nothing is trained.",
      measured:
        s.sequences_embedded !== null
          ? `${formatInteger(s.sequences_embedded)} sequences${
              s.embedding_hardware ? ` on ${s.embedding_hardware}` : ""
            }${
              formatSeconds(s.embedding_seconds)
                ? ` in ${formatSeconds(s.embedding_seconds)}`
                : ""
            }`
          : null,
    },
    {
      n: 3,
      label: "Clustering",
      detail: `KMeans over the embeddings, joined back to phenotype and species metadata. Produced ${data.clusters.length} clusters.`,
      measured: `${data.clusters.length} clusters`,
    },
    {
      n: 4,
      label: "Observation generation",
      detail:
        "Fireworks writes one headline and observation per cluster, constrained to the numbers in the input.",
      measured:
        s.llm_median_latency_ms !== null
          ? `${formatInteger(s.llm_median_latency_ms)} ms median per cluster${
              s.llm_model ? ` · ${s.llm_model}` : ""
            }`
          : null,
    },
    {
      n: 5,
      label: "Faithfulness evaluation",
      detail:
        "Braintrust checks that every number in the prose appears in the cluster data.",
      measured:
        s.eval_mean_faithfulness !== null
          ? `mean ${s.eval_mean_faithfulness.toFixed(2)}${
              s.eval_n_examples ? ` over ${s.eval_n_examples} examples` : ""
            }`
          : null,
    },
    {
      n: 6,
      label: "This dashboard",
      detail: `Rendering ${data.clusters.length} clusters from ${data.label}.`,
      measured: data.syncedAt
        ? `loaded ${new Date(data.syncedAt).toLocaleString()}`
        : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Pipeline</p>
        <h2 className="display mt-1.5 text-2xl text-ink">
          How these numbers were produced
        </h2>
        <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted">
          A stage shows a timing only where one was measured and reported. Blank
          means nobody recorded it, not that it was instant.
        </p>
      </div>

      <ol className="space-y-3">
        {stages.map((stage) => (
          <li key={stage.n} className="border border-hairline bg-card p-5">
            <div className="flex gap-4">
              <span
                aria-hidden
                className="tabular flex h-8 w-8 shrink-0 items-center justify-center border border-violet/30 bg-violet-tint text-sm text-violet"
              >
                {stage.n}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="text-sm font-semibold text-ink">
                    {stage.label}
                  </h3>
                  {stage.measured ? (
                    <span className="tabular text-xs text-ink">
                      {stage.measured}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">not measured</span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {stage.detail}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <p className="border-t border-hairline pt-4 text-xs leading-relaxed text-muted">
        Quote a speedup only against a timed run. The honest comparison is this
        pipeline&rsquo;s measured end-to-end time against the manual alternative:
        cross-referencing CARD, VFDB and AST tables by hand across the same
        genomes.
      </p>
    </div>
  );
}
