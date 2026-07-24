# Frontend — Next.js + CopilotKit Dashboard

**Owner: frontend.** You build the surface the judges actually see.
**Verified against CopilotKit 1.63.2, 2026-07-24.** See [prompt.md](./prompt.md).

Your deliverable is a dashboard that displays co-occurrence and resistance
statistics from the Daytona API, with a conversational panel powered by Fireworks.

---

## 1. Stack

```bash
npm install @copilotkit/react-core@1.63.2 @copilotkit/react-ui@1.63.2 @copilotkit/runtime@1.63.2
```

CopilotKit is **MIT-licensed and fully self-hostable**. No CopilotKit Cloud
account or API key is required for anything in this spec.

### Use the v2 API — this is the single biggest thing to get right

CopilotKit ships **two APIs in the same packages**. The one in most tutorials and
blog posts — `useCopilotAction`, `useCopilotReadable`, `OpenAIAdapter`, UI
imported from `@copilotkit/react-ui` — is the **deprecated v1 surface**. The
current API lives under the **`/v2` subpath**.

| Legacy v1 | Use instead |
|---|---|
| `useCopilotAction` | `useFrontendTool` |
| `useCopilotReadable` | `useAgentContext` |
| `useCopilotAction` + `renderAndWaitForResponse` | `useHumanInTheLoop` |
| `useCoAgent` | `useAgent` |
| `OpenAIAdapter` + `serviceAdapter` | `BuiltInAgent` + `createCopilotRuntimeHandler` |

In v2, chat components import from **`@copilotkit/react-core/v2`**, not from
`@copilotkit/react-ui` (which has no v2 JS export). Styles come from
`@copilotkit/react-core/v2/styles.css`. Tool parameters are **Zod schemas**, so
`zod >= 3` is required.

**Do not pin below 1.63.0** — it fixed an `/info` request storm firing 70–80
requests per page load under StrictMode, plus TypeScript declaration resolution
under modern `bundler`/`nodenext` tsconfigs.

Do **not** reach for `useAgent`/CoAgents. Those are for stateful LangGraph-style
backend graphs. `useFrontendTool`, `useAgentContext`, and `useRenderTool` cover
everything here.

### Provider

```tsx
// app/layout.tsx
import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CopilotKit runtimeUrl="/api/copilotkit" showDevConsole>{children}</CopilotKit>
      </body>
    </html>
  );
}
```

`showDevConsole` defaults to `false` — turn it on while building or you debug blind.

---

## 2. Wiring CopilotKit to Fireworks

There is **no `OpenAIAdapter`** in the current path. v2 replaced adapters with
`BuiltInAgent`, which takes a Vercel AI SDK `LanguageModel`. Fireworks is
OpenAI-compatible, so any AI SDK OpenAI-compatible provider works.

```ts
// app/api/copilotkit/[...path]/route.ts
import { CopilotRuntime, createCopilotRuntimeHandler, BuiltInAgent } from "@copilotkit/runtime/v2";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const fireworks = createOpenAICompatible({
  name: "fireworks",
  apiKey: process.env.FIREWORKS_API_KEY!,
  baseURL: "https://api.fireworks.ai/inference/v1",
});

const runtime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      model: fireworks("accounts/fireworks/models/deepseek-v4-pro"),
      maxSteps: 5,
      prompt: SYSTEM_PROMPT,
      tools: [queryCooccurrence, queryResistanceProfile],
    }),
  },
});

const handler = createCopilotRuntimeHandler({ runtime, basePath: "/api/copilotkit" });
export { handler as GET, handler as POST };
```

Route file must be `app/api/copilotkit/[...path]/route.ts` exporting both `GET`
and `POST`. (Single-route mode exists via `mode: "single-route"` with `POST` only.)

### Three traps, each worth an hour you do not have

1. **AI SDK provider version mismatch — the worst one.** CopilotKit 1.63.2
   bundles `ai@^6`, which pins `@ai-sdk/provider@3.x`. Installing
   `@ai-sdk/openai-compatible@latest` today gives you a `provider@4.x` build for
   `ai` v7, and the resulting model object is rejected with an opaque
   "unsupported model version" error rather than a clean failure. **Pin:**

   ```bash
   npm install @ai-sdk/openai-compatible@^2.0.62   # or
   npm install @ai-sdk/openai@^3.0.36              # or
   npm install @ai-sdk/fireworks@^2.0.70
   ```

   **Never `@latest`.**

2. **`maxSteps` defaults to `1`.** The agent calls your tool and then stops
   without ever using the result. This looks *exactly* like the model ignoring
   your tool, and you will debug the wrong thing. Set `maxSteps: 5`.

3. **`forwardSystemMessages` defaults to `false`** — system messages sent from
   the client are silently dropped. Put the system prompt in `BuiltInAgent`'s
   `prompt` field.

### Highest-risk unknown in the project

Generative UI depends entirely on the model emitting well-formed tool calls in
the shape `ai` v6 expects, and tool-calling fidelity varies across open models.
**Test the tool-call path in the first hour**, before building any UI. Fall back
through `deepseek-v4-flash`, then `gpt-oss-120b`.

