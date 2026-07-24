// Data-source abstraction used by the dashboard, insights and copilot.
// The UI must not care whether data came from an uploaded file, an external
// API, or the built-in sample dataset — every loader returns DashboardData.
//
// TODO(real backend): loadFromUploadedFiles() should parse uploaded CSV/JSON
// on the server (Lovable Cloud edge function) and return the same shape.

import { clusters as mockClusters, geneClasses as mockGeneClasses, resistanceTrend as mockTrend, insights as mockInsights } from "@/lib/mock-data";

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
  /** Present when the dataset was analysed locally (uploads). */
  enrichment?: EnrichmentReport;
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

export function loadSampleData(): DashboardData {
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

// ---------- Real upload parsing + analysis ----------

export interface ClusterEnrichment {
  n_genes: number;
  species_enrichment: Record<string, number>;
  phenotype_enrichment: Record<string, number>;
  max_phenotype_deviation: number;
  phenotype_signal: boolean;
}

export interface EnrichmentReport {
  n_genes: number;
  flat_threshold: number;
  clusters: Record<string, ClusterEnrichment>;
  clusters_with_phenotype_signal: string[];
  interpretation: string;
}

/** Below this, a cluster is indistinguishable from the corpus background. */
const FLAT_THRESHOLD = 0.25;

/**
 * The actual analysis, run in the browser on whatever was uploaded.
 *
 * Enrichment = share within a cluster / share across the whole corpus. 1.0
 * means the cluster looks exactly like background, so it says nothing about
 * resistance however large it is. This is what stops the assistant claiming a
 * cluster is "linked to resistance" when the arithmetic does not support it.
 */
export function computeEnrichment(
  clusterSummary: Record<string, ClusterSummaryEntry>,
): EnrichmentReport {
  const entries = Object.entries(clusterSummary);
  const grand = entries.reduce((a, [, c]) => a + (c.n_genes ?? 0), 0);

  const spTotals: Record<string, number> = {};
  const phTotals: Record<string, number> = {};
  for (const [, c] of entries) {
    for (const [k, v] of Object.entries(c.species_breakdown ?? {})) {
      spTotals[k] = (spTotals[k] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(c.resistant_phenotype_breakdown ?? {})) {
      phTotals[k] = (phTotals[k] ?? 0) + v;
    }
  }

  const ratio = (
    part: Record<string, number>,
    n: number,
    totals: Record<string, number>,
  ) => {
    const out: Record<string, number> = {};
    for (const [k, tot] of Object.entries(totals)) {
      const observed = n > 0 ? (part[k] ?? 0) / n : 0;
      const expected = grand > 0 ? tot / grand : 0;
      out[k] = expected > 0 ? Number((observed / expected).toFixed(3)) : 0;
    }
    return out;
  };

  const clusters: Record<string, ClusterEnrichment> = {};
  for (const [cid, c] of entries) {
    const n = c.n_genes ?? 0;
    const ph = ratio(c.resistant_phenotype_breakdown ?? {}, n, phTotals);
    // Only Resistant/Susceptible speak to resistance. Unknown is the
    // virulence-only organisms riding along and must not drive a claim.
    const dev = Math.max(
      0,
      ...["Resistant", "Susceptible"]
        .filter((k) => ph[k] !== undefined)
        .map((k) => Math.abs(ph[k] - 1)),
    );
    clusters[cid] = {
      n_genes: n,
      species_enrichment: ratio(c.species_breakdown ?? {}, n, spTotals),
      phenotype_enrichment: ph,
      max_phenotype_deviation: Number(dev.toFixed(3)),
      phenotype_signal: dev >= FLAT_THRESHOLD,
    };
  }

  return {
    n_genes: grand,
    flat_threshold: FLAT_THRESHOLD,
    clusters,
    clusters_with_phenotype_signal: Object.entries(clusters)
      .filter(([, c]) => c.phenotype_signal)
      .map(([cid]) => cid),
    interpretation:
      "Enrichment is the share within a cluster divided by the share across the " +
      "whole corpus. 1.0 means the cluster is indistinguishable from background. " +
      "No cluster may be described as associated with resistance unless its id " +
      "appears in clusters_with_phenotype_signal.",
  };
}

/** Build grounded observations locally when no observations.json was uploaded. */
function deriveObservations(
  clusterSummary: Record<string, ClusterSummaryEntry>,
  enrichment: EnrichmentReport,
): ObservationsResponse {
  const clusters = Object.entries(clusterSummary).map(([cid, c]) => {
    const ph = c.resistant_phenotype_breakdown ?? {};
    const species = Object.entries(c.species_breakdown ?? {}).sort((a, b) => b[1] - a[1]);
    const products = Object.entries(c.top_products ?? {}).sort((a, b) => b[1] - a[1]);
    const [domSpecies, domN] = species[0] ?? ["an unnamed species", 0];
    const lead = products.slice(0, 2).map(([p, n]) => `${p} (${n})`).join(", ");
    const signal = enrichment.clusters_with_phenotype_signal.includes(cid);
    const dev = enrichment.clusters[cid]?.max_phenotype_deviation ?? 0;

    return {
      cluster_id: cid,
      headline: `Cluster ${cid}: ${products[0]?.[0] ?? "mixed products"} in ${domSpecies}`,
      observation:
        `This cluster contains ${c.n_genes} genes${lead ? `, led by ${lead}` : ""}. ` +
        `The species breakdown is dominated by ${domSpecies} (${domN}), with phenotypes ` +
        `reported as ${ph["Resistant"] ?? 0} Resistant and ${ph["Susceptible"] ?? 0} Susceptible. ` +
        (signal
          ? `This cluster departs from the corpus base rate (deviation ${dev}), so the split is worth investigating; co-occurrence is not linkage and not causation.`
          : `The phenotype split matches the corpus base rate, so this cluster does not distinguish resistant from susceptible isolates.`),
      confidence: signal ? "medium" : "high",
      // Not scored by an eval, and not invented either.
      eval_score: 0,
      supporting_gene_count: c.n_genes,
    };
  });

  return { generated_at: new Date().toISOString(), clusters };
}

export interface ParsedUpload {
  data: DashboardData | null;
  enrichment: EnrichmentReport | null;
  errors: string[];
  notes: string[];
}

function looksLikeClusterSummary(v: unknown): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const entries = Object.entries(v as Record<string, unknown>);
  if (entries.length === 0) return false;
  // Contract 1: top-level keys are cluster ids, values carry n_genes.
  return entries.some(
    ([k, val]) =>
      /^\d+$/.test(k) && !!val && typeof val === "object" && "n_genes" in (val as object),
  );
}

/**
 * Parse the user's uploaded files in the browser and run the analysis.
 *
 * Accepts Contract 1 (`cluster_summary.json`) and, optionally, Contract 2
 * (`observations.json`). Files are matched on shape rather than filename, so a
 * renamed export still works. If observations are missing they are derived
 * locally from the cluster summary — grounded, never invented.
 */
export async function parseUploadedFiles(files: File[]): Promise<ParsedUpload> {
  const errors: string[] = [];
  const notes: string[] = [];
  let clusterSummary: Record<string, ClusterSummaryEntry> | null = null;
  let observations: ObservationsResponse | null = null;

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".json")) {
      notes.push(`Skipped ${file.name} — only JSON is parsed in the browser.`);
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      errors.push(`${file.name} is not valid JSON.`);
      continue;
    }

    const obj = parsed as Record<string, unknown>;
    if (obj && Array.isArray(obj.clusters) && obj.clusters.length > 0) {
      observations = parsed as ObservationsResponse;
      notes.push(`Loaded ${obj.clusters.length} observations from ${file.name}.`);
    } else if (looksLikeClusterSummary(parsed)) {
      // Ignore any non-numeric keys so a stray metadata block is not read as a cluster.
      const clean: Record<string, ClusterSummaryEntry> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (/^\d+$/.test(k)) clean[k] = v as ClusterSummaryEntry;
      }
      clusterSummary = clean;
      notes.push(`Loaded ${Object.keys(clean).length} clusters from ${file.name}.`);
    } else {
      notes.push(`Ignored ${file.name} — not a cluster summary or observations file.`);
    }
  }

  if (!clusterSummary) {
    errors.push(
      "No cluster summary found. Upload a cluster_summary.json whose top-level keys are cluster ids (Contract 1).",
    );
    return { data: null, enrichment: null, errors, notes };
  }

  const enrichment = computeEnrichment(clusterSummary);

  if (!observations) {
    observations = deriveObservations(clusterSummary, enrichment);
    notes.push("No observations file uploaded — generated grounded summaries from the cluster data.");
  }

  const gate = enrichment.clusters_with_phenotype_signal;
  notes.push(
    gate.length
      ? `Analysis: clusters ${gate.join(", ")} depart from the corpus base rate.`
      : "Analysis: no cluster departs from the corpus base rate, so none can be called resistance-associated.",
  );

  return { data: { clusterSummary, observations, enrichment }, enrichment, errors, notes };
}

// Retained for the "sample" path; uploads now go through parseUploadedFiles().
export function loadFromUploadedFiles(): DashboardData {
  return loadSampleData();
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
  /** Gate for association language. Empty list = no cluster may be called
   *  resistance-associated. Undefined when the dataset was not analysed. */
  clustersWithPhenotypeSignal?: string[];
  enrichment?: EnrichmentReport;
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
    clustersWithPhenotypeSignal: data.enrichment?.clusters_with_phenotype_signal,
    enrichment: data.enrichment,
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
