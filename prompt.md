# Genome → Treatment Failure: Build Prompt

**Status:** implementation spec, ready to hand to a coding agent.
**Data facts below were verified live against the BV-BRC API on 2026-07-24.**

---

## 0. What you are building

A three-part system that takes a bacterial genome assembly and answers one
clinically meaningful question: **will this antibiotic still work on this
infection?**

```
┌─────────────────────────┐     ┌──────────────────────┐     ┌────────────────────┐
│ PART 1 — Daytona        │     │ PART 2 — Fireworks   │     │ PART 3 — Frontend  │
│ Train + host the        │◄────┤ Open-weight LLM      │◄────┤ Next.js +          │
│ predictor. FastAPI over │ API │ explains results,    │     │ CopilotKit         │
│ AMRFinderPlus + a       │     │ drives tool calls    │     │ FASTA upload +     │
│ calibrated linear model │     │ into Part 1          │     │ generative UI      │
└─────────────────────────┘     └──────────────────────┘     └────────────────────┘
```

The LLM never predicts resistance. It explains, narrates, and calls tools.
All predictions come from Part 1. This separation is the core design rule.

---

## 1. Critical framing — read before writing any code

The obvious framing, "train a model to associate DNA sequence with disease,"
does not work on this data. It was tested and rejected. Do not rebuild it.

- BV-BRC exposes a `disease` field, but only **25,413 of 1,372,189** bacterial
  genomes (1.9%) populate it, and the vocabulary is uncontrolled free text —
  `bacteremia`, `bacteraemia`, `Bacteremia`, and `bacterimia` are four separate
  values; `shigellosis` and `shigellosi` coexist.
- **Every disease label maps to essentially one species.** Gonorrhea is
  3,904/3,904 *Neisseria gonorrhoeae*. Bubonic plague is 106/106 *Yersinia
  pestis*. A cross-species disease classifier is a species identifier in
  disguise: ~100% accurate and scientifically empty.
- The one apparently within-species contrast — *S. pneumoniae* invasive disease
  (2,238) vs. carriage (3,018) — is fully confounded by study design. Invasive
  isolates come from Australia and the USA (two BioProjects); carriage isolates
  from The Gambia, Malawi, Peru, Nepal, and China. A model would learn
  geography, not pathogenesis.
- Viruses are a dead end: **271 disease-labeled genomes out of 15,469,076**.

What is real is `genome_amr`: **1,284,851 laboratory-measured** susceptibility
rows. So the product is **treatment-failure prediction for a named disease**,
not disease classification. Say it that way in the UI and the pitch.

---

## 2. Use case #1 (locked): *Neisseria gonorrhoeae* + ciprofloxacin

| Fact | Value |
|---|---|
| Lab-measured Resistant | 1,481 |
| Lab-measured Susceptible | 2,143 |
| Class balance | 40.9% resistant |
| Quality-gated genomes with AMR panel | 5,532 |
| Mean genome length | 2.13 Mb |

Chosen because it has the best class balance of any mid-size cohort (no
resampling needed); the genome is 2.13 Mb against 4.4 Mb for TB and 5.0 Mb for
*E. coli*, and AMRFinderPlus runtime scales with genome size, so every pipeline
run is roughly twice as fast; resistance is driven by a small set of
well-characterised determinants (gyrA S91F/D95x, parC S87/S88), so a linear
model is genuinely appropriate rather than a compromise; and there is a crisp
clinical story, since CDC withdrew ciprofloxacin as recommended gonorrhoea
therapy precisely because of this resistance.

**Ship this one end to end before starting another.** Verified next targets:

- *M. tuberculosis* + isoniazid — 4,982 R / 10,810 S, 20,335 quality genomes.
- *K. pneumoniae* + meropenem — 1,496 R / 2,557 S, 6,015 quality genomes.

Avoid last-line drugs in most species — they are near-degenerate. *E. coli*
meropenem is 69 R / 5,934 S; *Salmonella* meropenem is 0 R / 2,415 S.

---

## 3. PART 1 — Daytona: train and host the model

### 3.1 Data acquisition

Ground truth comes from BV-BRC's `genome_amr` collection. Two routes:

**Preferred — one bulk file.**
`ftp://ftp.bv-brc.org/RELEASE_NOTES/PATRIC_genomes_AMR.txt` (~142 MB, ~1.5M
rows) is the entire lab-measured phenotype table in a single download, removing
all per-label API paging.

