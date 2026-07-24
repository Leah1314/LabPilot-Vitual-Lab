import "server-only";

import {
  MOCK_CLUSTER_SUMMARY,
  MOCK_COHORT,
  MOCK_COOCCURRENCE,
  MOCK_OBSERVATIONS,
} from "./fixtures";
import {
  joinClusters,
  type Cohort,
  type ClusterSummaryFile,
  type CooccurrenceFile,
  type DashboardData,
  type ObservationsFile,
  type PipelineStats,
} from "./contracts";

const EMPTY_STATS: PipelineStats = {
  sequences_embedded: null,
  embedding_seconds: null,
  embedding_hardware: null,
  llm_median_latency_ms: null,
  llm_model: null,
  eval_mean_faithfulness: null,
  eval_n_examples: null,
};

/**
 * Fetches one endpoint from the Daytona-hosted pipeline. Returns null on any
 * failure so a partially-available backend degrades to mock data per section
 * rather than blanking the dashboard mid-demo.
 */
async function fetchLive<T>(base: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${base}${path}`, {
      // Statistics are recomputed rarely; revalidate often enough that a
      // mid-demo pipeline restart is picked up without a rebuild.
      next: { revalidate: 15 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Loads dashboard data. With PIPELINE_URL unset (the default) this serves the
 * committed mock fixtures and reports `source: "mock"`, which the header
 * renders as a visible chip — Part C step C.4 is done when that chip reads
 * LIVE. Falls back to mocks whenever the pipeline is unreachable.
 */
export async function loadDashboardData(): Promise<DashboardData> {
  const base = process.env.PIPELINE_URL?.replace(/\/$/, "");

  let summary = MOCK_CLUSTER_SUMMARY;
  let observations = MOCK_OBSERVATIONS;
  let cohort = MOCK_COHORT;
  let cooccurrence = MOCK_COOCCURRENCE;
  let source: DashboardData["source"] = "mock";

  if (base) {
    const [liveSummary, liveObs, liveCohort, liveCooc] = await Promise.all([
      fetchLive<ClusterSummaryFile>(base, "/cluster-summary"),
      fetchLive<ObservationsFile>(base, "/observations"),
      fetchLive<Cohort>(base, "/cohort"),
      fetchLive<CooccurrenceFile>(
        base,
        "/cooccurrence?organism=Klebsiella%20pneumoniae&min_support=5",
      ),
    ]);

    // Only claim LIVE when both halves of the displayed numbers are real: the
    // cluster statistics and the observations written about them.
    if (liveSummary && liveObs) {
      summary = liveSummary;
      observations = liveObs;
      source = "live";
      if (liveCohort) cohort = liveCohort;
      if (liveCooc) cooccurrence = liveCooc;
    }
  }

  return {
    source,
    generated_at: observations.generated_at,
    cohort,
    clusters: joinClusters(summary, observations),
    cooccurrence,
    pipeline_stats: observations.pipeline_stats ?? EMPTY_STATS,
  };
}
