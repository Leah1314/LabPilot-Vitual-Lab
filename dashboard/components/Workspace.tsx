"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type {
  ClusterSummaryFile,
  DashboardData,
  ObservationsFile,
} from "@/lib/contracts";
import { buildDashboardData } from "@/lib/build-data";
import type { ApiConfig, SourceResult } from "@/lib/datasource";
import { DashboardShell } from "./DashboardShell";
import { SourcePicker } from "./SourcePicker";

export type SyncState =
  | { status: "idle" }
  | { status: "syncing" }
  | { status: "error"; message: string };

interface WorkspaceValue {
  data: DashboardData | null;
  /** The built-in sample, always available as an escape hatch. */
  sample: DashboardData;
  load: (data: DashboardData, config?: ApiConfig) => void;
  clear: () => void;
  /** Re-fetches the connected pipeline. Null when the source is not an API. */
  resync: (() => Promise<void>) | null;
  syncState: SyncState;
}

const Ctx = createContext<WorkspaceValue | null>(null);

export function useWorkspace(): WorkspaceValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used inside Workspace");
  return ctx;
}

/**
 * Holds the active dataset in memory and swaps between the source picker and
 * the dashboard.
 *
 * State is deliberately not persisted: an uploaded file's contents living in
 * localStorage across sessions is a surprise, and a stale cached copy of a
 * pipeline response is worse than re-fetching. Reloading returns you to the
 * picker, unless PIPELINE_URL preloaded a source on the server.
 *
 * The API config is kept in memory alongside the data purely so the dashboard
 * can re-sync. It carries the key, so it is never written anywhere.
 */
export function Workspace({
  sample,
  preloaded,
}: {
  sample: DashboardData;
  preloaded: DashboardData | null;
}) {
  const [data, setData] = useState<DashboardData | null>(preloaded);
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({ status: "idle" });

  const load = useCallback((next: DashboardData, apiConfig?: ApiConfig) => {
    setData(next);
    setConfig(apiConfig ?? null);
    setSyncState({ status: "idle" });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, []);

  const clear = useCallback(() => {
    setData(null);
    setConfig(null);
    setSyncState({ status: "idle" });
  }, []);

  const resync = useCallback(async () => {
    if (!config) return;
    setSyncState({ status: "syncing" });
    try {
      const res = await fetch("/api/datasource", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });
      const body = (await res.json()) as SourceResult;
      if (!body.ok) {
        setSyncState({ status: "error", message: body.message });
        return;
      }
      setData(
        buildDashboardData({
          kind: "api",
          label: config.connectionName,
          clusterSummary: body.clusterSummary as ClusterSummaryFile,
          observations: body.observations as ObservationsFile,
        }),
      );
      setSyncState({ status: "idle" });
    } catch {
      setSyncState({
        status: "error",
        message: "Could not reach the dashboard server.",
      });
    }
  }, [config]);

  const value = useMemo<WorkspaceValue>(
    () => ({
      data,
      sample,
      load,
      clear,
      resync: config ? resync : null,
      syncState,
    }),
    [data, sample, load, clear, config, resync, syncState],
  );

  return (
    <Ctx.Provider value={value}>
      {data ? <DashboardShell data={data} /> : <SourcePicker />}
    </Ctx.Provider>
  );
}