- The host is `ftp.bv-brc.org`. `ftp.bvbrc.org` is a CNAME to it, but the TLS
  certificate is `*.bv-brc.org`, so FTPS to the short name fails hostname
  verification. Use the full name.
- The server requires FTPS; plain FTP returns 550.
- `genome_name` values are quote-mangled (`"""Escherichia coli """`); clean them.
- Note: the genome-firewall project's docs claim this FTP mirror is unreachable
  and fall back to reconstructing FASTA over REST. That is a wrong-hostname and
  plain-FTP artifact. Try FTPS against the full hostname first.

**Fallback — REST.** Measured at 6.7 s and 5.1 MB for one 5.3 Mb *E. coli*
genome, so noticeably slower.

```
https://www.bv-brc.org/api/genome_sequence/?in(genome_id,(ID1,ID2))&limit(25000)&http_accept=application/dna+fasta
```

Per-genome FASTA over FTPS: `ftp://ftp.bv-brc.org/genomes/<id>/<id>.fna`

### 3.2 API gotchas (verified empirically — save yourself the debugging)

- **Hard 25,000-row cap.** `limit(50000)` silently returns 25,000. Bulk pulls
  need `sort()` plus cursor paging.
- **Faceting requires a base query term** and the `application/solr+json` accept
  header. `?eq(taxon_id,*)&facet((field,antibiotic),(limit,30))&limit(1)`.
  Adding `json(nl,map)` returns facets as a dict instead of a flat array.
- **Facet sort is locked to index order**, not count. `(sort,count)` is ignored;
  pass `(limit,-1)` and sort client-side for a true top-N.
- **`genome_amr` has no `species` field** — only `taxon_id` and `genome_name`.
  `species` exists on the `genome` collection. *N. gonorrhoeae* is taxon 485.
- Antibiotic names with slashes must be URL-encoded
  (`trimethoprim%2Fsulfamethoxazole`) or the RQL query silently returns zero.
- Total row counts come from the `Content-Range` response header, so issue
  `limit(1)` with `curl -D -` rather than downloading result sets to count them.

### 3.3 Non-negotiable data rules

1. **Filter `evidence == "Laboratory Method"`.** `genome_amr` holds 17,266,649
   rows, but 15,932,293 of them are BV-BRC's own computational predictions.
   Training on those means training on another model's output.
2. **Keep only `Resistant` and `Susceptible`.** Drop `Intermediate`,
   `Nonsusceptible`, and `Reduced Susceptibility` — do not force them binary.
3. **Grouped splits by Mash cluster, never random.** Bacterial genomes are
   clonal; a random split puts near-identical relatives on both sides of the
   boundary and inflates every metric. Sketch with Mash (k=21, sketch size
   10000), single-linkage cluster at distance 0.01, and assign whole clusters to
   train / calibration / test. Sweep the threshold and inspect cluster sizes
   before trusting it — at 0.02, single-linkage chaining collapsed
   genome-firewall's 102-genome cohort into 5 clusters, which would have made
   the held-out fold meaningless.
4. **Quality gate** against the `genome` collection: `genome_quality == "Good"`,
   `checkm_completeness >= 95`, `checkm_contamination <= 5`, assembly length
   within 1.9–2.4 Mb for *N. gonorrhoeae*.
5. **Emit a no-call band.** Pick two thresholds on the calibration split only;
   anything between them returns "insufficient evidence" instead of a guess.
   Never tune thresholds on test.

### 3.4 Features and model

Annotate each assembly with
`amrfinder -n <genome.fna> -O Neisseria_gonorrhoeae -o <out.tsv>`.

Derive counts of matching resistance genes and point mutations, then add
explicit binary indicators for gyrA S91F, gyrA D95x, and parC S87x/S88x, which
is where nearly all the ciprofloxacin signal lives.

Train a regularized logistic regression. This is a deliberate choice, not a
shortcut: with a handful of well-understood determinants a linear model is
competitive with anything heavier, and its coefficients *are* the explanation
the frontend needs to render. Persist the model as JSON — intercept, named
weights, thresholds, and the full validation block — so it is inspectable and
diffable in git.

Report AUROC, balanced accuracy, per-class recall, Brier score, no-call rate,
and a calibration curve, all on the grouped held-out fold. Write a model card
per drug.

**Expectation management:** ciprofloxacin resistance in gonorrhoea is close to
solved genomically. High accuracy is table stakes, not a finding. The defensible
claims are calibration quality and honest abstention.

### 3.5 Compute shape — no GPU, and mind the CPU ceiling

