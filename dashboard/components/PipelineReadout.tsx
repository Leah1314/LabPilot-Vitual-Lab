import type { PipelineStats } from "@/lib/contracts";
import { formatInteger, formatSeconds } from "@/lib/format";

/**
 * The demo stats strip. Every field is nullable and renders "not measured"
 * until a real number lands — prompt.md §4: never quote a speedup you have not
 * measured. An empty slot here is a to-do for Parts A and B, not a blank to
 * fill with something plausible.
 */
function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | null;
  unit?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1">
        {value === null ? (
          <span className="text-sm text-muted">not measured yet</span>
        ) : (
          <span className="display text-2xl text-ink">
            <span className="tabular">{value}</span>
            {unit && (
              <span className="ml-1 font-sans text-xs font-normal text-muted">
                {unit}
              </span>
            )}
          </span>
        )}
      </dd>
    </div>
  );
}

export function PipelineReadout({ stats }: { stats: PipelineStats }) {
  const embedSeconds = formatSeconds(stats.embedding_seconds);

  return (
    <section
      aria-label="Pipeline measurements"
      className="border border-hairline bg-card p-5"
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
        <Stat
          label="Proteins embedded"
          value={
            stats.sequences_embedded === null
              ? null
              : formatInteger(stats.sequences_embedded)
          }
          unit={stats.embedding_hardware ?? undefined}
        />
        <Stat label="Embedding wall clock" value={embedSeconds} />
        <Stat
          label="Median insight latency"
          value={
            stats.llm_median_latency_ms === null
              ? null
              : formatInteger(stats.llm_median_latency_ms)
          }
          unit="ms"
        />
        <Stat
          label="Mean faithfulness"
          value={
            stats.eval_mean_faithfulness === null
              ? null
              : stats.eval_mean_faithfulness.toFixed(2)
          }
          unit={
            stats.eval_n_examples ? `over ${stats.eval_n_examples} examples` : undefined
          }
        />
      </dl>
      <p className="mt-4 border-t border-hairline pt-3 text-xs leading-relaxed text-muted">
        {stats.llm_model ? (
          <>
            Observations written by{" "}
            <span className="tabular text-ink">{stats.llm_model}</span> on
            Fireworks; faithfulness scored in Braintrust.
          </>
        ) : (
          <>
            These slots stay empty until the pipeline reports a timed run. No
            speedup is quoted here that was not measured.
          </>
        )}
      </p>
    </section>
  );
}
