# LabPilot — the AI that refuses to lie about your data

**Repo:** https://github.com/johnqh/daytona_hackathon

---

## Summary

LabPilot turns raw pathogen-genomics tables into grounded, checkable research findings: it pulls real antimicrobial-resistance data from BV-BRC, embeds 34,466 proteins on a Daytona H100 in 93 seconds, and lets a researcher interrogate the result in plain English through a CopilotKit chat running on Fireworks.

Then it does the thing no other AI dashboard does: **it tells you when there's nothing there.** Our clustering found no resistance signal — so we built that verdict into the runtime as a hard gate. The agent is architecturally incapable of claiming a link the arithmetic doesn't support. Swap in a dataset that *does* have signal and the same agent, same prompt, immediately finds it. Grounding you can falsify in 30 seconds, not a promise in a system prompt.

---

## The problem, and why it matters

Infected pancreatic necrosis is the deadliest complication of severe pancreatitis, and the organisms responsible are overwhelmingly gut-derived: *E. coli*, *Klebsiella pneumoniae*, *Enterococcus*, *C. difficile*. ICU clinicians pick empiric antibiotics for these infections with very little visibility into what the current resistance landscape actually looks like.

The data to answer this is public. Assembling it is not: it means cross-referencing CARD, VFDB, NDARO and laboratory susceptibility tables across hundreds of genomes, which is a bioinformatician's week, and most labs don't have a bioinformatician.

But there's a second, worse problem, and it's the one we actually targeted.

**AI dashboards in this space quietly invent statistics.** Point an LLM at a genomics table and ask "which cluster is most resistant" and it will always name one — because that's what the question implies. It will sound authoritative. It will be wrong. In a clinical-adjacent domain, a confidently fabricated resistance association is not a bug, it's a liability.

So we built the tool a microbiologist would actually trust: one where **every number is copied, never generated, and every claim is gated by arithmetic the system computed itself.**

---

## What it does

Upload a dataset → it's analysed in-browser → the dashboard renders → you chat with it.

1. **Ingest** — BV-BRC REST: 240 pinned genomes across 6 gut-derived pathogens, 40,010 resistance/virulence gene calls, 2,725 **laboratory-measured** susceptibility results
2. **Embed** — ESM2 protein language model on a **Daytona H100**: 34,466 proteins in **93.0 seconds**
3. **Cluster** — KMeans, k chosen by silhouette
4. **Gate** — compute per-cluster enrichment and decide, numerically, whether any cluster is allowed to be described as resistance-associated
5. **Narrate** — grounded observations that may only restate computed numbers
6. **Evaluate** — a faithfulness scorer checks that every numeral in the prose appears in the source data
7. **Interrogate** — **CopilotKit** chat that must call a tool before answering, and is bound by the gate

---

## The headline result: a negative one

After embedding and clustering, we asked the question most hackathon projects skip: *do these clusters actually separate resistant from susceptible isolates?*

They don't.

| cluster | genes | phenotype deviation from corpus base rate |
|---|---|---|
| 0 | 12,497 | 0.075 |
| 1 | 5,804 | 0.081 |
| 2 | 13,238 | 0.112 |
| 3 | 2,927 | 0.084 |

Every cluster reproduces the background rate to within 11%. This is the *correct* result, not a broken pipeline: ESM2 embeds proteins by sequence and structure, so it groups **protein families**, while resistance is a property of the **isolate**, carried by a handful of specific genes. It does not survive averaging over every annotated protein in a genome.

Most teams would bury this and ship a colourful "resistance cluster" chart. We did the opposite: **we made the negative result the product's core feature.**

`cluster_enrichment.json` exposes `clusters_with_phenotype_signal`. It is currently an **empty list**. The agent's system prompt gates every association claim on that list. Ask "which cluster has the highest resistance?" and it refuses — explaining that none separate resistant from susceptible isolates, and that this is a finding rather than missing data.

**This is demonstrable in 30 seconds.** Upload our real data → the agent refuses to name a cluster. Upload a synthetic dataset where two clusters genuinely do carry signal → the same agent, same prompt, immediately names clusters 1 and 3. The honesty isn't personality, it's arithmetic.

---

## Technical architecture

```
BV-BRC REST  ──►  pipeline/bvbrc_fetch.py   ──►  data/*.csv + pinned manifest
                                                        │
                        Daytona H100 sandbox  ◄─────────┘
                        ESM2 t12_35M inference
                        34,466 proteins / 93.0s
                                                        │
                  pipeline/enrichment.py  ──►  the honesty gate
                                                        │
                  Fireworks GLM-5.2       ──►  grounded narration
                                                        │
                  CopilotKit v2 BuiltInAgent  ──►  grounded chat
                  (gate travels in the tool result)
```

