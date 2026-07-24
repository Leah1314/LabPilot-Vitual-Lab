## About

**Gut-to-Pancreas Pathogen AMR Dashboard** — one integrated hackathon system that
uses the full sponsor stack end-to-end.

| Field | Value |
|---|---|
| **Problem** | Empiric antibiotics for infected pancreatic necrosis lack fast resistance-structure context for gut-derived organisms |
| **Pipeline** | **BV-BRC** → **Daytona H100** (ESM2 + KMeans) → enrichment gate → **Fireworks** observations → faithfulness eval → **CopilotKit** UIs |
| **Cohort** | 240 pinned genomes · 6 organisms · 34,466 proteins |
| **Headline GPU** | 34,466 embeddings in **93.0s** on NVIDIA H100 (`data/timing.json`) |
| **Headline science** | Clusters are **phenotype-flat** — no resistance association claims |
| **Product UI** | [`dashboard/`](./dashboard/) (CopilotKit + Fireworks) |
| **Agent UI** | [`pathogen-pathfinder/`](./pathogen-pathfinder/) (CopilotKit + Claude, same contracts) |
| **Status** | Research prototype · **not for clinical use** |

### Run the full stack

```bash
# keys: DAYTONA_API_KEY, FIREWORKS_API_KEY (+ ANTHROPIC for pathogen-pathfinder)
python pipeline/bvbrc_fetch.py
python pipeline/run_on_daytona.py
python pipeline/enrichment.py && python pipeline/validate_contract.py
python scripts/generate_observations.py --input data/cluster_summary.json --require-fireworks
cd dashboard && bun install && bun run sync-data && bun run dev
```

Full docs: [README.md](./README.md) · [DOCS.md](./DOCS.md)
