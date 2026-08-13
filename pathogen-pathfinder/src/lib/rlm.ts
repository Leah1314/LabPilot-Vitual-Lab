import { z } from "zod";

const CountMap = z
  .record(z.string().min(1).max(120), z.number().finite().nonnegative())
  .refine((value) => Object.keys(value).length <= 40, "At most 40 entries are allowed");

const Cluster = z.object({
  id: z.string().min(1).max(80),
  nGenes: z.number().int().nonnegative(),
  headline: z.string().max(300).optional(),
  observation: z.string().max(2_000).optional(),
  confidence: z.string().max(40).optional(),
  evalScore: z.number().finite().min(0).max(1).optional(),
  species: CountMap.optional(),
  phenotypes: CountMap.optional(),
  products: CountMap.optional(),
}).strict();

export const InvestigationInput = z
  .object({
    objective: z.string().trim().min(8).max(800),
    dataset: z.object({
      source: z.string().max(200).optional(),
      generatedAt: z.string().datetime().optional(),
      clustersWithPhenotypeSignal: z.array(z.string().min(1).max(80)).max(50).default([]),
      clusters: z.array(Cluster).min(1).max(30),
    }).strict(),
  }).strict()
  .superRefine(({ dataset }, ctx) => {
    const ids = dataset.clusters.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dataset", "clusters"], message: "Cluster ids must be unique" });
    }
    const known = new Set(ids);
    dataset.clustersWithPhenotypeSignal.forEach((id, index) => {
      if (!known.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dataset", "clustersWithPhenotypeSignal", index],
          message: `Unknown cluster id: ${id}`,
        });
      }
    });
  });

const Claim = z.object({
  statement: z.string().min(1).max(800),
  evidenceRefs: z.array(z.string().min(1).max(80)).min(1).max(8),
  confidence: z.enum(["high", "medium", "low"]),
}).strict();

const BranchOutput = z.object({
  summary: z.string().min(1).max(1_500),
  claims: z.array(Claim).max(6),
  limitations: z.array(z.string().min(1).max(500)).max(6),
}).strict();

const SynthesisOutput = z.object({
  verdict: z.enum(["supported", "contested", "insufficient_evidence"]),
  answer: z.string().min(1).max(2_000),
  claims: z.array(Claim).max(8),
  limitations: z.array(z.string().min(1).max(500)).min(1).max(8),
}).strict();

export type InvestigationRequest = z.infer<typeof InvestigationInput>;
export type InvestigationReceipt = {
  id: string;
  objective: string;
  verdict: z.infer<typeof SynthesisOutput>["verdict"];
  answer: string;
  synthesis: string;
  claims: z.infer<typeof Claim>[];
  limitations: string[];
  modelCalls: number;
  branches: Array<
    z.infer<typeof BranchOutput> & {
      id: "support" | "challenge";
      role: "support" | "challenge";
      status: "supported" | "challenged";
      label: string;
      evidenceRefs: string[];
    }
  >;
  calls: Array<{
    id: string;
    role: "support" | "challenge" | "synthesis";
    model: string;
    startedAt: string;
    completedAt: string;
    inputRefs: string[];
  }>;
};

const claimJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["statement", "evidenceRefs", "confidence"],
  properties: {
    statement: { type: "string" },
    evidenceRefs: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
} as const;

const branchJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "claims", "limitations"],
  properties: {
    summary: { type: "string" },
    claims: { type: "array", maxItems: 6, items: claimJsonSchema },
    limitations: { type: "array", maxItems: 6, items: { type: "string" } },
  },
} as const;

const synthesisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "answer", "claims", "limitations"],
  properties: {
    verdict: { type: "string", enum: ["supported", "contested", "insufficient_evidence"] },
    answer: { type: "string" },
    claims: { type: "array", maxItems: 8, items: claimJsonSchema },
    limitations: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
  },
} as const;

const RULES = `Use only the supplied dataset. Never invent or calculate numbers. Cite every claim with exact cluster ids from the dataset. A cluster may be described as resistance-associated only when its id is in clustersWithPhenotypeSignal. Phenotype counts are laboratory susceptibility measurements; product annotations are computational predictions. Never swap or blur those evidence types. Do not assert causation or give clinical or treatment advice. Helicobacter pylori resistance claims are unsupported. Public genomes may contain clonal oversampling.`;

