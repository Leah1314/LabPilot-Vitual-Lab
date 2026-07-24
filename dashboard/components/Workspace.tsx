"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { DashboardData } from "@/lib/contracts";
import { DashboardShell } from "./DashboardShell";
import { SourcePicker } from "./SourcePicker";

interface WorkspaceValue {
  data: DashboardData | null;
  /** The built-in sample, always available as an escape hatch. */
  sample: DashboardData;
  load: (data: DashboardData) => void;
  clear: () => void;
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
 */
export function Workspace({
  sample,
  preloaded,
}: {
  sample: DashboardData;
  preloaded: DashboardData | null;
}) {
  const [data, setData] = useState<DashboardData | null>(preloaded);

  const load = useCallback((next: DashboardData) => {
    setData(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, []);

  const clear = useCallback(() => setData(null), []);

  const value = useMemo<WorkspaceValue>(
    () => ({ data, sample, load, clear }),
    [data, sample, load, clear],
  );

  return (
    <Ctx.Provider value={value}>
      {data ? <DashboardShell data={data} /> : <SourcePicker />}
    </Ctx.Provider>
  );
}
