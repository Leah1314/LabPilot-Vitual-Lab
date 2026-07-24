# Gut-to-Pancreas Pathogen Risk Dashboard — Hackathon Brief

**Constraint: 3–4 hours, four people, live demo at the end.**
**Stack: Daytona (incl. H100 GPU), Fireworks AI, CopilotKit, Braintrust.**
**All data and platform facts verified live on 2026-07-24.**

| Workstream | Doc | Deliverable |
|---|---|---|
| Data, analysis, serving | **[daytona.md](./daytona.md)** | Public HTTPS endpoint serving statistics as JSON |
| LLM observations | **[fireworks.md](./fireworks.md)** | Statistics JSON → trustworthy English |
| Dashboard | **[frontend.md](./frontend.md)** | Next.js + CopilotKit UI |
| Evaluation | §5 below | Braintrust faithfulness scores |

---

## 1. The product

Infected pancreatic necrosis is the deadliest complication of severe
pancreatitis, and the organisms responsible are overwhelmingly gut-derived:
*E. coli*, *Klebsiella pneumoniae*, *Enterococcus*, *C. difficile*. ICU
clinicians choose empiric antibiotics for these infections with limited
visibility into what the current resistance landscape actually looks like.

You are building a dashboard that ingests BV-BRC's structured pathogen data for
those organisms and surfaces, in minutes, the resistance and virulence structure
a researcher would otherwise assemble by hand over weeks: which resistance
determinants travel together, which co-occur with virulence factors, how that
varies by host and geography, and what is still susceptible.

A conversational panel lets a researcher interrogate it directly — *"what is
still active against carbapenem-resistant Klebsiella in this cohort?"*

---

## 2. The decision that makes the timeline possible

**Do not run genome annotation. Do not download genome sequences. Do not train a
model.** Any one of these consumes the entire hackathon.

BV-BRC has already run the annotation. `sp_gene` holds precomputed
resistance-gene and virulence-factor calls sourced from CARD, VFDB, NDARO, and
others. `genome_amr` holds laboratory-measured susceptibility results. Both are
structured tables over REST returning JSON or CSV.

The pipeline is **pull tables → compute co-occurrence → narrate → display**.
Every step is minutes. Details in [daytona.md](./daytona.md).

---

## 3. The scientific credibility bar

Two things separate this from a project that gets dismantled in the Q&A. Both
are cheap. Neither is optional.

**Lineage deduplication.** A finding like *"78% of mcr-1-carrying Klebsiella also
carry virulence cluster X"* is, by default, an artefact — public genome databases
are wildly oversampled for outbreak strains, and resistance genes ride on shared
plasmids. Deduplicate by strain before counting, report raw and deduplicated
numbers side by side, and flag patterns confined to one country or one year.
Costs about fifteen minutes. Full treatment in [daytona.md §3.2](./daytona.md).

**The LLM never generates a number.** Every numeric claim is copied verbatim from
computed statistics. Rules in [fireworks.md §5](./fireworks.md), enforced by the
Braintrust eval in §5 below and surfaced in the UI per
[frontend.md §4](./frontend.md).

---

## 4. About the GPU story

Be careful here. The obvious plan — embed known AMR proteins with ESM2 and
cluster them — **is close to circular**: those proteins already carry curated
CARD/VFDB identifiers, so clustering their embeddings mostly recovers the gene
families the labels already state.

The defensible version is to embed the **unannotated** proteins and find ones
sitting close to known resistance proteins in embedding space — candidate genes
that BLAST-based annotation missed. Genuine discovery, genuinely needs a GPU,
sharp narrative. Present as **candidates requiring validation**, never as
confirmed genes.

**If time is short, cut the GPU entirely.** Honest lineage-corrected statistics
with a good conversational interface beat a GPU figure a judge can dismantle.
**Decide at the 2-hour mark, not at 3:30.** See [daytona.md §3.3](./daytona.md).

### On the "100 hours versus 2 hours" pitch

Only make this claim if you can substantiate it. A fabricated benchmark is the
one thing that can genuinely sink you, because it invites a question you cannot
answer. Two honest framings that land just as well:

- Time your pipeline end to end and state that number plainly, alongside a
  concrete description of the manual alternative — cross-referencing CARD, VFDB,
  and AST tables by hand across N genomes.
- Frame the value as **access** rather than raw speed: this analysis is currently
  out of reach for a lab without a bioinformatician, and you put it one question
  away.

---

