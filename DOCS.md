# Documentation index

Canonical entry point: **[README.md](./README.md)**.

This file maps every other doc in the repo so judges and teammates can find the
right runbook without reading everything.

---

## Start here

| Doc | Audience | Contents |
|---|---|---|
| [README.md](./README.md) | Everyone | What the project is, measured results, quickstart, contracts, honesty |
| [ABOUT.md](./ABOUT.md) | Judges / GitHub visitors | Short product + demo blurb |
| [DOCS.md](./DOCS.md) | Everyone | This index |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Builders | Honesty rules when editing |
| [SECURITY.md](./SECURITY.md) | Everyone | Disclosure + not-for-clinical-use |
| [CITATION.cff](./CITATION.cff) | Academia | Citation metadata |
| [REPO_ABOUT.md](./REPO_ABOUT.md) | Repo owner | Commands to set GitHub About / topics |
| [prompt.md](./prompt.md) | Product / judges | Hackathon brief, scientific bar, eval expectations |
| [hackathon_build_planner.md](./hackathon_build_planner.md) | Builders | 3-workstream plan, contracts, kickoff checklist |

---

## Workstream specs (reference)

| Doc | Workstream | Contents |
|---|---|---|
| [daytona.md](./daytona.md) | Part A | BV-BRC + Daytona GPU serving contract, co-occurrence, caveats |
| [daytona_ssh.md](./daytona_ssh.md) | Part A | Ordered SSH/CLI runbook: sandbox → pull → embed → serve |
| [fireworks.md](./fireworks.md) | Part B | Grounding rules: LLM never invents numbers |
| [fireworks_2.md](./fireworks_2.md) | Part B | Hosting open-weights models on Fireworks |
| [fireworks_readme.md](./fireworks_readme.md) | Part B | Short Fireworks notes |
| [frontend.md](./frontend.md) | Part C | CopilotKit dashboard honesty affordances |
| [dashboard.md](./dashboard.md) | Part C | CopilotKit v2 dashboard build notes |

---

## Executable READMEs (apps & pipeline)

| Path | What to run |
|---|---|
| [pipeline/README.md](./pipeline/README.md) | Part A: fetch → Daytona H100 → enrichment → validate |
| [dashboard/README.md](./dashboard/README.md) | Next.js + CopilotKit (Fireworks) — **primary demo UI** |
| [dashboard/CLAUDE.md](./dashboard/CLAUDE.md) | Agent notes for the dashboard codebase |
| [pathogen-pathfinder/README.md](./pathogen-pathfinder/README.md) | Next.js + CopilotKit + Claude Agent SDK |
| [Insight Uploader/README.md](./Insight%20Uploader/README.md) | TanStack Start research workspace UI |

---

## Data & eval artefacts

| Path | Contract / role |
|---|---|
| `pipeline/manifest.json` | Pinned 240-genome cohort |
| `data/cluster_summary.json` | **Contract 1** — cluster statistics |
| `data/cluster_enrichment.json` | Honesty gate (`clusters_with_phenotype_signal`) |
| `data/timing.json` | Measured GPU timings — quote this, not memory |
| `data/cohort_meta.json` | Phenotype rule, caveats, attribution |
| `insights/observations.json` | **Contract 2** — grounded observations |
| `eval/braintrust_results.json` | Faithfulness scores / eval metadata |

---

## Environment

| File | Secrets |
|---|---|
| [.env.example](./.env.example) | `DAYTONA_API_KEY`, `FIREWORKS_API_KEY`, `BRAINTRUST_API_KEY` |
| [dashboard/.env.example](./dashboard/.env.example) | Fireworks + optional `PIPELINE_URL` |
| [pathogen-pathfinder/.env.example](./pathogen-pathfinder/.env.example) | `ANTHROPIC_API_KEY`, CopilotKit license |

Never commit `.env`. This repository is public.

---

## Suggested reading order for a new teammate

1. [README.md](./README.md) — architecture + honesty rules  
2. [prompt.md](./prompt.md) §1–3 — product and scientific bar  
3. Your workstream README (`pipeline/`, `dashboard/`, or `pathogen-pathfinder/`)  
4. Matching spec (`daytona.md` / `fireworks.md` / `frontend.md`) only as needed  

---

## Suggested reading order for a judge / demo

1. [README.md](./README.md) — measured table + negative result  
2. Live UI (`dashboard/` sample dataset)  
3. `data/timing.json` + `data/cluster_enrichment.json` if pressed on GPU / resistance claims  
