import { defineTool } from "@copilotkit/runtime/v2";
import { z } from "zod";

import { loadDatasource } from "./reference-evidence";

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
