# LabPilot Virtual Lab

LabPilot Virtual Lab is an AI-assisted experimental planning dashboard for biopharma teams. It keeps the interactive UI from the original hackathon work, but the core decision loop is now aligned to the product guidance: structured observations, model-based next-step recommendations, explicit human approval, and optional AWS-backed persistence.

The current implementation is optimized for:

- OpenAI credits for the reasoning layer
- AWS account credits for lightweight persistence
- A dashboard-first workflow for reviewing evidence before running the next experiment

Research prototype only. Not for clinical use.

## What this repo contains

This repository started from reusable work in [johnqh/daytona_hackathon](https://github.com/johnqh/daytona_hackathon), then was rewritten toward the LabPilot Virtual Lab product direction.

Main surfaces:

- `dashboard/`: the primary LabPilot product UI
- `pathogen-pathfinder/`: older sibling surface from the upstream hackathon work
- `pipeline/`, `data/`, `insights/`: upstream research pipeline assets retained for reference and possible reuse
- `Codex-Memory/`: local long-term working memory for this project and future Codex sessions

## Current product behavior

The dashboard centers on a single virtual experiment workflow:

1. Review measured dose-response observations
2. Run deterministic analysis on the current experiment
3. Ask LabPilot for a constrained OpenAI explanation
4. Simulate a next dose in the allowed range
5. Generate a recommended next experiment plan
6. Require human approval before any plan is treated as accepted

The app is intentionally opinionated:

- measured vs predicted values are clearly separated
- recommendations are evidence-bounded
- the LLM is constrained to a fixed schema
- approval is explicit and auditable

## Architecture

### Frontend

- Next.js 16
- React 19
- Tailwind CSS 4
- CopilotKit runtime for guided interaction

### AI layer

- OpenAI Responses API
- default model: `gpt-5.6-luna`
- optional upgrade path: `gpt-5.6-terra`

### Persistence

- optional DynamoDB storage through `@aws-sdk/client-dynamodb`
- graceful fallback to an in-memory demo session when AWS env vars are not set

### Domain contracts

The virtual-lab flow is normalized through typed contracts in [dashboard/lib/virtual-lab-contracts.ts](/Users/user/Documents/LabPilot%20Vitual%20Lab/dashboard/lib/virtual-lab-contracts.ts).

Key API routes:

- `POST /api/labpilot/ask`
- `POST /api/model/analyze`
- `POST /api/simulate`
- `POST /api/plan-experiment`
- `GET /api/experiment/[id]`

## Quick start

### 1. Install dependencies

```bash
cd dashboard
bun install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Minimum setup:

```bash
OPENAI_API_KEY=your_key
```

Optional AWS setup:

```bash
AWS_REGION=us-west-2
AWS_DYNAMODB_TABLE=labpilot-experiment-plans
```

### 3. Run the dashboard

```bash
bun run dev
```

Open `http://localhost:3000`.

## Environment variables

See [dashboard/.env.example](/Users/user/Documents/LabPilot%20Vitual%20Lab/dashboard/.env.example) for the current source of truth.

Important variables:

- `OPENAI_API_KEY`: required for Ask LabPilot
- `OPENAI_MODEL`: optional override, defaults to `gpt-5.6-luna`
- `AWS_REGION`: optional DynamoDB region
- `AWS_DYNAMODB_TABLE`: optional DynamoDB table
- `DAYTONA_API_KEY`: optional, only for sandbox visibility and older pipeline integration
- `PIPELINE_URL`: optional external contract source

## Dashboard verification

The dashboard has been verified in this repo with:

```bash
bun run typecheck
bun run build
```

Manual API checks were also run against the production build for the current virtual-lab flow, including dose simulation and model analysis behavior.

## Project status

This repository is now primarily a LabPilot Virtual Lab product repo, not just the original hackathon submission.

What was intentionally kept:

- the general UI/product shell
- some reusable dashboard patterns
- optional compatibility with upstream pipeline-style data

What was intentionally changed:

- Fireworks-first reasoning was replaced by OpenAI
- the core demo now reflects the product guidance document
- AWS is the preferred persistence path instead of adding another vendor dependency
- experiment planning and approval are first-class parts of the UX

## Codex memory

This repo includes a local Obsidian-style knowledge base under `Codex-Memory/` plus project instructions in `AGENTS.md`.

Purpose:

- preserve durable project decisions and preferences across Codex sessions
- reduce repeated repo re-reading
- keep reusable project context close to the codebase

This memory is for project context only and should never store secrets.

## Notes

- `pathogen-pathfinder/` still exists and may have useful components, but it is not the primary LabPilot surface
- the upstream `johnqh/daytona_hackathon` repo was used as a starting point, not as the current product definition
- the current source of product truth for this implementation is the LabPilot guidance-driven dashboard in `dashboard/`
