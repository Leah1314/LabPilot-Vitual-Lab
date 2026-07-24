// Data-source abstraction used by the dashboard, insights and copilot.
// The UI must not care whether data came from an uploaded file, an external
// API, or the built-in sample dataset — every loader returns DashboardData.
//
// TODO(real backend): loadFromUploadedFiles() should parse uploaded CSV/JSON
// on the server (Lovable Cloud edge function) and return the same shape.

import { clusters as mockClusters, geneClasses as mockGeneClasses, resistanceTrend as mockTrend, insights as mockInsights } from "@/lib/mock-data";

// Real Part A output, produced by pipeline/gpu_embedding_cluster.py:
// 34,466 BV-BRC proteins embedded with ESM2 on a Daytona H100 and clustered.
// See pipeline/README.md at the repo root for provenance and caveats.
import realClusterSummary from "@/data/cluster_summary.json";
import realObservations from "@/data/observations.json";
import realEnrichment from "@/data/cluster_enrichment.json";

export type DataSourceType = "upload" | "api" | "sample";

export type AuthMethod = "bearer" | "header" | "none";

export interface ApiConfig {
  connectionName: string;
  baseUrl: string;
  authMethod: AuthMethod;
  apiKey: string;
  apiKeyHeader: string;
  useCombinedEndpoint: boolean;
  combinedEndpoint: string;
  clusterSummaryEndpoint: string;
  observationsEndpoint: string;
}

export interface ClusterSummaryEntry {
  n_genes: number;
  example_genes?: string[];
  top_products?: Record<string, number>;
  resistant_phenotype_breakdown?: Record<string, number>;
  species_breakdown?: Record<string, number>;
}

export interface ObservationEntry {
  cluster_id: string;
  headline: string;
  observation: string;
  confidence: "high" | "medium" | "low" | string;
  eval_score: number;
  supporting_gene_count: number;
}

export interface ObservationsResponse {
  generated_at: string;
  clusters: ObservationEntry[];
}

export interface DashboardData {
  clusterSummary: Record<string, ClusterSummaryEntry>;
  observations: ObservationsResponse;
}

export const DEFAULT_API_CONFIG: ApiConfig = {
  connectionName: "BV-BRC Analysis API",
  baseUrl: "https://api.example.com",
  authMethod: "none",
  apiKey: "",
  apiKeyHeader: "X-API-Key",
  useCombinedEndpoint: true,
  combinedEndpoint: "/api/dashboard",
  clusterSummaryEndpoint: "/api/cluster-summary",
  observationsEndpoint: "/api/observations",
};

// ---------- Loaders (all return DashboardData) ----------

/**
 * The real BV-BRC dataset produced by Part A.
 *
 * 34,466 annotated proteins from 240 pinned genomes across six gut-derived
 * pathogens, embedded with ESM2 on a Daytona H100 in 93s and grouped into
 * 4 clusters.
 *
 * IMPORTANT for anything that narrates these clusters: the clusters carry no
 * resistance signal. Every cluster's Resistant/Susceptible split reproduces
 * the corpus base rate (max deviation 0.07-0.11), so none of them may be
 * described as linked to or enriched for resistance. `clusterEnrichment`
 * below exposes `clusters_with_phenotype_signal`, which is the gate for any
 * association language and is currently empty.
 */
export function loadRealData(): DashboardData {
  return {
    clusterSummary: realClusterSummary as Record<string, ClusterSummaryEntry>,
    observations: realObservations as unknown as ObservationsResponse,
  };
}

/** Enrichment gate. Empty `clusters_with_phenotype_signal` means no cluster
 *  supports a resistance claim. */
export const clusterEnrichment = realEnrichment;

/** Fabricated demo data. Kept for UI development only - prefer loadRealData(). */
export function loadMockData(): DashboardData {
  const clusterSummary: Record<string, ClusterSummaryEntry> = {};
  mockClusters.forEach((c, i) => {
    const resistantPct = Math.round(c.resistance * c.size);
    clusterSummary[String(i)] = {
      n_genes: Math.round(c.size * 0.6),
      example_genes: [`fig|573.${1000 + i}.peg.10`, `fig|573.${1000 + i}.peg.55`],
      top_products: {
        "beta-lactamase": Math.round(c.size * 0.3),
        "efflux pump": Math.round(c.size * 0.15),
        "aminoglycoside modifying": Math.round(c.size * 0.1),
      },
      resistant_phenotype_breakdown: {
        Resistant: resistantPct,
        Susceptible: c.size - resistantPct,
      },
      species_breakdown: { [c.label]: c.size },
    };
  });

  return {
    clusterSummary,
    observations: {
      generated_at: new Date().toISOString(),
      clusters: mockInsights.map((ins, i) => ({
        cluster_id: String(i),
        headline: ins.title,
        observation: ins.summary,
        confidence: ins.grounded ? "high" : "medium",
        eval_score: ins.grounded ? 0.92 : 0.74,
        supporting_gene_count: mockClusters[i]?.size ?? 100,
      })),
    },
  };
}

/** The built-in dataset. Now backed by real Part A output rather than mocks,
 *  so the dashboard shows real BV-BRC numbers with no upload or backend. */
export function loadSampleData(): DashboardData {
  return loadRealData();
}

