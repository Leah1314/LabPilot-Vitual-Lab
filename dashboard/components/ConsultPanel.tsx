"use client";

import { z } from "zod";
import {
  CopilotChat,
  useAgentContext,
  useFrontendTool,
  useRenderTool,
} from "@copilotkit/react-core/v2";
import type { DashboardData } from "@/lib/contracts";
import { isOutbreakArtefact } from "@/lib/contracts";
import { formatYearRange, formatPValue } from "@/lib/format";

interface ConsultPanelProps {
  data: DashboardData;
  speciesFilter: string | null;
  highlightedCluster: string | null;
  onHighlight: (clusterId: string | null) => void;
  onSpeciesFilter: (species: string | null) => void;
}

const SUGGESTED = [
  "Which cluster has the strongest lab-measured resistance, and how many strains support it?",
  "Show me the co-occurrence pairs for Klebsiella pneumoniae.",
  "Is anything here likely to be an outbreak artefact rather than a real pattern?",
  "Highlight cluster 3 and explain why its confidence is low.",
];

/**
 * The conversational panel.
 *
 * Context exposure follows frontend.md §3: `useAgentContext` carries what the
 * user is *looking at* plus compact per-cluster statistics — not bulk data.
 * Numbers reach the model as computed values it must quote verbatim; the
 * system prompt in the runtime handler forbids arithmetic.
 */
