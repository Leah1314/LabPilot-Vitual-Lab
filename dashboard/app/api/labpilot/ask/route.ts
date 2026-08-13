import { NextResponse } from "next/server";
import { measuredPoints, predictViability } from "@/lib/dose-response";

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

  const simulation = predictViability(35);
  const evidence = {
    experiment: { id: "LP-DR-042", compound: "Palbociclib", cellLine: "MCF-7", endpoint: "cell viability percent" },
    measuredPoints,
    modelOutput: { method: "log-dose interpolation", simulation35nM: simulation, recommendedDosesNm: [35, 15, 70] },
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna",
      reasoning: { effort: "low" },
      max_output_tokens: 300,
      instructions: "You are LabPilot, a concise scientific decision-support assistant. Answer only from the supplied evidence. Never calculate, alter, or invent a number; copy numeric claims exactly from evidence. Clearly distinguish measured observations from model predictions. Do not provide clinical advice or claim causation. Use 2–4 short sentences.",
      input: `Question: ${question}\n\nEvidence JSON: ${JSON.stringify(evidence)}`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("OpenAI Responses API error", response.status, detail.slice(0, 500));
    return NextResponse.json({ error: "LabPilot AI is temporarily unavailable" }, { status: 502 });
  }

  const answer = extractText(await response.json());
  if (!answer) return NextResponse.json({ error: "OpenAI returned no text" }, { status: 502 });
  return NextResponse.json({ answer, model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna" });
}
