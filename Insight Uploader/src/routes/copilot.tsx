import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";

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
  { q: "Compare Klebsiella vs E.coli", chart: "cluster-resistance" },
  { q: "Explain selected cluster", chart: "cluster-detail" },
  { q: "Show beta-lactamase genes", chart: "gene-classes" },
];

type Msg = { role: "user" | "assistant"; content: string; chart?: string };

function mockAnswer(q: string): Msg {
  // TODO: replace with real call to Fireworks/OpenAI + Braintrust grounding.
  if (/highest resistance/i.test(q))
    return {
      role: "assistant",
      chart: "cluster-resistance",
      content:
        "Cluster C-05 (Acinetobacter baumannii) shows the highest resistance at 92%, driven by carbapenemase and colistin-resistance markers. Highlighted on the Cluster resistance chart.",
    };
  if (/klebsiella.*coli|coli.*klebsiella/i.test(q))
    return {
      role: "assistant",
      chart: "cluster-resistance",
      content:
        "Klebsiella (C-01) shows 87% resistance vs E. coli (C-02) at 64%. Klebsiella isolates carry KPC-3 + OXA-48 co-occurrence, giving them broader β-lactam resistance.",
    };
  if (/beta-lactamase/i.test(q))
    return {
      role: "assistant",
      chart: "gene-classes",
      content:
        "412 isolates carry β-lactamase genes — the largest AMR class in your dataset. Dominant subtypes: blaKPC, blaCTX-M, blaOXA.",
    };
  return {
    role: "assistant",
    chart: "cluster-detail",
    content: `Analyzing "${q}"… The selected cluster contains 412 isolates with a resistance score of 0.87 and virulence of 0.62. Corresponding chart highlighted.`,
  };
}

function Copilot() {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Ask me about clusters, resistance patterns, or gene classes. Try a quick action below.",
    },
  ]);
  const [input, setInput] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);

  const send = (q: string) => {
    if (!q.trim()) return;
    const answer = mockAnswer(q);
    setMsgs((m) => [...m, { role: "user", content: q }, answer]);
    setHighlight(answer.chart ?? null);
    setInput("");
  };

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="text-xs uppercase tracking-wider text-teal font-semibold">AI Copilot</div>
      <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
        Chat with your dataset
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Grounded responses highlight the corresponding chart on the dashboard.
      </p>

      {/* Quick actions */}
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

      {/* Highlighted chart pill (illustrative — dashboard would react to this signal) */}
      {highlight && (
        <div className="mt-4 rounded-lg border border-teal/40 bg-teal/5 px-3 py-2 text-xs text-navy animate-fade-in">
          Chart highlighted: <span className="font-mono">{highlight}</span> — open the Dashboard to view.
        </div>
      )}

      {/* Messages */}
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
                m.role === "user"
                  ? "bg-navy text-navy-foreground"
                  : "bg-muted text-foreground"
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

      {/* Composer */}
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
