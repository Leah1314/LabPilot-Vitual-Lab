/**
 * Assembles a DashboardData from whatever a source supplied.
 *
 * Client-safe: the upload panel and the API panel both call this in the
 * browser, so nothing here may import server-only modules.
 */

import {
  joinClusters,
  type Cohort,
  type ClusterSummaryFile,
  type CooccurrenceFile,
  type DashboardData,
  type ObservationsFile,
  type PipelineStats,
} from "./contracts";
import { sourceLabel, type DataSourceKind } from "./datasource";

export const EMPTY_STATS: PipelineStats = {
  sequences_embedded: null,
  embedding_seconds: null,
  embedding_hardware: null,
  llm_median_latency_ms: null,
  llm_model: null,
  eval_mean_faithfulness: null,
  eval_n_examples: null,
};

/**
 * Sums `species_breakdown` across clusters. These are gene counts, not genome
 * counts — the two are labelled differently in the UI for that reason.
 */
export function tallySpecies(
  summary: ClusterSummaryFile,
): Array<{ name: string; genes: number }> {
  const tally = new Map<string, number>();
  for (const cluster of Object.values(summary)) {
    for (const [species, count] of Object.entries(cluster.species_breakdown ?? {})) {
      tally.set(species, (tally.get(species) ?? 0) + count);
    }
  }
  return [...tally.entries()]
    .map(([name, genes]) => ({ name, genes }))
    .sort((a, b) => b.genes - a.genes);
}

export interface BuildInput {
  kind: DataSourceKind;
  label?: string;
  clusterSummary: ClusterSummaryFile;
  observations: ObservationsFile;
  cohort?: Cohort | null;
  cooccurrence?: CooccurrenceFile | null;
  syncedAt?: string;
}

export function buildDashboardData({
  kind,
  label,
  clusterSummary,
  observations,
  cohort = null,
  cooccurrence = null,
  syncedAt,
}: BuildInput): DashboardData {
  return {
    kind,
    label: label?.trim() || sourceLabel(kind),
    syncedAt: syncedAt ?? new Date().toISOString(),
    generated_at: observations.generated_at ?? "",
    cohort,
    speciesTally: tallySpecies(clusterSummary),
    clusters: joinClusters(clusterSummary, observations),
    cooccurrence,
    pipeline_stats: observations.pipeline_stats ?? EMPTY_STATS,
  };
}
