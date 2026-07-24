# Dashboard — CopilotKit UI with Genome Upload and Disease Association

**Owner: frontend.** You build the surface the judges actually see.
**CopilotKit facts verified against 1.63.2, 2026-07-24.** See
[prompt.md](./prompt.md) for the brief, [daytona_ssh.md](./daytona_ssh.md) for the
API you consume, [fireworks_2.md](./fireworks_2.md) for the model endpoint.

This doc is a sequence of **prompts you paste into a coding agent**, in order.
Each states its success criterion. Do not move on until the criterion is met —
the failure modes in this stack are silent, and debugging two of them at once
costs more than the hackathon has.

---

## 0. What you are building

A Next.js dashboard with three things on it:

1. **The cohort view** — co-occurrence and resistance statistics for gut-derived
   pathogens, pulled from the Daytona API. This is the baseline product.
2. **Genome upload** — the user drops in a genome or protein FASTA. The backend
   identifies resistance determinants and virulence factors in it by sequence
   similarity, then reports the infection syndromes those organisms and virulence
   factors are associated with in the literature.
3. **A CopilotKit chat panel** — grounded in both the cohort statistics and the
   user's uploaded genome, so a researcher can ask *"what resistance did you find
   in my isolate, and what is still active against it in this cohort?"* and get
   an answer built from computed numbers rather than model recall.

The upload is the demo moment. The cohort view is what makes the upload
meaningful — an isolate's resistance profile is only interesting against a
reference population.

**Build order matters.** Get the cohort view rendering against mocked JSON in the
first 30 minutes, wire the copilot second, add upload third. Upload is the most
impressive and the most cuttable; do not let it block a working demo.

---

## Prompt 1 — Scaffold and pin dependencies

> Create a Next.js app (App Router, TypeScript, Tailwind) in `web/` and install
> CopilotKit with **exactly** these versions:
>
> ```bash
> npx create-next-app@latest web --typescript --tailwind --app
> cd web
> npm install @copilotkit/react-core@1.63.2 @copilotkit/react-ui@1.63.2 @copilotkit/runtime@1.63.2
> npm install @ai-sdk/openai-compatible@^2.0.62
> npm install zod recharts
> ```
>
> **Never install any `@ai-sdk/*` package at `@latest`.** CopilotKit 1.63.2
> bundles `ai@^6`, which pins `@ai-sdk/provider@3.x`. `@latest` today resolves to
> a `provider@4.x` build for `ai` v7, and the resulting model object is rejected
> with an opaque "unsupported model version" error rather than a clean failure.
> Alternatives if you prefer them: `@ai-sdk/openai@^3.0.36` or
> `@ai-sdk/fireworks@^2.0.70`. Pinned, always.
>
> **Do not pin CopilotKit below 1.63.0** — that release fixed an `/info` request
> storm firing 70–80 requests per page load under StrictMode, and TypeScript
> declaration resolution under `bundler`/`nodenext` tsconfigs.
>
> Then wrap the app in the provider:
>
> ```tsx
> // app/layout.tsx
> import { CopilotKit } from "@copilotkit/react-core/v2";
> import "@copilotkit/react-core/v2/styles.css";
>
> export default function RootLayout({ children }: { children: React.ReactNode }) {
>   return (
>     <html lang="en">
>       <body>
>         <CopilotKit runtimeUrl="/api/copilotkit" showDevConsole>{children}</CopilotKit>
>       </body>
>     </html>
>   );
> }
> ```
>
> `showDevConsole` defaults to `false`. Turn it on now or you debug blind.
>
> Report `npm ls ai @ai-sdk/openai-compatible @copilotkit/react-core` so I can
> confirm the resolved versions.

**Success criterion:** the dev server starts and `npm ls ai` shows a single
`ai@6.x`, not two versions.

### The single biggest thing to get right: use the v2 API

CopilotKit ships **two APIs in the same packages**. Everything in tutorials,
blog posts, and most search results is the **deprecated v1 surface**. The current
API lives under the **`/v2` subpath**.

