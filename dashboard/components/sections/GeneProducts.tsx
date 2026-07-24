"use client";

import { useMemo, useState } from "react";
import type { DashboardData } from "@/lib/contracts";
import { BarChart, type BarDatum } from "../BarChart";

/**
 * What the clusters actually carry, tallied from `top_products`.
 *
 * These are annotation calls from CARD, NDARO, VFDB and PATRIC_VF, not
 * laboratory measurements, and the caption says so — the reference dashboard
 * labelled the equivalent chart "isolates carrying gene class", which conflates
 * a computational prediction with a measured one.
 */
export function GeneProducts({ data }: { data: DashboardData }) {
  const [clusterFilter, setClusterFilter] = useState<string | null>(null);

  const products = useMemo<BarDatum[]>(() => {
    const tally = new Map<string, { count: number; clusters: Set<string> }>();
    for (const cluster of data.clusters) {
      if (clusterFilter && cluster.cluster_id !== clusterFilter) continue;
      for (const [product, count] of Object.entries(cluster.summary.top_products ?? {})) {
        const entry = tally.get(product) ?? { count: 0, clusters: new Set() };
        entry.count += count;
        entry.clusters.add(cluster.cluster_id);
        tally.set(product, entry);
      }
    }
    return [...tally.entries()]
      .map(([label, v]) => ({
        label,
        value: v.count,
        note:
          v.clusters.size > 1
            ? `in ${v.clusters.size} clusters`
            : `cluster ${[...v.clusters][0]}`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [data.clusters, clusterFilter]);

  const species = useMemo<BarDatum[]>(
    () => data.speciesTally.map((s) => ({ label: s.name, value: s.genes })),
    [data.speciesTally],
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Gene products</p>
        <h2 className="display mt-1.5 text-2xl text-ink">
          What these clusters carry
        </h2>
        <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted">
          Counts are annotation calls, summed across clusters. They say a gene
          matching that product was predicted present, not that an isolate was
          tested against a drug.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">Filter</span>
        <button
          type="button"
          onClick={() => setClusterFilter(null)}
          aria-pressed={clusterFilter === null}
          className={`cursor-pointer border px-2 py-1 text-xs transition-colors ${
            clusterFilter === null
              ? "border-violet bg-violet-tint text-violet"
              : "border-hairline text-muted hover:border-violet/50"
          }`}
        >
          All clusters
        </button>
        {data.clusters.map((c) => (
          <button
            key={c.cluster_id}
            type="button"
            onClick={() => setClusterFilter(c.cluster_id)}
            aria-pressed={clusterFilter === c.cluster_id}
            className={`tabular cursor-pointer border px-2 py-1 text-xs transition-colors ${
              clusterFilter === c.cluster_id
                ? "border-violet bg-violet-tint text-violet"
                : "border-hairline text-muted hover:border-violet/50"
            }`}
          >
            {c.cluster_id}
          </button>
        ))}
      </div>

      <section className="border border-hairline bg-card p-5">
        <h3 className="display text-lg text-ink">Products</h3>
        <p className="mb-4 text-xs text-muted">
          {clusterFilter === null
            ? "Summed across every cluster"
            : `Cluster ${clusterFilter} only`}
        </p>
        <BarChart
          data={products}
          unit="annotated genes"
          emptyMessage="This cluster reported no top_products."
        />
      </section>

      <section className="border border-hairline bg-card p-5">
        <h3 className="display text-lg text-ink">Species</h3>
        <p className="mb-4 text-xs text-muted">
          Genes contributed per species, summed across clusters
        </p>
        <BarChart data={species} unit="genes" />
      </section>
    </div>
  );
}
