/**
 * Data-source abstraction.
 *
 * The dashboard must not care whether its numbers came from an uploaded file,
 * a live API, or the committed sample fixtures — every loader resolves to the
 * same `DashboardData` from lib/contracts.ts. Only the header chip and the
 * provenance line differ, because a viewer does need to know which one they
 * are looking at.
 */

export type DataSourceKind = "sample" | "upload" | "api";

export type AuthMethod = "none" | "bearer" | "header";

export interface ApiConfig {
  connectionName: string;
  baseUrl: string;
  authMethod: AuthMethod;
  apiKey: string;
  apiKeyHeader: string;
  /** One endpoint returning both halves, or two separate endpoints. */
  useCombinedEndpoint: boolean;
  combinedEndpoint: string;
  clusterSummaryEndpoint: string;
  observationsEndpoint: string;
}

export const DEFAULT_API_CONFIG: ApiConfig = {
  connectionName: "Daytona pipeline",
  baseUrl: "",
  authMethod: "none",
  apiKey: "",
  apiKeyHeader: "X-API-Key",
  useCombinedEndpoint: false,
  combinedEndpoint: "/dashboard",
  clusterSummaryEndpoint: "/cluster-summary",
  observationsEndpoint: "/observations",
};

/** Preset matching the serving contract in daytona.md §5. */
export const DAYTONA_PRESET: Partial<ApiConfig> = {
  connectionName: "Daytona pipeline",
  useCombinedEndpoint: false,
  clusterSummaryEndpoint: "/cluster-summary",
  observationsEndpoint: "/observations",
  authMethod: "none",
};

export type FailureCode =
  | "invalid_url"
  | "auth_failed"
  | "not_found"
  | "unreachable"
  | "timeout"
  | "invalid_json"
  | "missing_fields"
  | "no_clusters"
  | "id_mismatch"
  | "blocked_host"
  | "unknown";

/** Every failure carries the trail of what was checked before it gave up. */
export interface SourceFailure {
  ok: false;
  code: FailureCode;
  message: string;
  endpointsTested: string[];
  validation: string[];
  httpStatus?: number;
  responseTimeMs?: number;
}

export interface SourceSuccess {
  ok: true;
  /** Contract 1, keyed by cluster id. */
  clusterSummary: unknown;
  /** Contract 2. */
  observations: unknown;
  /** Optional extras; absent unless the source supplied them. */
  cohort?: unknown;
  cooccurrence?: unknown;
  endpointsTested: string[];
  validation: string[];
  httpStatus?: number;
  responseTimeMs?: number;
}

export type SourceResult = SourceSuccess | SourceFailure;

export const FAILURE_MESSAGES: Record<FailureCode, string> = {
  invalid_url: "That is not a valid http:// or https:// URL.",
  auth_failed: "The endpoint rejected the credentials. Check the key and auth method.",
  not_found: "The endpoint returned 404. Check the path.",
  unreachable: "Could not reach the endpoint. Check the URL and that the service is running.",
  timeout: "The endpoint did not respond in time.",
  invalid_json: "The response was not valid JSON.",
  missing_fields: "The response is missing cluster_summary or observations.",
  no_clusters: "The response contained no clusters.",
  id_mismatch: "Observation cluster_ids do not match the cluster_summary keys.",
  blocked_host: "That host is not allowed.",
  unknown: "The request failed.",
};

export function fail(
  code: FailureCode,
  extra: Partial<Omit<SourceFailure, "ok" | "code">> = {},
): SourceFailure {
  return {
    ok: false,
    code,
    message: extra.message ?? FAILURE_MESSAGES[code],
    endpointsTested: extra.endpointsTested ?? [],
    validation: extra.validation ?? [],
    httpStatus: extra.httpStatus,
    responseTimeMs: extra.responseTimeMs,
  };
}

/** Non-secret parts of a connection, safe to remember across reloads. */
export interface RememberedConnection {
  id: string;
  connectionName: string;
  baseUrl: string;
  authMethod: AuthMethod;
  apiKeyHeader: string;
  useCombinedEndpoint: boolean;
  combinedEndpoint: string;
  clusterSummaryEndpoint: string;
  observationsEndpoint: string;
  lastConnectedAt: string;
  lastStatus: "success" | "failed";
}

const REMEMBERED_KEY = "amr-dashboard:connections";

/*
 * Backed by localStorage and exposed through useSyncExternalStore, so the
 * component reads it without a mount effect. The snapshot is memoised because
 * useSyncExternalStore compares by identity — returning a freshly parsed array
 * on every call would loop forever. `EMPTY` is a stable reference for the
 * server snapshot, where localStorage does not exist.
 */
const EMPTY: RememberedConnection[] = [];
let cache: RememberedConnection[] | null = null;
const listeners = new Set<() => void>();

function readConnections(): RememberedConnection[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(REMEMBERED_KEY);
    return raw ? (JSON.parse(raw) as RememberedConnection[]) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function invalidate() {
  cache = null;
  for (const listener of listeners) listener();
}

export function subscribeConnections(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab writing the same key should update this one too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === REMEMBERED_KEY) invalidate();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function connectionsSnapshot(): RememberedConnection[] {
  if (cache === null) cache = readConnections();
  return cache;
}

export function serverConnectionsSnapshot(): RememberedConnection[] {
  return EMPTY;
}

export function rememberConnection(config: ApiConfig, status: "success" | "failed") {
  if (typeof window === "undefined") return;
  const entry: RememberedConnection = {
    id: `${config.baseUrl}|${config.connectionName}`,
    connectionName: config.connectionName,
    baseUrl: config.baseUrl,
    authMethod: config.authMethod,
    apiKeyHeader: config.apiKeyHeader,
    useCombinedEndpoint: config.useCombinedEndpoint,
    combinedEndpoint: config.combinedEndpoint,
    clusterSummaryEndpoint: config.clusterSummaryEndpoint,
    observationsEndpoint: config.observationsEndpoint,
    lastConnectedAt: new Date().toISOString(),
    lastStatus: status,
  };
  const rest = readConnections().filter((c) => c.id !== entry.id);
  window.localStorage.setItem(
    REMEMBERED_KEY,
    JSON.stringify([entry, ...rest].slice(0, 5)),
  );
  invalidate();
}

export function forgetConnection(id: string) {
  if (typeof window === "undefined") return;
  const rest = readConnections().filter((c) => c.id !== id);
  window.localStorage.setItem(REMEMBERED_KEY, JSON.stringify(rest));
  invalidate();
}

export function sourceLabel(kind: DataSourceKind, connectionName?: string | null): string {
  if (kind === "api") return connectionName?.trim() || "Live API";
  if (kind === "upload") return "Uploaded files";
  return "Sample dataset";
}
