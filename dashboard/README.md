# Gut-to-Pancreas AMR Dashboard

Part C of the BV-BRC hackathon build. A Next.js + CopilotKit dashboard showing
resistance and virulence gene structure across gut-derived pathogens implicated
in infected pancreatic necrosis, with a conversational panel for interrogating
the cohort.

Research prototype. Not for clinical use.

## Install

```bash
bun install
cp .env.example .env.local   # add FIREWORKS_API_KEY
bun run dev                  # http://localhost:3000
```

The dashboard runs without any keys — pick **Sample dataset** on the opening
screen. `FIREWORKS_API_KEY` is only needed for the Consult chat panel.

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `FIREWORKS_API_KEY` | For chat | Server-side only. Never prefix `NEXT_PUBLIC_`. |
| `FIREWORKS_MODEL` | No | Defaults to `deepseek-v4-pro`. |
| `PIPELINE_URL` | No | Preloads a pipeline and skips the source picker. |
| `PIPELINE_NAME` | No | Label shown for that preloaded pipeline. |
| `COPILOTKIT_TELEMETRY_DISABLED` | No | Set `true` to silence usage telemetry. |

This repo is public. Commit `.env.example` only.

## Choosing a data source

The app opens on a picker with three options. Everything downstream reads one
normalised shape, so the dashboard, charts and Consult panel behave identically
whichever you choose — only the header chip changes.

**Sample dataset** — the fixtures in `data/`. One click, no setup.

**Upload files** — drop `cluster_summary.json` and `observations.json` (plus
optional `cohort.json` and `cooccurrence.json`). Parsed and validated entirely
in your browser; nothing is uploaded anywhere. CSV is deliberately not accepted:
turning raw BV-BRC tables into clusters is Part A's job.

**Connect a pipeline** — point at any endpoint serving Contracts 1 and 2, as
one combined endpoint or two separate ones, with optional bearer or header auth.
**Test connection** shows the full list of checks that ran and, on success, a
preview of cluster/observation/species counts before you commit.

Requests go out from this app's server, not your browser, so the pipeline needs
no CORS headers. That matters because `daytona.md §4.4` notes CORS behaviour
through the Daytona preview proxy is undocumented.

API keys stay in memory for the tab. Endpoints and auth method are remembered in
`localStorage` for convenience; keys never are.

Because the server fetches a URL you type, the route blocks link-local
addresses (where cloud providers expose instance credentials), resolves DNS
before connecting so a hostname cannot point there, and refuses redirects.
Localhost and private ranges are allowed on purpose — that is where the
pipeline runs.

### Skipping the picker

Set `PIPELINE_URL` and the server preloads that pipeline, opening straight onto
the dashboard — useful for a demo machine. `PIPELINE_NAME` labels it. If it is
unreachable the picker is shown instead. **Change source** in the header returns
to the picker at any time.

### Refreshing the committed fixtures

Parts A and B write `data/cluster_summary.json` and `insights/observations.json`
at the repo root. Copy them into the app with:

```bash
bun run sync-data
```

It validates shape before overwriting, so a malformed file fails at the command
rather than mid-demo, leaving the previous fixtures in place.

## Commands

| Command | What it does |
|---|---|
| `bun run dev` | Dev server on :3000, CopilotKit dev console enabled |
| `bun run build` | Production build |
| `bun run start` | Serve the production build on :3000 |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | ESLint |
| `bun run sync-data` | Copy + validate contract files from the repo root |

There is no test suite. Verification is `bun run typecheck && bun run build`.

## What's on the page

**The source picker** is the entry point: sample, upload, or a live pipeline.
The header always shows which one is on screen and offers **Change source**.

**Cluster cards** carry the Fireworks-written headline and observation, a
Braintrust faithfulness badge, the lab-measured resistance breakdown, lineage
provenance, and an expandable product/gene table.

**The denominator rail** draws each cluster's resistance split at a width equal
to its number of phenotyped isolates, on one scale shared across every card.
A cluster of 12 is visibly shorter than one of 63, so a "75%" can't be misread
as equivalent between them.

**The lineage rail** puts raw genome rows (dashed) against distinct strains
(solid) in the same unit at the same scale. The unfilled remainder is clonal
oversampling — the mcr-1 cluster collapsing 94 rows to 6 strains is legible
without reading a number.

**Consult** is the CopilotKit panel. It answers from the statistics on the page
and via two server-side tools, under a system prompt that forbids generating or
computing numbers.

## Honesty affordances

These are the design, not decoration — see `frontend.md §4` and `prompt.md §8`.

- The header names the active source on every screen, so nobody has to ask
  where a number came from.
- A source supplying only Contracts 1 and 2 gets a species gene tally instead of
  a borrowed cohort — attaching the sample's provenance to someone else's
  numbers would be worse than showing less.
- Deduplicated strain counts shown by default, raw counts adjacent.
- Single-country or single-year patterns badged as possible outbreak artefacts,
  on both cluster cards and co-occurrence rows.
- No percentage without its denominator, enforced in `lib/format.ts`.
- Pipeline stats render "not measured yet" until a real timed run reports in.
  Nothing is filled with a plausible-looking number.
- *H. pylori* is marked virulence-only; no resistance statistic is quoted for it.
- Disclaimer sits in the sticky header, visible without scrolling.
- Attribution to BV-BRC, CARD, NDARO, VFDB and PATRIC_VF, with the pinned date.

## Layout

```
app/
  layout.tsx                         fonts, CopilotKit provider, metadata
  page.tsx                           server component: sample + optional preload
  api/datasource/route.ts            server-side proxy for user endpoints
  api/copilotkit/route.ts            single-route transport
  api/copilotkit/[...path]/route.ts  multi-route transport
components/
  Workspace.tsx                      holds active dataset; picker or dashboard
  SourcePicker.tsx                   three-tab chooser
  source/                            Sample / Upload / Api panels
lib/
  contracts.ts                       Contract 1/2 types + join
  datasource.ts                      source kinds, ApiConfig, failure codes
  validate.ts                        shape + cross-validation, shared
  build-data.ts                      assembles DashboardData from any source
  data.ts                            sample loader + PIPELINE_URL preload
  agent-tools.ts                     server-side tools
  copilot-runtime.ts                 runtime, agent, system prompt
data/                                committed fixtures
```

## License

Hackathon project. BV-BRC data is publicly funded and freely available; CARD,
VFDB and NDARO carry their own terms.
