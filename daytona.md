# Daytona — Data Pipeline, Analysis, and Serving

**Owner: backend/data.** You produce the numbers everything else displays.
**All facts verified live 2026-07-24.** See [prompt.md](./prompt.md) for the brief.

Your deliverable is a public HTTPS endpoint serving co-occurrence and resistance
statistics as JSON, backed by a pinned genome cohort.

---

## 1. The decision that makes the timeline possible

**Do not run genome annotation. Do not download genome sequences. Do not train
a model.** Any of these consumes the whole hackathon.

BV-BRC has already run the annotation. The `sp_gene` collection holds
precomputed resistance-gene, virulence-factor, and drug-target calls for every
genome, sourced from CARD, VFDB, NDARO, PATRIC_VF, BacMet, and DrugBank. The
`genome_amr` collection holds laboratory-measured susceptibility results. Both
are structured tables over REST returning JSON or CSV.

Pipeline: **pull tables → compute co-occurrence → serve JSON.** Minutes, not hours.

---

## 2. The data

### 2.1 Target organisms (verified lab-AMR row counts)

| Organism | taxon_id | Lab-measured AMR rows |
|---|---|---|
| *E. coli* | 562 | 243,124 |
| *K. pneumoniae* | 573 | 85,291 |
| *E. faecium* | 1352 | 25,635 |
| *C. difficile* | 1496 | 5,811 |
| *E. faecalis* | 1351 | 3,384 |

**Drop *H. pylori*.** Only **265** lab-measured AMR rows. If you want it for the
gut-health framing, use it on the virulence side only (1,215,087 `sp_gene` rows)
and never quote a resistance statistic for it.

### 2.2 `sp_gene` — precomputed annotations

Verified `property` vocabulary, *K. pneumoniae*:

| property | rows |
|---|---|
| Transporter | 37,255,158 |
| Drug Target | 13,857,358 |
| Virulence Factor | 9,855,510 |
| Antibiotic Resistance | 7,114,647 |
| Metal Resistance | 3,383,210 |
| **Virulance factor** *(sic)* | 2,799,407 |
| Human Homolog | 196,054 |

> **Trap:** `Virulence Factor` and `Virulance factor` are **two separate values**
> in the same field. Filtering only the correct spelling silently discards **22%**
> of virulence annotations. Match case-insensitively on both. Assume the same
> class of typo exists elsewhere — **facet before you filter.**

Sources: TCDB, DrugBank, Victors, TTD, PATRIC_VF, VFDB, CARD, BacMet, PATRIC,
NDARO, Human, ARDB. **Use `CARD` and `NDARO` for resistance, `VFDB` and
`PATRIC_VF` for virulence.** Ignore TCDB and DrugBank — they are most of the rows
and are not what you are analysing.

Fields: `genome_id`, `genome_name`, `property`, `source`, `gene`, `product`,
`identity`, `query_coverage`, `e_value`, `patric_id`.

### 2.3 `genome_amr` — lab susceptibility

**Always filter `evidence == "Laboratory Method"`.** The collection holds
17,266,649 rows; only **1,284,851** are lab-measured. The other ~15.9M are
BV-BRC's own computational predictions. Presenting those as lab data would be
false.

Keep only `Resistant` and `Susceptible`. Drop `Intermediate`.

### 2.4 API gotchas — read before writing a query

Each of these costs ~20 minutes if you find it live.

- **Hard 25,000-row cap.** `limit(50000)` silently returns 25,000, with no error.
  Page with `sort()` + cursor, or scope tightly.
- **Scope by genome, not species.** *E. coli* has **286,973,774** `sp_gene` rows.
  Select a few hundred genomes first, then `in(genome_id,(...))`.
- **Faceting needs a base query term** plus `application/solr+json`:
  `?eq(taxon_id,573)&facet((field,property),(limit,12))&limit(1)`.
  Add `json(nl,map)` for a dict instead of a flat array.
- **Facet sort is locked to index order.** `(sort,count)` is ignored — pass
  `(limit,-1)` and sort client-side for a true top-N.
- **`genome_amr` has no `species` field** — only `taxon_id` and `genome_name`.
  `species` lives on the `genome` collection.
- **URL-encode slashes in drug names** (`trimethoprim%2Fsulfamethoxazole`) or the
  query silently returns zero rows.
- **Counts come from the `Content-Range` header** — `limit(1)` with `curl -D -`.
- `&http_accept=text/csv` gives CSV straight into pandas.

Working example:

```bash
curl -s "https://www.bv-brc.org/api/sp_gene/?and(eq(genome_id,573.5781),eq(source,CARD))&select(genome_id,gene,product,property,identity)&limit(25000)&http_accept=text/csv"
```

**Write and test every query in the first 30 minutes.** Pin the resulting genome
IDs to a manifest file so the cohort cannot shift mid-demo.

