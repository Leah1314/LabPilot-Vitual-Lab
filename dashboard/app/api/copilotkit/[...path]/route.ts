import { copilotHandler } from "@/lib/copilot-runtime";

// Node runtime: the tools reach the pipeline over the network and the API key
// must never be bundled for the client.
export const runtime = "nodejs";

export { copilotHandler as GET, copilotHandler as POST };
