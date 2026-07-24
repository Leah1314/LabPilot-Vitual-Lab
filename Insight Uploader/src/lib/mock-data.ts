// TODO: replace with real API calls to backend (BV-BRC ingest, Daytona embeddings, etc.)

export const clusters = [
  { id: "C-01", label: "Klebsiella pneumoniae", size: 412, resistance: 0.87, virulence: 0.62 },
  { id: "C-02", label: "Escherichia coli", size: 638, resistance: 0.64, virulence: 0.41 },
  { id: "C-03", label: "Staphylococcus aureus", size: 289, resistance: 0.78, virulence: 0.71 },
  { id: "C-04", label: "Pseudomonas aeruginosa", size: 204, resistance: 0.81, virulence: 0.66 },
  { id: "C-05", label: "Acinetobacter baumannii", size: 156, resistance: 0.92, virulence: 0.58 },
  { id: "C-06", label: "Enterobacter cloacae", size: 133, resistance: 0.55, virulence: 0.37 },
];

export const resistanceTrend = [
  { year: 2019, resistance: 0.42 },
  { year: 2020, resistance: 0.51 },
  { year: 2021, resistance: 0.58 },
  { year: 2022, resistance: 0.66 },
  { year: 2023, resistance: 0.73 },
  { year: 2024, resistance: 0.79 },
];

export const geneClasses = [
  { name: "beta-lactamase", count: 412 },
  { name: "aminoglycoside", count: 287 },
  { name: "fluoroquinolone", count: 198 },
  { name: "tetracycline", count: 156 },
  { name: "macrolide", count: 124 },
  { name: "colistin", count: 63 },
];

export const insights = [
  {
    id: "I-01",
    title: "Klebsiella cluster shows elevated carbapenem resistance",
    summary:
      "Cluster C-01 exhibits KPC-3 and OXA-48 co-occurrence at 87%, exceeding baseline by 2.3x.",
    tag: "High confidence",
    grounded: true,
  },
  {
    id: "I-02",
    title: "E. coli virulence markers stable across sample",
    summary: "Cluster C-02 shows no significant shift in fimH / papC prevalence over 12 months.",
    tag: "Verified",
    grounded: true,
  },
  {
    id: "I-03",
    title: "Emerging colistin resistance in Acinetobacter",
    summary: "mcr-1 detected in 8% of C-05 isolates — flag for surveillance.",
    tag: "Needs review",
    grounded: false,
  },
];

export const pipelineStages = [
  { key: "bvbrc", label: "BV-BRC", time: "0.8s", detail: "Fetched 3,124 genomes" },
  { key: "daytona", label: "Daytona H100", time: "4m 12s", detail: "3,124 sequences embedded" },
  { key: "esm2", label: "ESM2", time: "2m 41s", detail: "1280-dim protein embeddings" },
  { key: "kmeans", label: "KMeans", time: "18s", detail: "k=6 clusters formed" },
  { key: "fireworks", label: "Fireworks AI", time: "22s", detail: "18 insights generated" },
  { key: "braintrust", label: "Braintrust", time: "6s", detail: "Grounded validation @ 94%" },
  { key: "dashboard", label: "Dashboard", time: "instant", detail: "Interactive rendering" },
];
