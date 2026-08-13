import "server-only";

import { fetchConvokeEvidence, type ConvokeEvidence } from "./convoke-mcp";

/**
 * `load_datasource` — the read-only typed capability from the technical
 * product guide §8: "Normalized reference evidence + provenance".
 *
 * This sits between the Convoke transport and every consumer, because the
 * guide has three of them: the scientific model layer counts these records as
 * `reference_points` (§9.2), the RLM Evidence branch inspects them (§7), and
 * Ask LabPilot quotes them. Putting the normalization in a route body would
 * mean re-implementing it for each.
 *
 * Guide §5 is the reason this file exists rather than passing raw text to a
 * prompt: "Every measured or reference observation should have a stable
 * provenance reference. RLM receipts should point to those references rather
 * than inventing free-form evidence."
 */

export interface ReferenceEvidence {
  source_id: string;
  /** The stable ref a receipt cites instead of restating the text (§5, §9.5). */
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
  /**
   * `model.reference_points` in §9.2, and the count §12 requires be disclosed
   * when a public source is unavailable and we continue on measured data.
   */
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
 * the same ref between runs and a receipt written today still resolves
 * tomorrow. Position is the fallback, and is only stable within one response.
 */
function sourceId(entry: ConvokeEvidence, index: number): string {
  const server = slug(entry.server) || "reference";
  const cited = entry.citation ? slug(entry.citation).slice(0, 48) : "";
  return cited ? `${server}_${cited}` : `${server}_${index + 1}`;
}

function qualityNotes(entry: ConvokeEvidence): string[] {
  // The state model (§4) has no transition from reference evidence to
  // MEASURED. Saying so on every record keeps that visible downstream.
  const notes = ["unverified external reference; not a measured observation"];
  if (!entry.citation) notes.push("no citation supplied by the source");
  if (entry.truncated) notes.push("truncated before use");
  return notes;
}

/**
 * Never throws and never returns partial failure as success. An unreachable or
 * unconfigured source yields zero evidence, which §12 requires we continue
 * from: "continue with internal/measured dataset and disclose evidence count".
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
