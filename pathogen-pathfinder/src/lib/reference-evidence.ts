import { fetchConvokeEvidence, type ConvokeEvidence } from "./convoke-mcp";

/**
 * Normalizes Convoke results into reference evidence with stable provenance.
 *
 * This sits between the transport and the agent tool because the agent's hard
 * rules turn on provenance, not on prose. Rule 6 of the runtime system prompt
 * forbids blurring computational annotation with laboratory measurement, and
 * rule 1 forbids the model producing any number that did not come from a tool
 * result. External text that arrives as an undifferentiated blob invites
 * exactly those two failures, so every record carries what it is and where it
 * came from, and the model is told to cite the ref rather than restate the
 * finding as its own.
 */

export interface ReferenceEvidence {
  source_id: string;
  /** The stable ref an answer cites instead of restating the text. */
  provenance_ref: string;
  source_label: string;
  citation?: string;
  imported_at: string;
  /** Verbatim from the source. Never parsed into numeric observations. */
  summary: string;
  /** Honest limits on this record, carried with it rather than dropped. */
  quality_notes: string[];
}

export interface DatasourceLoad {
  evidence: ReferenceEvidence[];
  /** Disclosed count, so "no external evidence" is never silent. */
  reference_points: number;
  /** False when no reference source is configured at all. */
  configured: boolean;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Derive the id from the citation where there is one, so the same source keeps
 * the same ref between runs and an answer given today still resolves tomorrow.
 * Position is the fallback, and is only stable within one response.
 */
function sourceId(entry: ConvokeEvidence, index: number): string {
  const server = slug(entry.server) || "reference";
  const cited = entry.citation ? slug(entry.citation).slice(0, 48) : "";
  return cited ? `${server}_${cited}` : `${server}_${index + 1}`;
}

function qualityNotes(entry: ConvokeEvidence): string[] {
  // Annotation and external context are not laboratory measurement. Saying so
  // on every record keeps system-prompt rule 6 enforceable downstream.
  const notes = ["unverified external reference; not a laboratory measurement"];
  if (!entry.citation) notes.push("no citation supplied by the source");
  if (entry.truncated) notes.push("truncated before use");
  return notes;
}

/**
 * Never throws. An unreachable or unconfigured source yields zero evidence and
 * the agent continues on the loaded dataset alone.
 */
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
