# BV-BRC Gut-to-Pancreas Pathogen AMR Dashboard
## Full Build Planner — For Coding Agent Execution
### Hackathon time budget: 3.5–4 hours, 3 parallel workstreams

---

## 0. Project Summary (read this first)

**Problem**: Labs manually correlating antimicrobial-resistance (AMR) genes and virulence
factors across pathogen genomes — or doing it by hand-feeding data to GPT one query at a
time — takes ~100 hours of researcher time.

**Solution**: Pull real structured pathogen data from BV-BRC (Bacterial and Viral
Bioinformatics Resource Center), run GPU-accelerated protein embedding + clustering on
Daytona (H100), generate natural-language research observations with Fireworks AI,
validate those observations with Braintrust, and present everything in an interactive
CopilotKit-powered dashboard. Target: full pipeline run in ~2 hours instead of ~100.

**Clinical framing**: Infected pancreatic necrosis (a common complication of severe
pancreatitis) is typically caused by gut-derived bacteria translocating into the
pancreas. ICU clinicians often choose empiric antibiotics without strong resistance-
pattern context. This tool gives them a fast, data-grounded view.

**Target pathogens** (do not change mid-hackathon — lock this list at kickoff):
- *Escherichia coli*
- *Klebsiella pneumoniae*
- *Enterococcus faecium*
- *Enterococcus faecalis*
- *Clostridioides difficile*
- *Helicobacter pylori*

---

## 1. Architecture & Data Contracts (all 3 teammates must read this section)

This is the glue that lets 3 people work in parallel without blocking each other.
**Agree on these file formats FIRST, before writing any pipeline code.** Anyone can
mock these files by hand in the first 10 minutes so the other two workstreams can
start immediately without waiting on real data.

```
repo/
├── data/
│   ├── bvbrc_amr.csv            # Part A output
│   ├── bvbrc_spgene.csv         # Part A output
│   ├── bvbrc_metadata.csv       # Part A output
│   ├── sequences.csv            # Part A output (gene_id, sequence, ...)
│   └── cluster_summary.json     # Part A output -> Part B input
├── insights/
│   └── observations.json        # Part B output -> Part C input
├── eval/
│   └── braintrust_results.json  # Part B output (eval scores, for demo)
└── frontend/
    └── ...                      # Part C
```

### Contract 1 — `cluster_summary.json` (Part A → Part B)

```json
{
  "0": {
    "n_genes": 42,
    "example_genes": ["fig|573.1234.peg.10", "fig|573.1234.peg.55"],
    "top_products": {"beta-lactamase": 12, "efflux pump": 8},
    "resistant_phenotype_breakdown": {"Resistant": 30, "Susceptible": 12},
    "species_breakdown": {"Klebsiella pneumoniae": 25, "Escherichia coli": 17}
  },
  "1": { "...": "..." }
}
```
Keys are cluster IDs (strings). This is exactly what `gpu_embedding_cluster.py`
produces — Part A owns this schema, Part B just consumes it.

### Contract 2 — `observations.json` (Part B → Part C)

```json
{
  "generated_at": "2026-07-24T10:30:00Z",
  "clusters": [
    {
      "cluster_id": "0",
      "headline": "Beta-lactamase cluster strongly linked to K. pneumoniae resistance",
      "observation": "This cluster is dominated by beta-lactamase genes found almost exclusively in resistant K. pneumoniae isolates, suggesting a shared resistance mechanism worth prioritizing for empiric antibiotic selection.",
      "confidence": "high",
      "eval_score": 0.92,
      "supporting_gene_count": 42
    }
  ]
}
```
Part C only needs `clusters[]` — treat `headline` as card title, `observation` as
card body, `eval_score` as a small badge (e.g. "grounded ✓ 0.92").

### Contract 3 — Frontend data-fetch expectation (Part C)

Part C should build against a **local static JSON file** (`observations.json` +
`cluster_summary.json`) first, not a live backend — this removes a dependency and
lets Part C start rendering UI within the first 15 minutes using mocked data.
If time allows, wire up a tiny FastAPI/Express endpoint at the end to serve the
real files; this is optional polish, not required for the demo to work.

---

## 2. Kickoff Checklist (all 3, first 15 minutes together)

