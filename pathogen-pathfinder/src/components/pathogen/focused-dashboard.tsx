"use client";

import { useState } from "react";
import { ArrowRight, Check, FlaskConical, Search, Send, ShieldCheck, Sparkles } from "lucide-react";
import {
  candidate,
  canned,
  opportunities,
  program,
  publicEvidence,
  rankedExperiments,
  receipt,
  rlmBranches,
  sources,
} from "@/lib/drug-trial-fixtures";

export type DashboardView = "evidence" | "next-experiment" | "brainstorm" | "receipts";

const viewCopy: Record<DashboardView, { eyebrow: string; title: string; description: string }> = {
  evidence: {
    eyebrow: "Discovery evidence",
    title: "Evidence landscape",
    description: "Review measured, public, and contextual evidence before choosing what to test.",
  },
  "next-experiment": {
    eyebrow: "Decision workspace",
    title: "Next best experiment",
    description: "Compare the highest-value experiment with credible alternatives and approve the next step.",
  },
  brainstorm: {
    eyebrow: "Hypothesis studio",
    title: "Brainstorm lab",
    description: "Challenge assumptions, explore biological contexts, and turn questions into testable options.",
  },
  receipts: {
    eyebrow: "Governance trail",
    title: "Run receipts",
    description: "Inspect the evidence, model, skeptic, and operations checks behind each recommendation.",
  },
};