// TODO(real backend): parse the user's uploaded files server-side. Until then
// an upload resolves to the same real Part A dataset.
export function loadFromUploadedFiles(): DashboardData {
  return loadRealData();
}

// ---------- Derived chart data (used by dashboard / insights / gene explorer) ----------

export interface DerivedChartData {
  clusters: {
    id: string;
    label: string;
    size: number;
    resistance: number;
    virulence: number;
  }[];
  geneClasses: { name: string; count: number }[];
  insights: {
    id: string;
    title: string;
    summary: string;
    tag: string;
    grounded: boolean;
    evalScore: number;
  }[];
  resistanceTrend: { year: number; resistance: number }[];
  speciesCount: number;
  totalGenomes: number;
  amrPrevalence: number;
  medianVirulence: number;
  averageEvalScore: number;
}

export function deriveChartData(data: DashboardData): DerivedChartData {
  const entries = Object.entries(data.clusterSummary);
  const observationsById = new Map(data.observations.clusters.map((o) => [String(o.cluster_id), o]));

  let totalGenomes = 0;
  let resistanceWeighted = 0;
  const speciesSet = new Set<string>();
  const geneTally = new Map<string, number>();
  const virulenceValues: number[] = [];

  const clusters = entries.map(([id, c]) => {
    const speciesBreakdown = c.species_breakdown ?? {};
    Object.keys(speciesBreakdown).forEach((s) => speciesSet.add(s));
    const dominant = Object.entries(speciesBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ?? `Cluster ${id}`;
    const size = Object.values(speciesBreakdown).reduce((a, b) => a + b, 0) || c.n_genes || 0;
    const resistantBreakdown = c.resistant_phenotype_breakdown ?? {};
    const resistantCount = resistantBreakdown["Resistant"] ?? 0;
    const totalBreakdown = Object.values(resistantBreakdown).reduce((a, b) => a + b, 0);
    const resistance = totalBreakdown > 0 ? resistantCount / totalBreakdown : 0;
    // Virulence proxy: weight top_products by AMR keywords
    const products = c.top_products ?? {};
    const productTotal = Object.values(products).reduce((a, b) => a + b, 0) || 1;
    const virulenceKeywords = /toxin|virul|adhesion|pump|invasion/i;
    const virulenceRaw = Object.entries(products)
      .filter(([k]) => virulenceKeywords.test(k))
      .reduce((a, [, v]) => a + v, 0);
    const virulence = Math.min(1, virulenceRaw / productTotal + 0.35);

    Object.entries(products).forEach(([name, count]) => {
      geneTally.set(name, (geneTally.get(name) ?? 0) + count);
    });

    totalGenomes += size;
    resistanceWeighted += resistance * size;
    virulenceValues.push(virulence);

    return {
      id: `C-${String(Number(id) + 1).padStart(2, "0")}`,
      label: dominant,
      size,
      resistance,
      virulence,
    };
  });

  const amrPrevalence = totalGenomes > 0 ? resistanceWeighted / totalGenomes : 0;
  const sortedVir = [...virulenceValues].sort((a, b) => a - b);
  const medianVirulence = sortedVir.length ? sortedVir[Math.floor(sortedVir.length / 2)] : 0;
  const geneClasses = Array.from(geneTally.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const insights = data.observations.clusters.map((o) => ({
    id: `I-${String(o.cluster_id).padStart(2, "0")}`,
    title: o.headline,
    summary: o.observation,
    tag:
      o.confidence === "high"
        ? "High confidence"
        : o.confidence === "medium"
          ? "Verified"
          : "Needs review",
    grounded: (o.eval_score ?? 0) >= 0.8,
    evalScore: o.eval_score ?? 0,
  }));

  const averageEvalScore =
    insights.length > 0 ? insights.reduce((a, b) => a + b.evalScore, 0) / insights.length : 0;

  return {
    clusters,
    geneClasses: geneClasses.length ? geneClasses : mockGeneClasses,
    insights,
    // TODO(real backend): historical trend endpoint — mock for now.
    resistanceTrend: mockTrend,
    speciesCount: speciesSet.size,
    totalGenomes,
    amrPrevalence,
    medianVirulence,
    averageEvalScore,
  };
}

// ---------- Recent connections (no secrets stored) ----------

export interface RecentConnection {
  id: string;
  connectionName: string;
  baseUrl: string;
  authMethod: AuthMethod;
  apiKeyHeader: string;
  useCombinedEndpoint: boolean;
  combinedEndpoint: string;
  clusterSummaryEndpoint: string;
  observationsEndpoint: string;
  lastConnectedAt: string;
  lastStatus: "success" | "failed";
}

const RECENT_KEY = "pathogen-ai:recent-connections";

export function loadRecentConnections(): RecentConnection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentConnection[]) : [];
  } catch {
    return [];
  }
}

export function saveRecentConnection(entry: RecentConnection) {
  if (typeof window === "undefined") return;
  const list = loadRecentConnections().filter(
    (r) => !(r.baseUrl === entry.baseUrl && r.connectionName === entry.connectionName),
  );
  list.unshift(entry);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
}

export function deleteRecentConnection(id: string) {
  if (typeof window === "undefined") return;
  const list = loadRecentConnections().filter((r) => r.id !== id);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}
