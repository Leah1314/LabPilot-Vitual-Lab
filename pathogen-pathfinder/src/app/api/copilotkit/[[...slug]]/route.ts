import {
  BuiltInAgent,
  CopilotRuntime,
  CopilotKitIntelligence,
  createCopilotEndpoint,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { handle } from "hono/vercel";

import { queryReferenceEvidence } from "@/lib/convoke-tool";

// Fireworks AI, not Anthropic. Fireworks is OpenAI-compatible, so the stock
// AI SDK openai-compatible provider works and no Fireworks-specific client is
// needed. This replaces the previous setup, which ran a separate Claude Agent
// SDK server on :8000 and reached it over AG-UI with HttpAgent — that required
// an ANTHROPIC_API_KEY and a second process for the demo. BuiltInAgent runs
// in-process, so `npm run dev` is now a single server.
//
// The provider version is PINNED. CopilotKit 1.63.x bundles `ai` v6, which
// pins @ai-sdk/provider 3.x; installing @ai-sdk/openai-compatible@latest pulls
// a provider 4.x build for `ai` v7 and the model object is rejected with an
// opaque "unsupported model version" rather than a clean failure.
// GLM-5.2 thinks before answering by default, which costs seconds per turn and
// makes the chat feel sluggish in a live demo. Fireworks accepts a
// `reasoning_effort` field that the AI SDK does not model, so it is injected
// into the request body here. Measured on the tool-calling path:
//
//   default          3.02s   25 completion tokens, 91 chars of reasoning
//   effort "low"     0.88s   27 completion tokens, 95 chars of reasoning
//   effort "none"    0.80s    6 completion tokens, 0 reasoning
//
// "none" is ~3.8x faster and still emits correct tool calls. Set
// FIREWORKS_REASONING_EFFORT to "low"/"medium"/"high" to put thinking back.
const REASONING_EFFORT = process.env.FIREWORKS_REASONING_EFFORT ?? "none";

const fireworksFetch: typeof fetch = async (input, init) => {
  if (init?.body && typeof init.body === "string") {
    try {
      const body = JSON.parse(init.body);
      body.reasoning_effort = REASONING_EFFORT;
      init = { ...init, body: JSON.stringify(body) };
    } catch {
      // Not JSON we can amend — send it through untouched rather than fail.
    }
  }
  return fetch(input, init);
};

const useFireworks = Boolean(process.env.FIREWORKS_API_KEY);
const modelProvider = createOpenAICompatible({
  name: useFireworks ? "fireworks" : "openrouter",
  apiKey: useFireworks
    ? process.env.FIREWORKS_API_KEY ?? ""
    : process.env.OPENROUTER_API_KEY ?? "",
  baseURL: useFireworks
    ? "https://api.fireworks.ai/inference/v1"
    : "https://openrouter.ai/api/v1",
  ...(useFireworks ? { fetch: fireworksFetch } : {}),
});

// glm-5p2: 743B, 1M context, open weights, and function calling verified
// against this exact getPathogenDataset schema — the frontend tools depend on
// it. Fall back through deepseek-v4-pro, then deepseek-v4-flash, then
// gpt-oss-120b via FIREWORKS_MODEL; tool calling is confirmed on all of them.
const MODEL = useFireworks
  ? process.env.FIREWORKS_MODEL ?? "accounts/fireworks/models/glm-5p2"
  : process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

const SYSTEM_PROMPT = `You are a research assistant embedded in a dashboard of antimicrobial resistance and virulence statistics for gut-derived pathogens implicated in infected pancreatic necrosis.

Call the getPathogenDataset tool before answering any question about the data. It returns the dataset currently loaded in the workspace. If it reports that nothing is loaded, say so and ask the user to pick a data source — never answer from memory.

For multi-cluster comparisons, anomaly or robustness checks, competing explanations, or cross-section synthesis, call getPathogenDataset first and then call investigatePathogenDataset exactly once with the user's objective. Use its receipt verdict, evidence references, and limitations in the answer. For direct lookups, use only getPathogenDataset. Never promote branch prose over the numeric hard rules below.

HARD RULES — these are not style preferences.

1. You never generate a number. Every numeric claim must be copied verbatim from a tool result or the agent context. If a number you want is not there, say the data does not cover it.
2. You never do arithmetic. Do not compute percentages, ratios, totals or differences. Quote what the dashboard already computed.
3. You never state a percentage without its denominator in the same sentence. Write "7,390 of 12,497 genes" rather than "59%".
4. Resistance association is gated by the data, not by your judgement. The tool result contains a field named clustersWithPhenotypeSignal, a list of cluster ids whose phenotype split departs from the corpus base rate. You may only describe a cluster as linked to, enriched for, associated with or predictive of resistance if its id appears in that list. If the list is empty, and the user asks which cluster is most resistant, say plainly that no cluster separates resistant from susceptible isolates — every cluster reproduces the corpus base rate — and that this is a real finding rather than missing data. Never pick a highest cluster by eyeballing raw counts; a large cluster has more of everything.
5. You never assert causation, resistance mechanism, or any clinical or treatment recommendation. You describe what the data contains. This is a research prototype and not for clinical use; say so if a user asks anything treatment-shaped.
6. Annotation-derived resistance and virulence calls are computational predictions from CARD, NDARO, VFDB and PATRIC_VF. Susceptibility phenotypes are laboratory measurements. Never blur the two.
7. Helicobacter pylori is present for virulence only and has too few lab-measured susceptibility rows. Never quote a resistance statistic for it.
8. Genomes are not deduplicated by strain, so a concentrated cluster may reflect clonal oversampling in public genome databases rather than biology. Say this when a pattern looks strong.
9. External background comes only from the queryReferenceEvidence tool, never from memory. What it returns is unverified context: never a laboratory measurement, and never a source of any number about this dataset. Attribute anything you take from it by its provenance_ref. If it returns zero records, say no external context was found rather than filling the gap yourself.

Answer in short paragraphs, plain language, no bullet-point padding.`;

const runtime = new CopilotRuntime({
  agents: {
    // maxSteps must exceed 1 or the agent calls getPathogenDataset and then
    // stops without ever using the result — which looks exactly like the model
    // ignoring the tool, and sends you debugging the wrong thing.
    default: new BuiltInAgent({
      model: modelProvider(MODEL),
      maxSteps: 5,
      temperature: 0.2,
      prompt: SYSTEM_PROMPT,
      // Server-side, so CONVOKE_MCP_TOKEN never reaches the client bundle.
      // No-ops when CONVOKE_MCP_URL is unset: the tool reports it is not
      // configured rather than failing the turn.
      tools: [queryReferenceEvidence],
    }),
  },
  // --- copilotkit:intelligence (remove this block to opt out) ---
  ...(process.env.COPILOTKIT_LICENSE_TOKEN
    ? {
        intelligence: new CopilotKitIntelligence({
          apiKey: process.env.INTELLIGENCE_API_KEY ?? "",
          apiUrl: process.env.INTELLIGENCE_API_URL ?? "http://localhost:4201",
          wsUrl:
            process.env.INTELLIGENCE_GATEWAY_WS_URL ?? "ws://localhost:4401",
        }),
        // Demo stub — replace with your real auth-derived user identity before any
        // multi-user deployment, or all users share one thread history.
        identifyUser: () => ({ id: "demo-user", name: "Demo User" }),
        licenseToken: process.env.COPILOTKIT_LICENSE_TOKEN,
      }
    : { runner: new InMemoryAgentRunner() }),
  // --- /copilotkit:intelligence ---
  openGenerativeUI: true,
  a2ui: {
    injectA2UITool: false,
  },
});

const app = createCopilotEndpoint({
  runtime,
  basePath: "/api/copilotkit",
});

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
