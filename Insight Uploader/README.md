# Insight Uploader — Pathogen AI research workspace

TanStack Start research shell for the integrated Gut-to-Pancreas AMR system
([johnqh/daytona_hackathon](https://github.com/johnqh/daytona_hackathon)).

Loads **Contract 1** / **Contract 2** produced by **BV-BRC → Daytona → Fireworks**,
then shows dashboard, gene explorer, insights, pipeline stages, and chat.

**Product UI:** [`../dashboard/`](../dashboard/) (CopilotKit + Fireworks).  
**Agent UI:** [`../pathogen-pathfinder/`](../pathogen-pathfinder/) (CopilotKit + Claude).  
**This shell:** upload-first TanStack workspace on the same contracts.

**Research prototype. Not for clinical use.**

## Stack

- TanStack Start + React Router  
- TypeScript + Tailwind CSS 4  
- Recharts  

## Setup

```bash
cd "Insight Uploader"
npm install   # or: bun install
npm run dev
```

Open the printed local URL (typically Vite/TanStack on a free port).

## Using it

1. **Choose data source** — Upload files, Connect API, or Try Sample Dataset  
2. Wait through the analyzing animation  
3. Explore **Dashboard**, **Gene Explorer**, **AI Insights**, **Pipeline**, **Copilot**

Sample / upload paths resolve to the same normalised `DashboardData` shape used
across the monorepo (see root [README.md](../README.md) contracts).

### Expected filenames (upload)

Minimum required:

- `genome_amr.csv`
- `metadata.csv`
- `sequences.csv`
- `observations.json`

Also recognised: `sp_gene.csv`, `cluster_summary.json`.

## Wiring to Part A / B outputs

Root pipeline outputs live at:

- `../data/cluster_summary.json`
- `../insights/observations.json`

Point the **Connect API** tab at any HTTP endpoint that serves those contracts,
or use sample data for a key-free demo.

## Honesty

Same rules as the monorepo root README:

- No resistance–cluster association language without
  `clusters_with_phenotype_signal`
- No percentage without a denominator  
- Research prototype disclaimer on every surface  

## Related

- Monorepo overview: [../README.md](../README.md)  
- Doc index: [../DOCS.md](../DOCS.md)  
- Next.js CopilotKit dashboard: [../dashboard/README.md](../dashboard/README.md)  
- Claude CopilotKit rebuild: [../pathogen-pathfinder/README.md](../pathogen-pathfinder/README.md)  

## Built with

TanStack Start · TypeScript · React · Tailwind CSS
