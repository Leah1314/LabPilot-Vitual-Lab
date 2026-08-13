import { NextResponse } from "next/server";
import { predictViability } from "@/lib/dose-response";

export async function POST(request: Request) {
  const body = (await request.json()) as { experiment_id?: string; dose?: number };
  if (body.experiment_id !== "EXP-001" || typeof body.dose !== "number" || body.dose < 1 || body.dose > 100)
    return NextResponse.json({ error: "Use EXP-001 and a dose from 1–100 nM" }, { status: 400 });
  const result = predictViability(body.dose);
  return NextResponse.json({ experiment_id: body.experiment_id, dose: result.dose, unit: "nM", predicted_response: result.viability, estimated_range: [result.low, result.high], uncertainty_proxy: result.uncertainty, model: { type: "monotonic_log_dose_interpolation", version: "labpilot-model-0.2" }, status: "predicted" });
}
