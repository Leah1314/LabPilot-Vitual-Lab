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
import { Activity, Dna, ShieldAlert, Sparkles, RefreshCw, Link2, Database, UploadCloud, Loader2, Unplug } from "lucide-react";
import { useMemo, useState } from "react";
import { resistanceTrend as fallbackTrend } from "@/lib/mock-data";
import { useWorkspace } from "@/lib/workspace-store";
import { deriveChartData, loadSampleData } from "@/lib/data-sources";
import { fetchDashboardData } from "@/services/dataSourceApi";

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

function PageHeader({ eyebrow, title, subtitle, right }: { eyebrow: string; title: string; subtitle: string; right?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
      <div>
        <div className="text-xs uppercase tracking-wider text-teal font-semibold">{eyebrow}</div>
        <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {right}
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
        <h2 className="mt-4 text-lg font-semibold text-foreground">No dataset loaded</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a data source — upload files, connect an API, or load the sample dataset.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-navy-foreground hover:bg-navy/90"
        >
          Choose data source
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

function SourceBadge() {
  const { dataSource, connectionName, lastSyncedAt, apiConfig, refreshApiData, disconnect } = useWorkspace();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  if (!dataSource) return null;

  const meta =
    dataSource === "api"
      ? { icon: Link2, label: "Live API", tone: "bg-teal/10 text-teal border-teal/30" }
      : dataSource === "upload"
        ? { icon: UploadCloud, label: "Uploaded Files", tone: "bg-navy/10 text-navy border-navy/20" }
        : { icon: Database, label: "Sample Dataset", tone: "bg-muted text-foreground border-border" };
  const Icon = meta.icon;

  const sync = async () => {
    if (dataSource !== "api") return;
    setSyncing(true);
    setSyncError(null);
    try {
      const data = await fetchDashboardData(apiConfig);
      refreshApiData(data);
    } catch {
      setSyncError("Sync failed — check the connection and try again.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.tone}`}>
        <Icon className="h-3.5 w-3.5" />
        {meta.label}
      </span>
      {connectionName && (
        <span className="text-xs text-muted-foreground">
          {connectionName}
          {lastSyncedAt && ` · Last synced ${new Date(lastSyncedAt).toLocaleTimeString()}`}
        </span>
      )}
      {dataSource === "api" && (
        <>
          <button
            onClick={sync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:border-teal hover:text-teal disabled:opacity-60"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync Data
          </button>
          <button
            onClick={() => {
              disconnect();
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:border-destructive hover:text-destructive"
          >
            <Unplug className="h-3.5 w-3.5" /> Disconnect
          </button>
        </>
      )}
      {syncError && <span className="text-xs text-destructive">{syncError}</span>}
    </div>
  );
}

function Dashboard() {
  const { analyzed, dashboardData } = useWorkspace();
  // Fallback: allow direct navigation for dev by rendering sample data.
  const data = useMemo(() => (dashboardData ? deriveChartData(dashboardData) : null), [dashboardData]);

  if (!analyzed || !data) return <EmptyState />;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Interactive Dashboard"
        title="Antimicrobial resistance overview"
        subtitle={`${data.clusters.length} clusters · ${data.totalGenomes.toLocaleString()} genomes · ${data.insights.length} grounded insights`}
        right={<SourceBadge />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Dna} label="Genomes" value={data.totalGenomes.toLocaleString()} hint={`${data.speciesCount} species detected`} />
        <Kpi icon={ShieldAlert} label="AMR prevalence" value={`${Math.round(data.amrPrevalence * 100)}%`} hint="Weighted mean across clusters" />
        <Kpi icon={Activity} label="Virulence score" value={data.medianVirulence.toFixed(2)} hint="Median across clusters" />
        <Kpi icon={Sparkles} label="AI insights" value={`${data.insights.length}`} hint={`Avg Braintrust ${data.averageEvalScore.toFixed(2)}`} />
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
              <BarChart data={data.clusters}>
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
                  {data.clusters.map((c, i) => (
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
              <LineChart data={data.resistanceTrend.length ? data.resistanceTrend : fallbackTrend}>
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
                {data.clusters.map((c) => (
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
            {data.insights.slice(0, 3).map((i) => (
              <div key={i.id} className="rounded-lg border border-border p-3">
                <div className="text-sm font-medium text-foreground">{i.title}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{i.summary}</div>
                <div className="mt-2 text-[11px]">
                  <span className={`rounded-full px-2 py-0.5 ${i.grounded ? "bg-success/10 text-success" : "bg-accent text-accent-foreground"}`}>
                    {i.tag} · {i.evalScore.toFixed(2)}
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

// Ensure treeshake keeps loadSampleData reachable for callers that navigate here directly.
void loadSampleData;
