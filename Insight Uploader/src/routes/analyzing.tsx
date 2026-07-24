import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Loader2, Upload, Cpu, Network, Sparkles, ShieldCheck, LayoutDashboard } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-store";

export const Route = createFileRoute("/analyzing")({
  head: () => ({
    meta: [
      { title: "Analyzing dataset — Pathogen AI" },
      { name: "description", content: "Running GPU embeddings, clustering, and grounded AI insight generation." },
    ],
  }),
  component: AnalyzingPage,
});

const steps = [
  { key: "upload", label: "Upload", icon: Upload, detail: "Validating 4 files", timing: "0.6s" },
  { key: "daytona", label: "Daytona H100 Embedding", icon: Cpu, detail: "3,124 sequences embedded", timing: "4m 12s" },
  { key: "cluster", label: "Gene Clustering", icon: Network, detail: "KMeans k=6", timing: "18s" },
  { key: "fireworks", label: "Fireworks AI Insight Generation", icon: Sparkles, detail: "18 insights generated · 1.2s / cluster", timing: "22s" },
  { key: "braintrust", label: "Braintrust Validation", icon: ShieldCheck, detail: "94% grounded", timing: "6s" },
  { key: "dashboard", label: "Interactive Dashboard", icon: LayoutDashboard, detail: "Rendering", timing: "instant" },
];

function AnalyzingPage() {
  const navigate = useNavigate();
  const { setAnalyzed } = useWorkspace();
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // TODO: replace with real pipeline progress events (WebSocket / SSE).
    if (current >= steps.length) {
      setAnalyzed(true);
      const t = setTimeout(() => navigate({ to: "/dashboard" }), 600);
      return () => clearTimeout(t);
    }
    setProgress(0);
    const iv = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(iv);
          setCurrent((c) => c + 1);
          return 100;
        }
        return p + 8;
      });
    }, 90);
    return () => clearInterval(iv);
  }, [current, navigate, setAnalyzed]);

  return (
    <div className="min-h-screen hero-gradient flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin text-teal" /> Pipeline running
          </div>
          <h1 className="mt-5 text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
            Analyzing your dataset
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            GPU-powered embeddings, clustering, and grounded AI insight generation.
          </p>
        </div>

        <div className="card-elevated rounded-2xl p-6 space-y-4">
          {steps.map((s, i) => {
            const done = i < current;
            const active = i === current;
            const Icon = s.icon;
            return (
              <div
                key={s.key}
                className={`flex items-start gap-4 transition-opacity ${i > current ? "opacity-40" : "opacity-100"}`}
              >
                <div
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    done
                      ? "bg-success/10 border-success text-success"
                      : active
                        ? "bg-teal/10 border-teal text-teal"
                        : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  {done ? (
                    <Check className="h-4 w-4" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-foreground">
                      {i + 1}. {s.label}
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground">{s.timing}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.detail}</div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full transition-all duration-100 ${done ? "bg-success" : "bg-teal"}`}
                      style={{ width: `${done ? 100 : active ? progress : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
