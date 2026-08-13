// Client-side API service for external dashboard data providers.
//
// SECURITY NOTE: browser requests carry the API key in a header, which means
// it is visible to any user of the app. For production usage, this client
// should be replaced by a server-side proxy (Lovable Cloud edge function)
// that owns the credential and never exposes it to the browser.

import type { ApiConfig, DashboardData, ClusterSummaryEntry, ObservationsResponse } from "@/lib/data-sources";

const TIMEOUT_MS = 15_000;

export interface TestConnectionSuccess {
  ok: true;
  clusterCount: number;
  observationCount: number;
  speciesCount: number;
  averageEvalScore: number;
  data: DashboardData;
  details: {
    httpStatus: number;
    responseTimeMs: number;
    endpointsTested: string[];
    validation: string[];
  };
}

export interface TestConnectionFailure {
  ok: false;
  code:
    | "invalid_url"
    | "auth_failed"
    | "not_found"
    | "cors_blocked"
    | "invalid_json"
    | "missing_fields"
    | "no_clusters"
    | "id_mismatch"
    | "network_error"
    | "timeout"
    | "unknown";
  message: string;
  details: {
    httpStatus?: number;
    responseTimeMs?: number;
    endpointsTested: string[];
    validation: string[];
  };
}

export type TestConnectionResult = TestConnectionSuccess | TestConnectionFailure;

function buildHeaders(config: ApiConfig): HeadersInit {
  const headers: Record<string, string> = { Accept: "application/json" };
  // Only attach credentials when an authenticated method is selected.
  if (config.authMethod === "bearer" && config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  } else if (config.authMethod === "header" && config.apiKey) {
    headers[config.apiKeyHeader || "X-API-Key"] = config.apiKey;
  }
  return headers;
}

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function validateUrl(base: string): boolean {
  try {
    const u = new URL(base);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchJson(url: string, headers: HeadersInit): Promise<{ status: number; body: unknown; ms: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = performance.now();
  try {
    const res = await fetch(url, { method: "GET", headers, signal: controller.signal });
    const ms = Math.round(performance.now() - start);
    let body: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        throw Object.assign(new Error("invalid_json"), { code: "invalid_json", status: res.status, ms });
      }
    }
    return { status: res.status, body, ms };
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    if ((err as Error & { code?: string }).code === "invalid_json") throw err;
    if ((err as Error).name === "AbortError") {
      throw Object.assign(new Error("timeout"), { code: "timeout", ms });
    }
    // The Fetch API surfaces CORS + DNS + network as TypeError.
    // We never include the API key in the message.
    throw Object.assign(new Error("network_error"), { code: "network_error", ms });
  } finally {
    clearTimeout(timer);
  }
}

function validateShape(payload: unknown, validation: string[]): DashboardData {
  if (!payload || typeof payload !== "object") {
    validation.push("Response is not a JSON object");
    throw Object.assign(new Error("invalid_json"), { code: "invalid_json" });
  }
  const p = payload as Record<string, unknown>;
  if (!p.cluster_summary || typeof p.cluster_summary !== "object") {
    validation.push("Missing `cluster_summary` object");
    throw Object.assign(new Error("missing_fields"), { code: "missing_fields" });
  }
  if (!p.observations || typeof p.observations !== "object") {
    validation.push("Missing `observations` object");
    throw Object.assign(new Error("missing_fields"), { code: "missing_fields" });
  }
  const obs = p.observations as Record<string, unknown>;
  if (!Array.isArray(obs.clusters)) {
    validation.push("`observations.clusters` must be an array");
    throw Object.assign(new Error("missing_fields"), { code: "missing_fields" });
  }
  validation.push("Top-level shape ✓");
  return {
    clusterSummary: p.cluster_summary as Record<string, ClusterSummaryEntry>,
    observations: p.observations as ObservationsResponse,
  };
}

function crossValidateIds(data: DashboardData, validation: string[]) {
  const clusterIds = new Set(Object.keys(data.clusterSummary));
  if (clusterIds.size === 0) {
    validation.push("cluster_summary is empty");
    throw Object.assign(new Error("no_clusters"), { code: "no_clusters" });
  }
  const missing = data.observations.clusters
    .map((o) => String(o.cluster_id))
    .filter((id) => !clusterIds.has(id));
  if (missing.length > 0) {
    validation.push(`Observation cluster_ids missing from cluster_summary: ${missing.join(", ")}`);
    throw Object.assign(new Error("id_mismatch"), { code: "id_mismatch" });
  }
  validation.push(`cluster_summary has ${clusterIds.size} clusters ✓`);
  validation.push(`observations align with cluster_summary ✓`);
}