function provider() {
  if (process.env.FIREWORKS_API_KEY) {
    return {
      apiKey: process.env.FIREWORKS_API_KEY,
      model: process.env.FIREWORKS_MODEL ?? "accounts/fireworks/models/glm-5p2",
      url: "https://api.fireworks.ai/inference/v1/chat/completions",
      reasoning_effort: process.env.FIREWORKS_REASONING_EFFORT ?? "none",
    };
  }
  if (process.env.OPENROUTER_API_KEY) {
    return {
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
      url: "https://openrouter.ai/api/v1/chat/completions",
    };
  }
  throw new Error("FIREWORKS_API_KEY or OPENROUTER_API_KEY is not configured");
}

async function callJson<T>(
  role: string,
  prompt: string,
  schema: Record<string, unknown>,
  parser: z.ZodType<T>,
): Promise<T> {
  const selected = provider();

  const response = await fetch(selected.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${selected.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: selected.model,
      temperature: 0.1,
      ...(selected.reasoning_effort ? { reasoning_effort: selected.reasoning_effort } : {}),
      messages: [
        { role: "system", content: `${RULES}\nReturn only JSON matching the provided schema.` },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_schema", json_schema: { name: role, strict: true, schema } },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`Model provider ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Model provider returned no ${role} content`);
  try {
    return parser.parse(JSON.parse(content));
  } catch (error) {
    throw new Error(`Invalid ${role} response`, { cause: error });
  }
}

function assertEvidenceRefs(output: { claims: Array<{ evidenceRefs: string[] }> }, known: Set<string>) {
  const unknown = output.claims.flatMap(({ evidenceRefs }) => evidenceRefs).filter((ref) => !known.has(ref));
  if (unknown.length) throw new Error(`Model cited unknown evidence: ${[...new Set(unknown)].join(", ")}`);
}

export async function investigate(input: InvestigationRequest): Promise<InvestigationReceipt> {
  const selected = provider();
  const refs = input.dataset.clusters.map(({ id }) => id);
  const known = new Set(refs);
  const calls: InvestigationReceipt["calls"] = [];
  const run = async (role: "support" | "challenge", instruction: string) => {
    const startedAt = new Date().toISOString();
    const output = await callJson(
      `${role}_branch`,
      `${instruction}\nObjective: ${input.objective}\nDataset: ${JSON.stringify(input.dataset)}`,
      branchJsonSchema,
      BranchOutput,
    );
    assertEvidenceRefs(output, known);
    calls.push({ id: crypto.randomUUID(), role, model: selected.model, startedAt, completedAt: new Date().toISOString(), inputRefs: refs });
    const status: "supported" | "challenged" = role === "support" ? "supported" : "challenged";
    return {
      ...output,
      id: role,
      role,
      status,
      label: role === "support" ? "Evidence / support" : "Skeptic / challenge",
      evidenceRefs: [...new Set(output.claims.flatMap(({ evidenceRefs }) => evidenceRefs))],
    };
  };

  const branches = await Promise.all([
    run("support", "Find the strongest dataset-grounded answer to the objective. State gaps rather than filling them."),
    run("challenge", "Try to falsify the objective and the likely supporting interpretation. Surface confounds, contradictions, and missing evidence."),
  ]);

  const startedAt = new Date().toISOString();
  const synthesis = await callJson(
    "root_synthesis",
    `Adjudicate the two bounded investigations. Prefer contested or insufficient_evidence when support does not survive the challenge.\nObjective: ${input.objective}\nValid evidence refs: ${refs.join(", ")}\nBranches: ${JSON.stringify(branches)}`,
    synthesisJsonSchema,
    SynthesisOutput,
  );
  assertEvidenceRefs(synthesis, known);
  calls.push({ id: crypto.randomUUID(), role: "synthesis", model: selected.model, startedAt, completedAt: new Date().toISOString(), inputRefs: branches.map(({ id }) => id) });

  return {
    id: crypto.randomUUID(),
    objective: input.objective,
    ...synthesis,
    synthesis: synthesis.answer,
    modelCalls: calls.length,
    branches,
    calls,
  };
}