Every step is CPU- or network-bound. AMRFinderPlus is BLAST and HMMER and has no
GPU code path; the logistic regression trains in under a second. A GPU sandbox
would cost $0.99–4.54/hour and accelerate nothing. **Do not provision one.**

The binding constraint is the opposite of what you'd expect: **Daytona CPU
sandboxes max out at 4 vCPU, 8 GiB RAM, and 10 GiB disk.** Plan around that.

Budget for a ~2,000-genome cohort at the 4 vCPU maximum:

| Step | Bound by | Estimate |
|---|---|---|
| Download FASTA | Network | 15–25 min at 8-way parallelism |
| AMRFinderPlus | CPU (4 vCPU cap) | **~100 min** |
| Mash sketch + all-vs-all + cluster | CPU | ~5 min |
| Train logistic regression | CPU | < 1 second |
| Calibration + metrics | CPU | seconds |

**~2–2.5 hours end to end**, essentially all AMRFinderPlus. Make the annotation
batch resumable — skip genomes that already have a TSV — so interruptions cost
nothing. If you need it faster, cut the cohort to ~1,200 genomes rather than
reaching for a GPU; the class balance is good enough that you will barely feel it.

**The 10 GiB disk ceiling is the real risk.** A micromamba environment plus the
AMRFinderPlus database is several GB before any data, and 2,000 gonococcal
assemblies add ~4.4 GB. Two mitigations, use both:

1. **Stream and discard.** Download a genome, annotate it, write the small
   AMRFinderPlus TSV, delete the FASTA. Only the TSVs and the Mash sketches need
   to persist, and both are tiny. Never hold the full FASTA corpus on disk.
2. **Mount a Volume** for anything that must survive. Volumes are S3-backed FUSE
   mounts that persist across sandbox deletion, are shareable between sandboxes,
   and do **not** count against the storage quota. They are slower than local
   disk and unsuitable for block-storage workloads, so use them for the cohort
   manifest, model artifacts, and checkpoints — not as the AMRFinder scratch dir.

### 3.6 Daytona specifics (verified 2026-07-24)

Daytona is a cloud sandbox runtime for agent workloads — it is **not** the
dev-environment manager it used to be, and `github.com/daytonaio/daytona` was
frozen in June 2026 with development moved private. **Do not use the OSS repo as
your API reference; use the docs and the current SDKs**, which are actively
released: `pip install daytona` (0.200.2) and `npm install @daytona/sdk` (0.200.1).

```python
from daytona import Daytona, DaytonaConfig
daytona = Daytona(DaytonaConfig(api_key=os.environ["DAYTONA_API_KEY"]))
sandbox = daytona.create()
sandbox.process.exec("amrfinder --version")
```

Note the method names diverge between languages: Python uses
`sandbox.process.exec(...)`, TypeScript uses `sandbox.process.executeCommand(...)`.
Files go through `sandbox.fs` — `upload_file` / `uploadFile`, `download_file`,
`upload_files`, `list_files`, `create_folder`.

**Long-running jobs use sessions**, which is how the training run must be
launched:

```python
sandbox.process.create_session("train")
cmd = sandbox.process.execute_session_command(
    "train", SessionExecuteRequest(command="python train.py", run_async=True))
sandbox.process.get_session_command_logs("train", cmd.cmd_id)
```

**The single most important gotcha: `auto_stop_interval` defaults to 15 minutes
of inactivity and fires even while your processes are still running.** A
two-hour training job will be killed three times over unless you set
`auto_stop_interval=0` at creation, or call `sandbox.refresh_activity()` from
outside on a timer. Set it to `0`.

**Exposing the API to the frontend:**

```python
pv = sandbox.get_preview_link(8000)   # opens the port if closed
pv.url     # https://8000-{sandboxId}.proxy.daytona.work
pv.token   # only needed for private sandboxes
```

Create the serving sandbox with **`public=True`** so preview links work without
an auth header — that is what the Part 3 frontend needs. For a private sandbox
you must send `x-daytona-preview-token`, and the token is invalidated on restart.
There is also `create_signed_preview_url(port, expires_in_seconds)`, but its
default expiry is **60 seconds**, so set it explicitly if you use it.

CORS and WebSocket behavior through the preview proxy are **not documented**.
Your FastAPI app must set its own CORS headers, and you should verify browser
calls end-to-end early rather than discovering it during the demo.

**Image definition** uses a fluent builder, cached for 24 hours:

```python
image = (Image.base("mambaorg/micromamba:1.5.8")
    .run_commands("micromamba install -y -n base -c conda-forge -c bioconda "
                  "ncbi-amrfinderplus mash && micromamba clean -a -y",
                  "amrfinder -u")          # bake the DB into the image
    .pip_install(["scikit-learn", "pandas", "biopython", "fastapi", "uvicorn"]))

sandbox = daytona.create(
    CreateSandboxFromImageParams(
        image=image,
        resources=Resources(cpu=4, memory=8, disk=10),
        public=True,
        auto_stop_interval=0),
    timeout=0,
    on_snapshot_create_logs=print)
```

Pass `timeout=0` and `on_snapshot_create_logs=print` to stream build logs — a
bioconda image build is slow and you want to see it. **Image tags must be
pinned**; `latest`, `lts`, and `stable` are rejected.

**Architecture:** use two sandboxes. A **training sandbox** (ephemeral, writes
model JSON and metrics to a Volume) and a **serving sandbox** (long-lived,
`auto_stop_interval=0`, `public=True`, reads the model from the same Volume).
Cache prediction results by SHA-256 of the uploaded FASTA so repeat demo uploads
return instantly.

Cost is trivial at this shape: 4 vCPU + 8 GiB is about $0.33/hour, and new
accounts get **$200 in free credits** with no card required. The closest official
reference is the vLLM model-serving guide, which shows the sandbox + async
session + preview-URL pattern; note that Daytona's RL training guides run the
training loop on your *own* local GPU, so there is no official template for
training inside a sandbox. You are composing that yourself, which is
straightforward for a CPU job.

### 3.7 Part 1 HTTP contract

```
POST /predict            multipart FASTA + {antibiotic}
  → { call: "likely_to_fail" | "likely_to_work" | "no_call",
      probability: float, confidence_band: [float, float],
      determinants: [ { name, kind: "gene"|"mutation", contribution: float,
                        evidence: { identity, coverage, amrfinder_row } } ],
      qc: { contigs, total_bp, n50, passed_gate: bool, reasons: [str] },
      model_version: str, runtime_ms: int }

GET  /model/{antibiotic}  → model card + validation metrics
GET  /antibiotics         → supported targets
GET  /healthz             → readiness
```

`no_call` is a first-class outcome. QC failure (wrong species, truncated
assembly, contamination) must return `no_call` with reasons, never a guess.

---

## 4. PART 2 — Fireworks AI: the open-weight LLM

### 4.1 Connection (verified)

Fireworks exposes an OpenAI-compatible API, so use the stock OpenAI SDK:

- Base URL: `https://api.fireworks.ai/inference/v1`
- Auth: `Authorization: Bearer $FIREWORKS_API_KEY`
- Model ID format: `accounts/fireworks/models/{model-name}`

```python
from openai import OpenAI
client = OpenAI(base_url="https://api.fireworks.ai/inference/v1",
                api_key=os.environ["FIREWORKS_API_KEY"])
```

```typescript
import OpenAI from "openai";
const client = new OpenAI({
  baseURL: "https://api.fireworks.ai/inference/v1",
  apiKey: process.env.FIREWORKS_API_KEY,
});
```

### 4.2 Model choice (catalog verified 2026-07-24)

**Primary: `accounts/fireworks/models/deepseek-v4-pro`**
1.6T MoE, 1,048,576-token context, open weights, confirmed function calling.
Standard pricing $1.74 uncached input / **$0.145 cached input** / $3.48 output
per 1M tokens. The cached-input rate is a 12x discount rather than the usual 2x,
which suits this app's shape directly: the system prompt, tool schemas, and
determinant reference tables are a large static prefix resent every turn, and
they cost almost nothing after the first call.

**Fallback: `accounts/fireworks/models/deepseek-v4-flash`**
284B MoE, same 1M context, same family and prompt formatting, open weights —
**12x cheaper** at $0.14 / $0.028 / $0.28. Because it is architecturally a
sibling you can route between the two with no prompt rework. Use Flash for
summarization and routine extraction, Pro for explaining determinants and
edge-case reasoning. This is the biggest cost lever available.

Runners-up, for reference: `glm-5p2` (743B, 1M ctx, open, but $4.40/M output for
no reasoning advantage here), `kimi-k2p6` (1.028T, 262k ctx, open, $4.00/M
output), `gpt-oss-120b` (116B, 131k ctx, Apache 2.0, $0.15/$0.60 — the budget
floor, fine for a routing or classification sidecar).

