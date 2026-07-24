#!/usr/bin/env bun
/**
 * Step C.4 — swap mock fixtures for the real Part A/B outputs.
 *
 * Copies the shared contract files from the repo root into dashboard/data/,
 * validating the shape first so a malformed file fails here rather than
 * halfway through a demo. Run from the dashboard directory:
 *
 *   bun run sync-data
 */
import { existsSync, readFileSync } from "node:fs";
import { copyFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const DEST = resolve(HERE, "../data");

interface Job {
  from: string;
  to: string;
  check: (parsed: unknown) => string | null;
}

const JOBS: Job[] = [
  {
    from: resolve(ROOT, "data/cluster_summary.json"),
    to: resolve(DEST, "cluster_summary.json"),
    check: (p) => {
      if (typeof p !== "object" || p === null || Array.isArray(p)) {
        return "expected an object keyed by cluster id";
      }
      const entries = Object.entries(p as Record<string, unknown>);
      if (entries.length < 3) {
        return `expected 3+ clusters, found ${entries.length}`;
      }
      for (const [id, v] of entries) {
        const c = v as Record<string, unknown>;
        if (typeof c?.n_genes !== "number") {
          return `cluster ${id} is missing n_genes`;
        }
        if (typeof c?.resistant_phenotype_breakdown !== "object") {
          return `cluster ${id} is missing resistant_phenotype_breakdown`;
        }
      }
      return null;
    },
  },
  {
    from: resolve(ROOT, "insights/observations.json"),
    to: resolve(DEST, "observations.json"),
    check: (p) => {
      const o = p as Record<string, unknown>;
      if (!Array.isArray(o?.clusters)) return "missing clusters[]";
      if (!o.clusters.length) return "clusters[] is empty";
      for (const c of o.clusters as Array<Record<string, unknown>>) {
        if (typeof c.cluster_id !== "string") {
          return "an observation is missing cluster_id (must be a string)";
        }
        if (typeof c.headline !== "string" || typeof c.observation !== "string") {
          return `observation ${c.cluster_id} is missing headline or observation`;
        }
      }
      return null;
    },
  },
];

/**
 * The check that matters most at handoff: two files that are each individually
 * valid but describe different pipeline runs. Without it the dashboard renders
 * headlines from one run beside counts from another, and nothing looks wrong.
 */
function crossCheck(): string | null {
  const summaryPath = resolve(ROOT, "data/cluster_summary.json");
  const obsPath = resolve(ROOT, "insights/observations.json");
  if (!existsSync(summaryPath) || !existsSync(obsPath)) return null;

  let summary: Record<string, unknown>;
  let observations: { clusters?: Array<{ cluster_id?: unknown }> };
  try {
    summary = JSON.parse(readFileSync(summaryPath, "utf8"));
    observations = JSON.parse(readFileSync(obsPath, "utf8"));
  } catch {
    return null; // the per-file jobs already report parse errors
  }

  const ids = new Set(Object.keys(summary));
  const orphans = (observations.clusters ?? [])
    .map((c) => String(c.cluster_id))
    .filter((id) => !ids.has(id));

  if (orphans.length > 0) {
    return (
      `observations describe cluster(s) ${orphans.join(", ")}, which are not in ` +
      `cluster_summary (it has ${[...ids].join(", ")}). The two files are from ` +
      `different pipeline runs — re-run Part B against the current cluster_summary.`
    );
  }
  return null;
}

// Runs before any copying: a mismatch must not leave half-updated fixtures
// behind, or the "previous fixtures are intact" message below becomes a lie.
const mismatch = crossCheck();
if (mismatch) {
  console.error(`FAIL  cross-check — ${mismatch}`);
  console.error("\nNothing was copied. The dashboard keeps its current fixtures.");
  process.exit(1);
}

let failed = false;

for (const job of JOBS) {
  const label = job.from.replace(`${ROOT}/`, "");
  if (!existsSync(job.from)) {
    console.log(`skip  ${label} — not written yet, keeping current fixture`);
    continue;
  }
  try {
    const parsed = JSON.parse(await readFile(job.from, "utf8"));
    const problem = job.check(parsed);
    if (problem) {
      console.error(`FAIL  ${label} — ${problem}`);
      failed = true;
      continue;
    }
    await copyFile(job.from, job.to);
    console.log(`ok    ${label}`);
  } catch (err) {
    console.error(`FAIL  ${label} — ${(err as Error).message}`);
    failed = true;
  }
}

if (failed) {
  console.error(
    "\nOne or more contract files did not validate. The dashboard still has its\n" +
      "previous fixtures, so nothing is broken — fix the source file and re-run.",
  );
  process.exit(1);
}

console.log(
  "\nFixtures updated. Restart the dev server to pick them up.\n" +
    "Note the header still reads MOCK: it reads LIVE only when PIPELINE_URL is\n" +
    "set and the pipeline answers.",
);
