/**
 * Convoke, reached as an MCP server over Streamable HTTP (spec 2025-06-18).
 *
 * Imported only by the CopilotKit runtime route, which runs server-side, so the
 * endpoint and token never reach the client bundle.
 */

const PROTOCOL_VERSION = "2025-06-18";
const TIMEOUT_MS = 8_000;
const MAX_EVIDENCE_CHARS = 4_000;

export interface ConvokeEvidence {
  source: "public_reference";
  server: string;
  tool: string;
  citation?: string;
  text: string;
  truncated: boolean;
}

interface Session {
  url: string;
  token?: string;
  id?: string;
  protocolVersion: string;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, { type?: string } | undefined>;
    required?: string[];
  };
}

interface ToolResult {
  content?: Array<Record<string, unknown>>;
  structuredContent?: unknown;
  isError?: boolean;
}

function headers(session: Session, initializing: boolean): Record<string, string> {
  const value: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (session.token) value.authorization = `Bearer ${session.token}`;
  if (!initializing) value["mcp-protocol-version"] = session.protocolVersion;
  if (session.id) value["mcp-session-id"] = session.id;
  return value;
}

async function readResponse(res: Response, id: number): Promise<JsonRpcResponse | null> {
  const body = await res.text();
  if (!(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    try {
      return JSON.parse(body) as JsonRpcResponse;
    } catch {
      return null;
    }
  }
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    try {
      const frame = JSON.parse(line.slice(5).trim()) as JsonRpcResponse;
      if (frame.id === id) return frame;
    } catch {
      // Ignore malformed or unrelated frames.
    }
  }
  return null;
}

async function request(
  session: Session,
  id: number,
  method: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const res = await fetch(session.url, {
    method: "POST",
    headers: headers(session, method === "initialize"),
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;

  const issued = res.headers.get("mcp-session-id");
  if (issued) session.id = issued;

  const frame = await readResponse(res, id);
  if (!frame || frame.error || !frame.result) return null;
  return frame.result;
}

async function notifyInitialized(session: Session): Promise<void> {
  await fetch(session.url, {
    method: "POST",
    headers: headers(session, false),
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

const QUERY_KEYS = ["query", "question", "q", "search", "text", "input", "prompt"];

function queryArgument(tool: McpTool): string | null {
  const properties = tool.inputSchema?.properties ?? {};
  const strings = Object.keys(properties).filter((key) => properties[key]?.type === "string");
  const required = (tool.inputSchema?.required ?? []).filter((key) => strings.includes(key));
  return QUERY_KEYS.find((key) => strings.includes(key)) ?? required[0] ?? strings[0] ?? null;
}

function extract(
  result: ToolResult,
): { text: string; citation?: string; truncated: boolean } | null {
  if (result.isError) return null;

  const parts: string[] = [];
  let citation: string | undefined;

  for (const item of result.content ?? []) {
    const kind = item.type;
    const text = item.text;
    const uri = item.uri;

    if (kind === "text" && typeof text === "string") parts.push(text);
    if (kind === "resource_link" && typeof uri === "string") citation ??= uri;
    if (kind === "resource" && item.resource && typeof item.resource === "object") {
      const resource = item.resource as Record<string, unknown>;
      const embeddedText = resource.text;
      const embeddedUri = resource.uri;
      if (typeof embeddedText === "string") parts.push(embeddedText);
      if (typeof embeddedUri === "string") citation ??= embeddedUri;
    }
  }

  if (!citation && result.structuredContent && typeof result.structuredContent === "object") {
    const structured = result.structuredContent as Record<string, unknown>;
    for (const key of ["citation", "url", "source_url", "doi"]) {
      const value = structured[key];
      if (typeof value === "string") {
        citation = value;
        break;
      }
    }
  }

  let text = parts.join("\n\n").trim();
  if (!text && result.structuredContent !== undefined) {
    try {
      text = JSON.stringify(result.structuredContent);
    } catch {
      return null;
    }
  }
  if (!text) return null;

  const truncated = text.length > MAX_EVIDENCE_CHARS;
  return {
    text: truncated
      ? `${text.slice(0, MAX_EVIDENCE_CHARS)}\n[truncated at ${MAX_EVIDENCE_CHARS} characters]`
      : text,
    citation,
    truncated,
  };
}

export async function fetchConvokeEvidence(query: string): Promise<ConvokeEvidence[]> {
  const url = process.env.CONVOKE_MCP_URL;
  if (!url) return [];

  const session: Session = {
    url,
    token: process.env.CONVOKE_MCP_TOKEN,
    protocolVersion: PROTOCOL_VERSION,
  };

  try {
    const initialized = await request(session, 1, "initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "pathogen-pathfinder", version: "0.1.0" },
    });
    if (!initialized) return [];

    if (typeof initialized.protocolVersion === "string") {
      session.protocolVersion = initialized.protocolVersion;
    }
    const serverInfo = initialized.serverInfo as { name?: string } | undefined;
    const server = serverInfo?.name ?? "convoke";

    await notifyInitialized(session);

    const listed = await request(session, 2, "tools/list", {});
    const tools = (listed?.tools ?? []) as McpTool[];
    const pinned = process.env.CONVOKE_MCP_TOOL;
    const tool = pinned ? tools.find((item) => item.name === pinned) : tools[0];
    if (!tool) return [];

    const argument = queryArgument(tool);
    if (!argument) return [];

    const called = await request(session, 3, "tools/call", {
      name: tool.name,
      arguments: { [argument]: query },
    });
    if (!called) return [];

    const found = extract(called as ToolResult);
    if (!found) return [];

    return [
      {
        source: "public_reference",
        server,
        tool: tool.name,
        citation: found.citation,
        text: found.text,
        truncated: found.truncated,
      },
    ];
  } catch {
    return [];
  }
}
