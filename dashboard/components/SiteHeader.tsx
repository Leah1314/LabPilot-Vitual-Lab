"use client";

import type { DashboardData } from "@/lib/contracts";
import { useWorkspace } from "./Workspace";

const CHIP: Record<
  DashboardData["kind"],
  { text: string; className: string; title: string }
> = {
  sample: {
    text: "sample data",
    className: "border-amber/50 bg-amber-tint text-amber",
    title: "Committed fixtures. Illustrative numbers, not measured.",
  },
  upload: {
    text: "uploaded files",
    className: "border-violet/40 bg-violet-tint text-violet",
    title: "Parsed from files you provided, in your browser.",
  },
  api: {
    text: "live pipeline",
    className: "border-viridian/40 bg-viridian-tint text-viridian",
    title: "Served by a connected pipeline endpoint.",
  },
};

/**
 * Standing header. The disclaimer lives here rather than in a footer because
 * prompt.md requires it visible without scrolling on every screen, and the
 * source chip is permanent for the same reason: whoever is looking at the
 * screen should never have to ask where the numbers came from.
 */
export function SiteHeader({
  data,
  onChangeSource,
}: {
  data: DashboardData;
  onChangeSource: () => void;
}) {
  const { resync, syncState } = useWorkspace();
  const chip = CHIP[data.kind];
  const generated = data.generated_at ? data.generated_at.slice(0, 10) : null;
  const syncedAt = data.syncedAt
    ? new Date(data.syncedAt).toLocaleTimeString()
    : null;

  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-[110rem] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="inline-block h-6 w-1.5 shrink-0 bg-violet" />
          <h1 className="display text-base text-ink">
            Gut-to-pancreas resistance structure
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 border px-2 py-1 ${chip.className}`}
            title={chip.title}
          >
            <span className="eyebrow !text-inherit">{chip.text}</span>
          </span>

          <span className="min-w-0 truncate text-muted" title={data.label}>
            {data.label}
          </span>

          {data.cohort && (
            <span className="text-muted">
              Cohort pinned{" "}
              <span className="tabular text-ink">{data.cohort.pinned_date}</span>
            </span>
          )}

          {generated && (
            <span className="text-muted">
              Observations <span className="tabular text-ink">{generated}</span>
            </span>
          )}

          {syncedAt && (
            <span className="text-muted">
              Loaded <span className="tabular text-ink">{syncedAt}</span>
            </span>
          )}

          {resync && (
            <button
              type="button"
              onClick={() => void resync()}
              disabled={syncState.status === "syncing"}
              className="cursor-pointer border-b border-dashed border-muted pb-px text-violet hover:border-violet disabled:opacity-50"
            >
              {syncState.status === "syncing" ? "Syncing…" : "Sync now"}
            </button>
          )}

          <button
            type="button"
            onClick={onChangeSource}
            className="cursor-pointer border-b border-dashed border-muted pb-px text-violet hover:border-violet"
          >
            {resync ? "Disconnect" : "Change source"}
          </button>

          {syncState.status === "error" && (
            <span className="text-safranin" title={syncState.message}>
              Sync failed
            </span>
          )}
        </div>

        <p className="ml-auto border border-safranin/40 bg-safranin-tint px-2.5 py-1 text-xs text-safranin">
          Research prototype — not for clinical use
        </p>
      </div>
    </header>
  );
}
