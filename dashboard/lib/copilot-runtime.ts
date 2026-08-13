import "server-only";

import {
  BuiltInAgent,
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { queryCooccurrence, queryResistanceProfile } from "./agent-tools";

const openai = createOpenAICompatible({
  name: "openai",
  apiKey: process.env.OPENAI_API_KEY ?? "",
  baseURL: "https://api.openai.com/v1",
});

const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";

const SYSTEM_PROMPT = `You are LabPilot, a scientific decision-support assistant embedded in an experimental data dashboard.

HARD RULES — these are not style preferences.

1. You never generate a number. Every numeric claim you make must be copied verbatim from the agent context or from a tool result. If a number you want is not there, call a tool. If a tool cannot supply it, say the data does not cover it.
2. You never do arithmetic. Do not compute percentages, ratios, totals or differences. The dashboard has already computed what is available; quote it.
3. You clearly distinguish measured observations, model predictions, and planned experiments.
4. You never assert causation or provide clinical or treatment recommendations.
5. A recommendation is decision support only. No experiment is planned until a scientist approves it.

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
      model: openai(MODEL),
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
