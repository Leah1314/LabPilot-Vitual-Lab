import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  DiscoveryInvestigationInput,
  investigateDiscovery,
} from "@/lib/discovery-investigation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = DiscoveryInvestigationInput.parse(await request.json());
    return NextResponse.json(investigateDiscovery(input));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "invalid_request", issues: error.flatten() }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    console.error("Discovery investigation failed", error);
    return NextResponse.json({ error: "investigation_failed" }, { status: 502 });
  }
}
