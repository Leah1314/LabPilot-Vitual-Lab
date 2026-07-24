import "server-only";

import {
  MOCK_CLUSTER_SUMMARY,
  MOCK_COHORT,
  MOCK_COOCCURRENCE,
  MOCK_OBSERVATIONS,
} from "./fixtures";
import { buildDashboardData } from "./build-data";
import type { DashboardData } from "./contracts";

/**
 * The built-in sample dataset, assembled on the server and handed to the
 * client as the "Try sample data" option. This is the only source that ships
 * with the app; upload and API sources are assembled in the browser.
 *
 * `syncedAt` is fixed rather than `Date.now()` so the server-rendered markup
 * matches what React hydrates on the client. The workspace stamps a real time
 * when the user actually selects it.
 */
export function loadSampleDashboardData(): DashboardData {
  return buildDashboardData({
    kind: "sample",
    label: "Sample dataset",
    clusterSummary: MOCK_CLUSTER_SUMMARY,
    observations: MOCK_OBSERVATIONS,
    cohort: MOCK_COHORT,
    cooccurrence: MOCK_COOCCURRENCE,
    syncedAt: MOCK_OBSERVATIONS.generated_at,
  });
}

/**
 * Optional convenience for the team demo: with PIPELINE_URL set, pull the
 * live pipeline on the server so the dashboard opens straight onto real data
 * instead of the source picker. Returns null when unset or unreachable, and
 * the picker is shown instead.
 */
export async function loadConfiguredPipeline(): Promise<DashboardData | null> {
  const base = process.env.PIPELINE_URL?.replace(/\/$/, "");
  if (!base) return null;

  async function get<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${base}${path}`, {
        next: { revalidate: 15 },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  const [summary, observations, cohort, cooccurrence] = await Promise.all([
    get<Parameters<typeof buildDashboardData>[0]["clusterSummary"]>("/cluster-summary"),
    get<Parameters<typeof buildDashboardData>[0]["observations"]>("/observations"),
    get<NonNullable<Parameters<typeof buildDashboardData>[0]["cohort"]>>("/cohort"),
    get<NonNullable<Parameters<typeof buildDashboardData>[0]["cooccurrence"]>>(
      "/cooccurrence?organism=Klebsiella%20pneumoniae&min_support=5",
    ),
  ]);

  // Both halves of what is displayed must be real before claiming a live source.
  if (!summary || !observations) return null;

  return buildDashboardData({
    kind: "api",
    label: process.env.PIPELINE_NAME?.trim() || "Configured pipeline",
    clusterSummary: summary,
    observations,
    cohort,
    cooccurrence,
    syncedAt: observations.generated_at,
  });
}
