"use client";

import { useState } from "react";
import type { DataSourceKind } from "@/lib/datasource";
import { useWorkspace } from "./Workspace";
import { UploadPanel } from "./source/UploadPanel";
import { ApiPanel } from "./source/ApiPanel";
import { SamplePanel } from "./source/SamplePanel";

const TABS: Array<{ id: DataSourceKind; label: string; hint: string }> = [
  { id: "sample", label: "Sample dataset", hint: "Committed fixtures, one click" },
  { id: "upload", label: "Upload files", hint: "Your cluster_summary and observations" },
  { id: "api", label: "Connect a pipeline", hint: "Fetch from a live endpoint" },
];

export function SourcePicker() {
  const { sample, load } = useWorkspace();
  const [tab, setTab] = useState<DataSourceKind>("sample");

  return (
    <div className="min-h-screen">
      <header className="border-b border-hairline bg-paper/95">
        <div className="mx-auto flex max-w-[70rem] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden className="inline-block h-6 w-1.5 shrink-0 bg-violet" />
            <h1 className="display text-base text-ink">
              Gut-to-pancreas resistance structure
            </h1>
          </div>
          <p className="ml-auto border border-safranin/40 bg-safranin-tint px-2.5 py-1 text-xs text-safranin">
            Research prototype — not for clinical use
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[70rem] px-6 py-12">
        <div className="max-w-2xl">
          <p className="eyebrow">Step one</p>
          <h2 className="display mt-2 text-3xl text-ink">Choose a data source</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Everything downstream reads one normalised shape, so the dashboard,
            the charts and the Consult panel behave identically whichever you
            pick. The header keeps showing which source is on screen.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Data source"
          className="mt-8 grid gap-3 sm:grid-cols-3"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`cursor-pointer border p-4 text-left transition-colors ${
                  active
                    ? "border-violet bg-violet-tint"
                    : "border-hairline bg-card hover:border-violet/50"
                }`}
              >
                <div
                  className={`text-sm font-semibold ${active ? "text-violet" : "text-ink"}`}
                >
                  {t.label}
                </div>
                <div className="mt-1 text-xs text-muted">{t.hint}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          {tab === "sample" && (
            <SamplePanel
              sample={sample}
              onLoad={() =>
                load({ ...sample, syncedAt: new Date().toISOString() })
              }
            />
          )}
          {tab === "upload" && <UploadPanel onLoad={load} />}
          {tab === "api" && (
            <ApiPanel onLoad={(data, config) => load(data, config)} />
          )}
        </div>

        <p className="mt-10 border-t border-hairline pt-4 text-xs leading-relaxed text-muted">
          Resistance and virulence calls in every source are precomputed
          annotations from CARD, NDARO, VFDB and PATRIC_VF. Susceptibility
          counts are laboratory measurements. The dashboard never presents one
          as the other.
        </p>
      </main>
    </div>
  );
}