---

## 3. Analysis

### 3.1 What to compute

Build a genome × gene presence/absence matrix from `sp_gene`, then:

- Pairwise co-occurrence between resistance determinants — lift, Jaccard, Fisher
  exact p-value with FDR correction.
- Co-occurrence between resistance determinants and virulence factors.
- Association between gene presence and lab phenotype from `genome_amr`.
- A co-occurrence network for the graph view; optionally UMAP over the matrix.

Seconds to minutes on CPU with pandas and scipy.

### 3.2 The confounding trap — the most important section here

*"78% of mcr-1-carrying Klebsiella also carry virulence cluster X"* is, by
default, **not a biological finding**. Two artefacts produce it:

1. **Clonal expansion.** Public databases are wildly oversampled for outbreak
   strains. If one clone was sequenced 400 times, every gene it carries appears
   perfectly correlated with every other gene it carries.
2. **Physical linkage.** Resistance genes ride on plasmids and transposons. Genes
   on the same mobile element co-occur because they are physically joined — real,
   but a statement about one plasmid, not about biology at large.

**Do at least the first of these:**

- **Deduplicate by strain before counting.** At minimum collapse genomes with
  identical resistance-gene profiles; better, group by MLST or clonal complex
  from metadata. Report raw **and** deduplicated counts and let the gap show.
- Check whether a pair spans multiple `isolation_country` values and multiple
  collection years. Confined to one country and one year = outbreak, not pattern.
- Every co-occurrence must carry the number of **distinct strains** supporting
  it, not the row count.

Skipping this makes your headline number an artefact, and any microbiologist on
the panel will find it in one question. It costs ~15 minutes and converts the
weakest part of the project into the most defensible.

### Citations, for when a judge pushes back

Have these ready. They are the difference between "we thought about confounding"
and "here is the literature on why this matters."

- **Hu et al. 2024, *Brief Bioinform* 25(3):bbae206** — 31,195 genomes, 11 species,
  78 species–antibiotic datasets. Changing *only the split*, the fraction of
  datasets reaching F1-macro ≥0.9 falls **64% (random) → 33% (phylogeny-aware) →
  25% (homology-aware)**. The method ranking also inverts: under proper splits a
  rule-based gene-catalogue lookup (ResFinder) *beats* every ML method.
- **Moradigaravand et al. 2018, *PLOS Comput Biol* 14:e1006258** — population
  structure features **alone** give 0.79 accuracy on *E. coli* resistance, versus
  0.91 with full genomic data. Most of the apparent signal is lineage.
- **Young et al. 2021, *Microb Genom*** — *S. aureus* bacteraemia vs. carriage,
  1,017 + 984 genomes: heritability **2.1% (95% CI 0.0–5.3%)**. Their conclusion:
  *"All S. aureus lineages are equally capable of causing bloodstream infection."*
- **The sharpest illustration:** *N. meningitidis* invasive vs. carriage scored
  **90.2% accuracy, AUROC 0.968** with no clade holdout (Podda 2024), while a
  phylogeny-aware method on the same phenotype found **one gene and one SNP**
  (Eriksson 2023).

The honest framing to offer proactively: *"co-occurrence in clonal organisms is
confounded by lineage and plasmid linkage, so we report deduplicated strain
counts and flag single-country patterns rather than quoting raw percentages."*
Saying it before you are asked is worth more than any accuracy number.

### 3.3 The H100 — read before committing to the GPU story

The obvious plan — embed known AMR proteins with ESM2 and cluster them — **is
close to circular and will not survive scrutiny.** Those proteins already carry
curated CARD/VFDB identifiers. Clustering their embeddings mostly recovers the
gene families the labels already state, so the GPU produces a figure adding no
information the annotation did not already provide.

**A defensible GPU story instead:** embed the **unannotated** proteins — the ones
BV-BRC labels "hypothetical protein" — and find those sitting close to known
resistance proteins in ESM2 embedding space. Annotation is BLAST-based and misses
distant homologs; a protein language model finds them. That is genuine candidate
discovery, it legitimately needs a GPU because it runs over millions of proteins,
and the narrative is sharp: *"standard annotation missed these; the embedding
model surfaced them as candidates."*

Present them as **candidates requiring validation**, never as confirmed genes.

Use `esm2_t12_35M` or `esm2_t33_650M`. Pull sequences from `genome_feature` with
the `aa_sequence` field, or the `.PATRIC.faa` FTP file.

**If short on time, cut the GPU entirely.** A dashboard with honest,
lineage-corrected statistics and a good conversational interface beats one with a
GPU figure a judge can dismantle. **Decide at the 2-hour mark, not at 3:30.**

---

## 4. Daytona platform

### 4.1 Verified facts

