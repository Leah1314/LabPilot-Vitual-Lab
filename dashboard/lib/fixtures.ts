import clusterSummary from "@/data/cluster_summary.json";
import observations from "@/data/observations.json";
import cohort from "@/data/cohort.json";
import cooccurrence from "@/data/cooccurrence.json";

import type {
  Cohort,
  ClusterSummaryFile,
  CooccurrenceFile,
  ObservationsFile,
} from "./contracts";

/*
 * Committed mock fixtures, cast once here.
 *
 * TypeScript widens JSON tuples like `year_range: [2009, 2024]` to `number[]`
 * and string unions like `confidence` to `string`, so a direct assertion to
 * the contract types is rejected. The double assertion is confined to this
 * module rather than repeated at each call site. These files are replaced by
 * the real Part A/B outputs at step C.4 — see scripts/sync-data.ts.
 */
export const MOCK_CLUSTER_SUMMARY = clusterSummary as unknown as ClusterSummaryFile;
export const MOCK_OBSERVATIONS = observations as unknown as ObservationsFile;
export const MOCK_COHORT = cohort as unknown as Cohort;
export const MOCK_COOCCURRENCE = cooccurrence as unknown as CooccurrenceFile;
