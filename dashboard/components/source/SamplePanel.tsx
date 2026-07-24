"use client";

import type { DashboardData } from "@/lib/contracts";

export function SamplePanel({
  sample,
  onLoad,
}: {
  sample: DashboardData;
  onLoad: () => void;
}) {
  const clusters = sample.clusters.length;
  const species = sample.speciesTally.length;
  const artefacts = sample.clusters.filter(
    (c) =>
      (c.summary.n_countries !== undefined && c.summary.n_countries <= 1) ||
      (c.summary.year_range !== undefined &&
        c.summary.year_range[0] === c.summary.year_range[1]),
  ).length;

  return (
    <section className="border border-hairline bg-card p-6">
      <h3 className="display text-lg text-ink">Sample dataset</h3>
      <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted">
        The fixtures committed with this repo. Shaped exactly like real pipeline
        output, including provenance fields, so every feature on the dashboard
        is exercised — but the numbers are illustrative, not measured.
      </p>

      <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <dt className="eyebrow">Clusters</dt>
          <dd className="tabular mt-1 text-lg text-ink">{clusters}</dd>
        </div>
        <div>
          <dt className="eyebrow">Species</dt>
          <dd className="tabular mt-1 text-lg text-ink">{species}</dd>
        </div>
        <div>
          <dt className="eyebrow">Flagged as artefact</dt>
          <dd className="tabular mt-1 text-lg text-ink">{artefacts}</dd>
        </div>
        <div>
          <dt className="eyebrow">Co-occurrence pairs</dt>
          <dd className="tabular mt-1 text-lg text-ink">
            {sample.cooccurrence?.pairs.length ?? 0}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onLoad}
        className="mt-6 cursor-pointer bg-violet px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Load sample dataset
      </button>
    </section>
  );
}
