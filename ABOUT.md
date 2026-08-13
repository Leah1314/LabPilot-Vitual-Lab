## About

LabPilot Virtual Lab is a research prototype for experiment planning and review.

Current active app:

- [`pathogen-pathfinder/`](./pathogen-pathfinder/)

Primary workflow:

- review measured experiment data
- generate deterministic candidate experiments
- simulate candidates
- investigate recommendations
- review Lab Run Receipt output
- approve, modify, or reject the plan

Public data references retained in this repo:

- BV-BRC
- CARD
- NDARO
- VFDB
- PATRIC_VF

Current product guide:

- [`docs/LabPilot_Virtual_Lab_Complete_Technical_Product_Guide.docx`](./docs/LabPilot_Virtual_Lab_Complete_Technical_Product_Guide.docx)

Quick start:

```bash
cd pathogen-pathfinder
cp .env.example .env.local
npm install
npm run dev
```
