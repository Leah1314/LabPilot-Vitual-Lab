# Gut-to-Pancreas Pathogen AMR Dashboard

Real antimicrobial-resistance and virulence data for the gut-derived pathogens that
cause infected pancreatic necrosis, pulled from BV-BRC, embedded on a GPU, narrated
by an LLM under strict grounding rules, and served in an interactive dashboard.

**Research prototype. Not for clinical use.**

---

## What actually runs, and what it measured

Every number below was measured on this repo's data, not estimated. Nothing here
is a projection.

| Stage | Result |
|---|---|
| BV-BRC pull | 240 pinned genomes, 6 organisms, **34,466 proteins**, 117s |
| ESM2 embedding | **34,466 proteins in 93.0s on an NVIDIA H100 80GB** (370 seq/s) |
| Same job on CPU | 5 seq/s measured — the GPU is doing real work |
| Clustering | k=4 by silhouette (0.1271), 6.9s |
| Observations | 4 grounded observations, mean faithfulness 1.0 (n=4) |
| Frontend | builds clean, 6 routes serve HTTP 200 with real data |

### The headline finding is a negative result

**The clusters carry no resistance signal.** Enrichment is the share within a
cluster divided by the share across the whole corpus, so 1.0 means "identical to
background":

| cluster | n_genes | max phenotype deviation | verdict |
|---|---|---|---|
| 0 | 12,497 | 0.075 | flat |
| 1 | 5,804 | 0.081 | flat |
| 2 | 13,238 | 0.112 | flat |
| 3 | 2,927 | 0.084 | flat |

Every cluster's Resistant/Susceptible split reproduces the corpus base rate to
within 11%. This is the correct result, not a broken pipeline: ESM2 embeds
proteins by sequence and structure, so it groups by **protein family**, whereas
resistance is a property of the **isolate**, carried by a handful of specific
genes. It does not survive averaging over every annotated protein in a genome.

Consequence, enforced in code rather than left as advice: **no cluster may be
described as "linked to" or "enriched for" resistance.**
`data/cluster_enrichment.json` exposes `clusters_with_phenotype_signal`, which is
the gate for any association language and is **currently empty**. The frontend
imports it as `clusterEnrichment`.

Reported plainly, this is a negative control you ran and disclosed — considerably
stronger than a cluster chart implying a link the arithmetic refuses to support.

---

## Quickstart

```bash
# 1. Data + GPU pipeline (Part A)
pip install requests pandas fair-esm torch scikit-learn daytona
cp .env.example .env          # fill in DAYTONA_API_KEY
python pipeline/bvbrc_fetch.py            # BV-BRC -> data/*.csv    (~2 min)
python pipeline/run_on_daytona.py         # ESM2 + KMeans on H100   (~4 min)
python pipeline/enrichment.py             # signal check -> the honesty gate
python pipeline/validate_contract.py      # Contract 1 gate before handoff

# 2. Observations + eval (Part B)
pip install -r requirements-step-b.txt
export FIREWORKS_API_KEY=...
python scripts/generate_observations.py --input data/cluster_summary.json
#   ...or without a key, deterministic and still fully grounded:
python scripts/generate_observations.py --input data/cluster_summary.json --offline

# 3. Dashboard (Part C)
cd "Insight Uploader" && npm install && npm run dev
```

`bvbrc_fetch.py` resumes — any CSV already in `data/` is reused. Pass `--fresh` to
refetch and re-pin the cohort.

---

## Architecture

```
BV-BRC REST API
      │  sp_gene, genome_amr, genome, genome_feature, feature_sequence
      ▼
pipeline/bvbrc_fetch.py ──────────► data/*.csv, pipeline/manifest.json
      │                                   (cohort pinned, cannot drift)
      ▼
pipeline/run_on_daytona.py
      │  uploads sequences.csv to a Daytona H100 sandbox
      ▼
pipeline/gpu_embedding_cluster.py ─► data/cluster_summary.json   (Contract 1)
      │  ESM2 t12_35M inference + KMeans                data/timing.json
      ▼
pipeline/enrichment.py ───────────► data/cluster_enrichment.json (honesty gate)
      │
      ▼
scripts/generate_observations.py ─► insights/observations.json   (Contract 2)
      │  Fireworks, or deterministic offline       eval/braintrust_results.json
      ▼
Insight Uploader/  (TanStack Start + React)
```