- [ ] Confirm target pathogen list above (do not change later)
- [ ] Agree on the 3 JSON contracts above — **write a fake/mock version of each file
      by hand right now** (5 min), commit them to `data/` and `insights/`, so all 3
      people can build against real-shaped data immediately
- [ ] Set up shared repo (GitHub) + Daytona sandbox for Part A/B GPU work
- [ ] Confirm API keys ready: Fireworks AI, Braintrust, (Daytona already provisioned)
- [ ] Split into Part A / Part B / Part C below

---

# PART A — Data Pipeline & GPU Processing (Daytona / H100)
### Owner: 1 teammate · Time budget: ~2 hours
### Runs on: Daytona sandbox with GPU

## Goal
Pull structured pathogen data from BV-BRC, extract protein embeddings via a
pretrained model (no training — inference only), cluster them, and output
`cluster_summary.json` per Contract 1 above.

## Why no training
3-4 hours is not enough time to build/validate/tune a real ML model, and a rushed
model will be unconvincing to judges. Instead: use a **pretrained** protein language
model (ESM2) purely for inference (embedding extraction) — this is what justifies
GPU usage and the "fast" narrative, without the risk of a training pipeline.

## Step-by-step

### A.1 — Environment setup (10 min)
```bash
pip install requests pandas fair-esm torch scikit-learn
```
Verify GPU is visible: `python -c "import torch; print(torch.cuda.is_available())"`

### A.2 — Pull BV-BRC data (30–40 min)
Use/extend the starter script `bvbrc_fetch.py` (already written, see below).
It queries the BV-BRC REST API (`https://www.bv-brc.org/api`, RQL syntax) for:
- `genome_amr` — lab-tested AMR phenotypes (resistant/susceptible per antibiotic)
- `sp_gene` — specialty genes: AMR genes, virulence factors, essential genes
- `genome` — metadata: host, isolation source, geography, disease

Additionally pull protein sequences via `genome_feature` (field `aa_sequence`) or
the FTP `.PATRIC.faa` files, and assemble `sequences.csv` with at minimum:
`gene_id, sequence` (plus optional `species`, `resistant_phenotype`, `product`
columns for downstream enrichment).

**Fallback if API is flaky**: use pre-cleaned data from the
`BV-BRC/AMRMetadataReview_2021` GitHub repo (already-filtered AMR tables) as a
substitute data source. Do not spend more than 45 min total on data pulling —
if stuck, fall back and move on.

### A.3 — GPU embedding extraction (30–40 min)
Use/extend `gpu_embedding_cluster.py` (already written, see below).
- Model: `esm2_t12_35M_UR50D` (fast — do NOT use larger ESM2 variants, not worth
  the time cost in a hackathon)
- Batch size 32, mean-pool per-residue representations into one vector per gene
- **Record wall-clock time for this step** — this number is your headline demo
  stat ("N sequences embedded in M minutes on Daytona H100")

### A.4 — Clustering (15 min)
- KMeans with automatic k selection via silhouette score (already in script)
- Join cluster assignments back to AMR phenotype / product / species metadata
- Output `data/cluster_summary.json` per Contract 1

### A.5 — Handoff (5 min)
- Confirm `cluster_summary.json` matches Contract 1 schema exactly
- Ping Part B teammate that the real file is ready (they've been building against
  the mock version until now)

## Definition of Done
- [ ] `data/bvbrc_amr.csv`, `bvbrc_spgene.csv`, `bvbrc_metadata.csv` exist
- [ ] `data/sequences.csv` exists with real protein sequences
- [ ] `data/cluster_summary.json` exists, matches Contract 1, has 3+ clusters
- [ ] Embedding step timing recorded (for demo narrative)

## Starter code references
- `bvbrc_fetch.py` — BV-BRC API query functions (genome_amr, sp_gene, genome)
- `gpu_embedding_cluster.py` — ESM2 embedding + KMeans clustering + summary builder

---

# PART B — AI Insight Generation & Validation (Fireworks AI + Braintrust)
### Owner: 1 teammate · Time budget: ~2 hours
### Depends on: `cluster_summary.json` (start with mocked version immediately)