### Backend tool

```ts
import { defineTool } from "@copilotkit/runtime/v2";
import { z } from "zod";

const queryCooccurrence = defineTool({
  name: "queryCooccurrence",
  description: "Get resistance/virulence gene co-occurrence statistics for an organism",
  parameters: z.object({
    organism: z.string().describe("e.g. 'Klebsiella pneumoniae'"),
    minSupport: z.number().optional(),
  }),
  execute: async ({ organism, minSupport = 5 }) => {
    const r = await fetch(
      `${process.env.PIPELINE_URL}/cooccurrence?organism=${encodeURIComponent(organism)}&min_support=${minSupport}`);
    return await r.json();
  },
});
```

---

## 3. Rendering results

**Use `useRenderTool`, not `useComponent`.** Both exist and both render React in
chat. `useComponent` lets the LLM call a component as a tool and fill its props —
which means the model would be *retyping your statistics into tool arguments*.
When the numbers are the entire product, that is unacceptable. `useRenderTool` is
renderer-only, keyed to the backend tool name, and renders the actual JSON your
API returned.

```tsx
import { useRenderTool } from "@copilotkit/react-core/v2";
import { z } from "zod";

useRenderTool({
  name: "queryCooccurrence",
  parameters: z.object({ organism: z.string() }),
  render: ({ parameters, status, result }) => {
    if (status === "inProgress") return <Skeleton />;
    if (status === "executing") return <div>Analyzing {parameters.organism}…</div>;
    return <CooccurrenceCard {...JSON.parse(result)} />;
  },
}, []);
```

Reserve `useComponent` for things the LLM legitimately composes — comparisons,
summaries — never for numbers.

### API sharp edges

- **Status types are inconsistent.** `useRenderTool` reports **string literals**
  (`"inProgress"`, `"executing"`, `"complete"`), while `useFrontendTool` and
  `useHumanInTheLoop` use the **`ToolCallStatus` enum**.
- **`ToolCallStatus` imports from `@copilotkit/core`**, not from
  `@copilotkit/react-core/v2` — and the docs use it in examples *without ever
  showing the import*. This will bite you.
- **`useFrontendTool` handlers must return a `string`.** Use `JSON.stringify(obj)`.
- `useRenderTool` intentionally does not clean up on unmount, so chat history
  still renders; registrations dedupe by `agentId:name`, latest wins.

### Exposing app state

```tsx
import { useAgentContext } from "@copilotkit/react-core/v2";

useAgentContext({
  description: "Currently selected organism and active filters",
  value: { organism, minSupport, dedupEnabled, cohortDate },
});
```

Values must be **strictly JSON-serializable** — a `Date` or class instance throws.
Never put bulk data here; the assistant needs to know what the user is *looking
at*, not the whole dataset.

---

## 4. Dashboard layout

**Left:** organism selector, filters, cohort summary with the pinned data date.
**Centre:** co-occurrence network graph, plus a ranked table of pairs showing
lift, adjusted p-value, **deduplicated strain count**, country spread, and year
range.
**Right:** CopilotKit chat panel with auto-generated observation cards.

### The honesty affordances — these are the design

The backend returns both `n_genomes_raw` and `n_strains_dedup` for every
statistic. That contract exists so the UI can be truthful, so use it:

- **Display the deduplicated count by default**, with the raw count available.
  The gap between them is scientifically meaningful.
- **Badge any pattern confined to one country or one year** as a possible
  outbreak artefact. The API returns `n_countries` and `year_range` for this.
- **Never show a percentage without its denominator** adjacent to it.
- **Persistent disclaimer**, visible without scrolling: research prototype, not
  for clinical use.

These four details are what make the dashboard look like it was built by people
who know the field rather than people who found a dataset. They cost very little
and they are the most likely thing to win the room.

---

## 5. Demo robustness

- **Screenshot every key screen** as a fallback. Live demos of cloud sandboxes
  fail, and a screenshot beats a spinner.
- **Test the demo laptop against the Daytona preview URL on the venue network
  early.** Conference wifi frequently blocks odd ports, and you want to discover
  that at hour one, not at hour four.
- Freeze code at 3:15 and rehearse twice.
- Have a canned query list ready. Do not improvise prompts in front of judges.

---

## 6. Traps

1. Writing v1 code — `useCopilotAction`, `useCopilotReadable`, `OpenAIAdapter`.
2. Mixing bare `@copilotkit/react-core` and `/v2` imports in one tree.
3. `@ai-sdk/*` installed at `@latest` — the provider v3/v4 mismatch.
4. `maxSteps` left at 1, which looks exactly like the model ignoring your tool.
5. `useComponent` instead of `useRenderTool`, letting the LLM retype statistics.
6. Importing `ToolCallStatus` from the wrong package.
7. Returning an object rather than a string from a `useFrontendTool` handler.
8. A `Date` inside `useAgentContext`.
9. Pinning CopilotKit below 1.63.0.
10. `showDevConsole` left `false` while debugging.
11. Shipping `FIREWORKS_API_KEY` into the client bundle — it must stay in the
    route handler. **The repo is public.**
