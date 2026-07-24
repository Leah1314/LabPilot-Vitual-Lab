# Part A — Data Pipeline & GPU Processing

Owner: Part A. Produces the four CSVs and `data/cluster_summary.json` (Contract 1).

## Run order

```bash
pip install requests pandas fair-esm torch scikit-learn daytona

python pipeline/bvbrc_fetch.py          # BV-BRC -> data/*.csv       (~5 min)
export DAYTONA_API_KEY=...
python pipeline/run_on_daytona.py       # ESM2 + KMeans on H100      (~5 min)
```

`bvbrc_fetch.py` resumes: any CSV already in `data/` is reused. Pass `--fresh`
to refetch everything and re-pin the cohort.

Then measure signal and gate the handoff to Part B:

```bash
python pipeline/enrichment.py         # -> data/cluster_enrichment.json
python pipeline/validate_contract.py
```

The sandbox cannot reach `dl.fbaipublicfiles.com` — the ESM2 download dies with
`[Errno 104] Connection reset by peer`. `run_on_daytona.py` therefore fetches
the weights locally and pushes them to the volume, which persists across
sandbox deletion, so this is a one-time cost.

### CPU fallback

The embedding step falls back to CPU automatically, but **measured at ~5 seq/s**,
so the full 34,466 sequences would take roughly two hours. If Daytona is
unavailable, cut the workload instead:

```bash
python pipeline/gpu_embedding_cluster.py --limit 3000   # ~10 min on CPU
```

Do not load ESM2 through `torch.hub.load("facebookresearch/esm:main", ...)`. It
calls the GitHub API to validate the repo and fails with `HTTP 403: rate limit
exceeded` from shared and cloud IPs. `esm.pretrained.<model>()` is used instead
and pulls weights from `dl.fbaipublicfiles.com`. Weights cache under
`TORCH_HOME`, which the Daytona run points at a persistent volume so a re-run
does not redownload them.

## The cohort

Pinned in `pipeline/manifest.json` — 40 genomes per organism, 240 total. For the
five AMR organisms genomes are ranked by how many lab-measured antibiotic
results they carry, so the phenotype label rests on real testing rather than a
single MIC. *H. pylori* is virulence-only: it has 265 lab-measured AMR rows
against *K. pneumoniae*'s 85,291, so **never quote a resistance statistic for
it**.

The manifest is written once and reused. That is deliberate — the cohort must
not shift between the pipeline run and the demo.

## BV-BRC API traps, all hit and fixed in `bvbrc.py`

| Trap | Symptom | Fix |
|---|---|---|
| 25,000-row hard cap | `limit(50000)` returns 25,000, HTTP 200, no warning | page via `paged()` with a stable `sort()` |
| Space in a literal | `400 Illegal character in query string encountered` | percent-encode: `eq(evidence,%22Laboratory%20Method%22)` |
| Pipe in `patric_id` | `400 query.args[1].join is not a function` | percent-encode values in `in(...)`; quoting does **not** work |
| `aa_sequence` unreachable | `select(aa_sequence)` silently omits the field | two-hop join: `genome_feature.aa_sequence_md5` → `feature_sequence.md5` |
| Long id lists | URL length limits on GET | all queries issued as POST with RQL in the body |
| Virulence typo | `Virulance factor` is a separate value from `Virulence Factor` | filter by `source`, normalise `property` client-side |
| Computational rows | 15.9M of 17.3M `genome_amr` rows are predictions | always `eq(evidence,%22Laboratory%20Method%22)` |

## Phenotype labelling

`genome_amr` gives one result per genome per antibiotic; the cluster summary
needs one label per gene. The rule, stated so nobody has to guess:

> A genome is **Resistant** when it has more Resistant than Susceptible
> lab-measured results, otherwise **Susceptible**. Genomes with no lab AMR data
> are **Unknown** and counted as neither. Intermediate results are excluded.

Raw counts (`n_resistant`, `n_susceptible`) are carried through `sequences.csv`
so no downstream consumer has to quote a label without its denominator. The rule
and its caveats are also written to `data/cohort_meta.json`.

## Outputs

