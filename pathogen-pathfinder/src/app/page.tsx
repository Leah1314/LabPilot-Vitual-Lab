"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  UploadCloud,
  FileCheck2,
  X,
  Sparkles,
  Shield,
  Cpu,
  Database,
  Link2,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  Trash2,
  Info,
  ServerCog,
} from "lucide-react";
import {
  REQUIRED_FILES,
  MIN_REQUIRED,
  canAnalyze,
  readyCount,
  useWorkspace,
  type UploadedFile,
} from "@/lib/workspace-store";
import {
  DEFAULT_API_CONFIG,
  deleteRecentConnection,
  loadRecentConnections,
  loadSampleData,
  parseUploadedFiles,
  saveRecentConnection,
  type ApiConfig,
  type AuthMethod,
  type DashboardData,
  type DataSourceType,
  type ParsedUpload,
  type RecentConnection,
} from "@/lib/data-sources";
import { testConnection, type TestConnectionResult } from "@/services/dataSourceApi";

// Next.js page
export default UploadPage;

type Tab = { id: DataSourceType; label: string; icon: React.ComponentType<{ className?: string }>; hint: string };

const TABS: Tab[] = [
  { id: "upload", label: "Upload Files", icon: UploadCloud, hint: "Drop CSV / JSON exports" },
  { id: "api", label: "Connect API", icon: Link2, hint: "Fetch from a live endpoint" },
  { id: "sample", label: "Try Sample Dataset", icon: Database, hint: "Load a demo dataset instantly" },
];

