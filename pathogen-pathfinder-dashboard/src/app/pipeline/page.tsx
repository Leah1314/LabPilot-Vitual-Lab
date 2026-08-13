"use client";

import { ArrowDown, CheckCircle2 } from "lucide-react";
import { pipelineStages } from "@/lib/mock-data";

// Next.js page
export default PipelinePage;

function PipelinePage() {
  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="text-xs uppercase tracking-wider text-teal font-semibold">Pipeline</div>
      <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
        End-to-end research pipeline
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        From raw genomes to grounded insights and an interactive dashboard.
      </p>

      <div className="mt-8 space-y-3">
        {pipelineStages.map((s, i) => (
          <div key={s.key}>
            <div className="card-elevated rounded-xl p-5 flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-teal font-semibold">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-foreground">{s.label}</div>
                  <div className="text-[11px] font-mono text-muted-foreground">{s.time}</div>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.detail}</div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            </div>
            {i < pipelineStages.length - 1 && (
              <div className="flex justify-center py-1">
                <ArrowDown className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
