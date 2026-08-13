import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { investigate, InvestigationInput } from "@/lib/rlm";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = InvestigationInput.parse(await request.json());
    return NextResponse.json(await investigate(input));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "invalid_request", issues: error.flatten() }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    console.error("Investigation failed", error);
    return NextResponse.json(
      { error: "investigation_failed", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 502 },
    );
  }
}
