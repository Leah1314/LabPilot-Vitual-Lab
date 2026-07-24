import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Dna, ShieldAlert, Sparkles } from "lucide-react";
import { clusters, resistanceTrend, geneClasses, insights } from "@/lib/mock-data";
import { useWorkspace } from "@/lib/workspace-store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Pathogen AI" },
      { name: "description", content: "Interactive AMR + virulence analytics across pathogen clusters." },
      { property: "og:title", content: "Dashboard — Pathogen AI" },
      { property: "og:description", content: "Interactive AMR + virulence analytics across pathogen clusters." },
    ],
  }),
  component: Dashboard,
});

function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <div className="text-xs uppercase tracking-wider text-teal font-semibold">{eyebrow}</div>
      <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center card-elevated rounded-2xl p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/10 text-teal">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">No analysis yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload your pathogen dataset and run analysis to populate the dashboard.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-navy-foreground hover:bg-navy/90"
        >
          Go to Upload
        </Link>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint: string }) {
  return (
    <div className="card-elevated rounded-xl p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4 text-teal" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}

function Dashboard() {
  const { analyzed } = useWorkspace();
  if (!analyzed) return <EmptyState />;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Interactive Dashboard"
        title="Antimicrobial resistance overview"
        subtitle="6 clusters · 3,124 genomes · 18 grounded insights"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Dna} label="Genomes" value="3,124" hint="Across 6 species clusters" />
        <Kpi icon={ShieldAlert} label="AMR prevalence" value="76%" hint="Weighted mean · +6% YoY" />
        <Kpi icon={Activity} label="Virulence score" value="0.58" hint="Median across clusters" />
        <Kpi icon={Sparkles} label="AI insights" value="18" hint="94% grounded (Braintrust)" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card-elevated rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-foreground">Cluster resistance</div>
              <div className="text-xs text-muted-foreground">Resistance fraction per pathogen cluster</div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={clusters}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="id" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="resistance" radius={[6, 6, 0, 0]}>
                  {clusters.map((c, i) => (
                    <Cell key={c.id} fill={i % 2 ? "var(--teal)" : "var(--navy)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-elevated rounded-xl p-5">
          <div className="text-sm font-semibold text-foreground">Resistance trend</div>
          <div className="text-xs text-muted-foreground">5-year global trajectory</div>
          <div className="h-72 mt-3">
            <ResponsiveContainer>
              <LineChart data={resistanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="resistance" stroke="var(--teal)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card-elevated rounded-xl p-5 lg:col-span-2">
          <div className="text-sm font-semibold text-foreground mb-3">Clusters</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="py-2 pr-4">ID</th>
                  <th className="py-2 pr-4">Species</th>
                  <th className="py-2 pr-4">Isolates</th>
                  <th className="py-2 pr-4">Resistance</th>
                  <th className="py-2">Virulence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clusters.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-4 font-mono text-xs">{c.id}</td>
                    <td className="py-2 pr-4 text-foreground">{c.label}</td>
                    <td className="py-2 pr-4">{c.size}</td>
                    <td className="py-2 pr-4">
                      <span className="inline-flex items-center rounded-full bg-teal/10 text-teal px-2 py-0.5 text-xs font-medium">
                        {(c.resistance * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-2">
                      <span className="inline-flex items-center rounded-full bg-navy/10 text-navy px-2 py-0.5 text-xs font-medium">
                        {c.virulence.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-elevated rounded-xl p-5">
          <div className="text-sm font-semibold text-foreground mb-3">Top insights</div>
          <div className="space-y-3">
            {insights.slice(0, 3).map((i) => (
              <div key={i.id} className="rounded-lg border border-border p-3">
                <div className="text-sm font-medium text-foreground">{i.title}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{i.summary}</div>
                <div className="mt-2 text-[11px]">
                  <span className={`rounded-full px-2 py-0.5 ${i.grounded ? "bg-success/10 text-success" : "bg-accent text-accent-foreground"}`}>
                    {i.tag}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