## Goal
Turn structured cluster data into natural-language research observations using
Fireworks AI (fast inference), then validate those observations with Braintrust
so the demo can claim "grounded, checked insights" rather than "an LLM made this up."

## Step-by-step

### B.1 — Environment setup (10 min)
```bash
pip install requests braintrust
```
Get Fireworks API key + pick a fast model (e.g. a small/medium Llama or Qwen
model hosted on Fireworks — prioritize low latency over max quality here).

### B.2 — Build the observation-generation prompt (20 min)
Work against the **mocked** `cluster_summary.json` first (from kickoff step) so
you're not blocked waiting on Part A.

Prompt template:
```
You are analyzing gene clusters from pathogens implicated in gut-derived
infections (including infected pancreatic necrosis). For the cluster below,
write:
1. A one-line headline (under 12 words)
2. A 2-3 sentence research observation grounded ONLY in the data provided —
   do not invent facts not present in the input.

Cluster data:
{cluster_json}

Respond in JSON: {"headline": "...", "observation": "..."}
```
Call this once per cluster. Parse JSON response defensively (models sometimes
wrap in markdown fences — strip those).

### B.3 — Wire to Fireworks API (20 min)
```python
import requests

FIREWORKS_API_KEY = "..."
MODEL = "accounts/fireworks/models/<pick-a-fast-model>"

def generate_observation(cluster_id: str, cluster_data: dict) -> dict:
    prompt = PROMPT_TEMPLATE.format(cluster_json=cluster_data)
    resp = requests.post(
        "https://api.fireworks.ai/inference/v1/chat/completions",
        headers={"Authorization": f"Bearer {FIREWORKS_API_KEY}"},
        json={
            "model": MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 300,
            "temperature": 0.2,
        },
    )
    text = resp.json()["choices"][0]["message"]["content"]
    # strip markdown fences defensively, then json.loads(text)
    return parsed_result  # {"headline": ..., "observation": ...}
```
Record latency per call — this is your second demo stat ("insight generated in
X seconds per cluster").

### B.4 — Braintrust eval (30–40 min)
Goal: show judges the observations are checked, not hallucinated.
- Hand-label 3-5 cluster→observation pairs with a "faithful to data: yes/no"
  or 0-1 score judgment yourself (quick manual pass)
- Write a simple Braintrust eval scorer: does the observation only reference
  genes/phenotypes/products actually present in the cluster data? (can be a
  simple LLM-as-judge scorer, or basic keyword-overlap check if time is tight)
- Run the eval, get a score, screenshot it — this doesn't need to be
  sophisticated, it needs to exist and be visible in the demo

```python
from braintrust import Eval

def faithfulness_scorer(input, output, expected=None):
    # simplest version: check that entities mentioned in `output.observation`
    # appear in `input` cluster data (products, phenotypes, species names)
    ...
    return {"name": "faithfulness", "score": score}

Eval(
    "amr-observation-faithfulness",
    data=lambda: [{"input": c, "output": generate_observation(cid, c)}
                  for cid, c in cluster_summary.items()],
    task=lambda input: input,  # already generated above
    scores=[faithfulness_scorer],
)
```

### B.5 — Assemble final output (10 min)
Merge headline/observation/eval_score per cluster into `insights/observations.json`
per Contract 2. Attach real `cluster_summary.json` once Part A delivers it, re-run
if time allows to replace mocked outputs with real ones.

## Definition of Done
- [ ] `insights/observations.json` exists, matches Contract 2, has an entry per cluster
- [ ] Per-call latency recorded (demo stat)
- [ ] `eval/braintrust_results.json` or screenshot exists showing a faithfulness score
- [ ] Ran once against real `cluster_summary.json` from Part A (not just mock)

---

# PART C — Dashboard & CopilotKit Interface
### Owner: 1 teammate · Time budget: ~3 hours (can start immediately, in parallel)
### Depends on: mocked `observations.json` first, then real one from Part B

## Goal
Build the interactive dashboard: visualize gene clusters, show AI-generated
observations per cluster, and provide a CopilotKit-powered chat panel so judges
can ask questions and get grounded answers.

## Step-by-step

### C.1 — Scaffold (15 min)
- React app (Vite or Next.js — pick whichever the teammate is fastest with)
- Install CopilotKit: `npm install @copilotkit/react-core @copilotkit/react-ui`
- Load the **mocked** `observations.json` + `cluster_summary.json` as static
  imports so you can build UI without waiting on Parts A/B

### C.2 — Core visualizations (60–90 min)
Priority order (do these in order, stop when time runs low):
1. **Cluster cards**: one card per cluster showing headline, observation text,
   eval_score badge, gene count. This is the minimum viable dashboard.
2. **Resistance breakdown chart**: simple bar chart per cluster showing
   resistant vs susceptible counts (use `recharts` or `chart.js`)
3. **Gene/product table**: expandable table under each cluster card showing
   `top_products` and `example_genes`
4. (Stretch) network/graph view of gene co-occurrence — only attempt if steps
   1-3 are done with time to spare; do not let this block the demo

### C.3 — CopilotKit chat panel (45–60 min)
- Wrap the app in `<CopilotKit>` provider
- Use `useCopilotReadable` to expose the loaded `observations.json` /
  `cluster_summary.json` data to the copilot as context, so questions are
  answered grounded in the actual dashboard data (not generic LLM knowledge)
- Add a few `useCopilotAction` handlers for things like "highlight cluster N"
  or "filter by species X" so the chat can actually control the UI, not just
  answer text — this is a stronger demo moment than a plain Q&A box
- Minimum viable: a chat box that can answer "what's resistant in cluster 0"
  grounded in the readable context. Don't over-engineer actions if time is short.

### C.4 — Swap in real data (15 min)
Once Part A/B deliver real files, replace the mocked imports with the real
`data/cluster_summary.json` and `insights/observations.json`. Re-verify the UI
still renders correctly (field names should match Contract 1/2 exactly — this
is why the contracts matter).

### C.5 — Polish for demo (remaining time)
- Add the two headline stats from Part A/B (embedding time, per-insight latency)
  somewhere visible — e.g. a small "pipeline stats" banner: "3,000+ sequences
  embedded in 4 min on Daytona H100 · insights generated in 1.2s via Fireworks"
- Keep visual design simple and clean — do not spend time on design polish
  beyond making it legible; judges care about the pipeline story more than
  pixel-perfect UI

## Definition of Done
- [ ] Dashboard renders cluster cards with observation text + eval score badge
- [ ] At least one chart showing resistance breakdown
- [ ] CopilotKit chat panel can answer at least 2-3 grounded questions about
      the loaded data
- [ ] Real data (not mock) wired in before final demo run-through
- [ ] Pipeline stats (GPU time, LLM latency) visible somewhere on the page

---

## 3. Final Integration & Demo Run (last 20-30 min, all 3 together)

- [ ] Confirm all three parts are using the SAME real data files (not stale mocks)
- [ ] Full run-through, timed
- [ ] Prepare the 2-minute demo narrative:
  1. Problem (15s): this analysis normally takes ~100 hours manually
  2. Data (20s): real BV-BRC data on gut/pancreas-relevant pathogens
  3. Speed (30s): Daytona H100 embedding time — state the actual number
  4. AI insight (30s): Fireworks-generated observations, Braintrust-checked
     for faithfulness — state the actual eval score
  5. Interaction (20s): live CopilotKit question in the dashboard
  6. Close (5s): "100 hours → ~2 hours" one-liner
- [ ] Record a backup video of a successful run in case of live demo issues
      (network, GPU sandbox, API rate limits)

## Risk / Fallback Table

| Risk | Fallback |
|---|---|
| BV-BRC API query issues | Use `AMRMetadataReview_2021` pre-cleaned data instead |
| Protein sequence field messy/missing | Skip embeddings, do statistical co-occurrence analysis on AMR gene + phenotype tables instead — same demo narrative, just "instant" instead of "GPU-accelerated" |
| ESM2 model download slow | Pre-download/cache model weights before the clock starts |
| Daytona sandbox provisioning issues | Run on any available GPU/CPU as backup, say "this normally runs on Daytona H100" in the demo |
| Out of time for CopilotKit actions | Ship simple Q&A grounded chat only, skip `useCopilotAction` UI-control features |
| Out of time for real data integration | Demo on mocked-but-realistic data, be transparent that it's illustrative if asked |
