import "server-only";

import type {
  ClusterSummary,
  ClusterSummaryFile,
  Observation,
  ObservationsFile,
} from "./contracts";
import { isOutbreakArtefact } from "./contracts";

/**
 * Part B, run from the dashboard.
 *
 * A cluster_summary without an observations.json is useless to this UI, and
 * asking someone to go run a Python script before they can look at their own
 * numbers is a poor demo. This generates Contract 2 from Contract 1 directly.
 *
 * The API key is read here, server-side, and never reaches the browser.
 */

const FIREWORKS_URL = "https://api.fireworks.ai/inference/v1/chat/completions";

export const DEFAULT_MODEL =
  process.env.FIREWORKS_MODEL ?? "accounts/fireworks/models/deepseek-v4-pro";

/**
 * The prompt carries the honesty rules from prompt.md §8, not just the
 * formatting ask. A model told only "write an observation" will reach for
 * mechanism and clinical advice, both of which are out of bounds here.
 */
const SYSTEM = `You write short, factual research observations about gene clusters from pathogens implicated in gut-derived infections, including infected pancreatic necrosis.

RULES, in order of importance:
1. Use ONLY numbers present in the cluster data given to you. Never invent, estimate or calculate a figure. If you want a number that is not in the input, leave it out.
2. Never state a percentage. Quote the counts as given, for example "38 Resistant and 9 Susceptible".
3. Never assert causation, resistance mechanism, transmission route, or any clinical or treatment recommendation. Describe what co-occurs in the data and stop.
4. Resistance and virulence gene calls are computational annotations. Susceptibility counts are laboratory measurements. Never describe one as the other.
5. If the cluster is confined to a single country or a single collection year, say so and describe it as a possible outbreak or sampling artefact rather than a general pattern.
6. No hedging filler, no "further research is needed", no restating the question.

Reply with JSON only, no markdown fence:
{"headline": "under 12 words", "observation": "2-3 sentences", "confidence": "high" | "medium" | "low"}`;

function userPrompt(clusterId: string, cluster: ClusterSummary): string {
  const artefact = isOutbreakArtefact(cluster);
  return [
    `Cluster ${clusterId}.`,
    JSON.stringify(cluster, null, 2),
    artefact
      ? "This cluster is confined to a single country or a single collection year. Rule 5 applies: say so and set confidence to low."
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Models wrap JSON in markdown fences, prepend prose, or emit both. Strip the
 * common shapes and fall back to the first balanced object in the text.
 */
export function parseModelJson(raw: string): Record<string, unknown> | null {
  const withoutFence = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence) as Record<string, unknown>;
  } catch {
    // fall through
  }

  const start = withoutFence.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < withoutFence.length; i++) {
    const ch = withoutFence[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(withoutFence.slice(start, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function normaliseConfidence(value: unknown, artefact: boolean): Observation["confidence"] {
  if (artefact) return "low";
  const v = String(value ?? "").toLowerCase();
  if (v === "high" || v === "medium" || v === "low") return v;
  return "medium";
}

export interface GenerationOutcome {
  observations: ObservationsFile;
  /** Per-cluster latencies, for the pipeline readout. */
  latenciesMs: number[];
  failures: Array<{ cluster_id: string; reason: string }>;
}

async function generateOne(
  clusterId: string,
  cluster: ClusterSummary,
  apiKey: string,
  model: string,
): Promise<{ observation: Observation | null; ms: number; reason?: string }> {
  const started = Date.now();
  try {
    const res = await fetch(FIREWORKS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt(clusterId, cluster) },
        ],
        max_tokens: 400,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const ms = Date.now() - started;

    if (!res.ok) {
      const detail = res.status === 401 ? "key rejected" : `HTTP ${res.status}`;
      // 429 is the documented trap: Fireworks caps unpaid accounts at 10 rpm.
      const reason =
        res.status === 429
          ? "rate limited (Fireworks allows 10 requests/minute without a payment method on file)"
          : detail;
      return { observation: null, ms, reason };
    }

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    const parsed = parseModelJson(text);
    if (!parsed || typeof parsed.headline !== "string" || typeof parsed.observation !== "string") {
      return { observation: null, ms, reason: "model did not return usable JSON" };
    }

    const artefact = isOutbreakArtefact(cluster);
    return {
      ms,
      observation: {
        cluster_id: clusterId,
        headline: parsed.headline.trim(),
        observation: parsed.observation.trim(),
        confidence: normaliseConfidence(parsed.confidence, artefact),
        // Generated here, so nothing has scored it. Null would be dishonest to
        // render as a passing badge; 0 marks it as unscored and the UI says so.
        eval_score: 0,
        supporting_gene_count: cluster.n_genes,
      },
    };
  } catch (err) {
    const ms = Date.now() - started;
    const timedOut = (err as Error).name === "TimeoutError";
    return { observation: null, ms, reason: timedOut ? "timed out" : "request failed" };
  }
}

/**
 * Generates one observation per cluster. Runs sequentially on purpose:
 * Fireworks rate-limits unpaid accounts to 10 requests per minute, and a
 * parallel fan-out over a dozen clusters trips it immediately.
 */
export async function generateObservations(
  summary: ClusterSummaryFile,
  model: string = DEFAULT_MODEL,
): Promise<GenerationOutcome> {
  const apiKey = process.env.FIREWORKS_API_KEY;
  if (!apiKey) throw new Error("FIREWORKS_API_KEY is not set");

  const clusters: Observation[] = [];
  const latenciesMs: number[] = [];
  const failures: GenerationOutcome["failures"] = [];

  for (const [clusterId, cluster] of Object.entries(summary)) {
    const { observation, ms, reason } = await generateOne(clusterId, cluster, apiKey, model);
    latenciesMs.push(ms);
    if (observation) clusters.push(observation);
    else failures.push({ cluster_id: clusterId, reason: reason ?? "unknown" });
  }

  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;

  return {
    latenciesMs,
    failures,
    observations: {
      generated_at: new Date().toISOString(),
      clusters,
      pipeline_stats: {
        sequences_embedded: null,
        embedding_seconds: null,
        embedding_hardware: null,
        llm_median_latency_ms: median,
        llm_model: model,
        // Generated in-app and not run through Braintrust, so there is no
        // faithfulness score to report. Left null rather than assumed good.
        eval_mean_faithfulness: null,
        eval_n_examples: null,
      },
    },
  };
}