**Contracts before code.** We froze two JSON contracts at kickoff so the GPU, LLM and UI workstreams could build in parallel against mocks and integrate without a rewrite. A validator (`pipeline/validate_contract.py`) gates the handoff — including a check that each cluster's breakdowns sum to its gene count, which catches a dropped join.

**Bring your own data, analysed live.** Drop any Contract-1 JSON on the upload page and the full enrichment analysis runs in the browser — no backend, no round trip — then the dashboard and the agent both bind to *your* dataset. The gate is therefore implemented **twice, independently**: once in Python for the pipeline, once in TypeScript for uploads. We verified the two agree exactly on the real data (0.075 / 0.081 / 0.112 / 0.084, empty gate). Two implementations agreeing is a stronger correctness argument than one implementation asserting.

**Provenance is enforced, not assumed.** `genome_amr` holds 17.3M rows, but only 1.28M are laboratory-measured — the rest are BV-BRC's own computational predictions. We filter to `evidence == "Laboratory Method"` everywhere. *H. pylori* has 265 lab-measured rows against *K. pneumoniae*'s 85,291, so it's included for virulence only and the system refuses to quote a resistance statistic for it.

---

## Sponsor tools, and how we integrated them

Three of these are load-bearing: remove any one and the project does not work.

### 🏅 Daytona — the GPU is doing the work

Daytona isn't hosting our app. It runs the one step that cannot happen without a GPU: ESM2 inference over **34,466 proteins in 93.0 s at 370 seq/s on an H100**, against **5 seq/s measured on our own CPU** — a **74x** speedup, and the difference between a 90-second step and a two-hour one. Without it, this pipeline does not fit inside a hackathon, or inside a researcher's afternoon.

We drove the platform properly, not just `create()` and hope:

- **Volumes for model weights.** The sandbox cannot reach `dl.fbaipublicfiles.com` — the ESM2 download dies mid-transfer with `Connection reset by peer`. We fetch the weights locally and push them to a **persistent Volume**, which survives sandbox deletion, making every later run a cache hit.
- **Ephemerality is mandatory on GPU nodes.** `auto_delete_interval` must be `0` or creation is hard-rejected, so results are downloaded *before* teardown rather than after.
- **`auto_stop_interval` defaults to 15 minutes and fires mid-job.** Set to `0`, or your embedding run dies silently at minute 15.
- **Long jobs go through a session with `run_async`**, with logs streamed back, rather than a blocking `exec` that dies on an HTTP timeout.
- **Image caching** took sandbox start from **160 s to 1 s** on re-runs.
- Resource limits are real: **4 vCPU / 8 GiB applies to GPU sandboxes too**, despite the docs quoting up to 16/192. Asking for more is rejected, not downgraded.

Every one of those is in `pipeline/run_on_daytona.py` with the symptom documented next to the fix, so the next team doesn't pay for them twice.

### 🎖️ Fireworks AI — the model that must never invent a number

`glm-5p2` (743B MoE, 1M context, **open weights**) via `@ai-sdk/openai-compatible`, running in-process through CopilotKit's `BuiltInAgent`. It powers the live chat under a system prompt that forbids generating, rounding or recomputing any number, and that gates every resistance claim on a computed list.

We measured rather than assumed, twice:

- **Tool-calling fidelity.** The entire design collapses if the agent doesn't call `getPathogenDataset`, so before committing we verified clean tool calls against the *real* tool schema on **GLM-5.2, DeepSeek V4 Pro, V4 Flash and gpt-oss-120b** — a tested fallback ladder, not a guess.
- **Latency, and a fix for it.** GLM-5.2's default reasoning chain cost **3.02 s per turn**, which is fatal for a live demo. Fireworks accepts a `reasoning_effort` field that the AI SDK doesn't model, so we inject it into the request through a provider `fetch` wrapper: **3.02 s → 0.80 s at the API, ~1.07 s end-to-end** through the running server, with tool calls still correct. Set `FIREWORKS_REASONING_EFFORT` to put thinking back.

Open weights mattered to us: the layer that narrates scientific data should be inspectable and self-hostable, not a black box we rent.

### 🎖️ CopilotKit — where the honesty guarantee becomes enforceable

CopilotKit is what turns "we promise the model won't lie" into something structural. Built on the **v2** API (1.63.2) — `BuiltInAgent`, `useFrontendTool`, `useAgentContext` — not the deprecated v1 surface most tutorials still show.

