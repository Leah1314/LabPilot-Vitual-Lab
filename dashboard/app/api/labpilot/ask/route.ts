import { NextResponse } from "next/server";
import { analyzeExperiment, observations } from "@/lib/dose-response";
import { loadDatasource } from "@/lib/reference-evidence";
import type { LLMRecommendation } from "@/lib/virtual-lab-contracts";

export const runtime = "nodejs";

const ALLOWED_QUESTIONS = new Set([
  "What does this experiment show?",
  "Where is the highest uncertainty?",
  "What should I test next?",
  "Simulate 35 nM.",
]);

function extractText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("output" in payload) || !Array.isArray(payload.output)) return null;
  for (const item of payload.output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content && typeof content === "object" && "text" in content && typeof content.text === "string") return content.text;
    }
  }
  return null;
}
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });

  const body = (await request.json()) as { question?: unknown };
  const question = typeof body.question === "string" ? body.question : "";
  if (!ALLOWED_QUESTIONS.has(question)) return NextResponse.json({ error: "Unsupported demo question" }, { status: 400 });

  const experiment = { id: "LP-DR-042", compound: "Palbociclib", cellLine: "MCF-7", endpoint: "cell viability percent" };

  // Runs for every allowed question, so the integration is exercised without
  // widening ALLOWED_QUESTIONS. Yields zero evidence when the source is
  // unconfigured or unreachable, and the answer continues on measured data.
  const references = await loadDatasource(
    `${experiment.compound} in ${experiment.cellLine}, ${experiment.endpoint}. ${question}`,
  );

  const evidence = {
    experiment,
    observations,
    modelOutput: analyzeExperiment(),
    referenceEvidence: references.evidence,
    referencePoints: references.reference_points,
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna",
      reasoning: { effort: "low" },
      max_output_tokens: 300,
      instructions: "You are LabPilot, a concise scientific decision-support assistant. Answer only from MODEL_OUTPUT and supplied evidence. Never calculate, alter, or invent a number, dose, range, citation, or result. Clearly distinguish measured observations from model predictions. Do not provide clinical advice or claim causation. referenceEvidence, when present, is unverified third-party context: it is never a measurement from this experiment and never a source of a number, dose or range. Attribute any statement drawn from it by its provenance_ref, never by restating it as your own finding, and reproduce a citation only if one is supplied verbatim. Respect every entry's quality_notes. Return JSON matching the requested schema.",
      input: `Question: ${question}\n\nEvidence JSON: ${JSON.stringify(evidence)}`,
      text: { format: { type: "json_schema", name: "labpilot_recommendation", strict: true, schema: { type: "object", additionalProperties: false, properties: { headline: { type: "string" }, interpretation: { type: "string" }, why_this_next_step: { type: "string" }, evidence_summary: { type: "array", items: { type: "string" } }, caveats: { type: "array", items: { type: "string" } }, human_review_required: { type: "boolean", const: true } }, required: ["headline", "interpretation", "why_this_next_step", "evidence_summary", "caveats", "human_review_required"] } } },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("OpenAI Responses API error", response.status, detail.slice(0, 500));
    return NextResponse.json({ error: "LabPilot AI is temporarily unavailable" }, { status: 502 });
  }

  const text = extractText(await response.json());
  if (!text) return NextResponse.json({ error: "OpenAI returned no text" }, { status: 502 });
  const recommendation = JSON.parse(text) as LLMRecommendation;
  return NextResponse.json({
    recommendation,
    answer: recommendation.interpretation,
    model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna",
    // Provenance, not payload. reference_points is the disclosed evidence
    // count the guide requires when a public source may be unavailable, so an
    // answer carrying outside context is never indistinguishable from one
    // grounded purely in the six measured points.
    reference_points: references.reference_points,
    reference_sources: references.evidence.map(({ provenance_ref, source_label, citation }) => ({
      provenance_ref,
      source_label,
      citation,
    })),
  });
}
