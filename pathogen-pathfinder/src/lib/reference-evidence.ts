import { fetchConvokeEvidence, type ConvokeEvidence } from "./convoke-mcp";

export interface ReferenceEvidence {
  source_id: string;
  provenance_ref: string;
  source_label: string;
  citation?: string;
  imported_at: string;
  summary: string;
  quality_notes: string[];
}

export interface DatasourceLoad {
  evidence: ReferenceEvidence[];
  reference_points: number;
  configured: boolean;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sourceId(entry: ConvokeEvidence, index: number): string {
  const server = slug(entry.server) || "reference";
  const cited = entry.citation ? slug(entry.citation).slice(0, 48) : "";
  return cited ? `${server}_${cited}` : `${server}_${index + 1}`;
}

function qualityNotes(entry: ConvokeEvidence): string[] {
  const notes = ["unverified external reference; not a laboratory measurement"];
  if (!entry.citation) notes.push("no citation supplied by the source");
  if (entry.truncated) notes.push("truncated before use");
  return notes;
}

export async function loadDatasource(query: string): Promise<DatasourceLoad> {
  const configured = Boolean(process.env.CONVOKE_MCP_URL);
  if (!configured) return { evidence: [], reference_points: 0, configured };

  const found = await fetchConvokeEvidence(query);
  const imported_at = new Date().toISOString();

  const evidence = found.map((entry, index) => {
    const source_id = sourceId(entry, index);
    return {
      source_id,
      provenance_ref: `pub:${source_id}`,
      source_label: `${entry.server} · ${entry.tool}`,
      citation: entry.citation,
      imported_at,
      summary: entry.text,
      quality_notes: qualityNotes(entry),
    };
  });

  return { evidence, reference_points: evidence.length, configured };
}
