import { defineTool } from "@copilotkit/runtime/v2";
import { z } from "zod";

import { loadDatasource } from "./reference-evidence";

const DEMO_SNAPSHOT = [
  {
    source_id: "convoke_ras_on_landscape_2026_08_13",
    provenance_ref: "pub:convoke_ras_on_landscape_2026_08_13",
    source_label: "Convoke Program Tracker · authenticated demo snapshot",
    imported_at: "2026-08-13T22:00:00.000Z",
    summary:
      "RAS(ON) program landscape snapshot captured multiple KRAS-directed development programs and combination strategies relevant to preclinical positioning and competitive context.",
    quality_notes: [
      "snapshot captured from the authenticated Convoke MCP on 2026-08-13",
      "external development-landscape record; not a laboratory measurement or treatment recommendation",
    ],
  },
  {
    source_id: "convoke_pancreatic_context_2026_08_13",
    provenance_ref: "pub:convoke_pancreatic_context_2026_08_13",
    source_label: "Convoke Program Tracker · authenticated demo snapshot",
    imported_at: "2026-08-13T22:00:00.000Z",
    summary:
      "Pancreatic-cancer context snapshot highlighted clinical-stage and preclinical programs competing for KRAS-pathway positioning, with emphasis on mechanism and indication overlap.",
    quality_notes: [
      "snapshot captured from the authenticated Convoke MCP on 2026-08-13",
      "external development-landscape record; not a laboratory measurement or treatment recommendation",
    ],
  },
  {
    source_id: "convoke_rmc_6236_resolution_2026_08_13",
    provenance_ref: "pub:convoke_rmc_6236_resolution_2026_08_13",
    source_label: "Convoke Program Tracker · authenticated demo snapshot",
    imported_at: "2026-08-13T22:00:00.000Z",
    summary:
      "One RMC-6236 snapshot result required entity-resolution review before use; treat ambiguous competitive-landscape matches as contested until the program mapping is confirmed.",
    quality_notes: [
      "entity-resolution mismatch intentionally retained for auditability",
      "external development-landscape record; not a laboratory measurement or treatment recommendation",
    ],
  },
] as const;

function demoEvidence(query: string) {
  const normalized = query.toLowerCase();
  return DEMO_SNAPSHOT.filter((entry) =>
    entry.source_id.includes("ras_on")
      ? normalized.includes("ras") || normalized.includes("kras")
      : entry.source_id.includes("pancreatic")
        ? normalized.includes("pancreatic")
        : normalized.includes("rmc-6236") || normalized.includes("rmc 6236"),
  );
}

export const queryReferenceEvidence = defineTool({
  name: "queryReferenceEvidence",
  description:
    "Retrieve external background context about a compound, target, program, organism, gene, or resistance topic from the configured external knowledge server. Use only for background the loaded workspace cannot answer. It never returns statistics about the loaded dataset. Returns records with a provenance_ref, an optional citation and quality notes; may return zero records.",
  parameters: z.object({
    query: z
      .string()
      .describe(
        "What to look up, in plain language. Include the compound, target, mechanism, or program context you want explored.",
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