The agent **must** call `getPathogenDataset` before answering; if nothing is loaded it says so rather than answering from memory. Crucially, the tool result carries `clustersWithPhenotypeSignal` — a computed gate that bounds what the model is permitted to conclude. **The constraint travels with the data, not just the prompt**, which is why swapping the dataset flips the agent's answer without touching a line of configuration. Generative UI renders the JSON the tool actually returned, rather than letting the model retype statistics into component props — when the numbers are the entire product, that distinction is the ballgame.

Three traps we hit, and documented:

- **`maxSteps` defaults to `1`** — the agent calls your tool, then stops without using the result. It looks exactly like the model ignoring the tool, and you will debug the wrong thing.
- **The AI SDK provider must be pinned.** CopilotKit 1.63.x bundles `ai` v6 (provider 3.x); `@latest` resolves to a 4.x build and the model is rejected with an opaque "unsupported model version".
- **Don't pin CopilotKit below 1.63.0** — it reintroduces an `/info` request storm firing 70–80 requests per page load.

### Braintrust — the faithfulness eval

Our scorer extracts every numeral from generated prose and asserts it appears in the source statistics — the precise failure mode that makes AI science dashboards dangerous — plus a no-overclaim rubric that fails any observation asserting causation, mechanism or clinical guidance. Per-observation input, output and verdict land in `eval/braintrust_results.json` in the shape a Braintrust `Eval()` consumes. It runs locally in this submission.

---

## Challenges

**The BV-BRC API is full of silent failures.** A 25,000-row hard cap that returns 200 OK with truncated data. A raw space in a literal → HTTP 400. A pipe character in `patric_id` → `query.args[1].join is not a function` (percent-encoding works; quoting doesn't). And `aa_sequence` is simply unreachable via `select()` — protein sequences require a two-hop join through `genome_feature.aa_sequence_md5` → `feature_sequence.md5`. Each cost real time; all are documented in the repo so the next person doesn't pay twice.

**Resisting the good-looking wrong story.** The clustering *looks* impressive. Cluster 3 is full of efflux pumps and MdfA/EmrD multidrug transporters — it would have been trivial and completely indefensible to caption it "multidrug resistance cluster." The arithmetic said no. Building the gate that enforces that took longer than ignoring it would have.

**The circularity trap.** Embedding proteins that already carry curated CARD/VFDB labels mostly recovers what the annotation already stated. We say so explicitly rather than letting a judge discover it.

---

## Try it yourself

```bash
git clone https://github.com/johnqh/daytona_hackathon
cd pathogen-pathfinder && npm install && npm run dev
```

1. Drag in **`data/cluster_summary.json`** (real: 240 genomes, 34,466 proteins)
2. → *"4 clusters parsed"* → **Analyze Dataset**
3. Open **/copilot** → ask *"Which cluster has the highest resistance?"*
   → it **refuses**, and explains why
4. Now drag in **`mock/cluster_summary.json`** and ask again
   → same agent, same prompt → it **names clusters 1 and 3**

Reproduce the pipeline end to end:
```bash
python pipeline/bvbrc_fetch.py        # BV-BRC → CSVs      (~2 min)
python pipeline/run_on_daytona.py     # ESM2 on H100       (~4 min)
python pipeline/enrichment.py         # the honesty gate
python pipeline/validate_contract.py  # contract gate
```

---

## What we can and cannot claim

We hold ourselves to the standard we built the product to enforce:

- **Genomes are not deduplicated by strain.** Public databases are heavily oversampled for outbreak clones, so any concentrated pattern could be clonal artefact. Metadata for country/year/MLST is fetched and ready to quantify this.
- **The clustering is partly circular**, as above. It organises the cohort; it is not gene discovery.
- **k selection is weak** — best silhouette 0.1271, with k=4…12 all between 0.087 and 0.127. We report the full table rather than just the winner. We do not claim k=4 is a discovered natural grouping.
- Computational gene calls are never presented as laboratory measurements — 15.9M of the 17.3M rows in `genome_amr` are predictions, and we filter them out.
- Every performance number here was measured on this dataset, on this hardware, today. We quote no speedup we did not time.

**Research prototype — not for clinical use.**

---

## What's next

The defensible GPU story we ran out of time for: embed the **unannotated** proteins — `hypothetical protein` is the single most common product in our largest cluster, 888 of them — and surface those sitting near known resistance proteins in embedding space. BLAST-based annotation misses distant homologs; a protein language model doesn't. That's genuine candidate discovery, it legitimately needs the H100, and every input is already on disk. Candidates requiring validation, never confirmed genes.

Then: strain deduplication, a hosted serving layer for the statistics, and the Braintrust cloud eval with deliberately-seeded failure cases — because an eval that reports 100% on everything reads as untested.
