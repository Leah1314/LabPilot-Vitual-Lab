import type { Cohort, DataSource } from "@/lib/contracts";

/**
 * Standing header. The disclaimer lives here rather than in a footer because
 * prompt.md requires it visible without scrolling on every screen, and the
 * data-source chip is the C.4 checklist item made permanent: if it reads MOCK
 * during the demo, the numbers on screen are illustrative.
 */
export function SiteHeader({
  cohort,
  source,
  generatedAt,
}: {
  cohort: Cohort;
  source: DataSource;
  generatedAt: string;
}) {
  const live = source === "live";
  const generatedDate = generatedAt.slice(0, 10);

  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-[110rem] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="inline-block h-6 w-1.5 shrink-0 bg-violet"
          />
          <h1 className="display text-base text-ink">
            Gut-to-pancreas resistance structure
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 border px-2 py-1 ${
              live
                ? "border-viridian/40 bg-viridian-tint text-viridian"
                : "border-amber/50 bg-amber-tint text-amber"
            }`}
            title={
              live
                ? "Numbers are being served by the pipeline API."
                : "Numbers come from committed mock fixtures. Illustrative only."
            }
          >
            <span className="eyebrow !text-inherit">
              {live ? "live pipeline" : "mock data"}
            </span>
          </span>
          <span className="text-muted">
            Cohort pinned{" "}
            <span className="tabular text-ink">{cohort.pinned_date}</span>
          </span>
          <span className="text-muted">
            Observations{" "}
            <span className="tabular text-ink">{generatedDate}</span>
          </span>
        </div>

        <p className="ml-auto border border-safranin/40 bg-safranin-tint px-2.5 py-1 text-xs text-safranin">
          Research prototype — not for clinical use
        </p>
      </div>
    </header>
  );
}
