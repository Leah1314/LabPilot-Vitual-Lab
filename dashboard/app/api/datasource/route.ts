import { NextResponse } from "next/server";

import {
  fail,
  type ApiConfig,
  type SourceResult,
} from "@/lib/datasource";
import { splitCombined, validatePayload } from "@/lib/validate";

/*
 * Server-side proxy for user-configured pipeline endpoints.
 *
 * The reference implementation fetches the endpoint straight from the browser
 * and then needs a page of CORS troubleshooting, because an arbitrary API will
 * not send Access-Control-Allow-Origin for our dev host. Fetching from the
 * server sidesteps that entirely — the browser only ever talks to this origin.
 * daytona.md §4.4 notes CORS behaviour through the Daytona preview proxy is
 * undocumented, which makes the browser-side approach a coin flip at demo time.
 *
 * The user's key still travels from their browser to this server, but it never
 * goes cross-origin from the page and is never persisted here.
 */

export const runtime = "nodejs";

const TIMEOUT_MS = 12_000;

/** Cloud metadata services are the classic SSRF target; refuse them outright. */
const BLOCKED_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "metadata.goog",
]);

function parseBaseUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function buildHeaders(config: ApiConfig): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (config.authMethod === "bearer" && config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  } else if (config.authMethod === "header" && config.apiKey) {
    headers[config.apiKeyHeader || "X-API-Key"] = config.apiKey;
  }
  return headers;
}

interface FetchOutcome {
  status: number;
  body: unknown;
  ms: number;
}

async function fetchJson(
  url: string,
  headers: Record<string, string>,
): Promise<FetchOutcome> {
  const started = Date.now();
  const res = await fetch(url, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const ms = Date.now() - started;
  const text = await res.text();
  if (!text) return { status: res.status, body: null, ms };
  try {
    return { status: res.status, body: JSON.parse(text), ms };
  } catch {
    throw Object.assign(new Error("invalid_json"), { code: "invalid_json", status: res.status, ms });
  }
}

/** Maps an HTTP status onto the shared failure vocabulary. */
function statusFailure(status: number, url: string, validation: string[], ms: number) {
  if (status === 401 || status === 403) {
    return fail("auth_failed", { httpStatus: status, responseTimeMs: ms, validation });
  }
  if (status === 404) {
    return fail("not_found", {
      httpStatus: status,
      responseTimeMs: ms,
      validation,
      message: `Endpoint not found (404): ${url}`,
    });
  }
  return fail("unknown", {
    httpStatus: status,
    responseTimeMs: ms,
    validation,
    message: `Request failed with status ${status}.`,
  });
}

export async function POST(request: Request): Promise<NextResponse<SourceResult>> {
  let config: ApiConfig;
  try {
    config = (await request.json()) as ApiConfig;
  } catch {
    return NextResponse.json(fail("invalid_json", { message: "Malformed request body." }));
  }

  const validation: string[] = [];
  const base = parseBaseUrl(config.baseUrl ?? "");
  if (!base) {
    return NextResponse.json(fail("invalid_url", { validation }));
  }
  if (BLOCKED_HOSTS.has(base.hostname)) {
    return NextResponse.json(fail("blocked_host", { validation }));
  }
  validation.push(`base URL ${base.origin} ✓`);

  const endpoints = config.useCombinedEndpoint
    ? [joinUrl(config.baseUrl, config.combinedEndpoint)]
    : [
        joinUrl(config.baseUrl, config.clusterSummaryEndpoint),
        joinUrl(config.baseUrl, config.observationsEndpoint),
      ];

  const headers = buildHeaders(config);
  const bodies: unknown[] = [];
  let totalMs = 0;
  let lastStatus = 0;

  for (const url of endpoints) {
    try {
      const { status, body, ms } = await fetchJson(url, headers);
      totalMs += ms;
      lastStatus = status;
      if (status >= 400) {
        return NextResponse.json(
          statusFailure(status, url, validation, ms) as SourceResult,
        );
      }
      validation.push(`GET ${url} → ${status} ✓`);
      bodies.push(body);
    } catch (err) {
      const e = err as Error & { code?: string; status?: number; ms?: number };
      totalMs += e.ms ?? 0;
      if (e.code === "invalid_json") {
        validation.push(`GET ${url} returned a non-JSON body`);
        return NextResponse.json(
          fail("invalid_json", {
            httpStatus: e.status,
            responseTimeMs: totalMs,
            endpointsTested: endpoints,
            validation,
          }),
        );
      }
      const timedOut = e.name === "TimeoutError" || e.name === "AbortError";
      validation.push(`GET ${url} ${timedOut ? "timed out" : "could not be reached"}`);
      return NextResponse.json(
        fail(timedOut ? "timeout" : "unreachable", {
          responseTimeMs: totalMs,
          endpointsTested: endpoints,
          validation,
        }),
      );
    }
  }

  const { clusterSummary: rawSummary, observations: rawObservations } =
    config.useCombinedEndpoint
      ? splitCombined(bodies[0])
      : { clusterSummary: bodies[0], observations: bodies[1] };

  const validated = validatePayload(rawSummary, rawObservations, validation);
  if (!validated.ok) {
    return NextResponse.json({
      ...validated,
      endpointsTested: endpoints,
      responseTimeMs: totalMs,
      httpStatus: lastStatus,
    });
  }

  return NextResponse.json({
    ok: true,
    clusterSummary: validated.value.clusterSummary,
    observations: validated.value.observations,
    endpointsTested: endpoints,
    validation,
    httpStatus: lastStatus,
    responseTimeMs: totalMs,
  });
}
