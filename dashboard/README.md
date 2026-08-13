# LabPilot Virtual Lab Dashboard

This is the primary product UI for LabPilot Virtual Lab.

It is a Next.js dashboard for reviewing experimental observations, simulating next doses, generating constrained AI explanations with OpenAI, and recording human-reviewed next-step plans with optional AWS persistence.

Research prototype only. Not for clinical use.

## Stack

- Next.js 16
- React 19
- Tailwind CSS 4
- CopilotKit runtime
- OpenAI Responses API
- optional AWS DynamoDB persistence

## Core workflow

The dashboard currently demonstrates a guided virtual experiment loop:

1. inspect measured observations for the active experiment
2. run model analysis on the dose-response curve
3. ask LabPilot a bounded question from the approved prompt set
4. simulate a candidate next dose
5. create a proposed next experiment plan
6. require human approval before the plan is treated as accepted

The product guidance rewrite added:

- typed experiment and recommendation contracts
- evidence-aware recommendation cards
- audit-style timeline behavior
- explicit measured vs predicted labeling
- optional persistence for approved plans

## Install

```bash
bun install
cp .env.example .env.local
bun run dev
```

Open `http://localhost:3000`.

## Environment

Current environment template: [dashboard/.env.example](/Users/user/Documents/LabPilot%20Vitual%20Lab/dashboard/.env.example)

Required for AI features:

```bash
OPENAI_API_KEY=your_key
```

Optional model override:

```bash
OPENAI_MODEL=gpt-5.6-luna
```

Optional AWS persistence:

```bash
AWS_REGION=us-west-2
AWS_DYNAMODB_TABLE=labpilot-experiment-plans
```

Optional pipeline compatibility:

```bash
DAYTONA_API_KEY=
PIPELINE_URL=
PIPELINE_NAME=Daytona pipeline
```

## Important routes

- `GET /api/experiment/[id]`: fetch experiment state and approval timeline
- `POST /api/model/analyze`: deterministic dose-response recommendation
- `POST /api/simulate`: predict viability for a candidate dose
- `POST /api/plan-experiment`: create or persist a human-review-required plan
- `POST /api/labpilot/ask`: ask a constrained OpenAI-backed question

## Commands

| Command | Purpose |
|---|---|
| `bun run dev` | Start local development server on port 3000 |
| `bun run build` | Build production bundle |
| `bun run start` | Start production server on port 3000 |
| `bun run typecheck` | Run TypeScript checks |
| `bun run lint` | Run ESLint |
| `bun run sync-data` | Refresh local fixture data |

## Product notes

- default OpenAI model is `gpt-5.6-luna`
- `gpt-5.6-terra` is a viable higher-quality option if latency and cost are acceptable
- DynamoDB is optional; without AWS config the app falls back to demo-session behavior
- the current demo experiment uses a constrained virtual-lab dataset rather than the older pathogen dashboard narrative

## Verification

Recommended checks:

```bash
bun run typecheck
bun run build
```

The current implementation was previously verified with manual API checks including analysis output and `35 nM` simulation behavior.
