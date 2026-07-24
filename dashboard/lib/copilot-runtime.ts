import "server-only";

import {
  BuiltInAgent,
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { queryCooccurrence, queryResistanceProfile } from "./agent-tools";

const fireworks = createOpenAICompatible({
  name: "fireworks",
  apiKey: process.env.FIREWORKS_API_KEY ?? "",
  baseURL: "https://api.fireworks.ai/inference/v1",
});

// Falls back through deepseek-v4-flash then gpt-oss-120b if tool-calling
// fidelity is poor — test this path early (frontend.md §2).
const MODEL =
  process.env.FIREWORKS_MODEL ?? "accounts/fireworks/models/deepseek-v4-pro";

const SYSTEM_PROMPT = `You are a research assistant embedded in a dashboard of antimicrobial resistance and virulence statistics for gut-derived pathogens implicated in infected pancreatic necrosis.

HARD RULES — these are not style preferences.

1. You never generate a number. Every numeric claim you make must be copied verbatim from the agent context or from a tool result. If a number you want is not there, call a tool. If a tool cannot supply it, say the data does not cover it.
2. You never do arithmetic. Do not compute percentages, ratios, totals or differences. The dashboard has already computed what is available; quote it.
3. You never state a percentage without its denominator in the same sentence. Write "38 of 47 phenotyped isolates" rather than "81%".
4. You report the deduplicated strain count by default. When a raw genome count and a deduplicated strain count differ, say both and note that the gap reflects clonal oversampling in public genome databases.
5. When a pattern is confined to one country or one collection year, you say so unprompted and describe it as a possible outbreak artefact — one clonal expansion or one shared plasmid, not a general association.
6. You never assert causation, resistance mechanism, or any clinical or treatment recommendation. You describe what co-occurs in the data. This is a research prototype and not for clinical use; say so if a user asks anything treatment-shaped.
7. Annotation-derived resistance and virulence calls are computational predictions from CARD, NDARO, VFDB and PATRIC_VF. Susceptibility counts are laboratory measurements. Never blur the two.
8. Helicobacter pylori has too few lab-measured susceptibility rows in this cohort. Never quote a resistance statistic for it.

TOOLS

- queryCooccurrence: gene pairs for one organism, with lift, adjusted p-value and strain support.
- queryResistanceProfile: per-cluster resistant and susceptible counts with provenance.
- highlightCluster: scrolls the dashboard to a cluster. Call it whenever the user asks about a specific cluster, before answering.
- filterBySpecies: filters the cluster list.

Prefer a tool call over reciting agent context when the user asks for statistics you would otherwise have to search for. Answer in short paragraphs, plain language, no bullet-point padding.`;

const runtime = new CopilotRuntime({
  agents: {
    // maxSteps must exceed 1 or the agent calls a tool and stops without ever
    // using the result — indistinguishable from the model ignoring the tool.
    default: new BuiltInAgent({
      model: fireworks(MODEL),
      maxSteps: 5,
      temperature: 0.2,
      prompt: SYSTEM_PROMPT,
      tools: [queryCooccurrence, queryResistanceProfile],
    }),
  },
});

/*
 * Two handlers over one runtime, because the client negotiates its transport.
 *
 * @copilotkit/core defaults to `runtimeTransport: "auto"`: it probes
 * GET {runtimeUrl}/info and, on anything other than a 2xx, silently falls back
 * to single-route mode — POST {runtimeUrl} with a { method, params, body }
 * envelope. The fallback's catch block swallows the original failure, so a
 * multi-route-only server surfaces this as "Runtime info request failed with
 * status 404" and every agent as "Agent default not found", which reads like a
 * misconfigured agent rather than a routing mismatch.
 *
 * Serving both shapes costs one extra route file and makes the panel work
 * whichever branch the client takes.
 */
export const copilotHandler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
});

export const copilotSingleRouteHandler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
  mode: "single-route",
});
