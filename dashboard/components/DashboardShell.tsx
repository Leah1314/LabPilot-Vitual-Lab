"use client";

import { useMemo, useState } from "react";
import type { DashboardData } from "@/lib/contracts";
import { useWorkspace } from "./Workspace";
import { SiteHeader } from "./SiteHeader";
import { Sidebar, type SectionId } from "./Sidebar";
import { CohortPanel } from "./CohortPanel";
import { ClusterCard } from "./ClusterCard";
import { PipelineReadout } from "./PipelineReadout";
import { CooccurrenceTable } from "./CooccurrenceTable";
import { ConsultPanel } from "./ConsultPanel";
import { Overview } from "./sections/Overview";
import { GeneProducts } from "./sections/GeneProducts";
import { Observations } from "./sections/Observations";
import { Pipeline } from "./sections/Pipeline";

export function DashboardShell({ data }: { data: DashboardData }) {
  const { clear } = useWorkspace();
  const [section, setSection] = useState<SectionId>("overview");
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

  // Null clears the highlight without leaving the current section.
  function goToCluster(clusterId: string | null) {
    setHighlighted(clusterId);
    if (clusterId !== null) setSection("clusters");
  }

  return (
    <div className="min-h-screen">
      <SiteHeader data={data} onChangeSource={clear} />

      <div className="mx-auto max-w-[110rem] px-6 py-6">
        <div className="grid gap-6 xl:grid-cols-[13rem_minmax(0,1fr)]">
          <Sidebar active={section} onSelect={setSection} data={data} />

          <main className="min-w-0">
            {section === "overview" && (
              <Overview data={data} onNavigate={setSection} />
            )}

            {section === "genes" && <GeneProducts data={data} />}

            {section === "observations" && (
              <Observations
                data={data}
                onNavigate={setSection}
                onHighlight={setHighlighted}
              />
            )}

            {section === "pipeline" && (
              <div className="space-y-6">
                <PipelineReadout stats={data.pipeline_stats} />
                <Pipeline data={data} />
              </div>
            )}

            {section === "cooccurrence" &&
              (data.cooccurrence ? (
                <CooccurrenceTable data={data.cooccurrence} />
              ) : (
                <section className="border border-hairline bg-card p-5">
                  <p className="eyebrow">Pairwise co-occurrence</p>
                  <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted">
                    This source did not supply co-occurrence pairs. Serve a{" "}
                    <span className="tabular">/cooccurrence</span> endpoint, or
                    include <span className="tabular">cooccurrence.json</span> in
                    the upload, to see ranked gene pairs with lift and strain
                    support here.
                  </p>
                </section>
              ))}

            {section === "consult" && (
              <div className="h-[calc(100vh-10rem)] min-h-[32rem]">
                <ConsultPanel
                  data={data}
                  speciesFilter={speciesFilter}
                  highlightedCluster={highlighted}
                  onHighlight={goToCluster}
                  onSpeciesFilter={setSpeciesFilter}
                />
              </div>
            )}

            {section === "clusters" && (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
                <section aria-labelledby="clusters-heading" className="space-y-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2 id="clusters-heading" className="display text-2xl text-ink">
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
                        clusters containing{" "}
                        <em className="not-italic">{speciesFilter}</em>
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
                      No cluster in this dataset contains {speciesFilter}. Clear
                      the filter to see all {data.clusters.length}.
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

                <CohortPanel
                  cohort={data.cohort}
                  speciesTally={data.speciesTally}
                  clusters={data.clusters}
                  speciesFilter={speciesFilter}
                  onSpeciesFilter={setSpeciesFilter}
                  highlightedCluster={highlighted}
                  onHighlight={setHighlighted}
                />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
