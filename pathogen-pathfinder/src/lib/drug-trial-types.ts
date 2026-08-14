export type EvidenceType = "measured" | "public" | "predicted" | "candidate" | "planned";
export type SourceStatus = "Live API" | "Dataset" | "Catalog" | "Context" | "Connected" | "Unavailable";

export interface DiscoveryProgram { compound: string; target: string; disease: string; model: string; stage: string; }
export interface Provenance { source: string; sourceId: string; note: string; url?: string; }
export interface MeasuredObservation { id: string; type: "measured"; concentrationNm: number; viability: number; provenance: Provenance; }
export interface PredictedObservation { id: string; type: "predicted"; concentrationNm: number; viability: number; modelVersion: string; }
export interface PublicEvidence { id: string; compound: string; target: string; model: string; assay: string; value: number; unit: string; source: string; type: "public"; provenance: Provenance; }
export interface EvidenceSource { name: string; category: string; status: SourceStatus; count?: number; description: string; }
export interface DiscoveryOpportunity { title: string; status: string; reason: string; score: number; }
export interface SearchDimension { name: string; value: string; description: string; selected?: boolean; }
export interface RankedExperiment { rank: number; experiment: string; informationGain: string; evidenceGap: string; complexity: string; status: "Recommended" | "Alternative" | "Explore"; }
export interface ExperimentCandidate { id: string; title: string; region: string; panelSize: string; informationGain: string; redundancyRisk: string; state: "candidate" | "planned"; }
export interface SimulationResult { beforeUncertainty: number; afterUncertainty: number; predictions: PredictedObservation[]; }
export interface BrainstormMessage { id: string; role: "assistant" | "user"; text: string; }
export interface RLMBranchResult { name: string; summary: string; checks: string[]; }
export interface LabRunReceipt { objective: string; recommendation: string; counterargument: string; uncertainty: string; trace: string[]; }
