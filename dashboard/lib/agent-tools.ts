import "server-only";

import { defineTool } from "@copilotkit/runtime/v2";
import { z } from "zod";

import { MOCK_CLUSTER_SUMMARY, MOCK_COOCCURRENCE } from "./fixtures";
import type { ClusterSummaryFile, CooccurrenceFile } from "./contracts";

const PIPELINE = process.env.PIPELINE_URL?.replace(/\/$/, "");

/**
 * Backend tools run server-side, so the Fireworks key and the pipeline URL
 * never reach the client bundle. Each falls back to the committed fixture when
 * the pipeline is unset or unreachable, so the chat still answers during a
 * network failure rather than erroring in front of judges.
 */

async function pipelineJson<T>(path: string): Promise<T | null> {
  if (!PIPELINE) return null;
  try {
    const res = await fetch(`${PIPELINE}${path}`, {
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const queryCooccurrence = defineTool({
  name: "queryCooccurrence",
  description:
    "Get resistance and virulence gene co-occurrence statistics for one organism. Returns gene pairs with lift, Jaccard, FDR-adjusted p-value, deduplicated strain support, country spread and collection year range. Call this whenever the user asks which genes travel together.",
  parameters: z.object({
    organism: z
      .string()
      .describe("Full species name, for example 'Klebsiella pneumoniae'"),
    minSupport: z
      .number()
      .optional()
      .describe("Minimum number of distinct strains supporting a pair"),
  }),
  execute: async ({ organism, minSupport = 5 }) => {
    const live = await pipelineJson<CooccurrenceFile>(
      `/cooccurrence?organism=${encodeURIComponent(organism)}&min_support=${minSupport}`,
    );
    const data = live ?? MOCK_COOCCURRENCE;

    // The fixture covers one organism. Say so rather than answering about a
    // different organism than the one asked about.
    if (!live && data.organism.toLowerCase() !== organism.toLowerCase()) {
      return JSON.stringify({
        error: `No co-occurrence statistics loaded for ${organism}. Available in the current dataset: ${data.organism}.`,
        source: "mock",
      });
    }

    return JSON.stringify({
      ...data,
      pairs: data.pairs.filter((p) => p.n_strains_dedup >= minSupport),
      source: live ? "live" : "mock",
    });
  },
});

export const queryResistanceProfile = defineTool({
  name: "queryResistanceProfile",
  description:
    "Get lab-measured resistant and susceptible counts per cluster, with the deduplicated strain support and country/year spread behind each. Use for questions about what is resistant or still susceptible.",
  parameters: z.object({
    clusterId: z
      .string()
      .optional()
      .describe("Restrict to one cluster id, for example '0'. Omit for all."),
  }),
  execute: async ({ clusterId }) => {
    const live = await pipelineJson<ClusterSummaryFile>("/cluster-summary");
    const summary = live ?? MOCK_CLUSTER_SUMMARY;

    const entries = Object.entries(summary).filter(
      ([id]) => clusterId === undefined || id === clusterId,
    );

    if (!entries.length) {
      return JSON.stringify({
        error: `No cluster ${clusterId}.`,
        available: Object.keys(summary),
      });
    }

    return JSON.stringify({
      source: live ? "live" : "mock",
      clusters: entries.map(([id, s]) => ({
        cluster_id: id,
        n_genes: s.n_genes,
        resistant: s.resistant_phenotype_breakdown?.["Resistant"] ?? 0,
        susceptible: s.resistant_phenotype_breakdown?.["Susceptible"] ?? 0,
        n_genomes_raw: s.n_genomes_raw ?? null,
        n_strains_dedup: s.n_strains_dedup ?? null,
        n_countries: s.n_countries ?? null,
        year_range: s.year_range ?? null,
        top_products: s.top_products,
        species_breakdown: s.species_breakdown,
      })),
    });
  },
});
