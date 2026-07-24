# CLAUDE.md — Gut-to-Pancreas AMR Dashboard

Part C (dashboard) of the BV-BRC hackathon build. Specs live one level up:
`../hackathon_build_planner.md` (Part C steps, data contracts),
`../frontend.md` (CopilotKit specifics), `../prompt.md` (honesty rules),
`../daytona.md` (serving contract).

## Tech stack

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- Tailwind CSS 4 (`@theme` tokens in `app/globals.css`, no config file)
- CopilotKit 1.63.2 **v2 API** + Fireworks via `@ai-sdk/openai-compatible`
- Bun for install and scripts — never npm/yarn/pnpm

## Commands

| Command | What it does |
|---|---|
| `bun run dev` | Dev server on :3000 |
| `bun run build` | Production build |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | ESLint |
| `bun run sync-data` | Copy + validate contract files from repo root |

No test suite. Verify with `bun run typecheck && bun run build` — both must pass
before claiming the dashboard works.

## Project structure

```
app/layout.tsx                       fonts + Providers + metadata
app/page.tsx                         server: sample + optional PIPELINE_URL preload
app/api/datasource/route.ts          server proxy for user-configured endpoints
app/api/copilotkit/route.ts          single-route transport
app/api/copilotkit/[...path]/route.ts  multi-route transport
components/Workspace.tsx             active dataset; renders picker or dashboard
components/SourcePicker.tsx          sample / upload / api chooser
components/source/*.tsx              the three panels + ValidationTrail
components/DashboardShell.tsx        dashboard-level state
components/DenominatorRail.tsx       signature: width == denominator
components/LineageRail.tsx           raw rows vs distinct strains
lib/contracts.ts                     Contract 1/2 types, joinClusters
lib/datasource.ts                    source kinds, ApiConfig, failure codes
lib/validate.ts                      shape + cross-validation (shared)
lib/build-data.ts                    assembles DashboardData from any source
lib/data.ts                          sample loader + pipeline preload
lib/agent-tools.ts                   defineTool server tools
lib/copilot-runtime.ts               runtime, BuiltInAgent, system prompt
lib/fixtures.ts                      single place JSON is cast to contracts
data/*.json                          committed fixtures
```

## Data sources

Three sources — sample, upload, API — all resolve through
`buildDashboardData()` to one `DashboardData`. Add a source by writing a loader
that produces that shape; do not special-case a source downstream of the
picker. The header chip is the only place `kind` should change rendering.

`lib/validate.ts` is shared by the upload parser and the API proxy so both fail
identically. It returns `Result<T>` (`{ok:true, value}` | `SourceFailure`)
rather than a bare union, because `ClusterSummaryFile` has an index signature
and `"ok" in x` cannot discriminate against it.

## Patterns

- **Contract fields are optional when the pipeline may not send them.** Contract
  1 guarantees `n_genes`, `top_products`, `resistant_phenotype_breakdown`,
  `species_breakdown`. Provenance (`n_strains_dedup`, `n_countries`,
  `year_range`) comes from `daytona.md §5` and is optional. Badges render only
  when the backing field exists — a missing field never implies "clean".
- **Fixtures are cast once, in `lib/fixtures.ts`.** TypeScript widens JSON
  tuples to `number[]`, so contract types need a double assertion. Don't repeat
  it at call sites.
- **`lib/data.ts` and `lib/agent-tools.ts` both fall back to fixtures** when the
  pipeline is unset or unreachable, independently. A dead backend degrades per
  section rather than blanking the page.
- **Rails share one scale computed across all clusters, not the filtered
  subset**, so filtering never silently rescales the bars.
- Percentages go through `lib/format.ts`, which always emits the denominator.

## Gotchas

1. **Serve both CopilotKit transports.** The client defaults to
   `runtimeTransport: "auto"`: it probes `GET {runtimeUrl}/info` and on any
   non-2xx silently falls back to single-route (`POST {runtimeUrl}` with a
   `{method, params, body}` envelope). The fallback's `catch` swallows the
   original error, so a multi-route-only server reports "Runtime info request
   failed with status 404" and "Agent default not found" — which reads as a
   broken agent, not a routing mismatch. `[...path]` cannot match the bare base
   path, hence the second route file. Do not delete either.
