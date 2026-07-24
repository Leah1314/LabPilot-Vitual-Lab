import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bot, Send, Sparkles, User, Link2, UploadCloud, Database } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-store";
import { deriveChartData } from "@/lib/data-sources";

export const Route = createFileRoute("/copilot")({
  head: () => ({
    meta: [
      { title: "AI Copilot — Pathogen AI" },
      { name: "description", content: "Chat with your dataset. Ask about clusters, resistance, and genes." },
      { property: "og:title", content: "AI Copilot — Pathogen AI" },
      { property: "og:description", content: "Chat with your dataset. Ask about clusters, resistance, and genes." },
    ],
  }),
  component: Copilot,
});

const quickActions = [
  { q: "Which cluster has highest resistance?", chart: "cluster-resistance" },
  { q: "Compare top two species", chart: "cluster-resistance" },
  { q: "Explain top-scoring insight", chart: "insights" },
  { q: "Show top gene classes", chart: "gene-classes" },
];

type Msg = { role: "user" | "assistant"; content: string; chart?: string };

function Copilot() {
  const { dashboardData, dataSource, connectionName, lastSyncedAt } = useWorkspace();
  const derived = useMemo(() => (dashboardData ? deriveChartData(dashboardData) : null), [dashboardData]);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Ask me about clusters, resistance patterns, or gene classes. Responses are grounded in the currently loaded dataset.",
    },
  ]);
  const [input, setInput] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);

  // TODO(real backend): swap this local grounding for a Fireworks/Braintrust call
  // that receives the current cluster_summary + observations as context.
  const answer = (q: string): Msg => {
    if (!derived) {
      return { role: "assistant", content: "No dataset loaded yet — choose a data source on the Upload page." };
    }
    if (/highest resistance/i.test(q)) {
      const top = [...derived.clusters].sort((a, b) => b.resistance - a.resistance)[0];
      return {
        role: "assistant",
        chart: "cluster-resistance",
        content: `${top.id} (${top.label}) has the highest resistance at ${(top.resistance * 100).toFixed(0)}% across ${top.size} isolates.`,
      };
    }
    if (/compare|top two|two species/i.test(q)) {
      const [a, b] = [...derived.clusters].sort((x, y) => y.size - x.size);
      if (a && b) {
        return {
          role: "assistant",
          chart: "cluster-resistance",
          content: `${a.label} shows ${(a.resistance * 100).toFixed(0)}% resistance vs ${b.label} at ${(b.resistance * 100).toFixed(0)}%. Population sizes: ${a.size} vs ${b.size}.`,
        };
      }
    }
    if (/insight|top-scoring|explain top/i.test(q)) {
      const top = [...derived.insights].sort((a, b) => b.evalScore - a.evalScore)[0];
      if (top) {
        return {
          role: "assistant",
          chart: "insights",
          content: `${top.title} — ${top.summary} (Braintrust score ${top.evalScore.toFixed(2)}).`,
        };
      }
    }
    if (/gene|beta-lactamase|class/i.test(q)) {
      const top = derived.geneClasses.slice(0, 3).map((g) => `${g.name} (${g.count})`).join(", ");
      return {
        role: "assistant",
        chart: "gene-classes",
        content: `Top gene classes in the current dataset: ${top}.`,
      };
    }
    return {
      role: "assistant",
      chart: "cluster-resistance",
      content: `The current dataset has ${derived.clusters.length} clusters and ${derived.totalGenomes} genomes. Try one of the quick actions for a grounded answer.`,
    };
  };

  const send = (q: string) => {
    if (!q.trim()) return;
    const a = answer(q);
    setMsgs((m) => [...m, { role: "user", content: q }, a]);
    setHighlight(a.chart ?? null);
    setInput("");
  };

  const sourceMeta =
    dataSource === "api"
      ? { icon: Link2, label: "Live API" }
      : dataSource === "upload"
        ? { icon: UploadCloud, label: "Uploaded Files" }
        : dataSource === "sample"
          ? { icon: Database, label: "Sample Dataset" }
          : null;

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="text-xs uppercase tracking-wider text-teal font-semibold">AI Copilot</div>
      <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
        Chat with your dataset
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Grounded responses reflect the currently loaded data source.
      </p>

      {sourceMeta && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs">
          <sourceMeta.icon className="h-3.5 w-3.5 text-teal" />
          <span className="text-foreground font-medium">{sourceMeta.label}</span>
          {connectionName && <span className="text-muted-foreground">· {connectionName}</span>}
          {lastSyncedAt && (
            <span className="text-muted-foreground">· synced {new Date(lastSyncedAt).toLocaleTimeString()}</span>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {quickActions.map((a) => (
          <button
            key={a.q}
            onClick={() => send(a.q)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:border-teal hover:text-teal transition-colors"
          >
            <Sparkles className="inline h-3 w-3 mr-1 text-teal" />
            {a.q}
          </button>
        ))}
      </div>

      {highlight && (
        <div className="mt-4 rounded-lg border border-teal/40 bg-teal/5 px-3 py-2 text-xs text-navy animate-fade-in">
          Chart highlighted: <span className="font-mono">{highlight}</span> — open the Dashboard to view.
        </div>
      )}

      <div className="mt-4 card-elevated rounded-2xl p-4 min-h-[380px] space-y-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy text-navy-foreground">
                <Bot className="h-4 w-4" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user" ? "bg-navy text-navy-foreground" : "bg-muted text-foreground"
              }`}
            >
              {m.content}
            </div>
            {m.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-4 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a cluster, gene, or resistance pattern…"
          className="flex-1 rounded-lg border border-input bg-card px-4 py-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-3 text-sm font-semibold text-navy-foreground hover:bg-navy/90"
        >
          <Send className="h-4 w-4" />
          Send
        </button>
      </form>
    </div>
  );
}