export async function fetchDashboardData(config: ApiConfig): Promise<DashboardData> {
  const headers = buildHeaders(config);
  const endpointsTested: string[] = [];
  if (config.useCombinedEndpoint) {
    const url = joinUrl(config.baseUrl, config.combinedEndpoint);
    endpointsTested.push(url);
    const { body } = await fetchJson(url, headers);
    const validation: string[] = [];
    const data = validateShape(body, validation);
    crossValidateIds(data, validation);
    return data;
  }
  const csUrl = joinUrl(config.baseUrl, config.clusterSummaryEndpoint);
  const obsUrl = joinUrl(config.baseUrl, config.observationsEndpoint);
  const [cs, obs] = await Promise.all([fetchJson(csUrl, headers), fetchJson(obsUrl, headers)]);
  const validation: string[] = [];
  const data = validateShape({ cluster_summary: cs.body, observations: obs.body }, validation);
  crossValidateIds(data, validation);
  return data;
}

export async function testConnection(config: ApiConfig): Promise<TestConnectionResult> {
  const validation: string[] = [];
  const endpointsTested: string[] = [];
  if (!validateUrl(config.baseUrl)) {
    return {
      ok: false,
      code: "invalid_url",
      message: "Invalid API URL — must start with http:// or https://",
      details: { endpointsTested, validation },
    };
  }
  const headers = buildHeaders(config);
  const urls = config.useCombinedEndpoint
    ? [joinUrl(config.baseUrl, config.combinedEndpoint)]
    : [
        joinUrl(config.baseUrl, config.clusterSummaryEndpoint),
        joinUrl(config.baseUrl, config.observationsEndpoint),
      ];
  endpointsTested.push(...urls);

  try {
    let lastStatus = 0;
    let totalMs = 0;
    const bodies: unknown[] = [];
    for (const url of urls) {
      const { status, body, ms } = await fetchJson(url, headers);
      lastStatus = status;
      totalMs += ms;
      if (status === 401 || status === 403) {
        return {
          ok: false,
          code: "auth_failed",
          message: "Authentication failed — check your API key or authentication method.",
          details: { httpStatus: status, responseTimeMs: ms, endpointsTested, validation },
        };
      }
      if (status === 404) {
        return {
          ok: false,
          code: "not_found",
          message: `Endpoint not found (404): ${url}`,
          details: { httpStatus: status, responseTimeMs: ms, endpointsTested, validation },
        };
      }
      if (status >= 400) {
        return {
          ok: false,
          code: "unknown",
          message: `Request failed with status ${status}`,
          details: { httpStatus: status, responseTimeMs: ms, endpointsTested, validation },
        };
      }
      validation.push(`GET ${url} → ${status} ✓`);
      bodies.push(body);
    }
    const payload = config.useCombinedEndpoint
      ? bodies[0]
      : { cluster_summary: bodies[0], observations: bodies[1] };
    const data = validateShape(payload, validation);
    crossValidateIds(data, validation);

    const speciesSet = new Set<string>();
    Object.values(data.clusterSummary).forEach((c) =>
      Object.keys(c.species_breakdown ?? {}).forEach((s) => speciesSet.add(s)),
    );
    const scores = data.observations.clusters.map((o) => o.eval_score ?? 0);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    return {
      ok: true,
      clusterCount: Object.keys(data.clusterSummary).length,
      observationCount: data.observations.clusters.length,
      speciesCount: speciesSet.size,
      averageEvalScore: Number(avg.toFixed(2)),
      data,
      details: {
        httpStatus: lastStatus,
        responseTimeMs: totalMs,
        endpointsTested,
        validation,
      },
    };
  } catch (err) {
    const e = err as Error & { code?: string; status?: number; ms?: number };
    const code = (e.code as TestConnectionFailure["code"]) ?? "unknown";
    const message =
      code === "invalid_json"
        ? "Invalid JSON response from server"
        : code === "missing_fields"
          ? "Response is missing required fields (cluster_summary / observations)"
          : code === "no_clusters"
            ? "No clusters returned in the response"
            : code === "id_mismatch"
              ? "Cluster IDs in observations do not match cluster_summary"
              : code === "timeout"
                ? "Request timed out"
                : code === "network_error"
                  ? "Network request failed — the endpoint may be unreachable or CORS may be blocking the browser (see help below)."
                  : "Request failed";
    return {
      ok: false,
      code: code === "network_error" ? "cors_blocked" : code,
      message,
      details: {
        httpStatus: e.status,
        responseTimeMs: e.ms,
        endpointsTested,
        validation,
      },
    };
  }
}