function Badge({ children, tone = "teal" }: { children: React.ReactNode; tone?: "teal" | "green" | "amber" }) {
  const colors = tone === "green" ? "bg-success/10 text-success" : tone === "amber" ? "bg-amber-100 text-amber-700" : "bg-teal/10 text-teal";
  return <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${colors}`}>{children}</span>;
}

function PageHeader({ view }: { view: DashboardView }) {
  const copy = viewCopy[view];
  return <>
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-[9px] font-bold uppercase tracking-[.2em] text-teal">{copy.eyebrow}</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{copy.title}</h1>
        <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{copy.description}</p>
      </div>
      <Badge tone="green">Workspace connected</Badge>
    </header>
    <section className="card-elevated rounded-xl px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="text-[9px] font-bold uppercase tracking-[.16em] text-teal">Active program</span>
        <span className="ml-2">{program.compound}</span><span className="text-muted-foreground">·</span>
        <span>KRAS G12D</span><span className="text-muted-foreground">·</span><span>{program.disease}</span>
        <span className="text-muted-foreground">·</span><span>AsPC-1</span><span className="text-muted-foreground">·</span><span>Preclinical</span>
      </div>
    </section>
  </>;
}

function EvidenceView() {
  return <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
    <section className="card-elevated rounded-xl p-5">
      <div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[.16em] text-teal">Source coverage</p><h2 className="mt-1 text-xl font-bold">11 connected evidence sources</h2></div><Badge>186 records</Badge></div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {sources.map((source) => <div key={source.name} className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2"><b className="text-xs">{source.name}</b><Badge tone={source.status === "Live API" || source.status === "Connected" ? "green" : "teal"}>{source.status}</Badge></div>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{source.description}</p>
        </div>)}
      </div>
    </section>
    <div className="space-y-4">
      <section className="rounded-xl bg-navy p-5 text-white">
        <p className="text-[9px] font-bold uppercase tracking-[.16em] text-teal">Highest evidence gap</p>
        <h2 className="mt-2 text-2xl font-bold">Cellular response transition</h2>
        <p className="mt-2 text-xs text-white/65">The 2-6 nM response region is under-sampled relative to the biological rationale.</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-white/10 p-3"><b>5</b><span className="block text-[9px] text-white/55">Measured</span></div><div className="rounded-lg bg-white/10 p-3"><b>4</b><span className="block text-[9px] text-white/55">Public</span></div><div className="rounded-lg bg-white/10 p-3"><b>High</b><span className="block text-[9px] text-white/55">Gap value</span></div></div>
      </section>
      <section className="card-elevated rounded-xl p-5"><h2 className="text-sm font-bold">Prior public evidence</h2><div className="mt-3 space-y-1">{publicEvidence.map((item) => <div key={item.id} className="flex items-center justify-between border-b py-3 text-[11px]"><span>{item.model} · {item.assay}</span><b>{item.value} {item.unit}</b></div>)}</div></section>
    </div>
  </div>;
}

function NextExperimentView() {
  const [simulated, setSimulated] = useState(false);
  const [state, setState] = useState<"candidate" | "planned">("candidate");
  return <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
    <section className="card-elevated rounded-xl p-5">
      <div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[.16em] text-teal">Ranked candidates</p><h2 className="mt-1 text-xl font-bold">Experiments compared</h2></div><Badge>Deterministic scoring</Badge></div>
      <div className="mt-5 space-y-2">{rankedExperiments.map((item) => <div key={item.rank} className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border p-4 ${item.rank === 1 ? "border-teal bg-teal/5" : "border-border"}`}><b className="text-lg">#{item.rank}</b><div><p className="text-xs font-bold">{item.experiment}</p><p className="mt-1 text-[10px] text-muted-foreground">Information gain {item.informationGain} · evidence gap {item.evidenceGap} · {item.complexity} complexity</p></div><Badge tone={item.rank === 1 ? "green" : "teal"}>{item.status}</Badge></div>)}</div>
    </section>
    <section className="relative overflow-hidden rounded-xl bg-navy p-6 text-white">
      <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-teal/20 blur-3xl"/><div className="relative">
        <div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-teal">Recommendation</p><Badge tone={state === "planned" ? "green" : "amber"}>{state}</Badge></div>
        <h2 className="mt-5 text-3xl font-bold">Dose-response refinement</h2><p className="mt-2 text-xs text-white/65">Explore the under-sampled cellular response region in the AsPC-1 preclinical model.</p>
        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-white/15">{[["Region",candidate.region],["Panel",candidate.panelSize],["Information gain","High"],["Redundancy","Low"]].map(([label,value]) => <div key={label} className="bg-navy/85 p-3"><span className="text-[8px] uppercase text-white/45">{label}</span><b className="mt-1 block text-sm">{value}</b></div>)}</div>
        {simulated && <div className="mt-4 rounded-lg bg-teal/15 p-3 text-xs"><Check className="mr-2 inline h-4 w-4 text-teal"/>Expected uncertainty decreases from 32% to 16%.</div>}
        <button onClick={() => setSimulated(true)} className="mt-5 w-full rounded-lg bg-teal py-2.5 text-xs font-bold"><Sparkles className="mr-1.5 inline h-3.5 w-3.5"/>{simulated ? "Simulation complete" : "Simulate candidate"}</button>
        <div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => setState("candidate")} className="rounded-lg border border-white/25 py-2.5 text-xs font-bold">Reject</button><button onClick={() => setState("planned")} className="rounded-lg bg-white py-2.5 text-xs font-bold text-navy">Approve experiment</button></div>
      </div>
    </section>
  </div>;
}

