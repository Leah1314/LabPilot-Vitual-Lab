/**
 * Pathogen AI agent — Claude Agent SDK + AG-UI adapter.
 *
 * Grounds answers on the workspace dataset synced into shared agent state
 * (`pathogen.dataset`) and via the frontend tool `getPathogenDataset`.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { ClaudeAgentAdapter } from "@ag-ui/claude-agent-sdk";
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { resolveModel } from "./model";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const SYSTEM_PROMPT = [
  "You are Pathogen AI Copilot — an AMR research assistant for the Pathogen AI workspace.",
  "Keep answers concise (2-5 sentences) and always ground claims in the loaded dataset.",
  "",
  "Workflow:",
  "1. Call getPathogenDataset (frontend tool) before answering questions about clusters,",
  "   resistance, virulence, gene classes, or insights.",
  "2. If no dataset is loaded, tell the user to open Upload and choose a data source",
  "   (upload files, connect API, or load the sample dataset).",
  "3. Prefer quantitative answers (percentages, counts, cluster IDs, Braintrust scores).",
  "4. For visualizations, use the barChart or pieChart generative UI components with",
  "   data derived from the dataset.",
  "5. Shared state may also include `pathogen.dataset` — treat it as the same source of truth.",
  "",
  "Domain tips:",
  "- Resistance values are fractions (0-1); report as percentages.",
  "- Insights include Braintrust eval scores and confidence tags.",
  "- Gene classes come from AMR product tallies across clusters.",
].join("\n");

const summarizeDataset = tool(
  "summarize_pathogen_state",
  "Summarize pathogen shared state JSON the host already synced. Prefer getPathogenDataset when available.",
  {
    note: z
      .string()
      .optional()
      .describe("Optional note about what the user asked."),
  },
  async (args) => ({
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          hint: "Use the frontend tool getPathogenDataset for the live workspace snapshot.",
          note: args.note ?? null,
        }),
      },
    ],
  }),
);

const SERVER_NAME = "pathogen";
const backendTools = [summarizeDataset];

export const adapter = new ClaudeAgentAdapter({
  agentId: "pathogen-ai",
  description: "Pathogen AI AMR research copilot",
  model: resolveModel(),
  systemPrompt: SYSTEM_PROMPT,
  mcpServers: {
    [SERVER_NAME]: createSdkMcpServer({
      name: SERVER_NAME,
      version: "1.0.0",
      tools: backendTools,
    }),
  },
  allowedTools: backendTools.map((t) => `mcp__${SERVER_NAME}__${t.name}`),
  tools: [],
  includePartialMessages: true,
});
