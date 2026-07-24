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

/*
 * SSRF posture.
 *
 * This route fetches a URL the user typed, which is the point — the pipeline
 * normally runs on localhost or a Daytona preview URL, so blanket-blocking
 * private ranges would break the primary use case. What is blocked is the
 * thing an attacker actually wants: link-local addresses, where cloud
 * providers expose instance credentials.
 *
 * Three defences, because a hostname check alone is not enough:
 *   1. Resolve DNS first and check every returned address, so a hostname that
 *      maps to 169.254.169.254 is refused (DNS rebinding).
 *   2. Refuse redirects, so an allowed host cannot bounce us to a blocked one.
 *   3. Re-check the host on each endpoint, not just the base URL.
 *
 * A determined attacker with a DNS server that changes its answer between our
 * lookup and the fetch can still win the race. Closing that needs a pinned-IP
 * agent; it is out of scope for a local research tool and noted rather than
 * pretended away.
 */
const BLOCKED_HOSTNAMES = new Set([
  "metadata.google.internal",
  "metadata.goog",
]);

function isBlockedAddress(ip: string): boolean {
  // IPv4 link-local (169.254/16) covers the AWS/GCP/Azure metadata endpoint.
  if (/^169\.254\./.test(ip)) return true;
  // IPv6 link-local and the IPv4-mapped form of the above.
  const lower = ip.toLowerCase();
  if (lower.startsWith("fe80:")) return true;
  if (lower.startsWith("::ffff:169.254.")) return true;
  // GCP's alternate metadata address.
  if (ip === "metadata.google.internal") return true;
  return false;
}

async function hostIsAllowed(hostname: string): Promise<boolean> {
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) return false;
  if (isBlockedAddress(hostname)) return false;
  try {
    const { lookup } = await import("node:dns/promises");
    const records = await lookup(hostname, { all: true });
    return !records.some((r) => isBlockedAddress(r.address));
  } catch {
    // Unresolvable: let the fetch fail and report "unreachable" instead.
    return true;
  }
}

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
    // Never follow redirects: an allowed host must not be able to bounce this
    // request onto a blocked one after the host check has already passed.
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const ms = Date.now() - started;
  if (res.status >= 300 && res.status < 400) {
    throw Object.assign(new Error("redirected"), {
      code: "redirected",
      status: res.status,
      ms,
    });
  }
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
  if (!(await hostIsAllowed(base.hostname))) {
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
      if (e.code === "redirected") {
        validation.push(`GET ${url} returned a ${e.status} redirect`);
        return NextResponse.json(
          fail("blocked_host", {
            httpStatus: e.status,
            responseTimeMs: totalMs,
            endpointsTested: endpoints,
            validation,
            message:
              "The endpoint redirected. Redirects are not followed, because they can " +
              "point somewhere the host check already rejected. Use the final URL directly.",
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
