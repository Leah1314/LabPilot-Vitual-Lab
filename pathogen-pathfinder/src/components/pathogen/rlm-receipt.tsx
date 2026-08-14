import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleHelp,
  GitBranch,
  Link2,
} from "lucide-react";

export interface RlmInvestigationReceipt {
  objective: string;
  verdict: "supported" | "contested" | "insufficient_evidence";
  branches: Array<{
    id: string;
    role: string;
    status: "supported" | "challenged" | "uncertain";
    summary: string;
    evidenceRefs: string[];
  }>;
  synthesis: string;
  limitations: string[];
  modelCalls: number;
}

const verdictMeta = {
  supported: {
    label: "Supported",
    Icon: CheckCircle2,
    className: "border-success/30 bg-success/10 text-success",
  },
  contested: {
    label: "Contested",
    Icon: AlertTriangle,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  insufficient_evidence: {
    label: "Insufficient evidence",
    Icon: CircleHelp,
    className: "border-border bg-muted text-muted-foreground",
  },
} as const;

const branchMeta = {
  supported: {
    label: "Supports",
    Icon: CheckCircle2,
    className: "text-success",
    rail: "border-success/50",
  },
  challenged: {
    label: "Challenges",
    Icon: AlertTriangle,
    className: "text-destructive",
    rail: "border-destructive/50",
  },
  uncertain: {
    label: "Uncertain",
    Icon: CircleHelp,
    className: "text-muted-foreground",
    rail: "border-border",
  },
} as const;

export function RlmReceipt({ receipt }: { receipt: RlmInvestigationReceipt }) {
  const verdict = verdictMeta[receipt.verdict];
  const VerdictIcon = verdict.Icon;

  return (
    <section
      aria-label="RLM investigation receipt"
      className="card-elevated overflow-hidden rounded-xl"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal">
            <BrainCircuit className="h-4 w-4" strokeWidth={2} />
            Investigation receipt
          </div>
          <h2 className="mt-1 max-w-2xl text-pretty text-base font-semibold leading-snug text-foreground">
            {receipt.objective}
          </h2>
        </div>
        <div
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${verdict.className}`}
        >
          <VerdictIcon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          {verdict.label}
        </div>
      </header>

      <div className="p-5">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground tabular-nums">
          <GitBranch className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          {receipt.branches.length} reasoning branches
          <span aria-hidden="true">·</span>
          {receipt.modelCalls} model {receipt.modelCalls === 1 ? "call" : "calls"}
        </div>

        <ol aria-label="Investigation branches" className="mt-3 space-y-2">
          {receipt.branches.map((branch) => {
            const meta = branchMeta[branch.status];
            const BranchIcon = meta.Icon;

            return (
              <li
                key={branch.id}
                className={`border-l-2 ${meta.rail} rounded-r-lg bg-muted/40 px-3 py-2.5`}
              >
                <div className="flex items-center gap-2">
                  <BranchIcon
                    className={`h-3.5 w-3.5 shrink-0 ${meta.className}`}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-semibold text-foreground">
                    {branch.role === "support"
                      ? "Evidence / support"
                      : branch.role === "challenge"
                        ? "Skeptic / challenge"
                        : branch.role}
                  </span>
                  <span className={`ml-auto text-[11px] font-medium ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>
                <p className="mt-1 text-pretty text-sm leading-5 text-muted-foreground">
                  {branch.summary}
                </p>

                {branch.evidenceRefs.length > 0 && (
                  <details className="group mt-1.5">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-medium text-teal transition-colors hover:text-teal/80">
                      <Link2 className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                      {branch.evidenceRefs.length} evidence {branch.evidenceRefs.length === 1 ? "reference" : "references"}
                    </summary>
                    <ul className="mt-1.5 space-y-1 pl-4 font-mono text-[11px] text-muted-foreground">
                      {branch.evidenceRefs.map((ref) => (
                        <li key={ref} className="break-all">{ref}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-4 border-t border-border pt-4">
          <div className="text-xs font-semibold text-foreground">Synthesis</div>
          <p className="mt-1 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">
            {receipt.synthesis}
          </p>
        </div>

        {receipt.limitations.length > 0 && (
          <details className="group mt-3 rounded-lg border border-border bg-card px-3 py-2.5">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-foreground">
              <CircleHelp className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
              Limitations
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground tabular-nums">
                {receipt.limitations.length}
              </span>
            </summary>
            <ul className="mt-2 space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
              {receipt.limitations.map((limitation) => (
                <li key={limitation} className="list-disc">{limitation}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