Cloud sandbox runtime for agent workloads. **`github.com/daytonaio/daytona` was
frozen in June 2026** with development moved private — do not use the repo as an
API reference. Current SDKs: `pip install daytona` (0.200.2), `npm install
@daytona/sdk` (0.200.1).

```python
from daytona import Daytona, DaytonaConfig
daytona = Daytona(DaytonaConfig(api_key=os.environ["DAYTONA_API_KEY"]))
sandbox = daytona.create()
sandbox.process.exec("python analyze.py")
```

Method names differ by language: Python `sandbox.process.exec(...)`, TypeScript
`sandbox.process.executeCommand(...)`. Files via `sandbox.fs` — `upload_file`,
`download_file`, `upload_files`, `list_files`.

### 4.2 Resource limits — these drive your architecture

| | CPU sandbox | GPU sandbox |
|---|---|---|
| vCPU | **max 4** | up to 16 |
| RAM | **max 8 GiB** | up to 192 GB |
| Disk | **max 10 GiB** | up to 512 GB |
| Filesystem on stop | persists | **deleted — ephemeral** |

GPU types: `H100`, `H200`, `RTX-PRO-6000`, `RTX-4090`, `RTX-5090`. `gpu=1` is the
per-sandbox max. Cost: H100 $3.95/hr, H200 $4.54/hr, RTX-4090 $0.99/hr; CPU ~$0.33/hr
at 4 vCPU + 8 GiB. **New accounts get $200 free credits.** GPU region pinning is
documented as ignored due to scarcity — do not depend on a region.

> **Critical:** GPU sandbox filesystems are **deleted on stop**. Write embeddings
> and results to a **Volume** (S3-backed FUSE mount, persists across deletion,
> shareable between sandboxes, does not count against storage quota) or you lose
> the work when the sandbox stops.

> **Critical:** `auto_stop_interval` **defaults to 15 minutes and fires even
> while your job is running.** Set it to `0` on anything doing real work, or call
> `sandbox.refresh_activity()` externally.

### 4.3 Long-running jobs

```python
sandbox.process.create_session("embed")
cmd = sandbox.process.execute_session_command(
    "embed", SessionExecuteRequest(command="python embed.py", run_async=True))
sandbox.process.get_session_command_logs("embed", cmd.cmd_id)
```

### 4.4 Exposing the API

```python
pv = sandbox.get_preview_link(8000)
pv.url     # https://8000-{sandboxId}.proxy.daytona.work
pv.token   # only needed if the sandbox is private
```

**Create the serving sandbox with `public=True`** so the frontend can call it
without an auth header. `create_signed_preview_url(port, expires_in_seconds)`
exists but defaults to a **60-second** expiry — set it explicitly.

CORS and WebSocket behaviour through the preview proxy are **not documented**.
Your FastAPI app must set its own CORS headers. **Verify a real browser call
end-to-end in the first hour**, not at demo time.

### 4.5 Image

```python
image = (Image.debian_slim("3.11")
    .pip_install(["pandas", "scipy", "scikit-learn", "networkx",
                  "umap-learn", "fastapi", "uvicorn", "requests"]))

sandbox = daytona.create(
    CreateSandboxFromImageParams(
        image=image,
        resources=Resources(cpu=4, memory=8, disk=10),
        public=True,
        auto_stop_interval=0),
    timeout=0, on_snapshot_create_logs=print)
```

Images cache for 24 hours. **Tags must be pinned** — `latest`, `lts`, `stable`
are rejected. Add `torch` and `fair-esm` only to the GPU image; keep the CPU
analysis image light so it builds fast.

---

## 5. Serving contract

```
GET  /cohort                     → organisms, genome counts, pinned date
GET  /cooccurrence?organism=&min_support=
     → { pairs: [ { gene_a, gene_b, lift, jaccard, p_adj,
                    n_genomes_raw, n_strains_dedup,
                    n_countries, year_range } ] }
GET  /resistance-profile?organism=
     → per-drug R/S counts, lab-measured AST only
GET  /candidates                 → GPU-derived candidates, if run
GET  /healthz
```

**Every statistic returns both `n_genomes_raw` and `n_strains_dedup`.** The
frontend displays the deduplicated number by default. This contract is what makes
the honesty guarantees enforceable downstream.

---

## 6. Traps

1. Filtering `Virulence Factor` only, losing 22% of rows to the typo variant.
2. Using `Computational Method` rows and calling them lab data.
3. The silent 25,000-row cap.
4. Querying `sp_gene` species-wide — *E. coli* is 287M rows.
5. **Reporting co-occurrence without lineage deduplication.** The one that
   invalidates your science.
6. Quoting resistance statistics for *H. pylori* (265 rows).
7. `auto_stop_interval` at its 15-minute default, killing a running job.
8. GPU filesystem deleted on stop — embeddings lost if not on a Volume.
9. Not verifying browser→preview-URL CORS until the demo.
