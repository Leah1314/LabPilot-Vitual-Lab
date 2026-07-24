/**
 * Payload validation shared by the upload parser and the API proxy.
 *
 * Both paths run the identical checks, so an uploaded file and a live endpoint
 * fail the same way with the same wording. Each function appends to a
 * `validation` trail that the UI shows verbatim — when a connection fails at a
 * hackathon, "which check failed" is the only useful thing to know.
 */

import type { ClusterSummaryFile, ObservationsFile } from "./contracts";
import { fail, type SourceFailure } from "./datasource";

export interface ValidatedPayload {
  clusterSummary: ClusterSummaryFile;
  observations: ObservationsFile;
}

/**
 * Explicit success wrapper. `ClusterSummaryFile` is an index-signature type,
 * so `"ok" in value` cannot discriminate it from a failure — TypeScript has to
 * assume any string key might exist. Wrapping the success case gives a real
 * discriminant.
 */
export type Result<T> = { ok: true; value: T } | SourceFailure;

const ok = <T,>(value: T): Result<T> => ({ ok: true, value });

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Checks Contract 1 shape. Only the fields the dashboard actually reads are
 * required; provenance fields stay optional so a strict Contract-1 producer
 * validates cleanly.
 */
export function validateClusterSummary(
  raw: unknown,
  validation: string[],
): Result<ClusterSummaryFile> {
  if (!isPlainObject(raw)) {
    validation.push("cluster_summary is not a JSON object");
    return fail("missing_fields", { validation });
  }
  const entries = Object.entries(raw);
  if (entries.length === 0) {
    validation.push("cluster_summary has no clusters");
    return fail("no_clusters", { validation });
  }
  for (const [id, value] of entries) {
    if (!isPlainObject(value)) {
      validation.push(`cluster ${id} is not an object`);
      return fail("missing_fields", { validation });
    }
    if (typeof value.n_genes !== "number") {
      validation.push(`cluster ${id} is missing a numeric n_genes`);
      return fail("missing_fields", { validation });
    }
    if (!isPlainObject(value.resistant_phenotype_breakdown)) {
      validation.push(`cluster ${id} is missing resistant_phenotype_breakdown`);
      return fail("missing_fields", { validation });
    }
  }
  validation.push(`cluster_summary: ${entries.length} clusters ✓`);
  return ok(raw as unknown as ClusterSummaryFile);
}

/** Checks Contract 2 shape. */
export function validateObservations(
  raw: unknown,
  validation: string[],
): Result<ObservationsFile> {
  if (!isPlainObject(raw)) {
    validation.push("observations is not a JSON object");
    return fail("missing_fields", { validation });
  }
  if (!Array.isArray(raw.clusters)) {
    validation.push("observations.clusters is not an array");
    return fail("missing_fields", { validation });
  }
  for (const entry of raw.clusters) {
    if (!isPlainObject(entry)) {
      validation.push("an observation entry is not an object");
      return fail("missing_fields", { validation });
    }
    if (typeof entry.cluster_id !== "string") {
      validation.push(
        `an observation has a non-string cluster_id (${JSON.stringify(entry.cluster_id)})`,
      );
      return fail("missing_fields", { validation });
    }
    if (typeof entry.headline !== "string" || typeof entry.observation !== "string") {
      validation.push(`observation ${entry.cluster_id} is missing headline or observation`);
      return fail("missing_fields", { validation });
    }
  }
  validation.push(`observations: ${raw.clusters.length} entries ✓`);
  return ok(raw as unknown as ObservationsFile);
}

/**
 * The check that catches the mistake nobody expects: two files that are each
 * individually valid but describe different runs. Without it the dashboard
 * renders cards with headlines from one pipeline run and counts from another.
 */
export function crossValidateIds(
  clusterSummary: ClusterSummaryFile,
  observations: ObservationsFile,
  validation: string[],
): SourceFailure | null {
  const ids = new Set(Object.keys(clusterSummary));
  const orphans = observations.clusters
    .map((o) => o.cluster_id)
    .filter((id) => !ids.has(id));

  if (orphans.length > 0) {
    validation.push(
      `observations reference clusters absent from cluster_summary: ${orphans.join(", ")}`,
    );
    return fail("id_mismatch", { validation });
  }

  const described = new Set(observations.clusters.map((o) => o.cluster_id));
  const undescribed = [...ids].filter((id) => !described.has(id));
  if (undescribed.length > 0) {
    // Not fatal: the dashboard renders these cards without an observation.
    validation.push(
      `note: ${undescribed.length} cluster(s) have no observation (${undescribed.join(", ")})`,
    );
  }

  validation.push("cluster ids align ✓");
  return null;
}

/**
 * Runs the full validation over an already-parsed payload. Accepts either the
 * combined `{cluster_summary, observations}` envelope or the two halves.
 */
export function validatePayload(
  clusterSummaryRaw: unknown,
  observationsRaw: unknown,
  validation: string[],
): Result<ValidatedPayload> {
  const summary = validateClusterSummary(clusterSummaryRaw, validation);
  if (!summary.ok) return summary;

  const observations = validateObservations(observationsRaw, validation);
  if (!observations.ok) return observations;

  const mismatch = crossValidateIds(summary.value, observations.value, validation);
  if (mismatch) return mismatch;

  return ok({ clusterSummary: summary.value, observations: observations.value });
}

/** Pulls the two halves out of a combined envelope, tolerating either casing. */
export function splitCombined(body: unknown): {
  clusterSummary: unknown;
  observations: unknown;
} {
  if (!isPlainObject(body)) return { clusterSummary: undefined, observations: undefined };
  return {
    clusterSummary: body.cluster_summary ?? body.clusterSummary,
    observations: body.observations,
  };
}
