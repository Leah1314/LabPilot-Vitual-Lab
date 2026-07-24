"use client";

import { useMemo, useState } from "react";
import type { DashboardData } from "@/lib/contracts";
import { SiteHeader } from "./SiteHeader";
import { CohortPanel } from "./CohortPanel";
import { ClusterCard } from "./ClusterCard";
import { PipelineReadout } from "./PipelineReadout";
import { CooccurrenceTable } from "./CooccurrenceTable";
import { ConsultPanel } from "./ConsultPanel";

export function DashboardShell({ data }: { data: DashboardData }) {
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const visibleClusters = useMemo(
    () =>
      speciesFilter === null
        ? data.clusters
        : data.clusters.filter(
            (c) => (c.summary.species_breakdown[speciesFilter] ?? 0) > 0,
          ),
    [data.clusters, speciesFilter],
  );

  /*
   * One scale for every rail on the page, taken across all clusters rather
   * than the filtered subset — so filtering does not silently rescale the
   * bars and make a small cluster look large.
   */
  const scaleMax = useMemo(
    () => Math.max(1, ...data.clusters.map((c) => c.phenotyped)),
    [data.clusters],
  );
  const rawScaleMax = useMemo(
    () => Math.max(1, ...data.clusters.map((c) => c.summary.n_genomes_raw ?? 0)),
    [data.clusters],
  );

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader
        cohort={data.cohort}
        source={data.source}
        generatedAt={data.generated_at}
      />

      <div className="mx-auto max-w-[110rem] px-6 py-6">
        <div className="grid gap-6 xl:grid-cols-[16rem_minmax(0,1fr)_24rem]">
          <CohortPanel
            cohort={data.cohort}
            clusters={data.clusters}
            speciesFilter={speciesFilter}
            onSpeciesFilter={setSpeciesFilter}
            highlightedCluster={highlighted}
            onHighlight={setHighlighted}
          />

          <main className="min-w-0 space-y-6">
            <PipelineReadout stats={data.pipeline_stats} />

            <section aria-labelledby="clusters-heading" className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="clusters-heading" className="display text-lg text-ink">
                  Gene clusters
                </h2>
                <p className="text-xs text-muted">
                  Bar width is the number of phenotyped isolates, drawn to one
                  scale across all clusters. Max{" "}
                  <span className="tabular text-ink">{scaleMax}</span>.
                </p>
              </div>

              {speciesFilter && (
                <p className="flex flex-wrap items-center gap-2 border border-violet/30 bg-violet-tint px-3 py-2 text-xs text-violet">
                  <span>
                    Showing {visibleClusters.length} of {data.clusters.length}{" "}
                    clusters containing <em className="not-italic">{speciesFilter}</em>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSpeciesFilter(null)}
                    className="cursor-pointer border-b border-dashed border-violet/60 pb-px hover:border-violet"
                  >
                    Clear
                  </button>
                </p>
              )}

              {visibleClusters.length === 0 ? (
                <p className="border border-hairline bg-card p-5 text-sm text-muted">
                  No cluster in this cohort contains {speciesFilter}. Clear the
                  filter to see all {data.clusters.length}.
                </p>
              ) : (
                visibleClusters.map((cluster, i) => (
                  <ClusterCard
                    key={cluster.cluster_id}
                    cluster={cluster}
                    scaleMax={scaleMax}
                    rawScaleMax={rawScaleMax}
                    order={i}
                    highlighted={highlighted === cluster.cluster_id}
                    expanded={expanded.has(cluster.cluster_id)}
                    onToggleExpand={() => toggleExpand(cluster.cluster_id)}
                  />
                ))
              )}
            </section>

            <CooccurrenceTable data={data.cooccurrence} />
          </main>

          <div className="min-h-[32rem] xl:sticky xl:top-20 xl:h-[calc(100vh-6.5rem)]">
            <ConsultPanel
              data={data}
              speciesFilter={speciesFilter}
              highlightedCluster={highlighted}
              onHighlight={setHighlighted}
              onSpeciesFilter={setSpeciesFilter}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
