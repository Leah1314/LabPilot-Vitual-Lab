# Gut-to-Pancreas Pathogen AMR Dashboard

Real antimicrobial-resistance and virulence data for the gut-derived pathogens that
cause infected pancreatic necrosis — pulled from [BV-BRC](https://www.bv-brc.org),
embedded on a Daytona H100, narrated under strict grounding rules, and shown in
interactive CopilotKit dashboards.

**Research prototype. Not for clinical use.**

| | |
|---|---|
| **Repo** | https://github.com/johnqh/daytona_hackathon |
| **Cohort** | 240 pinned genomes · 6 organisms · 34,466 proteins |
| **GPU** | 34,466 embeddings in **93.0s** on NVIDIA H100 80GB (370 seq/s) |
| **Stack** | BV-BRC · Daytona · ESM2 · Fireworks · Braintrust · CopilotKit |

---

## What this is

ICU clinicians treating infected pancreatic necrosis often choose empiric antibiotics
with limited visibility into current resistance structure among gut-derived organisms.
This hackathon build turns BV-BRC's already-annotated tables into:

1. **GPU-clustered protein summaries** (Daytona H100 + ESM2)
2. **Grounded natural-language observations** (Fireworks, or deterministic offline)
3. **Interactive dashboards** with CopilotKit chat that must not invent numbers

### Headline scientific result (measured, not estimated)

**The clusters carry no resistance signal.** Every cluster's Resistant/Susceptible
split matches the corpus base rate to within ~11%. ESM2 groups proteins by sequence
family; resistance is an isolate-level trait carried by a few genes — it does not
survive averaging over every annotated protein.

**Consequence (enforced in code):** no cluster may be described as “linked to” or
“enriched for” resistance. Gate on `data/cluster_enrichment.json` →
`clusters_with_phenotype_signal` (currently **empty**).

| Stage | Measured result |
|---|---|
| BV-BRC pull | 240 genomes, 6 organisms, **34,466 proteins**, ~117s |
| ESM2 on H100 | **93.0s** (370 seq/s) — see `data/timing.json` |
| Same job on CPU | ~5 seq/s measured |
| Clustering | k=4 by silhouette (0.1271), 6.9s |
| Observations | 4 grounded observations (offline path); local faithfulness mean 1.0 |

---

## Quickstart (demo with committed data)

You do **not** need Daytona or Fireworks to demo the dashboards — `data/` and
`insights/` already contain a full pipeline run.

### Option A — Next.js + CopilotKit dashboard (recommended demo)

```bash
cd dashboard
bun install          # or: npm install
cp .env.example .env.local
bun run sync-data    # copy root contracts into dashboard/data/
bun run dev          # http://localhost:3000
```

Pick **Sample dataset** on the source picker. Add `FIREWORKS_API_KEY` only if you
want the Consult chat panel live.

### Option B — Pathogen Pathfinder (CopilotKit + Claude agent)

```bash
cd pathogen-pathfinder
cp .env.example .env   # set ANTHROPIC_API_KEY
npm install
npm run dev            # UI :3000 · agent :8000
```

Upload → Sample dataset → Analyzing → Dashboard / Copilot.

### Option C — Insight Uploader (TanStack Start)

```bash
cd "Insight Uploader"
npm install
npm run dev
```

### Full pipeline rebuild (Part A → B → C)

```bash
cp .env.example .env   # DAYTONA_API_KEY, optional FIREWORKS_API_KEY / BRAINTRUST_API_KEY

# Part A — data + GPU
pip install requests pandas fair-esm torch scikit-learn daytona
python pipeline/bvbrc_fetch.py
python pipeline/run_on_daytona.py
python pipeline/enrichment.py
python pipeline/validate_contract.py

# Part B — observations
pip install -r requirements-step-b.txt
python scripts/generate_observations.py --input data/cluster_summary.json
# without a Fireworks key (deterministic, still grounded):
python scripts/generate_observations.py --input data/cluster_summary.json --offline

# Part C — refresh dashboard fixtures
cd dashboard && bun run sync-data
```

---

## Architecture

```
BV-BRC REST API
      │  sp_gene, genome_amr, genome, genome_feature, feature_sequence
      ▼
pipeline/bvbrc_fetch.py ──────────► data/*.csv, pipeline/manifest.json
      │                                   (cohort pinned — cannot drift)
      ▼
pipeline/run_on_daytona.py
      │  uploads sequences.csv to a Daytona H100 sandbox
      ▼
pipeline/gpu_embedding_cluster.py ─► data/cluster_summary.json   (Contract 1)
      │  ESM2 t12_35M + KMeans              data/timing.json
      ▼
pipeline/enrichment.py ───────────► data/cluster_enrichment.json (honesty gate)
      │
      ▼
scripts/generate_observations.py ─► insights/observations.json   (Contract 2)
      │  Fireworks or --offline            eval/braintrust_results.json
      ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontends (pick one for the demo)                          │
│  • dashboard/              Next.js + CopilotKit + Fireworks │
│  • pathogen-pathfinder/    Next.js + CopilotKit + Claude    │
│  • Insight Uploader/       TanStack Start research UI       │
└─────────────────────────────────────────────────────────────┘
```

---

## Repo layout

| Path | Role |
|---|---|
| [`pipeline/`](./pipeline/) | BV-BRC fetch, Daytona H100 ESM2 + KMeans, enrichment, contract validation |
| [`data/`](./data/) | Pinned cohort CSVs + Contract 1 outputs + timing |
| [`scripts/generate_observations.py`](./scripts/generate_observations.py) | Statistics → grounded English (Part B) |
| [`insights/`](./insights/) | Contract 2 observations |
| [`eval/`](./eval/) | Faithfulness scores |
| [`dashboard/`](./dashboard/) | **Primary demo UI** — Next.js + CopilotKit (Fireworks) |
| [`pathogen-pathfinder/`](./pathogen-pathfinder/) | Alternate CopilotKit UI with Claude Agent SDK |
| [`Insight Uploader/`](./Insight%20Uploader/) | TanStack Start / Lovable-origin UI wired to contracts |
| Specs | [`prompt.md`](./prompt.md), [`daytona.md`](./daytona.md), [`fireworks.md`](./fireworks.md), [`frontend.md`](./frontend.md), … |
| Doc index | [`DOCS.md`](./DOCS.md) |

---

## Data contracts

**Contract 1** — `data/cluster_summary.json` (Part A → B/C). Top-level keys are
cluster ids as strings **only** (no `_meta`). Validate with:

```bash
python pipeline/validate_contract.py
```

**Contract 2** — `insights/observations.json` (Part B → C):

```json
{
  "generated_at": "...",
  "clusters": [
    {
      "cluster_id": "0",
      "headline": "...",
      "observation": "...",
      "confidence": "medium",
      "eval_score": 1.0,
      "supporting_gene_count": 12497
    }
  ]
}
```

---

## The cohort

Pinned in `pipeline/manifest.json` (40 genomes × 6 organisms = 240), written once
so the demo cannot drift from the pipeline run.

| Organism | taxon_id | Role |
|---|---|---|
| *Escherichia coli* | 562 | resistance + virulence |
| *Klebsiella pneumoniae* | 573 | resistance + virulence |
| *Enterococcus faecium* | 1352 | resistance + virulence |
| *Enterococcus faecalis* | 1351 | resistance + virulence |
| *Clostridioides difficile* | 1496 | resistance + virulence |
| *Helicobacter pylori* | 210 | **virulence only** — never quote resistance stats |

**Phenotype rule:** a genome is **Resistant** when it has more lab-measured
Resistant than Susceptible AST results; otherwise **Susceptible**. No lab AMR →
**Unknown**. Intermediate excluded. Raw counts stay in `data/sequences.csv`.

---

## Environment variables

Root `.env` (never commit):

| Variable | Used by | Purpose |
|---|---|---|
| `DAYTONA_API_KEY` | Part A | H100 sandbox for ESM2 |
| `FIREWORKS_API_KEY` | Part B + `dashboard/` | LLM observations / Consult chat |
| `BRAINTRUST_API_KEY` | Part B | Optional remote eval |

`pathogen-pathfinder/.env` additionally needs `ANTHROPIC_API_KEY` (Claude agent).
See each app’s `.env.example`.

---

## Honesty rules (non-negotiable)

These are the difference between surviving Q&A and getting dismantled.

- Never present computational annotations (`sp_gene`) as laboratory measurements.
  Only `genome_amr` rows with `evidence == "Laboratory Method"` are lab results.
- **No cluster is associated with resistance** — gate on
  `clusters_with_phenotype_signal`.
- Never show a percentage without its denominator.
- Never quote a speedup you have not measured — cite `data/timing.json`.
- Genomes are **not** strain-deduplicated by default; outbreak oversampling is real.
- Clustering partly recovers annotation families (circular by construction).
- k selection is near-arbitrary (silhouette 0.087–0.127 for k=4..12).
- Every screen: **research prototype, not for clinical use.**

Full product brief and eval rules: [`prompt.md`](./prompt.md).

---

## Known gaps

- Fireworks / Braintrust live paths may be untested on a given machine — the
  committed observations used `--offline` with a local faithfulness scorer
  (`eval/braintrust_results.json`: `fireworks_used: false`).
- Observations quote real numbers but do not yet explicitly say clusters are
  phenotype-flat; that sentence should come from `cluster_enrichment.json`.
- `Insight Uploader.zip` at repo root is a stale duplicate of `Insight Uploader/`
  and can be deleted.

---

## Docs map

See **[DOCS.md](./DOCS.md)** for the full index of specs, runbooks, and app READMEs.

---

## Attribution

Data from [BV-BRC](https://www.bv-brc.org) (publicly funded). Annotations from
**CARD**, **NDARO**, **VFDB**, and **PATRIC_VF**. Embeddings from **ESM2**
(`esm2_t12_35M_UR50D`, Meta AI). Show the pinned cohort date from
`pipeline/manifest.json` in the UI.
