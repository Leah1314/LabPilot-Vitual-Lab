import type { ExperimentObservation, ModelAnalysis } from "./virtual-lab-contracts";

export type MeasuredPoint = { dose: number; viability: number; unit: "nM" };

export const measuredPoints: MeasuredPoint[] = [
  { dose: 1, unit: "nM", viability: 97 },
  { dose: 5, unit: "nM", viability: 91 },
  { dose: 10, unit: "nM", viability: 82 },
  { dose: 25, unit: "nM", viability: 65 },
  { dose: 50, unit: "nM", viability: 39 },
  { dose: 100, unit: "nM", viability: 20 },
];

export type Prediction = {
  dose: number;
  viability: number;
  low: number;
  high: number;
  uncertainty: number;
};

// Monotone interpolation in log-dose space is intentionally transparent and
// stable for a six-point hackathon demo. The LLM never supplies these values.
export function predictViability(doseInput: number): Prediction {
  const dose = Math.max(1, Math.min(100, doseInput));
  const exact = measuredPoints.find((point) => point.dose === dose);
  if (exact) {
    return { dose, viability: exact.viability, low: exact.viability, high: exact.viability, uncertainty: 0 };
  }

  let left = measuredPoints[0];
  let right = measuredPoints[measuredPoints.length - 1];
  for (let index = 0; index < measuredPoints.length - 1; index += 1) {
    if (dose > measuredPoints[index].dose && dose < measuredPoints[index + 1].dose) {
      left = measuredPoints[index];
      right = measuredPoints[index + 1];
      break;
    }
  }

  const logDose = Math.log10(dose);
  const position = (logDose - Math.log10(left.dose)) / (Math.log10(right.dose) - Math.log10(left.dose));
  const viability = left.viability + position * (right.viability - left.viability);
  const gapFactor = Math.log10(right.dose / left.dose) / Math.log10(100);
  const centerFactor = 1 - Math.abs(position - 0.5) * 2;
  const uncertainty = Math.max(4, Math.round(4 + gapFactor * 10 + centerFactor * 3));

  return {
    dose,
    viability: Math.round(viability),
    low: Math.max(0, Math.round(viability - uncertainty)),
    high: Math.min(100, Math.round(viability + uncertainty)),
    uncertainty,
  };
}

export const recommendations = [35, 15, 70].map(predictViability);

export const observations: ExperimentObservation[] = measuredPoints.map((point, index) => ({
  experiment_id: "EXP-001", sample_id: `MCF7-${index + 1}`, compound: "Palbociclib", cell_line: "MCF-7",
  dose: point.dose, unit: point.unit, endpoint: "cell_viability", value: point.viability,
  source: "internal", status: "measured",
}));

export function analyzeExperiment(): ModelAnalysis {
  const primary = predictViability(35);
  return {
    experiment_id: "EXP-001",
    primary_recommendation: { dose: 35, unit: "nM", predicted_response: primary.viability, estimated_range: [primary.low, primary.high], score: 0.86 },
    alternatives: [15, 70],
    model: { type: "monotonic_log_dose_interpolation", version: "labpilot-model-0.2", n_measured: observations.length, warning: "Hackathon decision-support estimate" },
    evidence: [{ source: "internal", n: observations.length }],
    requires_human_approval: true,
  };
}
