# LabPilot Virtual Lab

LabPilot Virtual Lab is the current biopharma experiment-planning app in this repository.

The main app we use now is:

`pathogen-pathfinder/`

If you want to run the current product, start there.

## Quick start

```bash
cd pathogen-pathfinder
cp .env.example .env.local
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Important repo note

This repository contains older hackathon-era materials and pipeline assets, but the active product surface is no longer the old `dashboard/` app.

We reused selected pieces of the original project:

- parts of the UI shell
- some Next.js and TypeScript structure
- some data-loading and interaction patterns

But the current LabPilot project is not the original hackathon product.

## What the current app does

The current LabPilot flow is:

1. Load measured experiment data and reference evidence
2. Review experiment state in the UI
3. Generate deterministic next-step candidates
4. Simulate candidate conditions
5. Investigate the recommendation through a governed RLM-style workflow
6. Review the Lab Run Receipt
7. Approve, modify, or reject the planned experiment

Core product rule:

- deterministic model owns the numbers
- the investigation layer explains and challenges
- the scientist owns the decision

## Current architecture

```text
LabPilot Virtual Lab

pathogen-pathfinder/
  current product UI
  current local dev entrypoint
  recommendation + simulation + investigation flow

pipeline/
  older data pipeline and reference processing assets

data/ insights/ docs/
  fixtures, outputs, and product guidance
```

## Public data sources used in this repo

The older pipeline and reference assets in this repo use:

- BV-BRC as the main public data source
- CARD
- NDARO
- VFDB
- PATRIC_VF

Those annotation sources are primarily consumed through BV-BRC-derived data assets in this repository.

## Product guide

The current technical guide is here:

- `docs/LabPilot_Virtual_Lab_Complete_Technical_Product_Guide.docx`

## Active app location

Use this path:

```bash
cd LabPilot-Vitual-Lab/pathogen-pathfinder
```

Do not start from the deleted `dashboard/` app. The current project should be found and run from `pathogen-pathfinder/`.
