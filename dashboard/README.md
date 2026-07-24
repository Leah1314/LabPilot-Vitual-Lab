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

The dashboard runs without any keys — it serves the committed fixtures in
`data/` and the header reads **MOCK DATA**. `FIREWORKS_API_KEY` is only needed
for the Consult chat panel.

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `FIREWORKS_API_KEY` | For chat | Server-side only. Never prefix `NEXT_PUBLIC_`. |
| `FIREWORKS_MODEL` | No | Defaults to `deepseek-v4-pro`. |
| `PIPELINE_URL` | No | Daytona preview URL. Unset serves fixtures. |
| `COPILOTKIT_TELEMETRY_DISABLED` | No | Set `true` to silence usage telemetry. |

This repo is public. Commit `.env.example` only.

## Wiring in real data

Two independent switches:

**Fixtures** — Parts A and B write `data/cluster_summary.json` and
`insights/observations.json` at the repo root. Copy them in:

```bash
bun run sync-data
```

It validates shape before overwriting, so a malformed file fails at the command
rather than mid-demo, and leaves the previous fixtures in place if it does.

**Live pipeline** — set `PIPELINE_URL` to the Daytona sandbox preview URL. The
dashboard then fetches `/cluster-summary`, `/observations`, `/cohort` and
`/cooccurrence`, and the header chip flips to **LIVE**. Any endpoint that fails
falls back to its fixture, so a partial backend degrades per section instead of
blanking the page.

The chip is the check for the step C.4 handoff: if it reads MOCK during the
demo, the numbers on screen are illustrative.

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
  page.tsx                           server component, loads data
  api/copilotkit/route.ts            single-route transport
  api/copilotkit/[...path]/route.ts  multi-route transport
components/                          UI, presentational except DashboardShell
lib/
  contracts.ts                       Contract 1/2 types + join
  data.ts                            loader, live-or-fixture
  agent-tools.ts                     server-side tools
  copilot-runtime.ts                 runtime, agent, system prompt
data/                                committed fixtures
```

## License

Hackathon project. BV-BRC data is publicly funded and freely available; CARD,
VFDB and NDARO carry their own terms.
