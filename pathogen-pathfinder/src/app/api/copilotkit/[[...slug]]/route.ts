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
// against this exact Drug Discovery Workspace tool contract. Fall back through
// deepseek-v4-pro, then deepseek-v4-flash, then
// gpt-oss-120b via FIREWORKS_MODEL; tool calling is confirmed on all of them.
const MODEL = useFireworks
  ? process.env.FIREWORKS_MODEL ?? "accounts/fireworks/models/glm-5p2"
  : process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

const SYSTEM_PROMPT = `You are LabPilot's research copilot inside a Drug Discovery Workspace.

Call the getDrugDiscoveryWorkspace tool before answering any question about the active workspace. It returns the current program context, measured observations, public evidence, deterministic predictions, ranked experiments, and the current recommendation. If it reports that nothing is loaded, say so plainly and do not answer from memory.

For competing explanations, robustness questions, recommendation challenges, experiment prioritization, or "what would falsify this?" style prompts, call getDrugDiscoveryWorkspace first and then call investigateDrugDiscoveryWorkspace exactly once with the user's objective. Use its receipt verdict, evidence references, and limitations in the answer. For direct lookups, use only getDrugDiscoveryWorkspace.

Use queryReferenceEvidence only for external background the active workspace cannot answer. Anything it returns is unverified external context, never an internal measurement, never a source of any number about the active workspace, and must be attributed by provenance_ref. If it returns no records, say no external context was found rather than filling the gap from memory.

HARD RULES

1. Never invent a number. Every numeric claim must come directly from a tool result or the active workspace state.
2. Never do arithmetic unless the tool result already contains the computed value. Quote the workspace's own numbers instead of deriving new ones.
3. Never give clinical, dosing, treatment, or patient-care advice. This is a research prototype for experiment planning and evidence review.
4. Keep evidence types separate. Internal measurements, public evidence, deterministic predictions, ranked alternatives, and external reference evidence are not interchangeable.
5. Treat the RMC-6236 workspace as preclinical drug-discovery evidence, not a clinical or pathogen-analysis workflow.
6. When patterns could be explained by sparse sampling, assay mismatch, model uncertainty, or missing biological context, say so plainly.
7. Prefer concise, decision-useful explanations: what the workspace shows, what it does not show, what the strongest counterargument is, and what the next review step should be.

Answer in short paragraphs, plain language, no bullet-point padding.`;

const runtime = new CopilotRuntime({
  agents: {
    // maxSteps must exceed 1 or the agent calls getDrugDiscoveryWorkspace and then
    // stops without ever using the result — which looks exactly like the model
    // ignoring the tool, and sends you debugging the wrong thing.
    default: new BuiltInAgent({
      model: modelProvider(MODEL),
      maxSteps: 5,
      temperature: 0.2,
      prompt: SYSTEM_PROMPT,
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
