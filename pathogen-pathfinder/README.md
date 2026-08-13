# LabPilot Virtual Lab App

This is the app we currently use in this repository.

If you are looking for the right place to run LabPilot, this is it:

```bash
cd pathogen-pathfinder
```

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

## What this app is now

This app is the active LabPilot Virtual Lab surface.

It is no longer just an older sibling to another product UI. In the current repo structure, this is the primary entrypoint for:

- measured experiment review
- candidate recommendation
- candidate simulation
- governed investigation workflow
- Lab Run Receipt review
- approve / modify / reject decisions

## Product principles

- measured data and predicted data must stay visually distinct
- deterministic model outputs own numeric recommendations
- the LLM or RLM layer must not invent numbers
- human approval is required before a candidate becomes planned work

## Current repo status

The repository previously contained an additional `dashboard/` app, but the current project should be found from `pathogen-pathfinder/`.

If you are onboarding someone, point them here first.

## Related files

- root guide: [../README.md](../README.md)
- product guide: [../docs/LabPilot_Virtual_Lab_Complete_Technical_Product_Guide.docx](../docs/LabPilot_Virtual_Lab_Complete_Technical_Product_Guide.docx)
- pipeline reference: [../pipeline/README.md](../pipeline/README.md)