| Legacy v1 — do not write | Use instead |
|---|---|
| `useCopilotAction` | `useFrontendTool` |
| `useCopilotReadable` | `useAgentContext` |
| `useCopilotAction` + `renderAndWaitForResponse` | `useHumanInTheLoop` |
| `useCoAgent` | `useAgent` |
| `OpenAIAdapter` + `serviceAdapter` | `BuiltInAgent` + `createCopilotRuntimeHandler` |

Chat components import from **`@copilotkit/react-core/v2`**, not from
`@copilotkit/react-ui` — which has no v2 JS export. Tool parameters are **Zod
schemas**, so `zod >= 3` is required.

Do **not** reach for `useAgent` / CoAgents. Those are for stateful LangGraph-style
backend graphs. `useFrontendTool`, `useAgentContext`, and `useRenderTool` cover
everything in this dashboard.

---

## Prompt 2 — Wire the runtime to Fireworks

> Create `app/api/copilotkit/[...path]/route.ts`. The file path is not
> negotiable — it must be a catch-all segment, and it must export both `GET` and
> `POST`.
>
> ```ts
> import { CopilotRuntime, createCopilotRuntimeHandler, BuiltInAgent, defineTool }
>   from "@copilotkit/runtime/v2";
> import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
> import { z } from "zod";
>
> const fireworks = createOpenAICompatible({
>   name: "fireworks",
>   apiKey: process.env.FIREWORKS_API_KEY!,
>   baseURL: "https://api.fireworks.ai/inference/v1",
> });
>
> const runtime = new CopilotRuntime({
>   agents: {
>     default: new BuiltInAgent({
>       model: fireworks(process.env.FIREWORKS_MODEL!),
>       maxSteps: 5,
>       prompt: SYSTEM_PROMPT,
>       tools: [queryCooccurrence, queryResistanceProfile, queryGenomeAnalysis],
>     }),
>   },
> });
>
> const handler = createCopilotRuntimeHandler({ runtime, basePath: "/api/copilotkit" });
> export { handler as GET, handler as POST };
> ```
>
> Read the model ID from `FIREWORKS_MODEL` — do not hard-code it. You will switch
> models under time pressure, and a dedicated deployment's ID looks like
> `accounts/fireworks/models/gpt-oss-120b#accounts/<ACCT>/deployments/<DEP_ID>`.
>
> **Before building any UI, prove the tool-call round-trip works.** Add one
> trivial tool that returns a constant, ask the copilot a question that forces it,
> and confirm the result reaches the model. Report the transcript.

**Success criterion:** the chat answers a question using a tool result, not from
its own knowledge. **Do this in the first hour.** Generative UI depends entirely
on the model emitting well-formed tool calls in the shape `ai` v6 expects, and
tool-calling fidelity varies across open models. If it fails, fall back through
`deepseek-v4-flash`, then `gpt-oss-120b`, before you change any of your own code.

### Three traps, each worth an hour you do not have

1. **`maxSteps` defaults to `1`.** The agent calls your tool and then stops
   without ever using the result. This looks *exactly* like the model ignoring
   your tool, and you will spend the hour debugging the tool. Set `maxSteps: 5`.
2. **`forwardSystemMessages` defaults to `false`** — system messages sent from
   the client are silently dropped. The system prompt goes in `BuiltInAgent`'s
   `prompt` field, nowhere else.
3. **`FIREWORKS_API_KEY` must stay in the route handler.** Anything prefixed
   `NEXT_PUBLIC_` ships in the client bundle, and **this repo is public.**

### Backend tools

```ts
const queryCooccurrence = defineTool({
  name: "queryCooccurrence",
  description: "Get resistance/virulence gene co-occurrence statistics for an organism",
  parameters: z.object({
    organism: z.string().describe("e.g. 'Klebsiella pneumoniae'"),
    minSupport: z.number().optional(),
  }),
  execute: async ({ organism, minSupport = 5 }) => {
    const r = await fetch(
      `${process.env.PIPELINE_URL}/cooccurrence?organism=${encodeURIComponent(organism)}&min_support=${minSupport}`);
    if (!r.ok) return JSON.stringify({ error: `pipeline returned ${r.status}` });
    return await r.json();
  },
});
```

**When a tool call fails, return the failure.** Do not swallow it and let the
model answer from memory. An LLM confidently inventing resistance statistics is
the worst possible failure mode this product has. Test that path deliberately —
stop the Daytona sandbox and ask a question.

