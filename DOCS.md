# Documentation index

Canonical entry point: [README.md](./README.md)

Current app entrypoint: [pathogen-pathfinder/README.md](./pathogen-pathfinder/README.md)

This repository still contains older pipeline and hackathon reference material, but the active app you should run today is `pathogen-pathfinder/`.

## Start here

| Doc | Purpose |
|---|---|
| [README.md](./README.md) | Repo-level overview and the correct app entrypoint |
| [pathogen-pathfinder/README.md](./pathogen-pathfinder/README.md) | Current app setup and usage |
| [docs/LabPilot_Virtual_Lab_Complete_Technical_Product_Guide.docx](./docs/LabPilot_Virtual_Lab_Complete_Technical_Product_Guide.docx) | Current technical product guide |

## Supporting references

| Doc | Purpose |
|---|---|
| [pipeline/README.md](./pipeline/README.md) | Older data pipeline and public-database ingestion notes |
| [ABOUT.md](./ABOUT.md) | Short repo summary |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Repo contribution notes |
| [SECURITY.md](./SECURITY.md) | Research-use and security guidance |

## Public data sources used in this repo

The older pipeline and retained data assets use:

- BV-BRC
- CARD
- NDARO
- VFDB
- PATRIC_VF

## Current recommendation

If you are opening this repo for the first time, do this:

```bash
cd pathogen-pathfinder
cp .env.example .env.local
npm install
npm run dev
```
