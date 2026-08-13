import { defineTool } from "@copilotkit/runtime/v2";
import { z } from "zod";

import { loadDatasource } from "./reference-evidence";

const DEMO_SNAPSHOT = [
  {
    source_id: "convoke_kpc_2026_08_13",
    provenance_ref: "pub:convoke_kpc_2026_08_13",
    source_label: "Convoke Program Tracker · authenticated demo snapshot",
    imported_at: "2026-08-13T22:00:00.000Z",
    summary:
      "KPC resolved exactly to KPC. The tracker returned 27 program-indication records, including active or approved programs for relebactam, vaborbactam, and meropenem-vaborbactam.",
    quality_notes: [
      "snapshot captured from the authenticated Convoke MCP on 2026-08-13",
      "external development-landscape record; not a laboratory measurement or treatment recommendation",
    ],
  },
  {
    source_id: "convoke_oxa48_2026_08_13",
    provenance_ref: "pub:convoke_oxa48_2026_08_13",
    source_label: "Convoke Program Tracker · authenticated demo snapshot",
    imported_at: "2026-08-13T22:00:00.000Z",
    summary:
      "OXA-48 resolved exactly to OXA-48. The tracker returned 14 program-indication records, including avibactam and xeruborbactam programs.",
    quality_notes: [
      "snapshot captured from the authenticated Convoke MCP on 2026-08-13",
      "external development-landscape record; not a laboratory measurement or treatment recommendation",
    ],
  },
  {
    source_id: "convoke_ndm1_resolution_2026_08_13",
    provenance_ref: "pub:convoke_ndm1_resolution_2026_08_13",
    source_label: "Convoke Program Tracker · authenticated demo snapshot",
    imported_at: "2026-08-13T22:00:00.000Z",
    summary:
      "The NDM-1 query resolved to Imipenemase metallo-beta-lactamase (IMP), not NDM-1. Treat that landscape result as contested until the entity mapping is corrected.",
    quality_notes: [
      "entity-resolution mismatch intentionally retained for auditability",
      "external development-landscape record; not a laboratory measurement or treatment recommendation",
    ],
  },
] as const;

function demoEvidence(query: string) {
  const normalized = query.toLowerCase();
  return DEMO_SNAPSHOT.filter((entry) =>
    entry.source_id.includes("kpc")
      ? normalized.includes("kpc")
      : entry.source_id.includes("oxa48")
        ? normalized.includes("oxa-48") || normalized.includes("oxa48")
        : normalized.includes("ndm-1") || normalized.includes("ndm1"),
  );
}

/**
 * A server-side tool rather than a pre-fetch on every turn: the agent already
 * has getPathogenDataset for the loaded data, and most questions never need
 * outside context. Letting the model ask for it only when it does keeps the
 * common path at its current latency, and keeps the external call visible in
 * the tool trace instead of hidden in a prompt.
 *
 * The key and endpoint stay server-side; only the normalized result crosses to
 * the model.
 */
export const queryReferenceEvidence = defineTool({
  name: "queryReferenceEvidence",
  description:
    "Retrieve external background context (literature, public reference material) about a compound, organism, gene or resistance topic from the configured external knowledge server. Use ONLY for background the loaded dataset cannot answer. It never returns statistics about the loaded dataset — call getPathogenDataset for those. Returns records with a provenance_ref, an optional citation and quality notes; may return zero records.",
  parameters: z.object({
    query: z
      .string()
      .describe(
        "What to look up, in plain language. Include the organism or compound, for example 'Klebsiella pneumoniae carbapenemase KPC background'.",
      ),
  }),
  execute: async ({ query }) => {
    const load = await loadDatasource(query);
    const fallback = demoEvidence(query);

    if (load.reference_points === 0 && fallback.length > 0) {
      return JSON.stringify({
        configured: load.configured,
        mode: "authenticated_demo_snapshot",
        reference_points: fallback.length,
        evidence: fallback,
        note:
          "The live MCP returned no usable record, so this response uses a clearly labeled snapshot captured from the authenticated Convoke MCP. Attribute claims by provenance_ref and disclose snapshot mode.",
      });
    }

    if (!load.configured) {
      return JSON.stringify({
        configured: false,
        reference_points: 0,
        evidence: [],
        note: "No external reference source is configured. Answer from the loaded dataset only, and do not claim external evidence was consulted.",
      });
    }

    return JSON.stringify({
      configured: true,
      reference_points: load.reference_points,
      evidence: load.evidence,
      note:
        load.reference_points === 0
          ? "The external source returned nothing usable for this query. Say that no external context was found rather than filling the gap from memory."
          : "Unverified external context. Not a laboratory measurement and not a source of any number about the loaded dataset. Attribute anything you use by its provenance_ref.",
    });
  },
});