---

## Repo layout

| Path | What it is | Owner |
|---|---|---|
| `pipeline/` | BV-BRC fetch, ESM2 + KMeans, Daytona runner, enrichment, contract gate | Part A |
| `data/` | the real dataset and its outputs | Part A |
| `scripts/generate_observations.py` | statistics → grounded English | Part B |
| `insights/`, `eval/` | observations and faithfulness scores | Part B |
| `Insight Uploader/` | TanStack Start dashboard, wired to real data | Part C |
| `dashboard/` | second frontend, Next.js + CopilotKit | Part C |
| `prompt.md`, `daytona.md`, `fireworks.md`, `frontend.md` | workstream specs | — |

Two frontends exist. `Insight Uploader/` is the one currently wired to real Part A
output; `dashboard/` is a separate Next.js + CopilotKit app with its own fixtures
under `dashboard/data/`. Pick one for the demo.

---

## Data contracts

**Contract 1** — `data/cluster_summary.json`, Part A → Part B and Part C. Top-level
keys are cluster ids as strings and **nothing else**, so consumers can iterate it
directly. Validate with `python pipeline/validate_contract.py`.

```json
{ "0": { "n_genes": 12497,
         "example_genes": ["fig|1351.1163.peg.1570"],
         "top_products": {"Translation elongation factor Tu": 180},
         "resistant_phenotype_breakdown": {"Resistant": 7390, "Susceptible": 3935, "Unknown": 1172},
         "species_breakdown": {"Escherichia coli": 5604} } }
```

**Contract 2** — `insights/observations.json`, Part B → Part C:

```json
{ "generated_at": "...",
  "clusters": [ { "cluster_id": "0", "headline": "...", "observation": "...",
                  "confidence": "medium", "eval_score": 1.0,
                  "supporting_gene_count": 12497 } ] }
```

The frontend's `ClusterSummaryEntry` type in
`Insight Uploader/src/lib/data-sources.ts` matches Contract 1 field-for-field, so
no translation layer exists or is needed.

---

## The cohort

Pinned in `pipeline/manifest.json` — 40 genomes per organism, 240 total, written
once and reused so the cohort cannot shift between the pipeline run and the demo.

| Organism | taxon_id | role |
|---|---|---|
| *Escherichia coli* | 562 | resistance + virulence |
| *Klebsiella pneumoniae* | 573 | resistance + virulence |
| *Enterococcus faecium* | 1352 | resistance + virulence |
| *Enterococcus faecalis* | 1351 | resistance + virulence |
| *Clostridioides difficile* | 1496 | resistance + virulence |
| *Helicobacter pylori* | 210 | **virulence only** |

For the five AMR organisms, genomes are ranked by how many lab-measured antibiotic
results they carry, so the phenotype label rests on real testing rather than a
single MIC. *H. pylori* has **265** lab-measured AMR rows against *K. pneumoniae*'s
85,291 — it rides along for the gut-health framing, and **no resistance statistic
may be quoted for it**.

### Phenotype labelling

`genome_amr` gives one result per genome per antibiotic; the cluster summary needs
one label per gene. The rule, stated so nobody has to guess:

> A genome is **Resistant** when it has more Resistant than Susceptible
> lab-measured results, otherwise **Susceptible**. Genomes with no lab AMR data are
> **Unknown** and counted as neither. Intermediate results are excluded.

Raw counts (`n_resistant`, `n_susceptible`) ride along in `data/sequences.csv` so
nothing downstream has to quote a label without its denominator.

---

## Honesty rules

These are the difference between a project that survives Q&A and one that does not.

- **Never present computational predictions as laboratory measurements.** `sp_gene`
  calls are BLAST-family annotations from CARD/NDARO/VFDB/PATRIC_VF. `genome_amr`
  rows filtered to `evidence == "Laboratory Method"` *are* lab measurements — and
  15.9M of the 17.3M rows in that collection are BV-BRC's own predictions, so the
  filter is not optional.
- **No cluster is associated with resistance.** Gate on
  `clusters_with_phenotype_signal`; it is empty.
- **Never show a percentage without its denominator.**
- **Never quote a speedup you have not measured.** The measured numbers are 93.0s
  on H100 and 5 seq/s on CPU. `data/timing.json` is the source of truth — quote it,
  not memory.