function BrainstormView() {
  const [messages, setMessages] = useState([{ role: "assistant", text: "A cross-model selectivity experiment is the strongest alternative to further refining the AsPC-1 response curve." }]);
  const [input, setInput] = useState("");
  const ask = (question: string) => { if (!question.trim()) return; setMessages((current) => [...current, { role: "user", text: question }, { role: "assistant", text: canned[question] ?? "I would rank that hypothesis against evidence coverage, information gain, redundancy, and feasibility before proposing an experiment." }]); setInput(""); };
  return <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
    <section className="card-elevated flex min-h-[520px] flex-col rounded-xl p-5"><div><p className="text-[9px] font-bold uppercase tracking-[.16em] text-teal">Ask LabPilot</p><h2 className="mt-1 text-xl font-bold">Explore the experiment space</h2></div><div className="mt-5 flex-1 space-y-3 overflow-y-auto">{messages.map((message, index) => <div key={index} className={`max-w-[82%] rounded-xl px-4 py-3 text-xs leading-relaxed ${message.role === "user" ? "ml-auto bg-navy text-white" : "bg-muted"}`}>{message.text}</div>)}</div><div className="mt-4 flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && ask(input)} placeholder="What else should we test?" className="min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-xs outline-none focus:border-teal"/><button onClick={() => ask(input)} className="rounded-lg bg-navy px-4 text-white"><Send className="h-4 w-4"/></button></div></section>
    <section className="card-elevated rounded-xl p-5"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-teal">Discovery opportunities</p><h2 className="mt-1 text-xl font-bold">Promising directions</h2><div className="mt-4 space-y-2">{opportunities.map((item) => <button key={item.title} onClick={() => ask(item.reason)} className="w-full rounded-xl border p-3 text-left transition-colors hover:border-teal hover:bg-teal/5"><div className="flex justify-between gap-3"><b className="text-xs">{item.title}</b><span className="text-xs font-bold text-teal">{item.score}</span></div><p className="mt-1 text-[10px] text-muted-foreground">{item.reason}</p></button>)}</div></section>
  </div>;
}

function ReceiptsView() {
  const [running, setRunning] = useState(false);
  return <div className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
    <section className="card-elevated rounded-xl p-5"><div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[.16em] text-teal">Governed investigation</p><h2 className="mt-1 text-xl font-bold">Checks completed</h2></div><ShieldCheck className="h-6 w-6 text-success"/></div><div className="mt-5 space-y-2">{rlmBranches.map((branch) => <div key={branch.name} className="rounded-xl border p-4"><div className="flex items-center justify-between"><b className="text-xs">{branch.name}</b><Badge tone="green">Checked</Badge></div><p className="mt-2 text-[10px] text-muted-foreground">{branch.summary}</p></div>)}</div><button onClick={() => { setRunning(true); window.setTimeout(() => setRunning(false), 900); }} className="mt-4 w-full rounded-lg bg-navy py-2.5 text-xs font-bold text-white"><Search className="mr-1.5 inline h-3.5 w-3.5"/>{running ? "Refreshing checks…" : "Run investigation again"}</button></section>
    <section className="rounded-xl border border-teal bg-teal/5 p-6"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[9px] font-bold uppercase tracking-[.16em] text-teal">Lab run receipt</p><h2 className="mt-1 text-2xl font-bold">{candidate.id}</h2></div><Badge tone="amber">Human approval required</Badge></div><div className="mt-5 space-y-4 text-xs"><div><b>Objective</b><p className="mt-1 text-muted-foreground">{receipt.objective}</p></div><div><b>Recommendation</b><p className="mt-1 text-muted-foreground">{receipt.recommendation}</p></div><div><b>Strongest counterargument</b><p className="mt-1 text-muted-foreground">{receipt.counterargument}</p></div><div><b>Known uncertainty</b><p className="mt-1 text-muted-foreground">{receipt.uncertainty}</p></div></div><div className="mt-6 flex flex-wrap items-center gap-1">{receipt.trace.map((step, index) => <span className="contents" key={step}><code className="rounded bg-background px-2 py-1 text-[9px]">{step}</code>{index < receipt.trace.length - 1 && <ArrowRight className="h-3 w-3"/>}</span>)}</div></section>
  </div>;
}

export function FocusedDashboard({ view }: { view: DashboardView }) {
  return <main className="min-h-screen bg-[radial-gradient(circle_at_80%_0%,color-mix(in_oklab,var(--teal)_9%,transparent),transparent_25%)]"><div className="mx-auto max-w-[1380px] space-y-4 p-5 lg:p-8"><PageHeader view={view}/>{view === "evidence" && <EvidenceView/>}{view === "next-experiment" && <NextExperimentView/>}{view === "brainstorm" && <BrainstormView/>}{view === "receipts" && <ReceiptsView/>}<p className="pb-2 text-center text-[10px] text-muted-foreground">Preclinical research workspace · predictions remain distinct from measurements</p></div></main>;
}