**Do not use `qwen3p7-plus`.** It is cheap and serverless, but it is Alibaba's
**closed-weights** flagship offered exclusively through Fireworks. It fails the
open-source requirement. Note also that **Llama 4 is no longer in the catalog** —
Scout and Maverick have been removed; the newest Llama is `llama-v3p3-70b-instruct`.

Confirm against the live catalog before you build, since this moves fast:

```bash
curl -H "Authorization: Bearer $FIREWORKS_API_KEY" \
     https://api.fireworks.ai/inference/v1/models
```

Record the chosen IDs in `.env.example` and the rationale plus date in the README.

### 4.3 Tool calling and structured output

Function calling is confirmed on both DeepSeek V4 models. `tool_choice` accepts
`"auto"` (default), `"none"`, `"required"`, or a specific function object.

Structured output is available three ways via `response_format`:
`{"type": "json_object"}`, `{"type": "json_schema", "json_schema": {...}}`
(JSON Schema 2020-12; external URL `$ref`s are not supported), and
`{"type": "grammar", "grammar": "<GBNF>"}`.

**Two gotchas that directly affect this build:**

1. **`response_format` disables reasoning output on reasoning models.** DeepSeek
   V4 Pro is exactly that. Since you want both the model's reasoning and
   structured results, **use tool calling rather than `response_format`** — it
   enforces a schema without suppressing reasoning. This is the recommended
   path for `predict_resistance`.
2. Always restate the expected JSON shape in the prompt as well. Otherwise the
   model can emit whitespace until it hits `max_tokens`.

### 4.4 Account limits

A new account gets **$1 in free credits**. **Without a payment method on file
you are capped at 10 requests per minute**, which will not survive a live demo;
with one, the account-wide limit is 6,000 RPM. Add a payment method before demo
day. Batch inference bills at 50% of serverless if you need bulk processing.

There are **no biomedical or genomics specialty models on Fireworks** — the
catalog is general LLMs, VLMs, embeddings, and rerankers. Domain knowledge comes
from your prompt and from tool results, which is the correct architecture here
anyway. If you later add RAG over literature, `qwen3-embedding-8b` (40,960 ctx,
$0.10/M) or `bge-m3` (8,192 ctx, $0.008/M) plus a `qwen3-reranker` stage are the
serverless options.

### 4.5 System prompt rules

The LLM must be constrained hard:

- It never estimates resistance itself. Every claim about resistance comes from
  a `predict_resistance` tool result.
- On `no_call` it explains *why* the evidence was insufficient — it does not
  break the tie.
- It states the organism and drug it is talking about in every answer.
- It surfaces the determinants the model actually used, with their weights.
- It always carries the disclaimer that this is a research prototype and not a
  clinical decision tool, and it never recommends a specific therapy for a
  specific patient.

---

## 5. PART 3 — Frontend: Next.js + CopilotKit

### 5.1 Stack (verified 2026-07-24 against CopilotKit 1.63.2)

Next.js (App Router) + TypeScript + Tailwind. CopilotKit is MIT-licensed and
fully self-hostable — **no CopilotKit Cloud account or API key is required** for
anything in this spec.

```bash
npm install @copilotkit/react-core@1.63.2 @copilotkit/react-ui@1.63.2 @copilotkit/runtime@1.63.2
```

**Use the v2 API, which lives under the `/v2` subpath of the same packages.**
This is the most important thing in Part 3. The API you will find in most blog
posts and older examples — `useCopilotAction`, `useCopilotReadable`,
`OpenAIAdapter`, importing UI from `@copilotkit/react-ui` — is the **legacy v1
surface**. It still ships and still works, but it is deprecated and the official
docs teach v2 only. Do not mix the two in one tree; lint against bare
`@copilotkit/react-core` imports.

| Legacy v1 | Use instead (v2) |
|---|---|
| `useCopilotAction` | `useFrontendTool` |
| `useCopilotReadable` | `useAgentContext` |
| `useCopilotAction` + `renderAndWaitForResponse` | `useHumanInTheLoop` |
| `useCoAgent` | `useAgent` |
| `OpenAIAdapter` + `serviceAdapter` | `BuiltInAgent` + `createCopilotRuntimeHandler` |

In v2 the chat components moved into react-core — import `CopilotChat`,
`CopilotSidebar`, and `CopilotPopup` from `@copilotkit/react-core/v2`, **not**
from `@copilotkit/react-ui`, which has no v2 JS export. Styles come from
`@copilotkit/react-core/v2/styles.css`. Tool parameters are **Zod schemas**, not
the v1 array of parameter descriptors, so `zod >= 3` is required.

