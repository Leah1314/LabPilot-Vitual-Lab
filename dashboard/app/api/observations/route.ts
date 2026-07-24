import { NextResponse } from "next/server";

import { validateClusterSummary } from "@/lib/validate";
import { generateObservations } from "@/lib/fireworks";

/*
 * Generates Contract 2 from Contract 1 using Fireworks.
 *
 * Server-side because FIREWORKS_API_KEY must never reach the client bundle —
 * this repo is public. The cluster summary is posted up rather than read from
 * disk, so this works for an uploaded file the server has never seen.
 */

export const runtime = "nodejs";
// One request per cluster, sequentially, to stay under the Fireworks rate cap.
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!process.env.FIREWORKS_API_KEY) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "FIREWORKS_API_KEY is not set on the server. Add it to .env.local and restart.",
      },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Malformed request body." },
      { status: 400 },
    );
  }

  const validation: string[] = [];
  const summary = validateClusterSummary(
    (body as { cluster_summary?: unknown })?.cluster_summary,
    validation,
  );
  if (!summary.ok) {
    return NextResponse.json(
      { ok: false, message: summary.message, validation },
      { status: 400 },
    );
  }

  try {
    const result = await generateObservations(summary.value);

    if (result.observations.clusters.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            result.failures[0]?.reason ?? "No observations could be generated.",
          failures: result.failures,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      observations: result.observations,
      failures: result.failures,
      latenciesMs: result.latenciesMs,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: (err as Error).message },
      { status: 500 },
    );
  }
}