2. **Pin `@ai-sdk/*`.** CopilotKit 1.63.2 bundles `ai@^6` (provider 3.x).
   `@ai-sdk/openai-compatible@latest` is 3.x (provider 4.x, for `ai` v7) and
   fails with an opaque "unsupported model version". Pinned to `2.0.62`.
3. **`maxSteps` defaults to 1.** The agent calls a tool then stops without using
   the result. Set to 5 in `lib/copilot-runtime.ts`.
4. **v2 API only.** `useFrontendTool` not `useCopilotAction`, `useAgentContext`
   not `useCopilotReadable`, `BuiltInAgent` not `OpenAIAdapter`. Chat components
   import from `@copilotkit/react-core/v2`, not `@copilotkit/react-ui`. Never
   mix bare `@copilotkit/react-core` and `/v2` imports in one tree.
5. **`defineTool` uses `execute`; `useFrontendTool` uses `handler`.** Frontend
   handlers must be async and resolve to a **string** — `JSON.stringify(obj)`.
6. **`useRenderTool`, not `useComponent`, for statistics.** `useComponent` lets
   the model retype numbers into props. `useRenderTool` renders the JSON the
   tool returned. Status is a string literal (`"inProgress"`, `"executing"`),
   not the `ToolCallStatus` enum that `useFrontendTool` uses.
7. **`useAgentContext` values must be strictly JSON-serializable.** A `Date`
   throws. Pass what the user is looking at plus compact stats, never bulk data.
8. **`FIREWORKS_API_KEY` stays server-side.** This repo is public. It is read in
   `lib/copilot-runtime.ts` only; never prefix `NEXT_PUBLIC_`.
9. **`turbopack.root` is pinned in `next.config.ts`** because `~/projects` has
   its own lockfile and Turbopack otherwise infers a workspace root far above
   this app.
10. **Fonts are fetched at build time** by `next/font/google`. A build on a
    network without access to Google Fonts fails; a built app runs offline.
11. **User-configured endpoints are fetched server-side**, via
    `app/api/datasource`. Never move this to the browser: an arbitrary pipeline
    will not send `Access-Control-Allow-Origin`, and `daytona.md §4.4` says CORS
    through the Daytona preview proxy is undocumented.

    That makes the route an SSRF surface, so it has three guards and all three
    must stay: DNS is resolved and every returned address checked (blocks a
    hostname pointing at `169.254.169.254`); redirects are refused with
    `redirect: "manual"` (blocks an allowed host bouncing to a blocked one);
    and only link-local ranges are blocked, not all private ones, because the
    pipeline legitimately runs on localhost. A DNS server that changes its
    answer between lookup and fetch can still win the race — closing that needs
    a pinned-IP agent and is out of scope here.
12. **Remembered connections use `useSyncExternalStore`, not a mount effect.**
    The snapshot is memoised in `lib/datasource.ts` — returning a freshly parsed
    array each call would loop forever, and the server snapshot must stay a
    stable empty reference or hydration mismatches.
13. **Never persist uploaded file contents or API keys.** Keys live in component
    state for the tab; only endpoints and auth method go to `localStorage`.

## Honesty rules (non-negotiable, from ../prompt.md §8)

These constrain code, not just copy. Before changing anything that displays a
number, check it still holds:

- Never show a percentage without its denominator adjacent.
- Show deduplicated strain counts by default; keep raw counts visible.
- Badge single-country or single-year patterns as possible outbreak artefacts.
- Never present computational annotation as laboratory measurement.
- Never quote a speedup or latency that was not measured — `PipelineStats`
  fields are nullable and render "not measured yet" rather than a placeholder.
- Never quote a resistance statistic for *H. pylori* (too few lab-measured rows).
- The research-prototype disclaimer stays visible without scrolling.

## Related

- `../` — Parts A and B write `data/cluster_summary.json` and
  `insights/observations.json`; `bun run sync-data` pulls them in.
