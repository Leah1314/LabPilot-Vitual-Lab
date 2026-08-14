"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Search, Send, Sparkles, X } from "lucide-react";
import { useAgent } from "@copilotkit/react-core/v2";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  curve,
  measured,
  program as initialProgram,
  publicEvidence,
  rankedExperiments,
  receipt,
  rlmBranches,
  simulation,
  sources,
} from "@/lib/drug-trial-fixtures";
import type { BrainstormMessage, DiscoveryProgram } from "@/lib/drug-trial-types";

export type DrugDiscoveryRouteMode =
  | "dashboard"
  | "evidence"
  | "next-experiment"
  | "brainstorm"
  | "run-receipts";

type DrawerKind = "evidence" | "experiments" | "investigation" | null;

const Badge = ({
  children,
  tone = "teal",
}: {
  children: React.ReactNode;
  tone?: "teal" | "green" | "amber";
}) => (
  <span
    className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${
      tone === "green"
        ? "bg-success/10 text-success"
        : tone === "amber"
          ? "bg-amber-100 text-amber-700"
          : "bg-teal/10 text-teal"
    }`}
  >
    {children}
  </span>
);

function ActiveProgram({
  program,
  setProgram,
}: {
  program: DiscoveryProgram;
  setProgram: (program: DiscoveryProgram) => void;
}) {
  const [editing, setEditing] = useState(false);
  const fields = (
    [
      ["compound", "Compound"],
      ["target", "Target"],
      ["disease", "Indication"],
      ["model", "Model"],
      ["stage", "Stage"],
    ] as [keyof DiscoveryProgram, string][]
  );

  return (
    <section className="card-elevated rounded-xl px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[9px] font-bold uppercase tracking-[.16em] text-teal">
          Active Discovery Program
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-1.5 text-xs font-semibold">
          <span>{program.compound}</span>
          <span className="text-muted-foreground">·</span>
          <span>{program.target.replace("RAS(ON) / ", "")}</span>
          <span className="text-muted-foreground">·</span>
          <span>{program.disease}</span>
          <span className="text-muted-foreground">·</span>
          <span>{program.model.replace(" cell model", "")}</span>
          <span className="text-muted-foreground">·</span>
          <span>{program.stage.replace("Lead optimization / ", "")}</span>
        </div>
        <button
          onClick={() => setEditing((value) => !value)}
          className="rounded-lg border border-border px-3 py-1.5 text-[10px] font-bold"
        >
          {editing ? "Close" : "Change Program"}
        </button>
        <button
          onClick={() => setProgram(initialProgram)}
          className="rounded-lg bg-navy px-3 py-1.5 text-[10px] font-bold text-white"
        >
          New Program
        </button>
      </div>

      {editing && (
        <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2 xl:grid-cols-5">
          {fields.map(([key, label]) => (
            <label key={key}>
              <span className="text-[9px] font-bold uppercase text-muted-foreground">
                {label}
              </span>
              <input
                value={program[key]}
                onChange={(event) =>
                  setProgram({ ...program, [key]: event.target.value })
                }
                className="mt-1 w-full rounded-md border bg-background px-2.5 py-2 text-xs outline-none focus:border-teal"
              />
            </label>
          ))}
        </div>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">
        Preclinical research only — not clinical dosing guidance.
      </p>
    </section>
  );
}

function WhatWeKnow({ onEvidence }: { onEvidence: () => void }) {
  return (
    <section id="evidence" className="card-elevated rounded-xl p-4">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[.16em] text-teal">
            What We Know
          </div>
          <div className="mt-1 text-sm font-bold">
            Highest evidence gap:{" "}
            <span className="text-teal">Cellular response transition</span>
          </div>
        </div>
        {[
          ["186", "evidence records"],
          ["7", "connected sources"],
          ["4", "discovery opportunities"],
        ].map(([count, label]) => (
          <div key={label}>
            <b className="text-lg">{count}</b>
            <span className="ml-1 text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="flex flex-1 flex-wrap gap-1.5">
          {["ChEMBL", "DepMap", "GDSC", "Open Targets", "Literature", "+2"].map((item) => (
            <Badge key={item}>{item}</Badge>
          ))}
        </div>
        <button onClick={onEvidence} className="text-[10px] font-bold text-teal">
          View Evidence <ArrowRight className="inline h-3 w-3" />
        </button>
      </div>
    </section>
  );
}

function DoseChart({ simulated }: { simulated: boolean }) {
  const wet = measured.map((item) => ({
    x: item.concentrationNm,
    y: item.viability,
  }));
  const predicted = simulated
    ? simulation.predictions.map((item) => ({
        x: item.concentrationNm,
        y: item.viability,
      }))
    : [];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[.16em] text-teal">
            Preclinical Dose-Response Evidence
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            AsPC-1 cellular viability · experimental concentration
          </p>
        </div>
        <div className="flex gap-3 text-[9px] font-bold uppercase">
          <span>● Measured</span>
          <span className="text-teal">○ Public context</span>
          <span className="text-amber-600">◆ Predicted</span>
        </div>
      </div>
      <div className="h-[330px]">
        <ResponsiveContainer>
          <ComposedChart margin={{ top: 16, right: 12, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              type="number"
              dataKey="x"
              domain={[0.5, 16]}
              scale="log"
              ticks={[0.5, 1, 2, 4, 8, 16]}
              tick={{ fontSize: 10 }}
              label={{
                value: "Concentration (nM)",
                position: "insideBottom",
                offset: -2,
                fontSize: 10,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[0, 105]}
              tick={{ fontSize: 10 }}
              label={{
                value: "Cell viability (%)",
                angle: -90,
                position: "insideLeft",
                offset: 18,
                fontSize: 10,
              }}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, fontSize: 11 }}
              formatter={(value) => [`${value}%`, "Viability"]}
            />
            <ReferenceArea
              x1={2}
              x2={6}
              fill="var(--teal)"
              fillOpacity={0.09}
              label={{
                value: "UNDER-SAMPLED REGION",
                position: "insideTop",
                fontSize: 9,
                fill: "var(--teal)",
              }}
            />
            <Line data={curve} dataKey="y" stroke="var(--teal)" strokeWidth={2.5} dot={false} type="monotone" />
            <Scatter data={wet} fill="var(--navy)" />
            <Scatter data={predicted} fill="#d88927" shape="diamond" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[9px] text-muted-foreground">
        Published EC50 summaries remain contextual evidence and are not plotted as raw observations.
      </p>
    </div>
  );
}

function Recommendation({
  simulated,
  onSimulate,
  onInvestigate,
  state,
}: {
  simulated: boolean;
  onSimulate: () => void;
  onInvestigate: () => void;
  state: "candidate" | "planned";
}) {
  return (
    <div
      id="next-experiment"
      className="relative overflow-hidden rounded-xl bg-navy p-5 text-white lg:p-6"
    >
      <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-teal/20 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="text-[9px] font-bold uppercase tracking-[.18em] text-teal">
            Next Best Experiment
          </div>
          <Badge tone={state === "planned" ? "green" : "amber"}>{state}</Badge>
        </div>
        <h2 className="mt-4 text-3xl font-bold">Dose-response refinement</h2>
        <p className="mt-2 text-xs leading-relaxed text-white/65">
          Explore the under-sampled cellular response region in the AsPC-1 preclinical model.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-white/15">
          {[
            ["Experimental region", "2–6 nM"],
            ["Suggested panel", "4–5 concentrations"],
            ["Information gain", "HIGH"],
            ["Redundancy", "LOW"],
          ].map(([label, value]) => (
            <div className="bg-navy/85 p-3" key={label}>
              <div className="text-[8px] uppercase tracking-wider text-white/45">{label}</div>
              <b className="mt-1 block text-sm">{value}</b>
            </div>
          ))}
        </div>
        <div className="mt-5 text-[9px] font-bold uppercase tracking-wider text-white/50">
          Why this experiment?
        </div>
        <div className="mt-2 space-y-2 text-[11px] text-white/75">
          {[
            "Under-sampled response region",
            "High uncertainty",
            "Strong biological rationale",
            "Low redundancy with existing evidence",
            "Feasible preclinical next step",
          ].map((item) => (
            <div className="flex gap-2" key={item}>
              <Check className="h-3.5 w-3.5 text-teal" />
              {item}
            </div>
          ))}
        </div>
        {simulated && (
          <div className="mt-5 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg bg-white/10 p-2">
              <span className="text-[8px] text-white/50">UNCERTAINTY BEFORE</span>
              <b className="block">32%</b>
            </div>
            <div className="rounded-lg bg-teal/15 p-2">
              <span className="text-[8px] text-white/50">EXPECTED AFTER</span>
              <b className="block text-teal">16%</b>
            </div>
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onSimulate} className="rounded-lg bg-teal py-2.5 text-xs font-bold">
            <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />
            {simulated ? "Simulated" : "Simulate"}
          </button>
          <button onClick={onInvestigate} className="rounded-lg border border-white/25 py-2.5 text-xs font-bold">
            <Search className="mr-1.5 inline h-3.5 w-3.5" />
            Investigate
          </button>
        </div>
      </div>
    </div>
  );
}

function Alternatives({ onAll }: { onAll: () => void }) {
  return (
    <section className="card-elevated rounded-xl p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="mr-auto">
          <div className="text-[9px] font-bold uppercase tracking-[.16em] text-teal">
            Alternatives Considered
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Different experiment types were ranked before the recommendation.
          </p>
        </div>
        {rankedExperiments.slice(1, 4).map((item) => (
          <div key={item.rank} className="min-w-[190px] border-l border-border pl-4">
            <b className="text-xs">
              #{item.rank}{" "}
              {item.experiment
                .replace("Test second KRAS G12D model", "Test another KRAS G12D biological model")
                .replace("pERK mechanism assay", "Run pERK mechanistic assay")
                .replace("Resistance pathway experiment", "Explore resistance pathway")}
            </b>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {item.informationGain} information value
              {item.complexity === "High" ? " · higher complexity" : ""}
            </p>
          </div>
        ))}
        <button onClick={onAll} className="text-[10px] font-bold text-teal">
          Compare All <ArrowRight className="inline h-3 w-3" />
        </button>
      </div>
    </section>
  );
}

function AskLabPilot() {
  const { agent } = useAgent({ agentId: "default" });
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const prompts: { label: string; key: string }[] = [
    { label: "Why this experiment?", key: "Find evidence gap" },
    { label: "Compare another model", key: "Which model next?" },
    { label: "Find evidence gap", key: "Find evidence gap" },
    { label: "Challenge hypothesis", key: "What would falsify this?" },
  ];

  const messages = useMemo(() => {
    const fallback: BrainstormMessage[] = [
      {
        id: "intro",
        role: "assistant",
        text: "Ask about evidence gaps, competing experiments, or what would challenge the current RMC-6236 recommendation.",
      },
    ];

    const extracted = (agent?.messages ?? [])
      .map((message) => {
        const content = message.content;
        let text = "";
        if (typeof content === "string") {
          text = content;
        } else if (Array.isArray(content)) {
          text = content
            .map((part) =>
              typeof part === "object" &&
              part &&
              "text" in part &&
              typeof part.text === "string"
                ? part.text
                : "",
            )
            .join("\n")
            .trim();
        } else if (content && typeof content === "object") {
          text = JSON.stringify(content);
        }
        if (!text) return null;
        return {
          id: message.id,
          role: message.role === "user" ? "user" : "assistant",
          text,
        } satisfies BrainstormMessage;
      })
      .filter((message): message is BrainstormMessage => Boolean(message));

    return extracted.length > 0 ? extracted : fallback;
  }, [agent?.messages]);

  const send = async (text = input) => {
    if (!text.trim() || !agent) return;
    setIsSending(true);
    agent.addMessage({
      role: "user",
      id: crypto.randomUUID(),
      content: text,
    });
    setInput("");
    try {
      await agent.runAgent();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section id="brainstorm" className="card-elevated rounded-xl p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-44">
          <div className="text-[9px] font-bold uppercase tracking-[.16em] text-teal">
            Ask LabPilot
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Explore the experiment space.
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {messages.slice(-4).map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-[11px] ${
                  message.role === "user" ? "ml-auto bg-navy text-white" : "bg-muted"
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="What else should we test?"
              className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs outline-none focus:border-teal"
            />
            <button
              onClick={() => void send()}
              disabled={isSending}
              className="rounded-lg bg-navy px-3 text-white disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {prompts.map((prompt) => (
              <button
                key={prompt.label}
                onClick={() => void send(prompt.key)}
                disabled={isSending}
                className="rounded-full border px-2.5 py-1 text-[9px] font-bold disabled:opacity-60"
              >
                {prompt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function InvestigationSummary({ onFull }: { onFull: () => void }) {
  return (
    <section className="card-elevated rounded-xl p-4">
      <div className="flex flex-wrap items-center gap-5">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[.16em] text-teal">
            AI Investigation
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-semibold">
            {[
              "Evidence checked",
              "Model challenged",
              "Alternatives compared",
              "Feasibility reviewed",
            ].map((item) => (
              <span key={item}>
                <Check className="mr-1 inline h-3.5 w-3.5 text-success" />
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="min-w-[300px] flex-1 rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-[9px] font-bold uppercase text-muted-foreground">
            Strongest counterargument
          </span>
          <p className="mt-1 text-[11px]">{receipt.counterargument}</p>
        </div>
        <button onClick={onFull} className="rounded-lg border px-3 py-2 text-[10px] font-bold">
          View Full Investigation
        </button>
      </div>
    </section>
  );
}

function DetailDrawer({
  kind,
  onClose,
}: {
  kind: "evidence" | "experiments" | "investigation";
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy/35 backdrop-blur-sm">
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-background p-6 shadow-2xl lg:p-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[.16em] text-teal">
              LabPilot Details
            </div>
            <h2 className="mt-2 text-2xl font-bold">
              {kind === "evidence"
                ? "Evidence Landscape"
                : kind === "experiments"
                  ? "Candidate Experiments"
                  : "Full AI Investigation"}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg border p-2" aria-label="Close details">
            <X className="h-4 w-4" />
          </button>
        </div>

        {kind === "evidence" && (
          <div className="mt-6 space-y-5">
            <div className="grid gap-2 sm:grid-cols-2">
              {sources.map((source) => (
                <div key={source.name} className="rounded-lg border p-3">
                  <div className="flex justify-between">
                    <b className="text-xs">{source.name}</b>
                    <Badge>{source.status}</Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{source.description}</p>
                </div>
              ))}
            </div>
            <h3 className="font-bold">Prior Evidence</h3>
            {publicEvidence.map((item) => (
              <div key={item.id} className="flex justify-between border-b py-2 text-xs">
                <span>
                  {item.model} · {item.assay}
                </span>
                <b>
                  {item.value} {item.unit} · PUBLIC
                </b>
              </div>
            ))}
          </div>
        )}

        {kind === "experiments" && (
          <div className="mt-6 space-y-2">
            {rankedExperiments.map((item) => (
              <div key={item.rank} className="flex items-center gap-3 rounded-lg border p-3">
                <b>#{item.rank}</b>
                <span className="flex-1 text-xs font-semibold">{item.experiment}</span>
                <span className="text-[10px]">
                  Gain {item.informationGain} · Gap {item.evidenceGap} · {item.complexity}
                </span>
                <Badge tone={item.rank === 1 ? "green" : "teal"}>{item.status}</Badge>
              </div>
            ))}
          </div>
        )}

        {kind === "investigation" && (
          <div className="mt-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {rlmBranches.map((branch) => (
                <div key={branch.name} className="rounded-xl border p-4">
                  <b>{branch.name}</b>
                  <p className="mt-2 text-xs text-muted-foreground">{branch.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {branch.checks.map((check) => (
                      <Badge key={check}>{check}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-teal p-5">
              <div className="flex justify-between">
                <h3 className="font-bold">Lab Run Receipt</h3>
                <Badge tone="amber">Human approval required</Badge>
              </div>
              {[
                ["Scientific Objective", receipt.objective],
                ["Recommendation", receipt.recommendation],
                ["Strongest Counterargument", receipt.counterargument],
                ["Unresolved Uncertainty", receipt.uncertainty],
              ].map(([label, value]) => (
                <div className="mt-4" key={label}>
                  <div className="text-[9px] font-bold uppercase text-muted-foreground">
                    {label}
                  </div>
                  <p className="mt-1 text-xs">{value}</p>
                </div>
              ))}
              <div className="mt-4 flex flex-wrap items-center gap-1">
                {receipt.trace.map((item, index) => (
                  <span className="contents" key={item}>
                    <code className="rounded bg-muted px-2 py-1 text-[9px]">{item}</code>
                    {index < receipt.trace.length - 1 && <ArrowRight className="h-3 w-3" />}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DrugDiscoveryWorkspace({ mode }: { mode: DrugDiscoveryRouteMode }) {
  const [program, setProgram] = useState(initialProgram);
  const [simulated, setSimulated] = useState(false);
  const [state, setState] = useState<"candidate" | "planned">("candidate");
  const [detail, setDetail] = useState<DrawerKind>(null);

  useEffect(() => {
    if (mode === "evidence") setDetail("evidence");
    if (mode === "run-receipts") setDetail("investigation");
    if (mode === "dashboard") setDetail(null);
  }, [mode]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklab,var(--teal)_9%,transparent),transparent_25%)]">
      <div className="mx-auto max-w-[1450px] space-y-4 p-5 lg:p-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[.2em] text-teal">
              LabPilot Virtual Lab
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Drug Discovery Workspace
            </h1>
            <p className="mt-1 text-sm font-semibold">
              Turn everything already known into the next best experiment.
            </p>
            <p className="text-xs text-muted-foreground">
              Explore evidence, identify uncertainty, and choose what to test next.
            </p>
          </div>
          <Badge tone="green">Discovery evidence loaded</Badge>
        </header>

        <ActiveProgram program={program} setProgram={setProgram} />
        <WhatWeKnow onEvidence={() => setDetail("evidence")} />

        <section className="card-elevated rounded-xl p-4 lg:p-5">
          <div className="grid gap-5 xl:grid-cols-[1.55fr_.85fr]">
            <DoseChart simulated={simulated} />
            <Recommendation
              simulated={simulated}
              onSimulate={() => setSimulated(true)}
              onInvestigate={() => setDetail("investigation")}
              state={state}
            />
          </div>
        </section>

        <Alternatives onAll={() => setDetail("experiments")} />

        <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
          <AskLabPilot />
          <div className="card-elevated rounded-xl p-4">
            <div className="text-[9px] font-bold uppercase tracking-[.16em] text-teal">
              Discovery Opportunity
            </div>
            <h3 className="mt-2 text-sm font-bold">
              KRAS G12D pancreatic cellular response
            </h3>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Strong biological rationale <b className="text-teal">+</b> sparse experimental coverage
            </p>
            <div className="mt-3 rounded-lg bg-teal/5 p-3 text-xs font-bold text-teal">
              High-value evidence gap detected
            </div>
            <button onClick={() => setDetail("experiments")} className="mt-3 text-[10px] font-bold">
              Explore Opportunities <ArrowRight className="inline h-3 w-3" />
            </button>
          </div>
        </section>

        <InvestigationSummary onFull={() => setDetail("investigation")} />

        <section id="run-receipts" className="rounded-xl border border-border bg-navy p-4 text-white">
          <div className="flex flex-wrap items-center gap-4">
            <div className="mr-auto">
              <div className="text-[9px] font-bold uppercase tracking-[.16em] text-teal">
                Human Approval
              </div>
              <p className="mt-1 text-xs text-white/65">
                CANDIDATE → human decision → PLANNED. Predictions never become measurements.
              </p>
            </div>
            <Badge tone={state === "planned" ? "green" : "amber"}>{state}</Badge>
            <button onClick={() => setState("candidate")} className="rounded-lg border border-white/20 px-4 py-2 text-xs font-bold">
              Reject
            </button>
            <button onClick={() => setState("candidate")} className="rounded-lg border border-white/20 px-4 py-2 text-xs font-bold">
              Modify
            </button>
            <button onClick={() => setState("planned")} className="rounded-lg bg-teal px-4 py-2 text-xs font-bold">
              Approve Experiment
            </button>
          </div>
        </section>

        <p className="pb-2 text-center text-[10px] text-muted-foreground">
          Drug discovery has thousands of possible next experiments. LabPilot turns everything already known into the next best experiment.
        </p>
      </div>

      {detail && <DetailDrawer kind={detail} onClose={() => setDetail(null)} />}
    </main>
  );
}