---

## Prompt 3 — The cohort view

Build this against mocked JSON matching the API contract. Do not wait for the
backend.

> Build the main dashboard view at `app/page.tsx`:
>
> **Left rail:** organism selector (*E. coli*, *K. pneumoniae*, *E. faecium*,
> *E. faecalis*, *C. difficile*), a minimum-support slider, a
> raw/deduplicated toggle, and a cohort summary showing genome count and the
> **pinned data date**.
>
> **Centre:** a ranked table of co-occurring gene pairs with columns for lift,
> adjusted p-value, **deduplicated strain count**, country spread, and year
> range. Above it, a bar chart of resistant-vs-susceptible counts per drug from
> `/resistance-profile` (use `recharts`).
>
> **Right:** the CopilotKit chat panel.
>
> Data shape from `GET /cooccurrence?organism=&min_support=`:
> ```json
> { "pairs": [ { "gene_a": "...", "gene_b": "...", "lift": 3.2, "jaccard": 0.4,
>                "p_adj": 0.001, "n_genomes_raw": 412, "n_strains_dedup": 37,
>                "n_countries": 1, "year_range": [2019, 2019] } ] }
> ```
>
> Create `web/mocks/cooccurrence.json` with 15 realistic rows now, including at
> least two where `n_genomes_raw` is ~10x `n_strains_dedup` and at least one
> confined to a single country and year. Build against the mock behind a
> `USE_MOCKS` env flag so swapping in the real API is one variable.

### The honesty affordances — these are the design

The backend returns both `n_genomes_raw` and `n_strains_dedup` on every
statistic. That contract exists so the UI can be truthful. Use it:

- **Display the deduplicated count by default**, with the raw count one click
  away. The gap between them is scientifically meaningful and showing it is a
  feature, not an admission.
- **Badge any pattern confined to one country or one year** as a possible
  outbreak artefact. `n_countries` and `year_range` exist for exactly this.
- **Never show a percentage without its denominator adjacent to it.**
- **Persistent disclaimer, visible without scrolling:** research prototype, not
  for clinical use.
- Credit BV-BRC, CARD, VFDB, and NDARO in the footer, and show the pinned data
  date in the UI.

These four details cost very little and they are the most likely single thing to
win the room. They make the dashboard look like it was built by people who know
the field rather than people who found a dataset.

---

## Prompt 4 — Genome upload UI

CopilotKit has no verified file-upload primitive in v2. Do the upload with plain
React and feed the *result* to the copilot. That is simpler and it keeps the
model away from the raw sequence, which you want anyway.

> Build a `GenomeUpload` component:
>
> - A drop zone accepting `.fasta`, `.fa`, `.fna`, `.faa`, and `.fasta.gz`.
> - **Hard client-side cap of 20 MB**, checked before any read. A bacterial
>   genome assembly is ~5 MB of nucleotide FASTA and a bacterial proteome is
>   ~1–2 MB of protein FASTA, so 20 MB is generous. Reject anything larger with a
>   message explaining the limit rather than hanging the tab.
> - Read only the **first 2 KB client-side** to validate: does it start with `>`,
>   and does the sequence alphabet look like nucleotide (ACGTN) or protein? Show
>   the detected type and the first record's header so the user can confirm they
>   uploaded what they meant to. Do **not** parse the whole file in the browser.
> - `POST` the file as `multipart/form-data` to `${PIPELINE_URL}/genome/analyze`.
>   All real work happens server-side, in the sandbox, near the reference data.
> - Show a progress state with a *specific* message per phase — "uploading",
>   "calling genes", "matching against CARD", "matching against VFDB",
>   "summarising" — because the wait is 10–60 seconds and a generic spinner for
>   that long reads as broken.
> - On success, store the result in React state and render an `IsolateReport`.
> - On failure, show the backend's error text. Never fabricate a result.
>
> Ship **two sample files** in `web/public/samples/` with a one-click "try a
> sample" button: one *K. pneumoniae* assembly carrying a known carbapenemase,
> one *E. coli*. The button is what you click during the demo — never upload a
> file live from a laptop's file picker in front of judges.

**Success criterion:** a sample file round-trips to a rendered report, from a
cold page load, in under 60 seconds.

