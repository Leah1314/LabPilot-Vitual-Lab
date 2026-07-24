# Pathogen Pathfinder (CopilotKit + Claude)

Agent UI for the integrated
[daytona_hackathon](https://github.com/johnqh/daytona_hackathon) system.

Same BV-BRC → **Daytona** → **Fireworks** contracts as the rest of the monorepo,
with a **CopilotKit + Claude Agent SDK** chat that must call `getPathogenDataset`
before answering.

**Product UI (Fireworks Consult):** [`../dashboard/`](../dashboard/).  
**This surface:** deeper grounded chat with Claude on the same workspace data.

**Research prototype. Not for clinical use.**

## Features

| Route | Purpose |
|---|---|
| `/` Upload | Files, live API, or sample dataset |
| `/analyzing` | Simulated pipeline progress |
| `/dashboard` | Cluster resistance, trends, KPIs |
| `/gene-explorer` | AMR gene-class distribution |
| `/insights` | Grounded observation feed |
| `/pipeline` | End-to-end stage map |
| `/copilot` | CopilotKit + Claude chat |

## Stack

- Next.js 16 + React 19 + Tailwind CSS 4  
- CopilotKit v2 (`@copilotkit/react-core`, runtime)  
- Claude Agent SDK (TypeScript) on port **8000** via AG-UI  

## Setup

```bash
cd pathogen-pathfinder
cp .env.example .env
```

```bash
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-5
AGENT_URL=http://localhost:8000
# Optional:
# COPILOTKIT_LICENSE_TOKEN=...
```

```bash
npm install
npm run dev
```

| Service | URL |
|---|---|
| UI | http://localhost:3000 |
| Agent health | http://localhost:8000/health |

## Demo path

1. **Upload** → **Try Sample Dataset** → Load  
2. Wait for analyzing → land on **Dashboard**  
3. Open **Copilot** → ask *“Which cluster has highest resistance?”*

The agent uses frontend tool `getPathogenDataset` plus shared state synced from
the workspace store.

## Using real Part A / B data

Monorepo contracts:

- `../data/cluster_summary.json` (Contract 1)  
- `../insights/observations.json` (Contract 2)  

Serve them behind any JSON HTTP API and use **Connect API** on the upload page,
or extend the sample loader to import those files. Upload parsing currently
falls back to a sample-shaped `DashboardData` (same limitation as the original
Lovable app).

## Project layout

```
src/app/           Next.js routes
src/lib/           workspace store + data-source abstraction
src/services/      external API helpers
src/hooks/         pathogen agent context + generative UI
agent/             Claude Agent SDK AG-UI server
```

## Honesty

Follow the monorepo rules in [../README.md](../README.md):

- Gate resistance association claims on `clusters_with_phenotype_signal`  
- Never invent numbers in chat — always read the loaded dataset  
- Always disclose: research prototype, not for clinical use  

## Related

- Doc index: [../DOCS.md](../DOCS.md)  
- Fireworks CopilotKit dashboard: [../dashboard/README.md](../dashboard/README.md)  
- Pipeline: [../pipeline/README.md](../pipeline/README.md)  

## License

MIT — see [LICENSE](./LICENSE).