| File | Consumer | Notes |
|---|---|---|
| `data/bvbrc_amr.csv` | — | lab-measured AST, cohort genomes only |
| `data/bvbrc_spgene.csv` | — | CARD/NDARO/VFDB/PATRIC_VF gene calls |
| `data/bvbrc_metadata.csv` | — | host, source, country, year, MLST |
| `data/sequences.csv` | stage 2 | `gene_id, sequence, species, resistant_phenotype, product` |
| `data/cluster_summary.json` | **Part B** | Contract 1. Top-level keys are cluster ids and nothing else |
| `data/cohort_meta.json` | Part C | cohort size, phenotype rule, caveats, attribution |
| `data/timing.json` | Part C | the GPU headline number — quote this, not a remembered figure |
| `data/gene_clusters.csv` | — | per-gene cluster assignment, for spot-checking |

`cluster_summary.json` deliberately carries **no** `_meta` key, so Part B can
iterate `summary.items()` directly without filtering. Metadata lives in
`cohort_meta.json`.

## Measured result — the clusters carry no resistance signal

Run on the real cohort: **34,466 proteins embedded in 93.0s on an NVIDIA H100**
(370 seq/s), clustered into k=4. Then `pipeline/enrichment.py` asked the
question that actually matters — do the clusters separate resistant from
susceptible isolates? They do not:

| cluster | n_genes | max phenotype deviation | verdict |
|---|---|---|---|
| 0 | 12,497 | 0.075 | flat |
| 1 | 5,804 | 0.081 | flat |
| 2 | 13,238 | 0.112 | flat |
| 3 | 2,927 | 0.084 | flat |

Every cluster's Resistant/Susceptible split reproduces the corpus base rate to
within ~10%. Species enrichment is also mild (0.42–1.46), and the strongest of
those is *H. pylori* at 1.46x in cluster 2 — which is an artefact of *H. pylori*
being the virulence-only organism, not a finding.

**So: no cluster may be described as associated with resistance.** Not "linked
to", not "enriched for", not "suggests". `data/cluster_enrichment.json` records
this per cluster and exposes `clusters_with_phenotype_signal`, which is
currently empty — Part B should gate any association language on that list, and
the eval should treat a resistance claim about a flat cluster as a failure.

This is a real result, not a broken pipeline. ESM2 embeds proteins by sequence
and structure, so it groups by protein family; resistance phenotype is a
property of the *isolate*, carried by a handful of specific genes, and it does
not survive averaging over every annotated protein in a genome. Reporting it
plainly is far stronger than a cluster chart implying a link the numbers refuse
to support — and it is exactly the kind of negative control a microbiologist on
the panel will look for.

## Clustering caveats — read before quoting a cluster

**The clusters are weakly separated.** On a 600-protein smoke test the best
silhouette score was 0.119, and k=4 through k=12 all scored between 0.08 and
0.12. That is normal for protein language model embeddings over a functionally
diverse set, but it means **k selection is close to arbitrary** — do not present
the chosen k as a discovered natural number of groups. `data/timing.json`
records the full silhouette-by-k table, so the honest framing is available:
these are a convenient grouping of embedding space, not discrete biological
families.

**The clustering is partly circular by construction.** Every protein here
already carries a curated CARD/NDARO/VFDB/PATRIC_VF identifier, so clustering
their embeddings largely recovers gene families the annotation already states.
It is a legitimate way to organise and summarise the cohort; it is not gene
discovery. If a judge presses on what the GPU added, that is the answer. The
non-circular version — embedding *unannotated* proteins to surface candidates
BLAST missed — is described in `daytona.md §3.3` and is a stretch goal, not
what this pipeline currently does.

## What this analysis is and is not

`sp_gene` calls are **computational annotations**, not laboratory measurements —
BLAST-family hits against CARD/VFDB. `genome_amr` rows filtered to
`Laboratory Method` **are** lab measurements. Never blur the two.

Genomes are **not deduplicated by strain**. Public genome databases are heavily
oversampled for outbreak strains, so a cluster that looks concentrated in one
species or phenotype may reflect clonal oversampling rather than biology. If a
judge asks about confounding, this is the honest answer, and
`data/bvbrc_metadata.csv` carries `isolation_country`, `collection_year` and
`mlst` if there is time to quantify it.

Attribution: data from [BV-BRC](https://www.bv-brc.org), annotations from CARD,
NDARO, VFDB and PATRIC_VF. Show the pinned date from `manifest.json` in the UI.
