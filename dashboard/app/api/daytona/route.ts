import { NextResponse } from "next/server";

/*
 * Lists Daytona sandboxes so the connect panel can offer their preview URLs.
 *
 * Read-only by design. Creating or starting a sandbox is deliberately not
 * exposed: GPU sandboxes bill by the hour (H100 at $3.95/hr per daytona.md
 * §4.2) and their filesystems are deleted on stop, so spawning one from a
 * dashboard button is a money-and-data decision that belongs in
 * pipeline/run_on_daytona.py where it is explicit.
 *
 * DAYTONA_API_KEY stays server-side; this repo is public.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

export interface SandboxEntry {
  id: string;
  name: string;
  state: string;
  target: string;
  /** Preview URL for the serving port, when the sandbox is running. */
  previewUrl: string | null;
  /** Present only for private sandboxes. */
  previewToken: string | null;
  labels: Record<string, string>;
}

const SERVING_PORT = Number(process.env.DAYTONA_PREVIEW_PORT ?? 8000);

export async function GET() {
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message:
        "DAYTONA_API_KEY is not set on the server. Add it to .env.local to list sandboxes, or paste a preview URL directly.",
      sandboxes: [],
    });
  }

  try {
    const { Daytona } = await import("@daytonaio/sdk");
    const daytona = new Daytona({ apiKey });

    const sandboxes: SandboxEntry[] = [];
    for await (const sandbox of daytona.list()) {
      const state = String(sandbox.state ?? "unknown");

      // A preview link only resolves for a running sandbox, and asking for one
      // on a stopped sandbox throws. Report the sandbox either way so the user
      // can see it exists and start it themselves.
      let previewUrl: string | null = null;
      let previewToken: string | null = null;
      if (state === "started") {
        try {
          const link = await sandbox.getPreviewLink(SERVING_PORT);
          previewUrl = link.url;
          previewToken = link.token ?? null;
        } catch {
          previewUrl = null;
        }
      }

      sandboxes.push({
        id: sandbox.id,
        name: sandbox.name ?? sandbox.id,
        state,
        target: sandbox.target ?? "",
        previewUrl,
        previewToken,
        labels: sandbox.labels ?? {},
      });
    }

    // Running sandboxes first: those are the ones worth connecting to.
    sandboxes.sort((a, b) => {
      if (a.state === b.state) return a.name.localeCompare(b.name);
      return a.state === "started" ? -1 : b.state === "started" ? 1 : 0;
    });

    return NextResponse.json({
      ok: true,
      configured: true,
      port: SERVING_PORT,
      sandboxes,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      configured: true,
      message: `Could not list sandboxes: ${(err as Error).message}`,
      sandboxes: [],
    });
  }
}
