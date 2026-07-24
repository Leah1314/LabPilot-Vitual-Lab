# Pathogen Pathfinder (CopilotKit)

Rebuild of [Leah1314/pathogen-pathfinder](https://github.com/Leah1314/pathogen-pathfinder) as a **Next.js + CopilotKit** app with a real Claude agent grounded on the loaded AMR workspace dataset.

## What you get

Same Pathogen AI research workspace flow:

1. **Upload** — files, live API, or sample dataset  
2. **Analyzing** — simulated pipeline progress  
3. **Dashboard** — cluster resistance, trends, KPIs  
4. **Gene Explorer** — AMR gene class distribution  
5. **AI Insights** — grounded insight feed  
6. **Pipeline** — end-to-end stage map  
7. **Copilot** — CopilotKit chat (Claude) that calls `getPathogenDataset` before answering

## Stack

- Next.js 16 + React 19 + Tailwind CSS 4  
- CopilotKit v2 (`@copilotkit/react-core`, runtime)  
- Claude Agent SDK (TypeScript) on port 8000 via AG-UI  

## Setup

1. Copy env and add your Anthropic key:

```bash
cp .env.example .env
```

```bash
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-5
AGENT_URL=http://localhost:8000
# Optional: COPILOTKIT_LICENSE_TOKEN=...
```

2. Install and run:

```bash
npm install
npm run dev
```

- UI: http://localhost:3000  
- Agent health: http://localhost:8000/health  

## Try it

1. Open **Upload** → **Try Sample Dataset** → **Load Sample Data**  
2. Wait for analyzing → land on **Dashboard**  
3. Open **Copilot** and ask: “Which cluster has highest resistance?”

## Project layout

```
src/app/                 # Next.js routes (upload, dashboard, copilot, …)
src/lib/                 # workspace store + data-source abstraction
src/services/            # external API connection helpers
src/hooks/               # pathogen agent context + generative UI tools
agent/                   # Claude Agent SDK AG-UI server
```

## Notes

- Upload parsing still returns the sample-shaped `DashboardData` (same as the Lovable original).  
- API connect/test uses browser `fetch` (CORS applies).  
- The mock regex copilot from the original is replaced by CopilotKit + Claude.

## License

MIT — see [LICENSE](./LICENSE).
