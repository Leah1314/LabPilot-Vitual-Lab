# Documentation index

Canonical entry point: **[README.md](./README.md)** — **one integrated system**
using BV-BRC → Daytona → Fireworks → CopilotKit (plus Claude agent surface).

This file maps every other doc so judges and teammates can find the right
runbook without reading everything.

---

## Start here

| Doc | Audience | Contents |
|---|---|---|
| [README.md](./README.md) | Everyone | Integrated product story, full-stack quickstart, contracts, honesty |
| [ABOUT.md](./ABOUT.md) | Judges / GitHub visitors | Short product + full-stack blurb |
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

## Executable READMEs (pipeline & UIs)

| Path | Role in the integrated system |
|---|---|
| [pipeline/README.md](./pipeline/README.md) | Part A: BV-BRC → **Daytona** H100 → enrichment → validate |
| [dashboard/README.md](./dashboard/README.md) | Product UI — Next.js + **CopilotKit** + **Fireworks** (+ Daytona API) |
| [dashboard/CLAUDE.md](./dashboard/CLAUDE.md) | Agent notes for the dashboard codebase |
| [pathogen-pathfinder/README.md](./pathogen-pathfinder/README.md) | Agent UI — CopilotKit + Claude on the same contracts |
| [Insight Uploader/README.md](./Insight%20Uploader/README.md) | TanStack research shell on the same contracts |

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

1. [README.md](./README.md) — integrated architecture + full-stack quickstart  
2. [prompt.md](./prompt.md) §1–3 — product and scientific bar  
3. Your workstream README (`pipeline/`, `dashboard/`, or `pathogen-pathfinder/`)  
4. Matching spec (`daytona.md` / `fireworks.md` / `frontend.md`) only as needed  

---

## Suggested reading order for a judge / demo

1. [README.md](./README.md) — measured table + negative result + tool map  
2. Live **dashboard/** Consult with Fireworks key  
3. `data/timing.json` + `data/cluster_enrichment.json` if pressed on GPU / resistance claims  
