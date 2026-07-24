"use client";

import { useId } from "react";
import type { ClusterView } from "@/lib/contracts";
import { DenominatorRail } from "./DenominatorRail";
import { ProvenanceRow } from "./ProvenanceRow";

interface ClusterCardProps {
  cluster: ClusterView;
  scaleMax: number;
  rawScaleMax: number;
  order: number;
  highlighted: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}

const EVAL_THRESHOLD = 0.75;

function EvalBadge({ score, confidence }: { score: number; confidence: string }) {
  const grounded = score >= EVAL_THRESHOLD;
  return (
    <span
      className={`inline-flex shrink-0 items-baseline gap-1.5 border px-2 py-1 text-xs ${
        grounded
          ? "border-viridian/30 bg-viridian-tint text-viridian"
          : "border-amber/40 bg-amber-tint text-amber"
      }`}
      title={
        grounded
          ? "Braintrust faithfulness score: every number in the prose appears in the cluster data."
          : "Braintrust faithfulness score below threshold. Read this observation with care."
      }
    >
      <span className="eyebrow !text-inherit">
        {grounded ? "grounded" : "review"}
      </span>
      <span className="tabular font-medium">{score.toFixed(2)}</span>
      <span className="text-[0.6875rem] opacity-70">{confidence}</span>
    </span>
  );
}

export function ClusterCard({
  cluster,
  scaleMax,
  rawScaleMax,
  order,
  highlighted,
  expanded,
  onToggleExpand,
}: ClusterCardProps) {
  const panelId = useId();
  const { summary, observation, resistant, susceptible } = cluster;
  const products = Object.entries(summary.top_products).sort(
    (a, b) => b[1] - a[1],
  );
  const species = Object.entries(summary.species_breakdown).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <article
      id={`cluster-${cluster.cluster_id}`}
      aria-current={highlighted ? "true" : undefined}
      className={`scroll-mt-28 border bg-card transition-shadow ${
        highlighted
          ? "border-violet shadow-[0_0_0_3px_var(--color-violet-tint)]"
          : "border-hairline"
      }`}
    >
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow">
              Cluster {cluster.cluster_id} · {summary.n_genes} genes
            </p>
            <h3 className="display mt-1.5 text-xl text-ink">
              {observation
                ? observation.headline
                : `Cluster ${cluster.cluster_id}`}
            </h3>
          </div>
          {observation && (
            <EvalBadge
              score={observation.eval_score}
              confidence={observation.confidence}
            />
          )}
        </div>

        {observation ? (
          <p className="max-w-[62ch] text-sm leading-relaxed text-ink/85">
            {observation.observation}
          </p>
        ) : (
          <p className="text-sm text-muted">
            No observation generated for this cluster yet. Part B writes these
            into observations.json.
          </p>
        )}

        {observation?.eval_note && (
          <p className="border-l-2 border-amber bg-amber-tint px-3 py-2 text-xs leading-relaxed text-amber">
            <strong className="font-semibold">Eval caught this.</strong>{" "}
            {observation.eval_note}
          </p>
        )}

        <div>
          <p className="eyebrow mb-1.5">Lab-measured susceptibility</p>
          <DenominatorRail
            resistant={resistant}
            susceptible={susceptible}
            scaleMax={scaleMax}
            order={order}
          />
        </div>

        <ProvenanceRow summary={summary} rawScaleMax={rawScaleMax} />

        <div className="flex flex-wrap gap-1.5">
          {species.map(([name, count]) => (
            <span
              key={name}
              className="border border-hairline bg-paper px-2 py-0.5 text-xs text-ink"
            >
              <em className="not-italic">{name}</em>{" "}
              <span className="tabular text-muted">{count}</span>
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="eyebrow cursor-pointer border-b border-dashed border-muted pb-0.5 !text-violet hover:border-violet"
        >
          {expanded ? "Hide" : "Show"} genes and products
        </button>
      </div>

      {expanded && (
        <div
          id={panelId}
          className="grid gap-6 border-t border-hairline bg-paper/60 p-5 sm:grid-cols-2"
        >
          <div>
            <p className="eyebrow mb-2">Top products</p>
            <table className="w-full text-sm">
              <caption className="sr-only">
                Product names and gene counts for cluster {cluster.cluster_id}
              </caption>
              <tbody>
                {products.map(([product, count]) => (
                  <tr key={product} className="border-b border-hairline/70">
                    <td className="py-1.5 pr-3 text-ink">{product}</td>
                    <td className="tabular py-1.5 text-right text-muted">
                      {count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <p className="eyebrow mb-2">
              Example genes ({summary.example_genes.length} of {summary.n_genes})
            </p>
            <ul className="space-y-1">
              {summary.example_genes.map((gene) => (
                <li key={gene} className="tabular text-xs text-ink">
                  {gene}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              BV-BRC feature identifiers. Resistance and virulence calls are
              precomputed annotations from CARD, NDARO, VFDB and PATRIC_VF, not
              laboratory measurements.
            </p>
          </div>
        </div>
      )}
    </article>
  );
}
