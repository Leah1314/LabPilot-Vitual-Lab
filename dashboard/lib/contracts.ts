/**
 * Data contracts shared across the three workstreams.
 *
 * Contract 1 (`cluster_summary.json`) and Contract 2 (`observations.json`) are
 * owned by Parts A and B respectively — see hackathon_build_planner.md §1.
 * Fields the serving layer adds on top (daytona.md §5) are marked optional so
 * this dashboard renders correctly against either a strict Contract-1 payload
 * or the richer API response. Honesty badges appear only when their backing
 * field is present; nothing is inferred.
 */

/** Contract 1 — one entry per cluster, keyed by cluster id. */
export interface ClusterSummary {
  n_genes: number;
  example_genes: string[];
  /** product name -> gene count */
  top_products: Record<string, number>;
  /** "Resistant" | "Susceptible" -> count (lab-measured AST only) */
  resistant_phenotype_breakdown: Record<string, number>;
  /** species name -> gene count */
  species_breakdown: Record<string, number>;

  // --- Optional provenance, per daytona.md §5. Drives the honesty affordances.
  /** Genome rows before lineage deduplication. */
  n_genomes_raw?: number;
  /** Distinct strains after collapsing identical resistance profiles. */
  n_strains_dedup?: number;
  /** Distinct isolation countries spanned. 1 => possible outbreak artefact. */
  n_countries?: number;
  /** Inclusive collection-year span. Single year => possible outbreak artefact. */
  year_range?: [number, number];
}

export type ClusterSummaryFile = Record<string, ClusterSummary>;

/** Contract 2 — Fireworks-generated, Braintrust-scored observations. */
export interface Observation {
  cluster_id: string;
  headline: string;
  observation: string;
  confidence: "high" | "medium" | "low";
  /** Braintrust faithfulness score, 0-1. */
  eval_score: number;
  supporting_gene_count: number;
  /** Optional eval note — shown verbatim when the score is below threshold. */
  eval_note?: string;
}

export interface PipelineStats {
  /** Null until Part A reports a real measurement. Never invent a number. */
  sequences_embedded: number | null;
  embedding_seconds: number | null;
  embedding_hardware: string | null;
  llm_median_latency_ms: number | null;
  llm_model: string | null;
  eval_mean_faithfulness: number | null;
  eval_n_examples: number | null;
}

export interface ObservationsFile {
  generated_at: string;
  clusters: Observation[];
  pipeline_stats?: PipelineStats;
}

/** daytona.md §5 — `GET /cohort` */
export interface Cohort {
  pinned_date: string;
  organisms: Array<{
    name: string;
    taxon_id: number;
    n_genomes: number;
    /** false for H. pylori — virulence only, never quote a resistance stat. */
    resistance_reportable: boolean;
  }>;
  sources: string[];
}

/** daytona.md §5 — `GET /cooccurrence` */
export interface CooccurrencePair {
  gene_a: string;
  gene_b: string;
  lift: number;
  jaccard: number;
  p_adj: number;
  n_genomes_raw: number;
  n_strains_dedup: number;
  n_countries: number;
  year_range: [number, number];
}

export interface CooccurrenceFile {
  organism: string;
  min_support: number;
  pairs: CooccurrencePair[];
}

/** Where the currently displayed numbers came from. Surfaced in the header. */
export type DataSource = "mock" | "live";

/** Joined view model consumed by the UI. */
export interface ClusterView {
  cluster_id: string;
  summary: ClusterSummary;
  observation: Observation | null;
  resistant: number;
  susceptible: number;
  /** Lab-measured isolates with a usable R/S call. The denominator. */
  phenotyped: number;
}

export interface DashboardData {
  source: DataSource;
  generated_at: string;
  cohort: Cohort;
  clusters: ClusterView[];
  cooccurrence: CooccurrenceFile;
  pipeline_stats: PipelineStats;
}

/** True when a pattern sits in a single country or a single year. */
export function isOutbreakArtefact(s: {
  n_countries?: number;
  year_range?: [number, number];
}): boolean {
  const oneCountry = s.n_countries !== undefined && s.n_countries <= 1;
  const oneYear = s.year_range !== undefined && s.year_range[0] === s.year_range[1];
  return oneCountry || oneYear;
}

/** Joins Contract 1 + Contract 2 into the view model the UI renders. */
export function joinClusters(
  summary: ClusterSummaryFile,
  observations: ObservationsFile,
): ClusterView[] {
  const byId = new Map(observations.clusters.map((o) => [o.cluster_id, o]));
  return Object.entries(summary)
    .map(([cluster_id, s]) => {
      const breakdown = s.resistant_phenotype_breakdown ?? {};
      const resistant = breakdown["Resistant"] ?? 0;
      const susceptible = breakdown["Susceptible"] ?? 0;
      return {
        cluster_id,
        summary: s,
        observation: byId.get(cluster_id) ?? null,
        resistant,
        susceptible,
        phenotyped: resistant + susceptible,
      };
    })
    .sort((a, b) => Number(a.cluster_id) - Number(b.cluster_id));
}
