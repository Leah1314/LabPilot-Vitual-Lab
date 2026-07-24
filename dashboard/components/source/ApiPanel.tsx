"use client";

import { useState, useSyncExternalStore } from "react";
import type { SandboxEntry } from "@/app/api/daytona/route";
import type {
  ClusterSummaryFile,
  DashboardData,
  ObservationsFile,
} from "@/lib/contracts";
import { buildDashboardData, tallySpecies } from "@/lib/build-data";
import {
  connectionsSnapshot,
  DEFAULT_API_CONFIG,
  forgetConnection,
  rememberConnection,
  serverConnectionsSnapshot,
  subscribeConnections,
  type ApiConfig,
  type AuthMethod,
  type SourceResult,
} from "@/lib/datasource";
import { ValidationTrail } from "./ValidationTrail";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </label>
  );
}

const inputClass =
  "w-full border border-hairline bg-card px-2.5 py-1.5 text-sm text-ink outline-none focus:border-violet";

export function ApiPanel({
  onLoad,
}: {
  onLoad: (data: DashboardData, config: ApiConfig) => void;
}) {
  const [config, setConfig] = useState<ApiConfig>(DEFAULT_API_CONFIG);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<SourceResult | null>(null);
  // Read straight from the store: no mount effect, and no hydration mismatch
  // because the server snapshot is a stable empty list.
  const remembered = useSyncExternalStore(
    subscribeConnections,
    connectionsSnapshot,
    serverConnectionsSnapshot,
  );

  const [sandboxes, setSandboxes] = useState<SandboxEntry[] | null>(null);
  const [sandboxNote, setSandboxNote] = useState<string | null>(null);
  const [listing, setListing] = useState(false);

  async function listSandboxes() {
    setListing(true);
    setSandboxNote(null);
    try {
      const res = await fetch("/api/daytona");
      const body = await res.json();
      setSandboxes(body.sandboxes ?? []);
      if (!body.ok) setSandboxNote(body.message ?? "Could not list sandboxes.");
      else if ((body.sandboxes ?? []).length === 0) {
        setSandboxNote("No sandboxes found on this account.");
      }
    } catch {
      setSandboxNote("Could not reach the dashboard server.");
    } finally {
      setListing(false);
    }
  }

  const patch = (p: Partial<ApiConfig>) => {
    setConfig((c) => ({ ...c, ...p }));
    setResult(null);
  };

  const needsKey = config.authMethod !== "none";
  const canTest =
    config.baseUrl.trim().length > 0 && (!needsKey || config.apiKey.trim().length > 0);

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      // Posted to our own origin: the browser never makes a cross-origin
      // request, so CORS on the pipeline is irrelevant.
      const res = await fetch("/api/datasource", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });
      const body = (await res.json()) as SourceResult;
      setResult(body);
      rememberConnection(config, body.ok ? "success" : "failed");
    } catch {
      setResult({
        ok: false,
        code: "unknown",
        message: "Could not reach the dashboard server.",
        endpointsTested: [],
        validation: [],
      });
    } finally {
      setTesting(false);
    }
  }

  function open() {
    if (!result?.ok) return;
    const clusterSummary = result.clusterSummary as ClusterSummaryFile;
    onLoad(
      buildDashboardData({
        kind: "api",
        label: config.connectionName,
        clusterSummary,
        observations: result.observations as ObservationsFile,
      }),
      // Kept in memory so the dashboard can re-sync without retyping the key.
      config,
    );
  }

  const preview = result?.ok
    ? {
        clusters: Object.keys(result.clusterSummary as ClusterSummaryFile).length,
        observations: (result.observations as ObservationsFile).clusters.length,
        species: tallySpecies(result.clusterSummary as ClusterSummaryFile).length,
      }
    : null;

  return (
    <section className="border border-hairline bg-card p-6">
      <h3 className="display text-lg text-ink">Connect a pipeline</h3>
      <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted">
        Point at any endpoint serving Contract 1 and Contract 2 — a Daytona
        sandbox preview URL, or a local FastAPI. Requests are made by this
        dashboard&rsquo;s server, not your browser, so the pipeline does not need
        to send CORS headers.
      </p>

      <div className="mt-5 border border-hairline bg-paper/60 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="eyebrow">Daytona sandboxes</p>
            <p className="mt-1 text-xs text-muted">
              Look up a running sandbox and fill in its preview URL. Listing only —
              sandboxes are created and stopped from pipeline/run_on_daytona.py,
              because GPUs bill by the hour.
            </p>
          </div>
          <button
            type="button"
            onClick={listSandboxes}
            disabled={listing}
            className="shrink-0 cursor-pointer border border-hairline px-2.5 py-1 text-xs text-muted hover:border-violet hover:text-violet disabled:opacity-50"
          >
            {listing ? "Listing…" : sandboxes ? "Refresh" : "List sandboxes"}
          </button>
        </div>

        {sandboxNote && (
          <p className="mt-3 text-xs leading-relaxed text-amber">{sandboxNote}</p>
        )}

        {sandboxes && sandboxes.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {sandboxes.map((sb) => (
              <li
                key={sb.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline/70 pb-1.5 text-xs"
              >
                <span className="min-w-0">
                  <span className="tabular text-ink">{sb.name}</span>
                  <span
                    className={`ml-2 ${sb.state === "started" ? "text-viridian" : "text-muted"}`}
                  >
                    {sb.state}
                  </span>
                  {sb.previewUrl && (
                    <span className="tabular ml-2 block truncate text-muted">
                      {sb.previewUrl}
                    </span>
                  )}
                </span>
                {sb.previewUrl ? (
                  <button
                    type="button"
                    onClick={() =>
                      patch({
                        baseUrl: sb.previewUrl!,
                        connectionName: sb.name,
                        ...(sb.previewToken
                          ? {
                              authMethod: "header" as const,
                              apiKeyHeader: "x-daytona-preview-token",
                              apiKey: sb.previewToken,
                            }
                          : {}),
                      })
                    }
                    className="shrink-0 cursor-pointer border-b border-dashed border-violet/60 text-violet hover:border-violet"
                  >
                    use
                  </button>
                ) : (
                  <span className="shrink-0 text-muted">no preview</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Connection name">
          <input
            className={inputClass}
            value={config.connectionName}
            onChange={(e) => patch({ connectionName: e.target.value })}
            placeholder="Daytona pipeline"
          />
        </Field>

        <Field label="Base URL" hint="https://8000-<sandbox>.proxy.daytona.work">
          <input
            className={`${inputClass} tabular`}
            value={config.baseUrl}
            onChange={(e) => patch({ baseUrl: e.target.value.trim() })}
            placeholder="http://localhost:8000"
          />
        </Field>

        <Field label="Authentication">
          <select
            className={inputClass}
            value={config.authMethod}
            onChange={(e) => patch({ authMethod: e.target.value as AuthMethod })}
          >
            <option value="none">None</option>
            <option value="bearer">Bearer token</option>
            <option value="header">API key header</option>
          </select>
        </Field>

        {config.authMethod === "header" && (
          <Field label="Header name">
            <input
              className={`${inputClass} tabular`}
              value={config.apiKeyHeader}
              onChange={(e) => patch({ apiKeyHeader: e.target.value })}
              placeholder="X-API-Key"
            />
          </Field>
        )}

        {needsKey && (
          <Field label="Key" hint="Held in memory for this tab only. Never stored.">
            <div className="flex gap-2">
              <input
                className={`${inputClass} tabular`}
                type={showKey ? "text" : "password"}
                value={config.apiKey}
                onChange={(e) => patch({ apiKey: e.target.value })}
                placeholder="paste key"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="shrink-0 cursor-pointer border border-hairline px-2 text-xs text-muted hover:border-violet hover:text-violet"
              >
                {showKey ? "hide" : "show"}
              </button>
            </div>
          </Field>
        )}
      </div>

      <div className="mt-4 border-t border-hairline pt-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={config.useCombinedEndpoint}
            onChange={(e) => patch({ useCombinedEndpoint: e.target.checked })}
          />
          One endpoint returns both halves
        </label>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {config.useCombinedEndpoint ? (
            <Field
              label="Combined endpoint"
              hint="Must return { cluster_summary, observations }"
            >
              <input
                className={`${inputClass} tabular`}
                value={config.combinedEndpoint}
                onChange={(e) => patch({ combinedEndpoint: e.target.value })}
              />
            </Field>
          ) : (
            <>
              <Field label="Cluster summary endpoint">
                <input
                  className={`${inputClass} tabular`}
                  value={config.clusterSummaryEndpoint}
                  onChange={(e) => patch({ clusterSummaryEndpoint: e.target.value })}
                />
              </Field>
              <Field label="Observations endpoint">
                <input
                  className={`${inputClass} tabular`}
                  value={config.observationsEndpoint}
                  onChange={(e) => patch({ observationsEndpoint: e.target.value })}
                />
              </Field>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={test}
          disabled={!canTest || testing}
          className="cursor-pointer border border-violet px-4 py-2 text-sm font-medium text-violet transition-colors hover:bg-violet-tint disabled:cursor-not-allowed disabled:opacity-40"
        >
          {testing ? "Testing…" : "Test connection"}
        </button>
        <button
          type="button"
          onClick={open}
          disabled={!result?.ok}
          className="cursor-pointer bg-violet px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Open dashboard
        </button>
        {result && !result.ok && (
          <span className="text-xs text-safranin">Fix the error below, then retest.</span>
        )}
      </div>

      {result && !result.ok && (
        <div className="mt-4 border-l-2 border-safranin bg-safranin-tint px-3 py-2">
          <p className="text-xs font-semibold text-safranin">
            {result.code.replace(/_/g, " ")}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-safranin">{result.message}</p>
        </div>
      )}

      {result?.ok && preview && (
        <div className="mt-4 border-l-2 border-viridian bg-viridian-tint px-3 py-2">
          <p className="text-xs font-semibold text-viridian">Connection verified</p>
          <p className="mt-0.5 text-xs leading-relaxed text-viridian">
            <span className="tabular">{preview.clusters}</span> clusters,{" "}
            <span className="tabular">{preview.observations}</span> observations,{" "}
            <span className="tabular">{preview.species}</span> species
            {result.responseTimeMs !== undefined && (
              <>
                {" "}
                in <span className="tabular">{result.responseTimeMs}</span> ms
              </>
            )}
            .
          </p>
        </div>
      )}

      {result && <ValidationTrail lines={result.validation} />}

      {remembered.length > 0 && (
        <div className="mt-6 border-t border-hairline pt-4">
          <p className="eyebrow mb-2">Previously used</p>
          <ul className="space-y-1">
            {remembered.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-baseline justify-between gap-2 text-xs"
              >
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      connectionName: c.connectionName,
                      baseUrl: c.baseUrl,
                      authMethod: c.authMethod,
                      apiKeyHeader: c.apiKeyHeader,
                      useCombinedEndpoint: c.useCombinedEndpoint,
                      combinedEndpoint: c.combinedEndpoint,
                      clusterSummaryEndpoint: c.clusterSummaryEndpoint,
                      observationsEndpoint: c.observationsEndpoint,
                      apiKey: "",
                    })
                  }
                  className="min-w-0 cursor-pointer truncate text-left text-violet hover:underline"
                >
                  {c.connectionName} — <span className="tabular">{c.baseUrl}</span>
                </button>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span
                    className={c.lastStatus === "success" ? "text-viridian" : "text-amber"}
                  >
                    {c.lastStatus}
                  </span>
                  <button
                    type="button"
                    onClick={() => forgetConnection(c.id)}
                    className="cursor-pointer text-muted hover:text-ink"
                  >
                    forget
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Endpoints and auth method are remembered. Keys never are.
          </p>
        </div>
      )}
    </section>
  );
}