function UploadPage() {
  const router = useRouter();
  const { loadDataSource, loadApiData } = useWorkspace();
  const [tab, setTab] = useState<DataSourceType>("upload");

  return (
    <div className="hero-gradient min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-16 lg:py-20">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-teal" />
            Upload-first AI Research Workspace
          </div>
          <h1 className="mt-6 text-4xl lg:text-6xl font-bold tracking-tight text-foreground">
            Choose your data source
          </h1>
          <p className="mt-5 text-base lg:text-lg text-muted-foreground leading-relaxed">
            Upload files, connect a live API, or explore with sample data — the rest of the workspace
            reads a single, normalized shape regardless of source.
          </p>
        </div>

        {/* Tabs */}
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={active}
                className={`card-elevated rounded-xl p-4 text-left transition-all ${
                  active
                    ? "border-teal ring-2 ring-teal/30"
                    : "hover:border-teal/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      active ? "bg-teal text-white" : "bg-teal/10 text-teal"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{t.label}</div>
                    <div className="text-[11px] text-muted-foreground">{t.hint}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 animate-fade-in">
          {tab === "upload" && <UploadPanel onAnalyze={(data) => {
            loadDataSource("upload", data);
            router.push("/analyzing");
          }} />}
          {tab === "api" && (
            <ApiPanel
              onConnected={(config, data) => {
                loadApiData(config, data);
                router.push("/analyzing");
              }}
            />
          )}
          {tab === "sample" && (
            <SamplePanel
              onLoadSample={() => {
                loadDataSource("sample", loadSampleData());
                router.push("/analyzing");
              }}
            />
          )}
        </div>

        {/* Feature strip */}
        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Cpu, title: "H100 embeddings", body: "ESM2 protein embeddings on Daytona." },
            { icon: Sparkles, title: "AI insights", body: "Fireworks AI generation per cluster." },
            { icon: Shield, title: "Grounded validation", body: "Braintrust verifies every claim." },
          ].map((f) => (
            <div key={f.title} className="card-elevated rounded-xl p-5">
              <f.icon className="h-5 w-5 text-teal" />
              <div className="mt-3 text-sm font-semibold text-foreground">{f.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{f.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Upload panel (unchanged workflow, preserved from the previous UI). */
/* ------------------------------------------------------------------ */
function UploadPanel({ onAnalyze }: { onAnalyze: (data: DashboardData) => void }) {
  const { files, addFiles, removeFile } = useWorkspace();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsed, setParsed] = useState<ParsedUpload | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const ready = readyCount(files);
  // A cluster summary is all that is actually needed to analyse and chat.
  const enabled = !!parsed?.data;

  // Files are parsed in the browser; there is no upload to a backend.
  const handleFiles = async (list: FileList | File[]) => {
    setUploading(true);
    const arr = Array.from(list);
    const incoming: UploadedFile[] = arr.map((f) => ({
      name: f.name,
      size: f.size,
      valid: (REQUIRED_FILES as string[]).includes(f.name),
    }));
    addFiles(incoming);
    try {
      setParsed(await parseUploadedFiles(arr));
    } catch {
      setParsed({
        data: null,
        enrichment: null,
        errors: ["Could not read those files."],
        notes: [],
      });
    }
    setUploading(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`card-elevated rounded-2xl border-2 border-dashed transition-all cursor-pointer p-10 lg:p-14 text-center ${
          dragOver ? "border-teal bg-accent/60 scale-[1.01]" : "border-border hover:border-teal/60 hover:bg-accent/30"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".csv,.json"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal/10 text-teal ${
            uploading ? "animate-pulse" : ""
          }`}
        >
          <UploadCloud className="h-8 w-8" />
        </div>
        <div className="mt-5 text-lg font-semibold text-foreground">
          {uploading ? "Uploading…" : "Drag & drop files here"}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">or click to browse — CSV and JSON supported</div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
          {REQUIRED_FILES.map((n) => (
            <span key={n} className="rounded-full border border-border bg-background/70 px-2 py-1 font-mono">
              {n}
            </span>
          ))}
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {files.map((f) => (
            <div key={f.name} className="card-elevated rounded-lg px-4 py-3 flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-3 min-w-0">
                <FileCheck2 className={`h-4 w-4 shrink-0 ${f.valid ? "text-success" : "text-muted-foreground"}`} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{f.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {(f.size / 1024).toFixed(1)} KB {f.valid ? "· validated" : "· unrecognized"}
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(f.name);
                }}
                className="text-muted-foreground hover:text-foreground p-1"
                aria-label={`Remove ${f.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {parsed && (parsed.errors.length > 0 || parsed.notes.length > 0) && (
        <div className="mt-6 rounded-lg border border-border bg-accent/30 p-4 text-sm">
          {parsed.errors.map((e, i) => (
            <div key={`e${i}`} className="text-destructive">• {e}</div>
          ))}
          {parsed.notes.map((n, i) => (
            <div key={`n${i}`} className="text-muted-foreground">• {n}</div>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm">
          <span className={`font-semibold ${enabled ? "text-success" : "text-muted-foreground"}`}>
            {enabled
              ? `${Object.keys(parsed!.data!.clusterSummary).length} clusters parsed`
              : `${ready}/${MIN_REQUIRED.length} Files Ready`}
          </span>
          <span className="text-muted-foreground ml-2">
            {enabled
              ? "Ready to analyze"
              : "Upload a cluster_summary.json to enable analysis"}
          </span>
        </div>
        <button
          disabled={!enabled}
          onClick={() => parsed?.data && onAnalyze(parsed.data)}
          className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all ${
            enabled
              ? "bg-navy text-navy-foreground hover:bg-navy/90 shadow-lg shadow-navy/20"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Analyze Dataset
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sample panel                                                       */
/* ------------------------------------------------------------------ */
function SamplePanel({ onLoadSample }: { onLoadSample: () => void }) {
  return (
    <div className="card-elevated rounded-2xl p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/10 text-teal">
        <Database className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">Try the built-in sample dataset</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">
        Skip setup and explore the workspace with a pre-computed BV-BRC subset: 6 pathogen clusters,
        ~3,124 genomes and 18 grounded AI observations.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onLoadSample}
          className="inline-flex items-center gap-2 rounded-lg bg-navy px-5 py-3 text-sm font-semibold text-navy-foreground hover:bg-navy/90 shadow-lg shadow-navy/20"
        >
          <Sparkles className="h-4 w-4" /> Load Sample Data Without API
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* API panel                                                          */
/* ------------------------------------------------------------------ */
function ApiPanel({ onConnected }: { onConnected: (config: ApiConfig, data: import("@/lib/data-sources").DashboardData) => void }) {
  const { apiConfig, setApiConfig } = useWorkspace();
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestConnectionResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCors, setShowCors] = useState(false);
  const [recent, setRecent] = useState<RecentConnection[]>(() => loadRecentConnections());

  useEffect(() => {
    setRecent(loadRecentConnections());
  }, [result]);

  const requiresKey = apiConfig.authMethod !== "none";
  const canTest =
    apiConfig.baseUrl.trim().length > 0 && (!requiresKey || apiConfig.apiKey.trim().length > 0);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    const r = await testConnection(apiConfig);
    setTesting(false);
    setResult(r);
    saveRecentConnection({
      id: `${apiConfig.baseUrl}|${apiConfig.connectionName}|${Date.now()}`,
      connectionName: apiConfig.connectionName,
      baseUrl: apiConfig.baseUrl,
      authMethod: apiConfig.authMethod,
      apiKeyHeader: apiConfig.apiKeyHeader,
      useCombinedEndpoint: apiConfig.useCombinedEndpoint,
      combinedEndpoint: apiConfig.combinedEndpoint,
      clusterSummaryEndpoint: apiConfig.clusterSummaryEndpoint,
      observationsEndpoint: apiConfig.observationsEndpoint,
      lastConnectedAt: new Date().toISOString(),
      lastStatus: r.ok ? "success" : "failed",
    });
  };

  const useLocalSamplePreset = () => {
    setApiConfig({
      connectionName: "Local Sample API",
      baseUrl: "http://localhost:8000",
      useCombinedEndpoint: true,
      combinedEndpoint: "/api/dashboard",
      authMethod: "none",
      apiKey: "",
    });
    setResult(null);
  };

  const connectAndAnalyze = () => {
    if (result && result.ok) onConnected(apiConfig, result.data);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 card-elevated rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-foreground">API connection</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Configure the endpoint that returns <code className="font-mono">cluster_summary</code> and{" "}
              <code className="font-mono">observations</code>.
            </p>
          </div>
          <button
            onClick={useLocalSamplePreset}
            className="text-xs inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 hover:border-teal hover:text-teal"
          >
            <ServerCog className="h-3.5 w-3.5" /> Use Local Sample API
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Connection name">
            <input
              value={apiConfig.connectionName}
              onChange={(e) => setApiConfig({ connectionName: e.target.value })}
              className="input"
              placeholder="BV-BRC Analysis API"
            />
          </Field>
          <Field label="API base URL">
            <input
              value={apiConfig.baseUrl}
              onChange={(e) => setApiConfig({ baseUrl: e.target.value.trim() })}
              className="input font-mono"
              placeholder="https://api.example.com"
            />
          </Field>

          <Field label="Authentication method">
            <select
              value={apiConfig.authMethod}
              onChange={(e) => setApiConfig({ authMethod: e.target.value as AuthMethod })}
              className="input"
            >
              <option value="bearer">Bearer Token</option>
              <option value="header">API Key Header</option>
              <option value="none">No Authentication</option>
            </select>
          </Field>

          {apiConfig.authMethod === "header" && (
            <Field label="API key header name">
              <input
                value={apiConfig.apiKeyHeader}
                onChange={(e) => setApiConfig({ apiKeyHeader: e.target.value })}
                className="input font-mono"
                placeholder="X-API-Key"
              />
            </Field>
          )}

          {requiresKey && (
            <Field label="API key" full>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={apiConfig.apiKey}
                  onChange={(e) => setApiConfig({ apiKey: e.target.value })}
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  className="input pl-9 pr-10 font-mono"
                  placeholder="paste your key — kept only in memory"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Kept in memory / sessionStorage only. Cleared on disconnect and never included in logs,
                URLs or error messages.
              </p>
            </Field>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-border bg-accent/30 p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={apiConfig.useCombinedEndpoint}
              onChange={(e) => setApiConfig({ useCombinedEndpoint: e.target.checked })}
              className="h-4 w-4 accent-[var(--teal)]"
            />
            <div>
              <div className="text-sm font-medium text-foreground">Use combined dashboard endpoint</div>
              <div className="text-[11px] text-muted-foreground">
                One request to <code className="font-mono">{apiConfig.combinedEndpoint}</code> instead of two separate calls.
              </div>
            </div>
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {apiConfig.useCombinedEndpoint ? (
              <Field label="Combined endpoint" full>
                <input
                  value={apiConfig.combinedEndpoint}
                  onChange={(e) => setApiConfig({ combinedEndpoint: e.target.value })}
                  className="input font-mono"
                  placeholder="/api/dashboard"
                />
              </Field>
            ) : (
              <>
                <Field label="Cluster summary endpoint">
                  <input
                    value={apiConfig.clusterSummaryEndpoint}
                    onChange={(e) => setApiConfig({ clusterSummaryEndpoint: e.target.value })}
                    className="input font-mono"
                    placeholder="/api/cluster-summary"
                  />
                </Field>
                <Field label="Observations endpoint">
                  <input
                    value={apiConfig.observationsEndpoint}
                    onChange={(e) => setApiConfig({ observationsEndpoint: e.target.value })}
                    className="input font-mono"
                    placeholder="/api/observations"
                  />
                </Field>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={runTest}
            disabled={!canTest || testing}
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold ${
              canTest && !testing
                ? "bg-navy text-navy-foreground hover:bg-navy/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {testing ? "Testing…" : "Test Connection"}
          </button>

          <button
            onClick={connectAndAnalyze}
            disabled={!result || !result.ok}
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold ${
              result && result.ok
                ? "bg-teal text-white hover:bg-teal/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            <Sparkles className="h-4 w-4" /> Connect & Analyze
          </button>
        </div>

        {/* Result panel */}
        {result && (
          <div className="mt-5 animate-fade-in">
            {result.ok ? (
              <div className="rounded-xl border border-success/40 bg-success/5 p-4">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  <div className="text-sm font-semibold">Connection successful</div>
                </div>
                <div className="mt-2 grid gap-1.5 text-xs text-foreground sm:grid-cols-2">
                  <div>• {result.clusterCount} clusters found</div>
                  <div>• {result.observationCount} AI observations found</div>
                  <div>• {result.speciesCount} pathogen species detected</div>
                  <div>• Average Braintrust score: {result.averageEvalScore}</div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-4 w-4" />
                  <div className="text-sm font-semibold">{result.message}</div>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">Code: {result.code}</div>
              </div>
            )}

            <button
              onClick={() => setShowDetails((s) => !s)}
              className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`} />
              Technical details
            </button>
            {showDetails && (
              <div className="mt-2 rounded-lg border border-border bg-background p-3 text-xs space-y-1 font-mono">
                <div>HTTP status: {result.details.httpStatus ?? "—"}</div>
                <div>Response time: {result.details.responseTimeMs ?? "—"} ms</div>
                <div>Endpoints:</div>
                <ul className="ml-4 list-disc">
                  {result.details.endpointsTested.map((e) => (
                    <li key={e} className="break-all">{e}</li>
                  ))}
                </ul>
                <div>Validation:</div>
                <ul className="ml-4 list-disc">
                  {result.details.validation.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
                <div className="pt-1 text-muted-foreground">
                  (API key is never included in technical details.)
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 rounded-lg border border-border bg-accent/30 p-3 text-[11px] text-muted-foreground flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 text-teal shrink-0" />
          <span>
            API credentials are used only to establish this connection. For production, requests should be
            proxied through a secure backend (Lovable Cloud edge function) so keys never reach the browser.
          </span>
        </div>

        {/* CORS help */}
        <div className="mt-4">
          <button
            onClick={() => setShowCors((s) => !s)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showCors ? "rotate-180" : ""}`} />
            Having trouble connecting?
          </button>
          {showCors && (
            <div className="mt-2 rounded-lg border border-border bg-background p-3 text-xs">
              <p className="text-muted-foreground">
                Browser requests are subject to CORS. The external API must explicitly allow requests from
                this dashboard's origin. Example FastAPI configuration:
              </p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-[11px] leading-relaxed">
{`from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-dashboard-domain.com"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)`}
              </pre>
              <p className="mt-2 text-muted-foreground">
                For local development, adding <code className="font-mono">http://localhost:3000</code> (or your
                dev origin) to <code className="font-mono">allow_origins</code> is typically enough.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="card-elevated rounded-2xl p-5">
        <div className="text-sm font-semibold text-foreground">Recent connections</div>
        <div className="text-[11px] text-muted-foreground">
          API keys are never saved. Click to repopulate non-secret fields.
        </div>
        <div className="mt-4 space-y-2">
          {recent.length === 0 && (
            <div className="text-xs text-muted-foreground rounded-lg border border-dashed border-border p-3">
              No connections yet. Test one to see it here.
            </div>
          )}
          {recent.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{r.connectionName}</div>
                  <div className="text-[11px] text-muted-foreground truncate font-mono">{r.baseUrl}</div>
                </div>
                <span
                  className={`text-[10px] rounded-full px-2 py-0.5 shrink-0 ${
                    r.lastStatus === "success"
                      ? "bg-success/10 text-success"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {r.lastStatus}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{r.authMethod} · {new Date(r.lastConnectedAt).toLocaleString()}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setApiConfig({
                        connectionName: r.connectionName,
                        baseUrl: r.baseUrl,
                        authMethod: r.authMethod,
                        apiKeyHeader: r.apiKeyHeader,
                        useCombinedEndpoint: r.useCombinedEndpoint,
                        combinedEndpoint: r.combinedEndpoint,
                        clusterSummaryEndpoint: r.clusterSummaryEndpoint,
                        observationsEndpoint: r.observationsEndpoint,
                        apiKey: "",
                      });
                      setResult(null);
                    }}
                    className="rounded px-2 py-1 hover:bg-accent hover:text-foreground"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => {
                      deleteRecentConnection(r.id);
                      setRecent(loadRecentConnections());
                    }}
                    className="rounded p-1 hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete connection"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-medium text-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
      <style>{`.input { width: 100%; border: 1px solid var(--border); background: var(--card); border-radius: 0.5rem; padding: 0.55rem 0.75rem; font-size: 0.85rem; outline: none; }
        .input:focus { border-color: var(--teal); box-shadow: 0 0 0 3px color-mix(in oklab, var(--teal) 20%, transparent); }
      `}</style>
    </label>
  );
}

// Re-export DEFAULT_API_CONFIG so tsc doesn't complain about the import.
export { DEFAULT_API_CONFIG };