## 5. Braintrust — the evaluation layer

Braintrust is your evidence that the LLM layer is trustworthy, which is exactly
what a judge will probe when an LLM is narrating scientific data.

Build a small eval — **20 to 30 examples is plenty**:

1. **Faithfulness.** Given a statistics JSON and the generated observation, does
   every number in the prose appear in the JSON? Gradeable programmatically with
   a regex over numerals, plus an LLM judge for phrasing. **This is your headline
   metric.**
2. **No-overclaim.** Does the observation avoid asserting causation, mechanism,
   or clinical recommendation? LLM-judged against a short rubric.
3. **Artefact-flagging.** For single-country or single-year patterns, does the
   observation flag the limitation? Hand-label ~10 cases.

Also use Braintrust tracing for latency and cost per observation — a live number
to show during the demo.

**Deliberately include failure cases** and show the eval catching them. A panel
reporting 100% on everything reads as untested; one showing a real failure mode
you found and handled reads as engineering.

Wire this up **in parallel** with the frontend, not after. It is the piece most
likely to get cut and it is disproportionately convincing.

---

## 6. Timeline

Four workstreams in parallel from minute zero. Nobody waits.

| Time | Data/Analysis | Backend/Daytona | Frontend | Eval |
|---|---|---|---|---|
| **0:00–0:30** | Write + test every BV-BRC query. Pin the genome manifest. | Create sandbox, verify preview URL reachable from a browser | Scaffold Next.js, install **pinned** AI SDK provider | Braintrust project setup |
| **0:30–1:00** | Pull sp_gene + genome_amr to CSV | FastAPI skeleton, CORS, `/healthz` | **Fireworks tool-call round-trip working** | Draft rubrics |
| **1:00–2:00** | Co-occurrence + **dedup by strain** | Serve `/cooccurrence`, `/resistance-profile` | Network graph + table | Collect 20–30 examples |
| **2:00–2:30** | **Decision point: GPU in or out?** | Wire real data end to end | Chat panel + observation cards | Run eval |
| **2:30–3:15** | (If in) ESM2 on unannotated proteins | `/candidates` | Polish, badges, disclaimers | Screenshot scores |
| **3:15–4:00** | — | Freeze | Demo rehearsal, 2 backup screenshots | — |

**Hard rules.** Freeze at 3:15. Rehearse twice. Screenshot every key screen —
live demos of cloud sandboxes fail and a screenshot beats a spinner. Test the
demo laptop against the preview URL **on the venue network** early; conference
wifi blocks odd ports.

---

## 7. The three things most likely to cost you an hour

Pulled forward from the per-workstream docs because each is silent, misleading,
and expensive:

1. **`@ai-sdk/*` installed at `@latest`.** CopilotKit 1.63.2 bundles `ai` v6
   (provider 3.x); `@latest` resolves to 4.x and fails with an opaque
   "unsupported model version". Pin the versions in
   [frontend.md §2](./frontend.md).
2. **`maxSteps` defaults to 1** in CopilotKit — the agent calls your tool then
   stops without using the result, which looks exactly like the model ignoring
   the tool. Set it to 5.
3. **Daytona `auto_stop_interval` defaults to 15 minutes and fires even while
   your job is running.** Set it to 0.

And one that is not technical: **Fireworks caps you at 10 requests per minute
with no payment method on file.** Add one before the demo.

---

## 8. Cross-cutting

**Repo layout**

```
pipeline/     BV-BRC fetch, co-occurrence, dedup, Daytona config
api/          FastAPI serving layer
web/          Next.js + CopilotKit
evals/        Braintrust
daytona.md  fireworks.md  frontend.md  prompt.md
```

**Secrets.** `FIREWORKS_API_KEY`, `DAYTONA_API_KEY`, `BRAINTRUST_API_KEY`,
pipeline URL. **This repo is public** — commit only `.env.example`, never a real
key. The Fireworks key must stay server-side in the Next.js route handler or it
ships in the client bundle.

**Attribution.** BV-BRC is publicly funded and freely available; cite it. CARD,
VFDB, and NDARO have their own terms — credit them on the dashboard. Show the
pinned data date in the UI.

**Honesty rules, non-negotiable.**
- Never present computational predictions as laboratory measurements.
- Never present a GPU-derived candidate as a confirmed resistance gene.
- Never quote a speedup you have not measured.
- Never show a percentage without its denominator.
- Every screen carries: research prototype, not for clinical use.