- **Genomes are not deduplicated by strain.** Public genome databases are heavily
  oversampled for outbreak strains, so a concentrated cluster may reflect clonal
  oversampling. `data/bvbrc_metadata.csv` carries `isolation_country`,
  `collection_year` and `mlst` if there is time to quantify it. Saying this before
  being asked is worth more than any accuracy number.
- **The clustering is partly circular by construction.** Every protein here already
  carries a curated CARD/VFDB identifier, so clustering their embeddings largely
  recovers families the annotation already states. It organises the cohort; it is
  not gene discovery.
- **k selection is near-arbitrary.** Best silhouette was 0.1271, with k=4..12 all
  between 0.087 and 0.127. Do not present the chosen k as a discovered natural
  number of groups. `data/timing.json` records the full silhouette-by-k table.

---

## Known gaps

- **Fireworks has not been exercised.** No `FIREWORKS_API_KEY` was available, so
  observations were generated with `--offline`, a deterministic grounded path.
  Every number in the prose is copied verbatim from the cluster summary, but the
  LLM path itself is untested. Set the key and re-run without `--offline`.
- **Braintrust has not been exercised.** `eval/braintrust_results.json` reports
  `braintrust_api_key_present: false` and `mean_faithfulness: 1.0` over n=4 — a
  local scorer, not a Braintrust run. A panel reporting 100% on everything reads as
  untested; add deliberate failure cases and show the eval catching them.
- **Observations do not yet flag the flat enrichment.** They are grounded and quote
  real numbers, but none says "this cluster does not distinguish resistant from
  susceptible isolates." That sentence should come from
  `data/cluster_enrichment.json`.
- **`Insight Uploader.zip`** at the repo root is a stale duplicate of
  `Insight Uploader/` and can be deleted.

---

## Traps already paid for

Each of these cost real time. They are handled in code — do not re-discover them.

**BV-BRC API** (`pipeline/bvbrc.py`)

| Trap | Symptom | Fix |
|---|---|---|
| 25,000-row hard cap | `limit(50000)` returns 25,000, HTTP 200, no warning | page via `paged()` with a stable `sort()` |
| Space in a literal | `400 Illegal character in query string` | percent-encode: `eq(evidence,%22Laboratory%20Method%22)` |
| Pipe in `patric_id` | `400 query.args[1].join is not a function` | percent-encode values in `in(...)`; quoting does **not** work |
| `aa_sequence` unreachable | `select(aa_sequence)` silently omits it | two-hop join: `genome_feature.aa_sequence_md5` → `feature_sequence.md5` |
| Long id lists | URL length limits on GET | issue every query as POST with RQL in the body |
| Virulence typo | `Virulance factor` is a separate value from `Virulence Factor` | filter by `source`, normalise `property` client-side |

**Daytona** (`pipeline/run_on_daytona.py`)

- GPU sandboxes **must** be ephemeral: `auto_delete_interval=0`, or creation is
  hard-rejected.
- `auto_stop_interval` defaults to 15 minutes and **fires mid-job**. Set it to 0.
- The **4 vCPU / 8 GiB cap applies to GPU sandboxes too**, despite the platform docs
  quoting up to 16 vCPU / 192 GB.
- GPU sandbox filesystems are **deleted on stop**. Results are downloaded before
  teardown; ESM2 weights live on a persistent Volume.
- The sandbox **cannot reach `dl.fbaipublicfiles.com`** — the ESM2 download dies
  with `[Errno 104] Connection reset by peer`. Weights are fetched locally and
  pushed to the Volume, a one-time cost.
- `get_session_command_logs` returns a `SessionCommandLogsResponse`, not a string;
  read `.output`.
- Do **not** load ESM2 via `torch.hub.load("facebookresearch/esm:main", ...)` — it
  calls the GitHub API and 403s from shared and cloud IPs. Use
  `esm.pretrained.<model>()`.

Image builds cache for 24h: first sandbox took 160s, subsequent ones **1s**.

---

## Attribution

Data from [BV-BRC](https://www.bv-brc.org), publicly funded and freely available.
Annotations from **CARD**, **NDARO**, **VFDB** and **PATRIC_VF**, each with its own
terms. Protein embeddings from **ESM2** (`esm2_t12_35M_UR50D`, Meta AI). Show the
pinned cohort date from `pipeline/manifest.json` in the UI.

Every screen must carry: **research prototype, not for clinical use.**
