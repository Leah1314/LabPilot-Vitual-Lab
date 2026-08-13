export type ExperimentObservation = {
  experiment_id: string;
  sample_id?: string;
  compound: string;
  cell_line: string;
  dose: number;
  unit: "nM" | "uM";
  endpoint: "cell_viability";
  value: number;
  source: "internal" | "public_reference" | "demo";
  status: "measured" | "predicted";
  citation?: string;
};

export type ModelAnalysis = {
  experiment_id: string;
  primary_recommendation: { dose: number; unit: "nM"; predicted_response: number; estimated_range: [number, number]; score: number };
  alternatives: number[];
  model: { type: "monotonic_log_dose_interpolation"; version: string; n_measured: number; warning: string };
  evidence: { source: string; n: number; citation?: string }[];
  requires_human_approval: true;
};

export type LLMRecommendation = {
  headline: string;
  interpretation: string;
  why_this_next_step: string;
  evidence_summary: string[];
  caveats: string[];
  human_review_required: true;
};
