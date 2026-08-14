// Simple in-memory workspace store shared across routes.
// TODO: replace with real backend state (uploaded files stored in Lovable Cloud
// and API connections proxied through a server-side edge function).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_API_CONFIG,
  loadFromUploadedFiles,
  loadSampleData,
  type ApiConfig,
  type DashboardData,
  type DataSourceType,
} from "@/lib/data-sources";

export type RequiredFile =
  | "genome_amr.csv"
  | "sp_gene.csv"
  | "metadata.csv"
  | "sequences.csv"
  | "cluster_summary.json"
  | "observations.json";

export const REQUIRED_FILES: RequiredFile[] = [
  "genome_amr.csv",
  "sp_gene.csv",
  "metadata.csv",
  "sequences.csv",
  "cluster_summary.json",
  "observations.json",
];

export const MIN_REQUIRED: RequiredFile[] = [
  "genome_amr.csv",
  "metadata.csv",
  "sequences.csv",
  "observations.json",
];

export type UploadedFile = { name: string; size: number; valid: boolean };

// Non-secret parts of an API connection persisted for reload-in-tab convenience.
const SESSION_CONFIG_KEY = "pathogen-ai:api-config";
const SESSION_SAMPLE_KEY = "labpilot:sample-workspace";
type PersistedSample = { dashboardData: DashboardData; lastSyncedAt: string };
function readPersistedSample(): PersistedSample | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(window.sessionStorage.getItem(SESSION_SAMPLE_KEY) ?? "null") as PersistedSample | null; }
  catch { return null; }
}
function writePersistedSample(value: PersistedSample | null) {
  if (typeof window === "undefined") return;
  if (value) window.sessionStorage.setItem(SESSION_SAMPLE_KEY, JSON.stringify(value));
  else window.sessionStorage.removeItem(SESSION_SAMPLE_KEY);
}

type WorkspaceState = {
  files: UploadedFile[];
  analyzed: boolean;
  dataSource: DataSourceType | null;
  apiConfig: ApiConfig;
  dashboardData: DashboardData | null;
  lastSyncedAt: string | null;
  connectionName: string | null;

  addFiles: (files: UploadedFile[]) => void;
  removeFile: (name: string) => void;
  reset: () => void;
  setAnalyzed: (v: boolean) => void;

  setApiConfig: (patch: Partial<ApiConfig>) => void;
  loadDataSource: (kind: "upload" | "sample", data?: DashboardData) => void;
  loadApiData: (config: ApiConfig, data: DashboardData) => void;
  refreshApiData: (data: DashboardData) => void;
  disconnect: () => void;
};

const Ctx = createContext<WorkspaceState | null>(null);

function readSessionConfig(): Partial<ApiConfig> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(SESSION_CONFIG_KEY);
    return raw ? (JSON.parse(raw) as Partial<ApiConfig>) : {};
  } catch {
    return {};
  }
}

function writeSessionConfig(config: ApiConfig) {
  if (typeof window === "undefined") return;
  // Never persist the apiKey. It stays in memory for the lifetime of the tab.
  const { apiKey: _drop, ...safe } = config;
  window.sessionStorage.setItem(SESSION_CONFIG_KEY, JSON.stringify(safe));
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [dataSource, setDataSource] = useState<DataSourceType | null>(null);
  const [apiConfig, setApiConfigState] = useState<ApiConfig>({
    ...DEFAULT_API_CONFIG,
    ...readSessionConfig(),
  });
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [connectionName, setConnectionName] = useState<string | null>(null);

  useEffect(() => {
    const persisted = readPersistedSample();
    if (!persisted?.dashboardData || !persisted.lastSyncedAt) return;
    setDataSource("sample"); setDashboardData(persisted.dashboardData);
    setLastSyncedAt(persisted.lastSyncedAt); setConnectionName("Sample Dataset"); setAnalyzed(true);
  }, []);

  const value = useMemo<WorkspaceState>(
    () => ({
      files,
      analyzed,
      dataSource,
      apiConfig,
      dashboardData,
      lastSyncedAt,
      connectionName,
      addFiles: (incoming) =>
        setFiles((prev) => {
          const map = new Map(prev.map((f) => [f.name, f]));
          for (const f of incoming) map.set(f.name, f);
          return Array.from(map.values());
        }),
      removeFile: (name) => setFiles((prev) => prev.filter((f) => f.name !== name)),
      reset: () => {
        writePersistedSample(null);
        setFiles([]);
        setAnalyzed(false);
        setDataSource(null);
        setDashboardData(null);
        setLastSyncedAt(null);
        setConnectionName(null);
      },
      setAnalyzed,
      setApiConfig: (patch) => {
        setApiConfigState((prev) => {
          const next = { ...prev, ...patch };
          writeSessionConfig(next);
          return next;
        });
      },
      loadDataSource: (kind, data) => {
        const resolved =
          data ?? (kind === "upload" ? loadFromUploadedFiles() : loadSampleData());
        const syncedAt = new Date().toISOString();
        writePersistedSample(kind === "sample" ? { dashboardData: resolved, lastSyncedAt: syncedAt } : null);
        setDataSource(kind);
        setDashboardData(resolved);
        setLastSyncedAt(syncedAt);
        setConnectionName(kind === "upload" ? "Uploaded Files" : "Sample Dataset");
      },
      loadApiData: (config, data) => {
        writePersistedSample(null);
        setDataSource("api");
        setDashboardData(data);
        setLastSyncedAt(new Date().toISOString());
        setConnectionName(config.connectionName);
      },
      refreshApiData: (data) => {
        setDashboardData(data);
        setLastSyncedAt(new Date().toISOString());
      },
      disconnect: () => {
        writePersistedSample(null);
        // Clear the API key from memory and sessionStorage.
        setApiConfigState((prev) => {
          const next = { ...prev, apiKey: "" };
          writeSessionConfig(next);
          return next;
        });
        setDataSource(null);
        setDashboardData(null);
        setAnalyzed(false);
        setLastSyncedAt(null);
        setConnectionName(null);
      },
    }),
    [files, analyzed, dataSource, apiConfig, dashboardData, lastSyncedAt, connectionName],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

export function readyCount(files: UploadedFile[]) {
  const names = new Set(files.map((f) => f.name));
  return MIN_REQUIRED.filter((n) => names.has(n)).length;
}

export function canAnalyze(files: UploadedFile[]) {
  return readyCount(files) === MIN_REQUIRED.length;
}