export function ConsultPanel({
  data,
  speciesFilter,
  highlightedCluster,
  onHighlight,
  onSpeciesFilter,
}: ConsultPanelProps) {
  // Strictly JSON-serializable — no Date objects, no class instances.
  useAgentContext({
    description:
      "What the analyst is currently viewing, plus per-cluster statistics already computed by the pipeline. Quote these numbers verbatim; never recompute or estimate.",
    value: {
      data_source_kind: data.kind,
      data_source_label: data.label,
      cohort_pinned_date: data.cohort?.pinned_date ?? null,
      observations_generated_at: data.generated_at,
      active_species_filter: speciesFilter,
      highlighted_cluster: highlightedCluster,
      // Null when the source supplied no cohort file. In that case the species
      // tally below is gene counts, not genome counts — do not conflate them.
      organisms:
        data.cohort?.organisms.map((o) => ({
          name: o.name,
          n_genomes: o.n_genomes,
          resistance_reportable: o.resistance_reportable,
        })) ?? null,
      species_gene_tally: data.speciesTally,
      clusters: data.clusters.map((c) => ({
        cluster_id: c.cluster_id,
        headline: c.observation?.headline ?? null,
        confidence: c.observation?.confidence ?? null,
        eval_score: c.observation?.eval_score ?? null,
        n_genes: c.summary.n_genes,
        resistant: c.resistant,
        susceptible: c.susceptible,
        phenotyped_total: c.phenotyped,
        n_genomes_raw: c.summary.n_genomes_raw ?? null,
        n_strains_dedup: c.summary.n_strains_dedup ?? null,
        n_countries: c.summary.n_countries ?? null,
        year_range: formatYearRange(c.summary.year_range),
        possible_outbreak_artefact: isOutbreakArtefact(c.summary),
        top_products: c.summary.top_products,
        species_breakdown: c.summary.species_breakdown,
      })),
    },
  });

  // Frontend tools must return a string (frontend.md §3 sharp edges).
  useFrontendTool({
    name: "highlightCluster",
    description:
      "Scroll to and highlight one cluster card in the dashboard. Use when the user asks about a specific cluster.",
    parameters: z.object({
      clusterId: z.string().describe("Cluster id, for example '0' or '3'"),
    }),
    handler: async ({ clusterId }) => {
      const exists = data.clusters.some((c) => c.cluster_id === clusterId);
      if (!exists) {
        return JSON.stringify({
          ok: false,
          error: `No cluster ${clusterId} in this cohort.`,
          available: data.clusters.map((c) => c.cluster_id),
        });
      }
      onHighlight(clusterId);
      document
        .getElementById(`cluster-${clusterId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return JSON.stringify({ ok: true, highlighted: clusterId });
    },
  });

  useFrontendTool({
    name: "filterBySpecies",
    description:
      "Filter the cluster list to those containing a given species. Pass null to clear the filter.",
    parameters: z.object({
      species: z
        .string()
        .nullable()
        .describe("Full species name, for example 'Klebsiella pneumoniae'"),
    }),
    handler: async ({ species }) => {
      if (species === null) {
        onSpeciesFilter(null);
        return JSON.stringify({ ok: true, filter: null });
      }
      // Falls back to the species actually present in the clusters when the
      // source supplied no cohort file.
      const known =
        data.cohort?.organisms.map((o) => o.name) ??
        data.speciesTally.map((s) => s.name);
      const match = known.find(
        (n) => n.toLowerCase() === species.toLowerCase(),
      );
      if (!match) {
        return JSON.stringify({ ok: false, error: "Unknown species", known });
      }
      onSpeciesFilter(match);
      return JSON.stringify({ ok: true, filter: match });
    },
  });

  /*
   * Renderer-only, keyed to the backend tool name. This renders the JSON the
   * API returned rather than letting the model retype statistics into
   * component props — the distinction frontend.md §3 insists on.
   */
  useRenderTool(
    {
      name: "queryCooccurrence",
      parameters: z.object({
        organism: z.string(),
        minSupport: z.number().optional(),
      }),
      render: ({ parameters, status, result }) => {
        if (status === "inProgress" || status === "executing") {
          return (
            <p className="border border-hairline bg-paper px-3 py-2 text-xs text-muted">
              Reading co-occurrence statistics for {parameters?.organism ?? "…"}
            </p>
          );
        }
        let parsed: {
          organism?: string;
          pairs?: Array<{
            gene_a: string;
            gene_b: string;
            lift: number;
            p_adj: number;
            n_strains_dedup: number;
            n_genomes_raw: number;
            n_countries: number;
            year_range: [number, number];
          }>;
          error?: string;
        };
        try {
          parsed =
            typeof result === "string" ? JSON.parse(result) : (result ?? {});
        } catch {
          return (
            <p className="border border-amber/40 bg-amber-tint px-3 py-2 text-xs text-amber">
              Could not read the statistics payload.
            </p>
          );
        }

        if (parsed.error || !parsed.pairs?.length) {
          return (
            <p className="border border-amber/40 bg-amber-tint px-3 py-2 text-xs text-amber">
              {parsed.error ?? "No pairs met the support threshold."}
            </p>
          );
        }

        return (
          <div className="border border-hairline bg-card">
            <p className="eyebrow border-b border-hairline px-3 py-2">
              {parsed.organism} · top {Math.min(5, parsed.pairs.length)} by lift
            </p>
            <ul className="divide-y divide-hairline">
              {parsed.pairs.slice(0, 5).map((p) => (
                <li key={`${p.gene_a}-${p.gene_b}`} className="px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="tabular text-xs text-ink">
                      {p.gene_a} + {p.gene_b}
                    </span>
                    <span className="tabular text-xs text-ink">
                      lift {p.lift.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[0.6875rem] text-muted">
                    <span className="tabular">{p.n_strains_dedup}</span> distinct
                    strains of <span className="tabular">{p.n_genomes_raw}</span>{" "}
                    raw rows · <span className="tabular">{p.n_countries}</span>{" "}
                    countries · {formatYearRange(p.year_range)} · p adj{" "}
                    <span className="tabular">{formatPValue(p.p_adj)}</span>
                    {isOutbreakArtefact(p) && (
                      <span className="ml-1 text-amber">
                        · possible outbreak artefact
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        );
      },
    },
    [],
  );

  return (
    <aside className="consult-surface flex h-full min-h-0 flex-col border border-hairline bg-card">
      <div className="border-b border-hairline px-5 py-4">
        <p className="eyebrow">Consult</p>
        <h2 className="display mt-1.5 text-lg text-ink">
          Ask about this cohort
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Answers are grounded in the statistics on this page. The assistant
          quotes computed numbers and does not calculate its own.
        </p>
      </div>

      <div className="min-h-0 flex-1">
        <CopilotChat />
      </div>

      <div className="border-t border-hairline px-5 py-3">
        <p className="eyebrow mb-2">Try</p>
        <ul className="space-y-1">
          {SUGGESTED.map((q) => (
            <li key={q} className="text-xs leading-snug text-muted">
              {q}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
