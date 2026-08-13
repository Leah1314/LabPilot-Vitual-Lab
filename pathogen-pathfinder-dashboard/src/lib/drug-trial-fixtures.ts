import type { BrainstormMessage, DiscoveryOpportunity, DiscoveryProgram, EvidenceSource, ExperimentCandidate, LabRunReceipt, MeasuredObservation, PublicEvidence, RankedExperiment, RLMBranchResult, SearchDimension, SimulationResult } from "./drug-trial-types";

export const program: DiscoveryProgram = { compound: "RMC-6236 / Daraxonrasib", target: "RAS(ON) / KRAS G12D", disease: "Pancreatic cancer", model: "AsPC-1 cell model", stage: "Lead optimization / Preclinical" };
export const sources: EvidenceSource[] = [
  { name:"ChEMBL",category:"Bioactivity",status:"Live API",count:84,description:"Curated target, assay, molecule, and bioactivity records." },
  { name:"DepMap / PRISM",category:"Bioactivity",status:"Dataset",count:31,description:"Prepared cancer cell-line drug sensitivity subset." },
  { name:"GDSC",category:"Bioactivity",status:"Dataset",count:22,description:"Prepared cell-line pharmacogenomic evidence." },
  { name:"Open Targets",category:"Target & Disease",status:"Live API",count:18,description:"Target-disease association and drug context." },
  { name:"PubChem",category:"Target & Disease",status:"Live API",count:1,description:"Compound identity and chemical properties." },
  { name:"DrugCentral",category:"Target & Disease",status:"Catalog",description:"Drug, mechanism, target, and approval context." },
  { name:"Scientific literature",category:"Research Context",status:"Context",count:12,description:"Indexed reference summaries; not raw observations." },
  { name:"ClinicalTrials.gov",category:"Research Context",status:"Context",count:6,description:"Development context only; human doses are excluded from modeling." },
  { name:"Convoke Tracker",category:"Research Context",status:"Context",description:"AI and biotech landscape context only." },
  { name:"LabPilot experiments",category:"Internal",status:"Connected",count:9,description:"Measured internal preclinical observations." },
  { name:"Uploaded assay data",category:"Internal",status:"Dataset",count:3,description:"Workspace assay files with source provenance." },
];
export const opportunities: DiscoveryOpportunity[] = [
  { title:"Indication opportunity",status:"High opportunity",reason:"Pancreatic cancer · strong target rationale and sparse transition data",score:91 },
  { title:"Model opportunity",status:"High",reason:"Alternative KRAS G12D model · useful cross-model selectivity comparison",score:84 },
  { title:"Mechanism opportunity",status:"Medium-High",reason:"Resistance / pathway escape after single-agent response mapping",score:76 },
  { title:"Assay opportunity",status:"Medium-High",reason:"Compare pERK pathway response with cellular growth response",score:72 },
  { title:"Combination opportunity",status:"Emerging",reason:"Potential pathway combination, pending stronger evidence",score:61 },
];
export const searchDimensions: SearchDimension[] = [
  {name:"Dose / Concentration",value:"2-6 nM panel",description:"Refine the response transition region.",selected:true},
  {name:"Biological Model",value:"Alternative model",description:"Test another cell line, organoid, strain, or model system."},
  {name:"Indication",value:"Disease context",description:"Compare the compound or target in another indication."},
  {name:"Assay",value:"Alternative readout",description:"Measure another biological response."},
  {name:"Mechanism",value:"Pathway / resistance",description:"Investigate response, escape, or selectivity."},
  {name:"Combination",value:"Second perturbation",description:"Test a rational compound or perturbation pair."},
];
export const rankedExperiments: RankedExperiment[] = [
  {rank:1,experiment:"Refine AsPC-1 dose-response",informationGain:"High",evidenceGap:"High",complexity:"Low",status:"Recommended"},
  {rank:2,experiment:"Test second KRAS G12D model",informationGain:"High",evidenceGap:"Medium",complexity:"Medium",status:"Alternative"},
  {rank:3,experiment:"pERK mechanism assay",informationGain:"Medium-High",evidenceGap:"Medium",complexity:"Medium",status:"Alternative"},
  {rank:4,experiment:"Resistance pathway experiment",informationGain:"High",evidenceGap:"High",complexity:"High",status:"Explore"},
  {rank:5,experiment:"Combination screen",informationGain:"High",evidenceGap:"High",complexity:"High",status:"Explore"},
];
export const measured: MeasuredObservation[] = [
  {id:"m1",type:"measured",concentrationNm:.5,viability:96,provenance:{source:"LabPilot",sourceId:"LP-141",note:"Internal demo fixture; 72 h viability."}},
  {id:"m2",type:"measured",concentrationNm:1,viability:89,provenance:{source:"LabPilot",sourceId:"LP-142",note:"Internal demo fixture; 72 h viability."}},
  {id:"m3",type:"measured",concentrationNm:2,viability:74,provenance:{source:"LabPilot",sourceId:"LP-143",note:"Internal demo fixture; 72 h viability."}},
  {id:"m4",type:"measured",concentrationNm:8,viability:25,provenance:{source:"LabPilot",sourceId:"LP-144",note:"Internal demo fixture; 72 h viability."}},
  {id:"m5",type:"measured",concentrationNm:16,viability:11,provenance:{source:"LabPilot",sourceId:"LP-145",note:"Internal demo fixture; 72 h viability."}},
];
export const curve = [{x:.5,y:96},{x:1,y:89},{x:2,y:74},{x:3,y:61},{x:4,y:50},{x:6,y:35},{x:8,y:25},{x:16,y:11}];
export const simulation: SimulationResult = { beforeUncertainty:32,afterUncertainty:16,predictions:[{id:"v1",type:"predicted",concentrationNm:3,viability:61,modelVersion:"LP deterministic v0.8"},{id:"v2",type:"predicted",concentrationNm:4,viability:50,modelVersion:"LP deterministic v0.8"},{id:"v3",type:"predicted",concentrationNm:5,viability:42,modelVersion:"LP deterministic v0.8"},{id:"v4",type:"predicted",concentrationNm:6,viability:35,modelVersion:"LP deterministic v0.8"}] };
const provenance={source:"Literature",sourceId:"RMC6236-reference",note:"Published-style summary anchor supplied for the demo; not converted into raw dose-response points."};
export const publicEvidence: PublicEvidence[] = [
  {id:"p1",compound:"RMC-6236",target:"KRAS G12D",model:"AsPC-1",assay:"Cell growth EC50",value:3.1,unit:"nM",source:"Literature",type:"public",provenance},
  {id:"p2",compound:"RMC-6236",target:"KRAS G12D",model:"AsPC-1",assay:"pERK EC50",value:3.6,unit:"nM",source:"Literature",type:"public",provenance},
  {id:"p3",compound:"RMC-6236",target:"KRAS G12C",model:"NCI-H358",assay:"Cell growth EC50",value:1,unit:"nM",source:"Literature",type:"public",provenance},
  {id:"p4",compound:"RMC-6236",target:"KRAS G12C",model:"NCI-H358",assay:"pERK EC50",value:1.6,unit:"nM",source:"Literature",type:"public",provenance},
];
export const candidate: ExperimentCandidate = {id:"EXP-CAND-206",title:"Dose panel refinement",region:"2-6 nM",panelSize:"4-5 concentrations",informationGain:"High",redundancyRisk:"Low",state:"candidate"};
export const initialMessages: BrainstormMessage[] = [
  {id:"a1",role:"assistant",text:"I've loaded the RMC-6236 discovery session. I can compare disease models, identify under-tested contexts, propose experiments, or challenge assumptions."},
  {id:"a2",role:"assistant",text:"The cellular response transition in the KRAS G12D pancreatic model looks under-sampled. A denser preclinical concentration panel could be a high-information next step."},
];
export const rlmBranches: RLMBranchResult[] = [
  {name:"Evidence",summary:"Confirms a genuine mid-response evidence gap.",checks:["Assay provenance","Comparable models","Supporting records"]},
  {name:"Model",summary:"Reviews deterministic outputs only.",checks:["Prediction","Uncertainty","Information gain"]},
  {name:"Skeptic",summary:"Challenges whether another experiment is stronger.",checks:["Alternative region","Assay choice","Cross-model selectivity"]},
  {name:"Operations",summary:"Checks feasibility without scheduling.",checks:["Metadata","Constraints","Execution readiness"]},
];
export const receipt: LabRunReceipt = {objective:"Reduce uncertainty around RMC-6236 cellular response in a KRAS G12D pancreatic model.",recommendation:"Support a denser 2-6 nM preclinical concentration panel.",counterargument:"A cross-model selectivity experiment may provide more strategic information than further refining one cell line.",uncertainty:"Public evidence may not capture assay-condition differences or resistance mechanisms.",trace:["evidence_search","analyze_experiment","simulate_candidate","compare_candidates","skeptic_check","synthesize_receipt"]};
export const canned: Record<string,string> = {
  "Where else to test?":"Compare KRAS G12D pancreatic models with RAS-driven lung or colorectal models to test whether activity is context-specific or broadly RAS-dependent.",
  "Find evidence gap":"The cellular response transition is not densely mapped. A refined panel is high-value; cross-model selectivity is the strongest alternative.",
  "Brainstorm mechanisms":"Explore pathway escape and adaptive signaling, then rank those hypotheses against existing evidence before choosing a combination experiment.",
  "Which model next?":"Compare the current model with another biologically relevant system, then score whether cross-model evidence would reduce more uncertainty than refining the current assay.",
  "What would falsify this?":"A well-powered alternative model or assay showing no response in the predicted transition region would challenge the current context-specific hypothesis.",
};