Do not pin below **1.63.0** — it fixed a `/info` request storm that fired 70–80
requests per page load under StrictMode, and TypeScript declaration resolution
under modern `bundler`/`nodenext` tsconfigs.

You do not need `useAgent`/CoAgents. Those are for stateful LangGraph-style
backend graphs. Upload → predict → display needs only `useFrontendTool`,
`useAgentContext`, and `useRenderTool`.

### 5.2 The key integration — pointing CopilotKit at Fireworks

There is **no `OpenAIAdapter` in the current path.** v2 replaced adapters with
`BuiltInAgent`, which accepts a Vercel AI SDK `LanguageModel`. Since Fireworks
is OpenAI-compatible, any AI SDK OpenAI-compatible provider works.

```ts
// app/api/copilotkit/[...path]/route.ts
import { CopilotRuntime, createCopilotRuntimeHandler, BuiltInAgent } from "@copilotkit/runtime/v2";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const fireworks = createOpenAICompatible({
  name: "fireworks",
  apiKey: process.env.FIREWORKS_API_KEY!,
  baseURL: "https://api.fireworks.ai/inference/v1",
});

const runtime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      model: fireworks("accounts/fireworks/models/deepseek-v4-pro"),
      maxSteps: 5,
      prompt: SYSTEM_PROMPT,   // see §4.5
      tools: [predictResistance],
    }),
  },
});

const handler = createCopilotRuntimeHandler({ runtime, basePath: "/api/copilotkit" });
export { handler as GET, handler as POST };
```

Route file must be `app/api/copilotkit/[...path]/route.ts` exporting both `GET`
and `POST`. (Single-route mode exists via `mode: "single-route"` with only `POST`.)

**Three traps here, all of which will cost you an afternoon each:**

1. **AI SDK provider version mismatch — the worst one.** CopilotKit 1.63.2
   bundles `ai@^6`, which pins `@ai-sdk/provider@3.x`. Installing
   `@ai-sdk/openai-compatible@latest` today gives you a `provider@4.x` build for
   `ai` v7, and the resulting model object is rejected with a confusing
   "unsupported model version" error rather than a clean failure. **Pin
   explicitly:** `@ai-sdk/openai-compatible@^2.0.62`, or `@ai-sdk/openai@^3.0.36`,
   or `@ai-sdk/fireworks@^2.0.70`. Never `@latest`.
2. **`maxSteps` defaults to `1`.** With the default, the agent calls your tool
   and then stops without ever using the result. Set `maxSteps: 5`.
3. **`forwardSystemMessages` defaults to `false`**, so system messages sent from
   the client are silently dropped. Put your system prompt in `BuiltInAgent`'s
   `prompt` field.

Get a plain text round-trip through Fireworks working, then a tool call, before
writing any UI.

**Highest-risk unknown in the whole project:** CopilotKit's generative UI depends
entirely on the model emitting well-formed tool calls in the shape `ai` v6
expects. The plumbing accepts any OpenAI-compatible endpoint, but tool-calling
fidelity varies across open models on Fireworks. **Prototype the tool-call path
against your chosen model on day one.** If DeepSeek V4 Pro misbehaves, fall back
through `deepseek-v4-flash`, then `gpt-oss-120b`.

### 5.2b Backend tool

```ts
import { defineTool } from "@copilotkit/runtime/v2";
import { z } from "zod";

const predictResistance = defineTool({
  name: "predictResistance",
  description: "Predict whether an antibiotic will fail for an uploaded genome",
  parameters: z.object({
    sampleId: z.string().describe("ID returned by /api/upload"),
    antibiotic: z.string(),
  }),
  execute: async ({ sampleId, antibiotic }) => {
    const r = await fetch(`${process.env.PREDICTOR_URL}/predict`, {
      method: "POST",
      body: JSON.stringify({ sampleId, antibiotic }),
      headers: { "content-type": "application/json" },
    });
    return await r.json();
  },
});
```

### 5.3 Interface requirements

**Upload — keep the sequence away from the LLM.** CopilotKit does have a
first-class chat attachment primitive (`attachments` on `CopilotChat`), but
**do not use it for FASTA.** Attachments exist to feed multimodal content to the
model and base64-inline the file into the message; a genome is megabytes of ACGT
that the LLM must never see, the default size cap is 20 MB, and unsupported file
types raise `RUN_ERROR`.

