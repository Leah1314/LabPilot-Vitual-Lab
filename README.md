# Gut-to-Pancreas Pathogen AMR Dashboard

[![Research prototype](https://img.shields.io/badge/status-research%20prototype-orange)](./SECURITY.md)
[![Not for clinical use](https://img.shields.io/badge/clinical-not%20for%20use-red)](./SECURITY.md)
[![BV-BRC](https://img.shields.io/badge/data-BV--BRC-0A66C2)](https://www.bv-brc.org)
[![Daytona H100](https://img.shields.io/badge/GPU-Daytona%20H100-111111)](./daytona.md)
[![Fireworks](https://img.shields.io/badge/LLM-Fireworks-FF5A00)](./fireworks.md)
[![CopilotKit](https://img.shields.io/badge/UI-CopilotKit-7C3AED)](./dashboard/README.md)
[![Docs](https://img.shields.io/badge/docs-DOCS.md-blue)](./DOCS.md)

**One integrated research system** — not three disconnected demos.

Pull gut-derived pathogen AMR + virulence tables from [BV-BRC](https://www.bv-brc.org),
embed and cluster proteins on a **Daytona H100**, narrate findings with
**Fireworks** under strict grounding rules, score faithfulness (Braintrust-shaped
eval), and interrogate the results in **CopilotKit** dashboards.

**Research prototype. Not for clinical use.**

| | |
|---|---|
| **Repo** | https://github.com/johnqh/daytona_hackathon |
| **Product surface** | [`dashboard/`](./dashboard/) — Next.js + CopilotKit + Fireworks |
| **Agent surface** | [`pathogen-pathfinder/`](./pathogen-pathfinder/) — CopilotKit + Claude on the same contracts |
| **Cohort** | 240 pinned genomes · 6 organisms · **34,466 proteins** |
| **GPU (measured)** | **93.0s** on NVIDIA H100 80GB · 370 seq/s · see `data/timing.json` |
| **Full stack** | BV-BRC · **Daytona** · ESM2 · **Fireworks** · Braintrust-shaped eval · **CopilotKit** |

---

## Product story (end-to-end)

```
BV-BRC REST
   │  sp_gene · genome_amr (Laboratory Method) · sequences
   ▼
Daytona H100  ── ESM2 t12_35M + KMeans ──►  Contract 1  (cluster_summary.json)
   │                                         timing.json · gene_clusters.csv
   ▼
enrichment.py ── honesty gate ──► cluster_enrichment.json
   │                              (clusters_with_phenotype_signal)
   ▼
Fireworks LLM ── grounded observations ──► Contract 2  (observations.json)
   │              + faithfulness eval      eval/braintrust_results.json
   ▼
┌──────────────────────────────────────────────────────────────┐
│  Integrated UIs on the same contracts                        │
│  • dashboard/           CopilotKit Consult (Fireworks agent) │
│  • pathogen-pathfinder/ CopilotKit + Claude AG-UI agent      │
│  • Insight Uploader/    TanStack research shell              │
└──────────────────────────────────────────────────────────────┘
```

Every stage is meant to run with real keys. Committed `data/` + `insights/` are
a **fixture snapshot** of a completed pipeline run so the UI can boot without
re-billing GPU/LLM — they are not a substitute for the live tool path.

### Headline scientific result (measured)

**Clusters are phenotype-flat.** Resistant/Susceptible splits match the corpus
base rate to within ~11%. ESM2 groups proteins by sequence family; resistance is
an isolate-level trait and does not survive averaging over every annotated protein.

**Enforced in code:** no cluster may be described as “linked to” or “enriched for”
resistance. Gate on `data/cluster_enrichment.json` → `clusters_with_phenotype_signal`
(currently **empty**).

| Stage | Tool | Measured / role |
|---|---|---|
| Ingest | **BV-BRC** | 240 genomes, 34,466 proteins, lab-filtered AMR |
| Embed + cluster | **Daytona H100** + ESM2 | 93.0s embed · 6.9s cluster · k=4 |
| Honesty gate | `enrichment.py` | All clusters flat — no resistance association |
| Narrate | **Fireworks** | Grounded English from Contract 1 only |
| Eval | Braintrust-shaped scorer | Numbers must appear in source stats |
| Interact | **CopilotKit** | Chat must not invent numbers |

---

## Full-stack quickstart (use all the tools)

### 0. Keys

```bash
cp .env.example .env
```

Fill **all** of these for the integrated path:

| Variable | Tool | Required for |
|---|---|---|
| `DAYTONA_API_KEY` | Daytona | H100 ESM2 + clustering |
| `FIREWORKS_API_KEY` | Fireworks | Part B observations + dashboard Consult |
| `BRAINTRUST_API_KEY` | Braintrust | Optional remote logging; faithfulness always written locally |
| `ANTHROPIC_API_KEY` | Claude | `pathogen-pathfinder/` Copilot agent |

Also mirror Fireworks (and optionally Daytona) into the dashboard:

```bash
cd dashboard
cp .env.example .env.local
# FIREWORKS_API_KEY=...
# DAYTONA_API_KEY=...   # sandbox list in UI
# PIPELINE_URL=...      # optional live Contract serve URL
```

### 1. Part A — BV-BRC → Daytona H100

```bash
pip install requests pandas fair-esm torch scikit-learn daytona

python pipeline/bvbrc_fetch.py          # → data/*.csv  (resumable; --fresh to repin)
python pipeline/run_on_daytona.py       # H100 ESM2 + KMeans → cluster_summary.json
python pipeline/enrichment.py           # honesty gate
python pipeline/validate_contract.py    # Contract 1 gate
```

### 2. Part B — Fireworks observations + eval

```bash
pip install -r requirements-step-b.txt

# Prefer the live Fireworks path (fails closed if the key is missing):
python scripts/generate_observations.py \
  --input data/cluster_summary.json \
  --require-fireworks
# → insights/observations.json
# → eval/braintrust_results.json
```

Offline fallback (fixtures / no key) exists as `--offline`, but the **integrated
product path uses Fireworks**.

### 3. Part C — CopilotKit product UI

```bash
cd dashboard
bun install          # or npm install
bun run sync-data    # pull root contracts into dashboard/data/
bun run dev          # http://localhost:3000
```

- Open **Sample dataset** (synced contracts) or **Connect a pipeline** / upload.
- Use **Consult** — CopilotKit agent backed by **Fireworks** (`lib/copilot-runtime.ts`).
- With `DAYTONA_API_KEY` in `.env.local`, Daytona sandbox status is available via
  the dashboard API (`app/api/daytona`).

### 4. Integrated agent surface (same contracts)

```bash
cd pathogen-pathfinder
cp .env.example .env   # ANTHROPIC_API_KEY=...
npm install
npm run dev            # UI + Claude agent on :8000
```

Point **Connect API** at any HTTP endpoint serving Contracts 1 & 2, or load
sample data derived from the same pipeline outputs. Chat uses CopilotKit +
Claude and must call `getPathogenDataset` before answering.

### 5. Research shell (optional)

```bash
cd "Insight Uploader" && npm install && npm run dev
```

Same contracts, TanStack Start workspace UI — useful for upload-first exploration
alongside the CopilotKit surfaces.

---

## Architecture & repo layout

| Path | Role in the integrated system |
|---|---|
| [`pipeline/`](./pipeline/) | **Daytona** + BV-BRC + ESM2 + enrichment + Contract 1 validation |
| [`data/`](./data/) | Pinned cohort + Contract 1 + timing + enrichment gate |
| [`scripts/generate_observations.py`](./scripts/generate_observations.py) | **Fireworks** narration + faithfulness eval |
| [`insights/`](./insights/) | Contract 2 observations |
| [`eval/`](./eval/) | Faithfulness scores (`braintrust_results.json`) |
| [`dashboard/`](./dashboard/) | **Primary product UI** — CopilotKit + Fireworks + Daytona/observations APIs |
| [`pathogen-pathfinder/`](./pathogen-pathfinder/) | CopilotKit + Claude agent on the same contracts |
| [`Insight Uploader/`](./Insight%20Uploader/) | TanStack research shell on the same contracts |
| Specs | [`daytona.md`](./daytona.md) · [`fireworks.md`](./fireworks.md) · [`frontend.md`](./frontend.md) · [`prompt.md`](./prompt.md) |
| Index | [`DOCS.md`](./DOCS.md) |

### Data contracts (the integration glue)

**Contract 1** — `data/cluster_summary.json` (Part A → B/C). Top-level keys are
cluster ids only. Validate: `python pipeline/validate_contract.py`.

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

Refresh the dashboard fixtures after any Part A/B rerun:

```bash
cd dashboard && bun run sync-data
```

---

## The cohort

Pinned in `pipeline/manifest.json` (40 genomes × 6 organisms = 240).

| Organism | taxon_id | Role |
|---|---|---|
| *Escherichia coli* | 562 | resistance + virulence |
| *Klebsiella pneumoniae* | 573 | resistance + virulence |
| *Enterococcus faecium* | 1352 | resistance + virulence |
| *Enterococcus faecalis* | 1351 | resistance + virulence |
| *Clostridioides difficile* | 1496 | resistance + virulence |
| *Helicobacter pylori* | 210 | **virulence only** — never quote resistance stats |

**Phenotype rule:** more lab-measured Resistant than Susceptible → **Resistant**;
else **Susceptible**; no lab AMR → **Unknown**. Intermediate excluded.

---

## How each sponsor tool is used

| Tool | Where it runs | What it does here |
|---|---|---|
| **BV-BRC** | `pipeline/bvbrc*.py` | Source of truth for annotations + lab AMR |
| **Daytona** | `pipeline/run_on_daytona.py`, `dashboard/app/api/daytona` | H100 sandbox for ESM2; optional sandbox visibility in UI |
| **ESM2** | `pipeline/gpu_embedding_cluster.py` | Protein embeddings on GPU |
| **Fireworks** | `scripts/generate_observations.py`, `dashboard` Consult + `/api/observations` | Grounded narration + live CopilotKit agent |
| **Braintrust-shaped eval** | `scripts/generate_observations.py` → `eval/` | Faithfulness: every number must appear in Contract 1 |
| **CopilotKit** | `dashboard/`, `pathogen-pathfinder/` | Conversational UI bound to tools + contracts |

---

## Honesty rules (non-negotiable)

- Never present computational annotations (`sp_gene`) as laboratory measurements.
- **No cluster↔resistance association** unless listed in `clusters_with_phenotype_signal`.
- Never show a percentage without its denominator.
- Never quote a speedup you have not measured — cite `data/timing.json`.
- LLM / Copilot **never invents numbers** — copy from Contract 1/2 or tool results.
- Genomes are not strain-deduplicated by default; outbreak oversampling is real.
- Every screen: **research prototype, not for clinical use.**

Full brief: [`prompt.md`](./prompt.md).

---

## Fixture snapshot vs live rebuild

| | Fixtures in git | Live integrated run |
|---|---|---|
| GPU | `data/timing.json` from a prior H100 run | `DAYTONA_API_KEY` + `run_on_daytona.py` |
| Observations | May be offline-generated | `FIREWORKS_API_KEY` + `--require-fireworks` |
| Consult chat | Needs Fireworks key in `dashboard/.env.local` | Same |
| Claude agent | Needs `ANTHROPIC_API_KEY` | Same |

Always prefer the **live** columns for demos to sponsors.

---

## Known gaps

- Wire remote Braintrust logging when `BRAINTRUST_API_KEY` is set (today the scorer
  writes a Braintrust-shaped JSON locally and records whether the key was present).
- Observations should explicitly state phenotype-flat clusters using
  `cluster_enrichment.json`.
- Delete stale `Insight Uploader.zip` at repo root when convenient.

---

## Attribution

Data from [BV-BRC](https://www.bv-brc.org). Annotations from **CARD**, **NDARO**,
**VFDB**, **PATRIC_VF**. Embeddings from **ESM2** (`esm2_t12_35M_UR50D`, Meta AI).
Show the pinned cohort date from `pipeline/manifest.json` in the UI.

More: [ABOUT.md](./ABOUT.md) · [SECURITY.md](./SECURITY.md) · [CITATION.cff](./CITATION.cff) · [DOCS.md](./DOCS.md)
