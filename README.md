# LabPilot Virtual Lab

LabPilot Virtual Lab is an AI-assisted experimental planning dashboard for biopharma teams. It keeps the interactive UI from the original hackathon work, but the core decision loop is now aligned to the product guidance: structured observations, model-based next-step recommendations, explicit human approval, and optional AWS-backed persistence.

The current implementation is optimized for:

- OpenAI credits for the reasoning layer
- AWS account credits for lightweight persistence
- A dashboard-first workflow for reviewing evidence before running the next experiment

Research prototype only. Not for clinical use.

## What this repo contains

This repository started from reusable work in [johnqh/daytona_hackathon](https://github.com/johnqh/daytona_hackathon), then was rewritten toward the LabPilot Virtual Lab product direction.

It is important to read this repo as a rewrite, not a rename of the original project.

We reused selected parts of the original codebase that were still useful to us:

- parts of the dashboard UI shell
- some Next.js / React / TypeScript app structure
- a few interaction patterns and reusable frontend components
- optional compatibility with earlier pipeline-style integration points

But this is not the same product as the original hackathon repo. The scientific workflow, AI behavior, data contracts, and product goal are different:

- the original project explored a pathogen research workflow
- LabPilot Virtual Lab focuses on virtual experiment planning for biopharma teams
- the current AI path uses OpenAI rather than the earlier Fireworks-first setup
- the current product loop centers on recommendation, simulation, and human approval
- the current persistence path is optional AWS-backed storage for approved plans

Main surfaces:

- `dashboard/`: the primary LabPilot product UI
- `pathogen-pathfinder/`: older sibling surface from the upstream hackathon work
- `pipeline/`, `data/`, `insights/`: upstream research pipeline assets retained for reference and possible reuse

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

The system is organized as a dashboard-first experimental decision stack:

```text
LABPILOT VIRTUAL LAB

┌─────────────────────────────────────────────────────┐
│                    Frontend / UI                    │
│                                                     │
│  Experiment Dashboard                              │
│  - dose-response chart                             │
│  - measured datapoints                             │
│  - predicted datapoints                            │
│  - Ask LabPilot                                    │
│  - Suggest Next Experiment                         │
│  - Simulate Experiment                             │
│  - Approve / Modify / Reject                       │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│               Application / API Layer               │
│                                                     │
│  GET /experiment/:id                               │
│  POST /analyze                                     │
│  POST /suggest-next                                │
│  POST /simulate                                    │
│  POST /approve                                     │
└───────────────┬────────────────┬────────────────────┘
                │                │
                ▼                ▼

┌──────────────────────────┐   ┌──────────────────────────┐
│ Scientific Model Layer   │   │      LLM / Agent         │
│                          │   │                          │
│ - curve fitting          │   │ - explain results       │
│ - interpolation          │   │ - answer questions      │
│ - prediction             │   │ - explain recommendation│
│ - uncertainty            │   │ - summarize evidence    │
│ - next-point selection   │   │ - structured response   │
│                          │   │                          │
│ DOES THE MATH            │   │ DOES NOT INVENT NUMBERS │
└─────────────┬────────────┘   └────────────┬─────────────┘
              │                             │
              └─────────────┬───────────────┘
                            ▼
┌─────────────────────────────────────────────────────┐
│                    Data Layer                       │
│                                                     │
│ LabPilot experiments                               │
│ + local/public reference dataset                   │
│ + experiment metadata                              │
│ + model results                                    │
│ + approved planned experiments                     │
└─────────────────────────────────────────────────────┘
```

In short: the scientific model does the math, the LLM explains the math, and the dashboard makes that loop reviewable by a scientist.

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

Current implementation routes are:

- `POST /api/labpilot/ask`
- `POST /api/model/analyze`
- `POST /api/simulate`
- `POST /api/plan-experiment`
- `GET /api/experiment/[id]`

Conceptually, these map to the product actions above:

- `GET /experiment/:id` → current experiment review
- `POST /analyze` → model analysis
- `POST /suggest-next` → next experiment recommendation
- `POST /simulate` → virtual next-point simulation
- `POST /approve` → human approval / modification / rejection workflow

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

## Notes

- `pathogen-pathfinder/` still exists and may have useful components, but it is not the primary LabPilot surface
- the upstream `johnqh/daytona_hackathon` repo was used as a starting point, not as the current product definition
- the current source of product truth for this implementation is the LabPilot guidance-driven dashboard in `dashboard/`
