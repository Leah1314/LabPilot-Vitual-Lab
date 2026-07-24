# Contributing / working in this monorepo

**Research prototype. Not for clinical use.**

## Before you change anything that displays a number

Read the honesty rules in [README.md](./README.md) and [prompt.md](./prompt.md).
In particular:

1. Never invent or recompute statistics in the LLM — copy from Contract 1/2.  
2. Never claim cluster↔resistance association unless
   `data/cluster_enrichment.json` → `clusters_with_phenotype_signal` lists it.  
3. Never show a % without its denominator.  
4. Quote GPU timings from `data/timing.json` only.  
5. Never quote resistance stats for *H. pylori*.

## Workstreams

| Part | Directory | Spec |
|---|---|---|
| A — Data / GPU | `pipeline/` | [daytona.md](./daytona.md), [pipeline/README.md](./pipeline/README.md) |
| B — Observations | `scripts/`, `insights/`, `eval/` | [fireworks.md](./fireworks.md) |
| C — UI | `dashboard/` (primary), `pathogen-pathfinder/`, `Insight Uploader/` | [frontend.md](./frontend.md) |

Contracts between parts are frozen in the root README. Do not change JSON shapes
without updating all consumers and `pipeline/validate_contract.py`.

## Secrets

- Copy [.env.example](./.env.example) → `.env` locally.  
- Never commit API keys. The GitHub repo is public.  
- Dashboard: `FIREWORKS_API_KEY` must stay server-side (no `NEXT_PUBLIC_`).  

## Docs

Full map: [DOCS.md](./DOCS.md).
