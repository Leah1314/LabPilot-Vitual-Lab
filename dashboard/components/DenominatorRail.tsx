import { percentOf } from "@/lib/format";

interface DenominatorRailProps {
  resistant: number;
  susceptible: number;
  /** Largest denominator on the page. Every rail is drawn against this. */
  scaleMax: number;
  /** Stagger index for the load-in sweep. */
  order?: number;
}

/**
 * A resistance breakdown where the bar's width *is* the denominator.
 *
 * Conventional stacked bars normalise every row to 100%, which makes 9-of-12
 * look identical to 47-of-63. Here every bar shares one scale, so sample size
 * is legible before a single number is read.
 *
 * Only isolate counts are drawn on this axis. The raw-versus-deduplicated
 * genome comparison lives on its own rail in ProvenanceRow, because plotting
 * genome rows against isolate counts on one axis would compare unlike units.
 */
export function DenominatorRail({
  resistant,
  susceptible,
  scaleMax,
  order = 0,
}: DenominatorRailProps) {
  const phenotyped = resistant + susceptible;
  const extentPct = scaleMax > 0 ? (phenotyped / scaleMax) * 100 : 0;
  const resistantShare = phenotyped > 0 ? (resistant / phenotyped) * 100 : 0;

  return (
    <div>
      <div
        className="rail-track"
        role="img"
        aria-label={`${resistant} resistant and ${susceptible} susceptible of ${phenotyped} lab-phenotyped isolates. Bar width is drawn to the shared scale of ${scaleMax}.`}
      >
        <div
          className="rail-extent"
          style={{
            width: `${extentPct}%`,
            animationDelay: `${order * 70}ms`,
          }}
        >
          <div
            className="rail-seg-resistant"
            style={{ width: `${resistantShare}%` }}
          />
          <div
            className="rail-seg-susceptible"
            style={{ width: `${100 - resistantShare}%` }}
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs">
        <span className="flex items-baseline gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 translate-y-px bg-safranin"
          />
          <span className="tabular text-ink">{resistant}</span>
          <span className="text-muted">
            resistant ({percentOf(resistant, phenotyped)} of {phenotyped})
          </span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 translate-y-px bg-viridian"
          />
          <span className="tabular text-ink">{susceptible}</span>
          <span className="text-muted">
            susceptible ({percentOf(susceptible, phenotyped)} of {phenotyped})
          </span>
        </span>
      </div>
    </div>
  );
}
