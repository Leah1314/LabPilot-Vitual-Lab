# Contributing / working in this monorepo

**Research prototype. Not for clinical use.**

This repo is one **integrated** system. Prefer the full tool path
(BV-BRC → **Daytona** → **Fireworks** → faithfulness eval → **CopilotKit**)
over fixture-only shortcuts when changing behavior.

## Before you change anything that displays a number

Read the honesty rules in [README.md](./README.md) and [prompt.md](./prompt.md):

1. Never invent or recompute statistics in the LLM — copy from Contract 1/2.  
2. Never claim cluster↔resistance association unless
   `data/cluster_enrichment.json` → `clusters_with_phenotype_signal` lists it.  
3. Never show a % without its denominator.  
4. Quote GPU timings from `data/timing.json` only.  
5. Never quote resistance stats for *H. pylori*.

## Workstreams (integrated handoff)

| Part | Directory | Tools | Spec |
|---|---|---|---|
| A — Data / GPU | `pipeline/` | BV-BRC, **Daytona**, ESM2 | [daytona.md](./daytona.md), [pipeline/README.md](./pipeline/README.md) |
| B — Observations | `scripts/`, `insights/`, `eval/` | **Fireworks**, Braintrust-shaped eval | [fireworks.md](./fireworks.md) |
| C — Product UI | `dashboard/` | **CopilotKit** + Fireworks (+ Daytona API) | [frontend.md](./frontend.md), [dashboard/README.md](./dashboard/README.md) |
| C — Agent UI | `pathogen-pathfinder/` | **CopilotKit** + Claude | [pathogen-pathfinder/README.md](./pathogen-pathfinder/README.md) |
| C — Shell | `Insight Uploader/` | Same contracts | [Insight Uploader/README.md](./Insight%20Uploader/README.md) |

Contracts between parts are frozen in the root README. Do not change JSON shapes
without updating all consumers and `pipeline/validate_contract.py`.

After Part A/B changes that affect fixtures:

```bash
cd dashboard && bun run sync-data
```

## Secrets

- Copy [.env.example](./.env.example) → `.env` and fill **Daytona + Fireworks** for the live path.  
- Never commit API keys. The GitHub repo is public.  
- Dashboard: `FIREWORKS_API_KEY` must stay server-side (no `NEXT_PUBLIC_`).  

## Docs

Full map: [DOCS.md](./DOCS.md).