---

## Prompt 5 — The backend analysis endpoint

This runs in the Daytona sandbox alongside the rest of the pipeline. It is
frontend-adjacent work but the frontend owns the contract, so it is specified
here.

> Add `POST /genome/analyze` to the FastAPI app. It accepts a FASTA upload and
> returns the JSON contract below.
>
> Pipeline:
> 1. **Detect the alphabet.** If nucleotide, call genes with
>    `prodigal -i input.fna -a proteins.faa -p meta` (or `-p single` for a
>    complete assembly). If already protein, skip this step.
> 2. **Match against a resistance reference** — CARD's protein homolog model
>    FASTA — using DIAMOND:
>    ```bash
>    diamond makedb --in card_protein_homolog.faa -d card      # once, at build time
>    diamond blastp -q proteins.faa -d card -o hits.tsv --outfmt 6 \
>            qseqid sseqid pident length evalue bitscore \
>            --id 80 --query-cover 70 --max-target-seqs 1 --threads 4
>    ```
> 3. **Match against a virulence reference** — VFDB core dataset — the same way.
> 4. **Join hits to the pinned cohort** so each identified gene carries the
>    lab-measured resistance context already computed for it, with both
>    `n_genomes_raw` and `n_strains_dedup`.
> 5. **Return** the contract below.
>
> **Build the DIAMOND databases into the sandbox image, at image-build time.**
> Downloading and indexing CARD and VFDB during a live demo is how you lose the
> demo.
>
> Response contract — the frontend is built against exactly this:
> ```json
> {
>   "input": { "filename": "...", "type": "nucleotide", "n_contigs": 84,
>              "total_bp": 5348219, "n_proteins_called": 5140 },
>   "organism_guess": { "name": "Klebsiella pneumoniae", "basis": "marker gene identity", "confidence": "moderate" },
>   "resistance_hits": [
>     { "query_id": "contig_3_142", "gene": "blaKPC-2", "product": "carbapenem-hydrolyzing class A beta-lactamase",
>       "drug_class": "carbapenem", "identity": 99.6, "coverage": 100.0, "source": "CARD",
>       "cohort_context": { "n_genomes_raw": 412, "n_strains_dedup": 37,
>                           "lab_resistant": 31, "lab_susceptible": 2 } }
>   ],
>   "virulence_hits": [ { "query_id": "...", "factor": "...", "category": "siderophore", "identity": 94.1, "source": "VFDB" } ],
>   "disease_associations": [
>     { "condition": "Infected pancreatic necrosis", "basis": "organism-level literature association",
>       "evidence": "reference", "citation_url": "https://..." }
>   ],
>   "timings_ms": { "gene_calling": 4100, "resistance_match": 900, "virulence_match": 800 },
>   "disclaimer": "Research prototype. Sequence-similarity screening only. Not a diagnostic result."
> }
> ```
>
> Every hit carries `identity` and `coverage`. Do not return hits below 80%
> identity and 70% coverage without labelling them as weak.

### Why DIAMOND and not BLAST

NCBI's BLAST URL API (`https://blast.ncbi.nlm.nih.gov/Blast.cgi`, the
`CMD=Put` → poll `CMD=Get` flow) takes minutes per query and asks callers to
poll politely. It is not viable for a live demo. DIAMOND against a local CARD
database returns a bacterial proteome's hits in seconds on the sandbox's 4 vCPUs.
`mmseqs2` is an equally good choice if you already know it. The point is that the
reference database is local and pre-indexed.

> **Verify these before relying on them.** I did not confirm the following live
> in this session, and the repo standard is that facts are checked: the CARD
> download URL and its licence terms for redistribution (academic use is free but
> download requires accepting terms — do **not** commit the database to this
> public repo), the VFDB download URL and file naming, and whether `prodigal` is
> apt-installable in the Debian slim image or needs a binary drop-in. Check all
> three in the first 20 minutes; each has an obvious fallback (bundle at runtime
> from a private bucket; use CARD only; require protein FASTA input and skip gene
> calling entirely).

### On "associated diseases" — be careful here

This is the claim most likely to be challenged, so make it a modest one.

What you can honestly say from a bacterial genome:

- **Which resistance determinants are present**, by sequence similarity to a
  curated reference, with identity and coverage shown.
- **Which virulence factors are present**, the same way.
- **Which infection syndromes that organism is associated with in the
  literature** — for gut-derived pathogens: bacteraemia, intra-abdominal
  infection, infected pancreatic necrosis, urinary tract infection,
  *C. difficile* colitis. This is an organism-level statement with a citation,
  not an inference from the uploaded sequence.

What you **cannot** say, and must not let the UI imply:

- That the isolate *will* cause any particular disease. Carriage and infection
  are not the same thing, and *S. aureus* heritability work (Young et al. 2021:
  2.1%, 95% CI 0.0–5.3%) is the standard illustration that lineage barely
  predicts invasiveness.
- That a detected gene confers clinical resistance. Gene presence is not
  phenotype. Say "carries a determinant associated with X resistance", and show
  the lab-measured R/S counts from the cohort next to it.
- Anything resembling an antibiotic recommendation for a patient.

Label each association with its `basis` field and render that basis in the UI.
"Organism-level literature association" reads as honest; an unqualified disease
name next to an upload reads as a diagnosis.

### If the user uploads a human genome

They will try. A human WGS VCF is gigabytes and your 20 MB cap rejects it, which
is the correct behaviour — but say why. Detect a VCF header (`##fileformat=VCFv`)
and return a clear message: this tool screens **bacterial** genomes for
antimicrobial resistance determinants, it does not interpret human variants, and
uploading personal genetic data to a hackathon prototype is a bad idea. That
message is a better demo moment than a half-built ClinVar lookup, and it is the
answer a judge who works in clinical genetics wants to hear.

---

## Prompt 6 — Connect the upload to the copilot

> Expose the uploaded isolate to the copilot as context, and give it a tool to
> re-query it.
>
> ```tsx
> import { useAgentContext } from "@copilotkit/react-core/v2";
>
> useAgentContext({
>   description: "The isolate the user uploaded, and the current dashboard filters",
>   value: {
>     organism, minSupport, dedupEnabled, cohortDate,
>     uploadedIsolate: report && {
>       filename: report.input.filename,
>       organismGuess: report.organism_guess.name,
>       resistanceGenes: report.resistance_hits.map(h => h.gene),
>       virulenceFactors: report.virulence_hits.map(h => h.factor),
>     },
>   },
> });
> ```
>
> Values must be **strictly JSON-serializable** — a `Date` or a class instance
> throws. Put the *summary* here, never the bulk data and never the sequence. The
> assistant needs to know what the user is looking at, not the whole dataset.
>
> Then add a backend tool `queryGenomeAnalysis` that fetches the full stored
> report by ID, so the model can pull detail on demand without it all sitting in
> context.
>
> Finally, one `useFrontendTool` so the chat can drive the UI:
>
> ```tsx
> useFrontendTool({
>   name: "highlightGene",
>   description: "Scroll to and highlight a gene in the isolate report",
>   parameters: z.object({ gene: z.string() }),
>   handler: async ({ gene }) => {
>     setHighlighted(gene);
>     return JSON.stringify({ ok: true, gene });   // MUST be a string
>   },
> });
> ```

**`useFrontendTool` handlers must return a `string`.** Returning an object fails
in a way that is not obvious from the error.

### Rendering tool results

> Use `useRenderTool`, **not `useComponent`.**
>
> ```tsx
> import { useRenderTool } from "@copilotkit/react-core/v2";
>
> useRenderTool({
>   name: "queryCooccurrence",
>   parameters: z.object({ organism: z.string() }),
>   render: ({ parameters, status, result }) => {
>     if (status === "inProgress") return <Skeleton />;
>     if (status === "executing") return <div>Analysing {parameters.organism}…</div>;
>     return <CooccurrenceCard {...JSON.parse(result)} />;
>   },
> }, []);
> ```

Both `useRenderTool` and `useComponent` render React in chat. `useComponent` lets
the LLM call a component as a tool and fill its props — which means **the model
retypes your statistics into tool arguments**. When the numbers are the entire
product, that is unacceptable. `useRenderTool` is renderer-only, keyed to the
backend tool name, and renders the actual JSON your API returned. Reserve
`useComponent` for things the model legitimately composes — comparisons,
summaries — never for numbers.

