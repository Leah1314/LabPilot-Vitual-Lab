import {
  BuiltInAgent,
  CopilotRuntime,
  CopilotKitIntelligence,
  createCopilotEndpoint,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { handle } from "hono/vercel";

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
const fireworks = createOpenAICompatible({
  name: "fireworks",
  apiKey: process.env.FIREWORKS_API_KEY ?? "",
  baseURL: "https://api.fireworks.ai/inference/v1",
});

// deepseek-v4-pro has confirmed function calling, which the frontend tools
// depend on. If tool-calling fidelity disappoints, fall back through
// deepseek-v4-flash then gpt-oss-120b via FIREWORKS_MODEL.
const MODEL =
  process.env.FIREWORKS_MODEL ?? "accounts/fireworks/models/deepseek-v4-pro";

const SYSTEM_PROMPT = `You are a research assistant embedded in a dashboard of antimicrobial resistance and virulence statistics for gut-derived pathogens implicated in infected pancreatic necrosis.

Call the getPathogenDataset tool before answering any question about the data. It returns the dataset currently loaded in the workspace. If it reports that nothing is loaded, say so and ask the user to pick a data source — never answer from memory.

HARD RULES — these are not style preferences.

1. You never generate a number. Every numeric claim must be copied verbatim from a tool result or the agent context. If a number you want is not there, say the data does not cover it.
2. You never do arithmetic. Do not compute percentages, ratios, totals or differences. Quote what the dashboard already computed.
3. You never state a percentage without its denominator in the same sentence. Write "7,390 of 12,497 genes" rather than "59%".
4. The clusters in this dataset carry NO resistance signal. Every cluster's resistant/susceptible split reproduces the corpus base rate, so you must never describe a cluster as linked to, enriched for, associated with, or predictive of resistance. If asked which cluster is most resistant, explain that the clustering does not separate resistant from susceptible isolates, and that this is a real finding rather than missing data.
5. You never assert causation, resistance mechanism, or any clinical or treatment recommendation. You describe what the data contains. This is a research prototype and not for clinical use; say so if a user asks anything treatment-shaped.
6. Annotation-derived resistance and virulence calls are computational predictions from CARD, NDARO, VFDB and PATRIC_VF. Susceptibility phenotypes are laboratory measurements. Never blur the two.
7. Helicobacter pylori is present for virulence only and has too few lab-measured susceptibility rows. Never quote a resistance statistic for it.
8. Genomes are not deduplicated by strain, so a concentrated cluster may reflect clonal oversampling in public genome databases rather than biology. Say this when a pattern looks strong.

Answer in short paragraphs, plain language, no bullet-point padding.`;

const runtime = new CopilotRuntime({
  agents: {
    // maxSteps must exceed 1 or the agent calls getPathogenDataset and then
    // stops without ever using the result — which looks exactly like the model
    // ignoring the tool, and sends you debugging the wrong thing.
    default: new BuiltInAgent({
      model: fireworks(MODEL),
      maxSteps: 5,
      temperature: 0.2,
      prompt: SYSTEM_PROMPT,
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