The correct pattern:

1. A plain React dropzone posting to `POST /api/upload`.
2. The server validates the FASTA, forwards it to Part 1, and returns a
   lightweight summary: `{ sampleId, organism, contigCount, totalBp, n50, qcPassed }`.
3. Expose **only that summary** through `useAgentContext` — never the sequence.
   Values must be strictly JSON-serializable; a `Date` or class instance throws.
4. The LLM calls `predictResistance` with the `sampleId`.

This keeps token cost flat regardless of genome size and gives you normal HTTP
progress and retry behavior. If you want drag-into-chat as a convenience, enable
`attachments` with an `onUpload` that uploads to your own storage and returns
`{ type: "url" }`, so the model sees a URL rather than bytes.

Also provide a "try a demo genome" path with three pinned examples — one clearly
resistant, one clearly susceptible, one that fails QC and returns `no_call`.

**Generative UI — use `useRenderTool`, not `useComponent`.** Both exist.
`useComponent` lets the LLM call a component as a tool and fill its props, which
means the model would be *retyping* confidence numbers into tool arguments. In a
clinical context that is unacceptable. `useRenderTool` is renderer-only, keyed to
the backend tool name, and renders your predictor's actual JSON:

```tsx
useRenderTool({
  name: "predictResistance",
  parameters: z.object({ sampleId: z.string(), antibiotic: z.string() }),
  render: ({ parameters, status, result }) => {
    if (status === "inProgress") return <Skeleton />;
    if (status === "executing") return <div>Analyzing {parameters.sampleId}…</div>;
    return <ResistanceCard {...JSON.parse(result)} />;
  },
}, []);
```

Reserve `useComponent` for things the LLM legitimately composes, such as
comparisons or summaries.

The card shows the call (`likely_to_fail` / `likely_to_work` / `no_call`) with
unmistakable color coding, the calibrated probability with its confidence band,
a determinant table listing each gene or mutation with its contribution, a QC
panel, and the model version linking to the model card.

Two API sharp edges worth knowing up front: `useRenderTool` reports status as
**string literals** (`"inProgress"`, `"executing"`, `"complete"`) while
`useFrontendTool` and `useHumanInTheLoop` use the **`ToolCallStatus` enum** — and
that enum is imported from `@copilotkit/core`, not from `@copilotkit/react-core/v2`,
which the docs use without ever showing the import. Also, `useFrontendTool`
handlers must return a `string`; return `JSON.stringify(obj)`, not the object.

**Optional: `useHumanInTheLoop`** fits naturally here if you want a clinician to
approve an interpretation before it is saved. The agent pauses until `respond()`
is called.

**Honest-uncertainty design.** `no_call` must look like a deliberate answer, not
an error — it is the most trustworthy thing the system does. Give it equal
visual weight and explain what additional data would resolve it.

**Persistent disclaimer.** Research prototype. Not for clinical use. Visible
without scrolling.

### 5.4 Suggested layout

