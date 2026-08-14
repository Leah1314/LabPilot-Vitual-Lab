import { z } from "zod";

export const DiscoveryInvestigationInput = z.object({
  experimentId: z.string().min(1).max(100),
  objective: z.string().min(8).max(800),
  program: z.object({
    compound: z.string().min(1).max(200),
    target: z.string().min(1).max(200),
    disease: z.string().min(1).max(200),
    model: z.string().min(1).max(200),
    stage: z.string().min(1).max(200),
  }),
  candidate: z.object({
    title: z.string().min(1).max(200),
    region: z.string().min(1).max(100),
    panelSize: z.string().min(1).max(100),
    informationGain: z.string().min(1).max(100),
    redundancyRisk: z.string().min(1).max(100),
  }),
  evidenceRefs: z.array(z.string().min(1).max(160)).min(1).max(30),
});

export type DiscoveryInvestigationReceipt = {
  id: string;
  objective: string;
  verdict: "supported" | "contested" | "insufficient_evidence";
  synthesis: string;
  limitations: string[];
  modelCalls: number;
  mode: "governed_fixture";
  branches: Array<{
    id: "evidence" | "model" | "skeptic" | "operations";
    status: "supported" | "challenged" | "uncertain";
    summary: string;
    evidenceRefs: string[];
  }>;
  trace: string[];
};

export function investigateDiscovery(
  input: z.infer<typeof DiscoveryInvestigationInput>,
): DiscoveryInvestigationReceipt {
  const refs = [...new Set(input.evidenceRefs)];
  return {
    id: crypto.randomUUID(),
    objective: input.objective,
    verdict: "contested",
    mode: "governed_fixture",
    synthesis: `The ${input.candidate.title.toLowerCase()} is supported as a bounded preclinical next step, but a cross-model selectivity experiment remains a strategically credible alternative.`,
    limitations: [
      "Quantitative concentration selection remains owned by the deterministic scientific model.",
      "Public summary evidence may not capture assay-condition differences.",
      "This receipt does not schedule an experiment or convert predictions into measurements.",
    ],
    modelCalls: 0,
    branches: [
      { id: "evidence", status: "supported", summary: "The candidate fills a documented gap near the cellular response transition.", evidenceRefs: refs },
      { id: "model", status: "supported", summary: `The deterministic model reports ${input.candidate.informationGain.toLowerCase()} information gain and ${input.candidate.redundancyRisk.toLowerCase()} redundancy risk.`, evidenceRefs: refs.slice(0, 2) },
      { id: "skeptic", status: "challenged", summary: "A second biological model may provide more strategic information than further refining one cell line.", evidenceRefs: refs.slice(-2) },
      { id: "operations", status: "uncertain", summary: `A ${input.candidate.panelSize} panel in the ${input.candidate.region} region appears feasible, pending lab-specific constraints.`, evidenceRefs: [] },
    ],
    trace: ["evidence_search", "analyze_experiment", "simulate_candidate", "compare_candidates", "skeptic_check", "synthesize_receipt"],
  };
}
