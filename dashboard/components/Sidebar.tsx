"use client";

import type { DashboardData } from "@/lib/contracts";

export type SectionId =
  | "overview"
  | "clusters"
  | "genes"
  | "observations"
  | "cooccurrence"
  | "pipeline"
  | "consult";

export const SECTIONS: Array<{
  id: SectionId;
  label: string;
  hint: string;
}> = [
  { id: "overview", label: "Overview", hint: "Headline counts" },
  { id: "clusters", label: "Clusters", hint: "Cards and rails" },
  { id: "genes", label: "Gene products", hint: "What the clusters carry" },
  { id: "observations", label: "Observations", hint: "Written by Fireworks" },
  { id: "cooccurrence", label: "Co-occurrence", hint: "Ranked gene pairs" },
  { id: "pipeline", label: "Pipeline", hint: "How this was produced" },
  { id: "consult", label: "Consult", hint: "Ask about the cohort" },
];

export function Sidebar({
  active,
  onSelect,
  data,
}: {
  active: SectionId;
  onSelect: (id: SectionId) => void;
  data: DashboardData;
}) {
  const counts: Partial<Record<SectionId, number>> = {
    clusters: data.clusters.length,
    genes: data.speciesTally.length,
    observations: data.clusters.filter((c) => c.observation).length,
    cooccurrence: data.cooccurrence?.pairs.length ?? 0,
  };

  return (
    <nav aria-label="Sections" className="xl:sticky xl:top-20">
      <ul className="flex gap-1 overflow-x-auto border-b border-hairline pb-2 xl:block xl:space-y-1 xl:overflow-visible xl:border-b-0 xl:pb-0">
        {SECTIONS.map((s) => {
          const isActive = s.id === active;
          const count = counts[s.id];
          return (
            <li key={s.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={isActive ? "page" : undefined}
                className={`flex w-full cursor-pointer items-baseline justify-between gap-3 border px-3 py-2 text-left transition-colors ${
                  isActive
                    ? "border-violet bg-violet-tint text-violet"
                    : "border-transparent hover:border-hairline hover:bg-card"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {s.label}
                  </span>
                  <span className="hidden text-xs text-muted xl:block">
                    {s.hint}
                  </span>
                </span>
                {count !== undefined && count > 0 && (
                  <span className="tabular shrink-0 text-xs text-muted">
                    {count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