Left: upload panel, QC summary, genome metadata. Center: result card and
determinant evidence table. Right: CopilotKit chat sidebar for follow-up
questions ("why was this called resistant?", "what is gyrA S91F?", "what would
change this to a no-call?").

---

## 6. Cross-cutting

**Repo layout** — one repo, three top-level directories:

```
predictor/    Part 1 — pipeline, training, FastAPI, Daytona image + config
llm/          Part 2 — prompts, tool schemas, Fireworks client, evals
web/          Part 3 — Next.js + CopilotKit
prompt.md     this file
README.md     architecture, setup, model-choice rationale with dates
```

**Secrets.** `FIREWORKS_API_KEY`, `DAYTONA_API_KEY`, predictor base URL. Provide
`.env.example` in each part. Never commit real keys. The Fireworks key must stay
server-side — it lives in the Next.js route handler, never in client bundles.

**Reproducibility.** Pin the cohort to a manifest file listing every genome ID
with its quality metrics and lab AST label, so the dataset is fixed even as
BV-BRC's live query results drift. Pin AMRFinderPlus and its database version,
and record both in the model card.

**Testing.** Unit tests for FASTA parsing (multi-contig, lowercase bases, CRLF,
empty records), the feature extractor, and threshold logic. One end-to-end test
that runs a pinned demo genome through `/predict` and asserts the call. Assert
that the grouped split shares no `group_id` across folds — that is the test that
catches the leakage bug everyone hits.

**Attribution.** BV-BRC is publicly funded and freely available; cite it.
AMRFinderPlus is public domain. Record data provenance and license in the repo.

---

## 7. Build order

Work strictly in this order. Each milestone must run before the next starts.

1. **Labels.** Pull the *N. gonorrhoeae* ciprofloxacin cohort with lab-evidence
   filtering and the quality gate. Assert you get roughly 1,481 R / 2,143 S.
   Write the manifest.
2. **Genomes.** Download FASTA for the manifest. Resumable.
3. **Annotate.** AMRFinderPlus across the cohort. Resumable, cached.
4. **Group.** Mash sketch, all-vs-all, single-linkage cluster. Print the
   cluster-size distribution and sanity-check it before proceeding.
5. **Train.** Grouped split, logistic regression, calibrate thresholds on the
   calibration fold, emit model JSON and a model card.
6. **Serve.** FastAPI on Daytona with the contract in §3.7, reachable over
   HTTPS. Verify with curl from outside the sandbox.
7. **LLM.** Fireworks round-trip, then tool calling into `/predict`.
8. **Frontend.** CopilotKit wired to Fireworks, then upload, then the result
   card, then the chat sidebar.
9. **Polish.** Demo genomes, no-call path, disclaimers, README.

---

## 8. Acceptance criteria

- Uploading a known-resistant demo genome returns `likely_to_fail` with gyrA
  S91F visible in the determinant table.
- Uploading a known-susceptible genome returns `likely_to_work`.
- Uploading a low-quality or wrong-species assembly returns `no_call` with a
  specific reason, and the assistant explains it without guessing.
- Held-out metrics are computed on a **grouped** split, and the test asserting
  no `group_id` overlap passes.
- The model card reports AUROC, balanced accuracy, per-class recall, Brier
  score, and no-call rate, with the cohort size stated.
- The chat assistant answers "why?" by citing determinants returned by the
  predictor, not by reasoning about resistance on its own.
- No API keys in the client bundle.

---

## 9. Known traps

1. Training on `Computational Method` rows. Silently ruins everything and still
   produces beautiful metrics.
2. Random train/test splits. Same failure mode — inflated metrics, invisible.
3. The 25,000-row API cap, silently truncating a query you thought returned
   everything.
4. `ftp.bvbrc.org` vs `ftp.bv-brc.org` — the TLS cert mismatch that made a
   previous project abandon the fast download path.
5. Mash single-linkage chaining collapsing the cohort into a few mega-clusters.
   Always print the distribution.
6. Fetching the AMRFinderPlus database at request time instead of baking it into
   the image. Turns a 15-second prediction into minutes.
7. Letting the LLM answer resistance questions when the tool call fails. It must
   surface the failure instead.
8. **Leaving `auto_stop_interval` at its 15-minute default.** It fires even while
   your training job is running. Set it to `0`.
9. **Blowing the 10 GiB sandbox disk** by keeping every FASTA. Stream, annotate,
   discard; persist only TSVs and model artifacts, on a Volume.
10. Reaching for a GPU sandbox. Nothing in this pipeline uses one, and it costs
    up to $4.54/hour to accelerate nothing.
11. Picking `qwen3p7-plus` on Fireworks because it is cheap and fast. It is
    **closed-weights** and fails the open-source requirement.
12. Using `response_format` for structured output with DeepSeek V4 Pro — it
    silently disables reasoning. Use tool calling instead.
13. Demoing on a Fireworks account with no payment method: you are capped at
    **10 requests per minute**.
14. Treating `github.com/daytonaio/daytona` as current. It was frozen in June
    2026; the SDKs are what ship.
15. **Writing CopilotKit v1 code.** `useCopilotAction`, `useCopilotReadable`, and
    `OpenAIAdapter` are the deprecated legacy surface. Use the `/v2` subpath.
16. **Installing `@ai-sdk/*` providers at `@latest`.** They resolve to the
    `provider@4.x` line for `ai` v7; CopilotKit 1.63.2 bundles `ai` v6 and will
    reject the model with an opaque error. Pin to the `3.x` provider line.
17. **Leaving `maxSteps` at its default of 1.** The agent calls the tool, then
    stops without using the result. Looks like the model ignoring your tool.
18. Sending the FASTA through chat attachments. Blows up token cost, hits the
    20 MB cap, and leaks sequence data to the model for no benefit.
19. Using `useComponent` for the prediction card, which makes the LLM retype
    confidence numbers into tool args. Use `useRenderTool`.
20. Leaving `showDevConsole` at its `false` default while debugging.
