## About

**Gut-to-Pancreas Pathogen AMR Dashboard** — hackathon research prototype that
turns BV-BRC pathogen tables into GPU-clustered summaries and CopilotKit UIs.

| Field | Value |
|---|---|
| **Problem** | Empiric antibiotics for infected pancreatic necrosis lack fast resistance-structure context for gut-derived organisms |
| **Approach** | BV-BRC pull → Daytona H100 ESM2 + KMeans → grounded LLM observations → CopilotKit dashboards |
| **Cohort** | 240 pinned genomes · 6 organisms · 34,466 proteins |
| **Headline GPU** | 34,466 embeddings in **93.0s** on NVIDIA H100 (see `data/timing.json`) |
| **Headline science** | Clusters are **phenotype-flat** — no resistance association claims |
| **Status** | Research prototype · **not for clinical use** |

### Primary demo

```bash
cd dashboard && bun install && bun run sync-data && bun run dev
```

Full docs: [README.md](./README.md) · [DOCS.md](./DOCS.md)
