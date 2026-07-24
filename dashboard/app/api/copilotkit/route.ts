import { copilotSingleRouteHandler } from "@/lib/copilot-runtime";

/*
 * Single-route transport, served at the base path. The catch-all sibling
 * cannot match a bare /api/copilotkit — Next.js requires [...path] to have at
 * least one segment — so without this file the client's auto-detect fallback
 * 404s and the chat never connects. See lib/copilot-runtime.ts for why the
 * client takes that branch.
 */
export const runtime = "nodejs";

export { copilotSingleRouteHandler as GET, copilotSingleRouteHandler as POST };