### API sharp edges

- **Status types are inconsistent.** `useRenderTool` reports **string literals**
  (`"inProgress"`, `"executing"`, `"complete"`), while `useFrontendTool` and
  `useHumanInTheLoop` use the **`ToolCallStatus` enum**.
- **`ToolCallStatus` imports from `@copilotkit/core`**, not from
  `@copilotkit/react-core/v2` — and the docs use it in examples without ever
  showing the import. This will bite you.
- `useRenderTool` intentionally does not clean up on unmount, so chat history
  keeps rendering. Registrations dedupe by `agentId:name`, latest wins.

---

## Prompt 7 — The system prompt

> Write `SYSTEM_PROMPT` in the runtime route with these rules, and structure it
> so the stable material sits at the **front** of the prompt where it caches:
>
> 1. **Every numeric claim must be copied verbatim** from tool output. Never
>    infer, never round, never recompute. The model's job is to turn computed
>    statistics into readable English, nothing else.
> 2. **Always state the deduplicated strain count** alongside any percentage. A
>    percentage without its denominator is exactly what makes these dashboards
>    misleading.
> 3. **Flag single-country or single-year patterns** as possible outbreak
>    artefacts. `n_countries` and `year_range` are in every response for this.
> 4. **No speculation** about mechanism, causation, or clinical significance.
>    Co-occurrence is neither linkage nor causation.
> 5. **Never recommend an antibiotic** and never phrase output as clinical advice.
> 6. **Distinguish laboratory-measured phenotypes from computational
>    annotations** whenever both appear.
> 7. For an uploaded isolate, say "carries a determinant associated with X
>    resistance", never "is resistant to X". Gene presence is not phenotype.
> 8. **If a tool call fails, say so.** Do not answer from your own knowledge about
>    resistance genes or organisms.
>
> Keep `temperature` at 0.1–0.2. You want faithful restatement, not prose variety.

---

## Prompt 8 — Demo hardening

> Prepare the demo:
>
> - **Screenshot every key screen** as a PNG fallback: cohort view, a populated
>   isolate report, and a good chat exchange. Live demos of cloud sandboxes fail,
>   and a screenshot beats a spinner.
> - **Test the demo laptop against the Daytona preview URL on the venue
>   network.** Conference wifi blocks odd ports with some regularity, and you
>   want to know at hour one.
> - Add a "pipeline stats" strip showing measured numbers only: gene-calling
>   time, DIAMOND match time, and per-observation LLM latency. **Never quote a
>   speedup you have not measured.**
> - Write a canned query list and rehearse it. Do not improvise prompts in front
>   of judges. Three that work well:
>   - "What resistance determinants are in the isolate I uploaded?"
>   - "How common is that combination in the reference cohort?"
>   - "What is still susceptible in *K. pneumoniae* here?"
> - **Freeze the code at 3:15 and rehearse twice.**

---

## Traps

1. Writing v1 code — `useCopilotAction`, `useCopilotReadable`, `OpenAIAdapter`.
2. Mixing bare `@copilotkit/react-core` and `/v2` imports in one tree.
3. Any `@ai-sdk/*` installed at `@latest` — the provider v3/v4 mismatch, which
   fails with an opaque "unsupported model version".
4. `maxSteps` left at 1, which looks exactly like the model ignoring your tool.
5. `useComponent` instead of `useRenderTool`, letting the model retype statistics.
6. Importing `ToolCallStatus` from the wrong package.
7. Returning an object rather than a string from a `useFrontendTool` handler.
8. A `Date` inside `useAgentContext`, or the whole dataset inside it.
9. Pinning CopilotKit below 1.63.0.
10. `showDevConsole` left `false` while debugging.
11. `FIREWORKS_API_KEY` reaching the client bundle. **The repo is public.**
12. Parsing an uploaded FASTA client-side instead of streaming it to the backend.
13. Downloading or indexing CARD/VFDB at request time rather than image-build time.
14. Committing the CARD database to this public repo — its terms do not permit it.
15. Presenting a gene hit as a phenotype, or an organism as a diagnosis.
16. A generic spinner over a 30-second analysis, which reads as a hang.
