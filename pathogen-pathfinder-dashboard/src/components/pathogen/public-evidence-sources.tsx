import { Database, Radio, Library, CircleOff } from "lucide-react";
import type { EvidenceSource, SourceStatus } from "@/lib/drug-trial-types";

const statusStyle: Record<SourceStatus, { icon: typeof Radio; className: string }> = {
  "Live API": { icon: Radio, className: "bg-success/10 text-success" },
  Dataset: { icon: Database, className: "bg-teal/10 text-teal" },
  Catalog: { icon: Library, className: "bg-navy/10 text-navy" },
  Context: { icon: Library, className: "bg-amber-100 text-amber-700" },
  Connected: { icon: Radio, className: "bg-success/10 text-success" },
  Unavailable: { icon: CircleOff, className: "bg-muted text-muted-foreground" },
};

export function PublicEvidenceSources({ sources }: { sources: EvidenceSource[] }) {
  const categories = [...new Set(sources.map((source) => source.category))];
  return (
    <section className="card-elevated rounded-xl p-5 lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Public Evidence Sources</h2>
          <p className="mt-1 text-xs text-muted-foreground">Availability and provenance across the current trial context.</p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">10 sources</span>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        {categories.map((category) => (
          <div key={category}>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{category}</div>
            <div className="space-y-2">
              {sources.filter((source) => source.category === category).map((source) => {
                const config = statusStyle[source.status];
                const Icon = config.icon;
                return (
                  <div key={source.name} className="rounded-lg border border-border bg-background/50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-foreground">{source.name}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.className}`}>
                        <Icon className="h-3 w-3" />{source.status}{source.count !== undefined ? ` · ${source.count}` : ""}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{source.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
