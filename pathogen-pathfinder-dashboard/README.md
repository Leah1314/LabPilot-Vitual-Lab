# Pathogen Pathfinder (CopilotKit + Fireworks)

Agent UI for the integrated
[daytona_hackathon](https://github.com/johnqh/daytona_hackathon) system.

Same BV-BRC → **Daytona** → **Fireworks** contracts as the rest of the monorepo,
with a **CopilotKit v2** chat that must call `getPathogenDataset` before
answering.

**Product UI (Fireworks Consult):** [`../dashboard/`](../dashboard/).  
**This surface:** deeper grounded chat on the same workspace data.

**Research prototype. Not for clinical use.**

## Features

| Route | Purpose |
|---|---|
| `/` Upload | Files, live API, or sample dataset |
| `/analyzing` | Simulated pipeline progress |
| `/dashboard` | Cluster resistance, trends, KPIs |
| `/gene-explorer` | AMR gene-class distribution |
| `/insights` | Grounded observation feed |
| `/copilot` | CopilotKit + Fireworks chat |
| `/pipeline` | End-to-end stage map |

## Stack

- Next.js 16 + React 19 + Tailwind CSS 4  
- CopilotKit v2 (`@copilotkit/react-core`, `@copilotkit/runtime`) — **1.63.2**  
- Fireworks AI via `@ai-sdk/openai-compatible`, running **in-process** through
  CopilotKit's `BuiltInAgent`

There is **no separate agent server**. This app previously ran a Claude Agent SDK
server on port 8000 reached over AG-UI with `HttpAgent`, which needed an
`ANTHROPIC_API_KEY` and a second process. It now uses Fireworks like the rest of
the monorepo, and `npm run dev` is a single server.

## Setup

```bash
cd pathogen-pathfinder
cp .env.example .env.local
```

```bash
FIREWORKS_API_KEY=fw_...
FIREWORKS_MODEL=accounts/fireworks/models/glm-5p2   # optional
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
| Runtime info | http://localhost:3000/api/copilotkit/info |

`agents.default.className` in that info payload should read `BuiltInAgent`.

## Demo path

1. **Upload** → **Try Sample Dataset** → Load  
2. Wait for analyzing → land on **Dashboard**  
3. Open **Copilot** → ask *"What clusters are in the loaded dataset?"*

The agent uses frontend tool `getPathogenDataset` plus shared state synced from
the workspace store.

Do **not** demo *"which cluster has the highest resistance?"* expecting a winner.
The clusters carry no resistance signal — every cluster's resistant/susceptible
split reproduces the corpus base rate — and the system prompt instructs the model
to say so rather than name one. That is a real finding, not a bug, and explaining
it is a stronger demo moment than a fabricated ranking.

## Using real Part A / B data

Monorepo contracts:

- `../data/cluster_summary.json` (Contract 1)  
- `../insights/observations.json` (Contract 2)  

Serve them behind any JSON HTTP API and use **Connect API** on the upload page,
or extend the sample loader to import those files. Upload parsing currently
falls back to a sample-shaped `DashboardData` (same limitation as the original
Lovable app).

Two consequences of that, worth knowing before a demo: the loaders are still on
the fabricated `mock-data.ts`, and the landing page advertises "6 pathogen
clusters, ~3,124 genomes and 18 grounded AI observations" — inherited scaffold
copy that does not describe the real dataset (**4 clusters, 240 genomes, 4
observations**).

## Three pinned versions, and why

1. **`@ai-sdk/openai-compatible` is pinned to `2.0.62`.** CopilotKit 1.63.x
   bundles `ai` v6, which pins `@ai-sdk/provider` 3.x. Installing `@latest` pulls
   a provider 4.x build for `ai` v7 and the model object is rejected with an
   opaque "unsupported model version" rather than a clean failure. Verified good:
   `ai@6.0.221` + `@ai-sdk/provider@3.0.13`.
2. **CopilotKit is not pinned below 1.63.0.** 1.63.0 fixed an `/info` request
   storm firing 70–80 requests per page load under StrictMode, plus TypeScript
   declaration resolution under `bundler`/`nodenext`.
3. **`maxSteps: 5`.** The default is 1, which makes the agent call
   `getPathogenDataset` and then stop without ever using the result — which looks
   exactly like the model ignoring the tool.

## Fireworks notes

Without a payment method on file Fireworks caps the account at **10 requests per
minute**, which will not survive a live audience clicking around. Add one before
demoing.

Default model is **`glm-5p2`** (743B MoE, 1M context, open weights). Function
calling was verified against the real `getPathogenDataset` schema.

**Reasoning is disabled by default.** GLM-5.2 thinks before answering, which
cost seconds per turn and made the chat feel sluggish. The runtime injects
`reasoning_effort: "none"` into every Fireworks request (the AI SDK does not
model that field, so it goes in via a `fetch` wrapper). Measured on the
tool-calling path: 3.02s default vs 0.80s with reasoning off, and ~1.07s
end-to-end through the running server. Set `FIREWORKS_REASONING_EFFORT` to
`low`, `medium` or `high` to put thinking back. Fall back
through `deepseek-v4-pro`, `deepseek-v4-flash`, then `gpt-oss-120b` via
`FIREWORKS_MODEL` — tool calling is confirmed on all of them.

GLM-5.2 bills at **$4.40 per 1M output tokens** against DeepSeek V4 Pro's $3.48,
so a long demo session costs modestly more. DeepSeek V4 Pro is a reasoning model
whose reasoning arrives on a separate AG-UI channel (`REASONING_MESSAGE_*`) and
never leaks into assistant text; GLM emits ordinary content.

## Project layout

```
src/app/                 Next.js routes
src/app/api/copilotkit/  CopilotKit v2 runtime, Fireworks BuiltInAgent
src/lib/                 workspace store + data-source abstraction
src/services/            external API helpers
src/hooks/               pathogen agent context + generative UI
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
