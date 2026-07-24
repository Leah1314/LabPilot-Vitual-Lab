"""
Validate data/cluster_summary.json against Contract 1 before handing it to Part B.

This is the A.5 handoff gate. Part B has been building against a hand-written
mock; this check is what guarantees the real file is drop-in compatible with it.

Run:  python pipeline/validate_contract.py [path]
Exit: 0 valid, 1 invalid.
"""

from __future__ import annotations

import json
import os
import sys

REQUIRED = {
    "n_genes": int,
    "example_genes": list,
    "top_products": dict,
    "resistant_phenotype_breakdown": dict,
    "species_breakdown": dict,
}


def main() -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "data/cluster_summary.json")

    with open(path) as fh:
        summary = json.load(fh)

    errors: list[str] = []
    warnings: list[str] = []

    if not isinstance(summary, dict):
        sys.exit("FAIL: top level must be an object keyed by cluster id")

    if not summary:
        errors.append("no clusters at all")

    for key, cluster in summary.items():
        # Part B iterates summary.items() directly, so a stray metadata key
        # would be consumed as if it were a cluster.
        if not key.isdigit():
            errors.append(f"top-level key {key!r} is not a numeric cluster id")
            continue
        if not isinstance(cluster, dict):
            errors.append(f"cluster {key}: not an object")
            continue

        for field, typ in REQUIRED.items():
            if field not in cluster:
                errors.append(f"cluster {key}: missing {field!r}")
            elif not isinstance(cluster[field], typ):
                errors.append(
                    f"cluster {key}: {field!r} is {type(cluster[field]).__name__}, expected {typ.__name__}"
                )

        if isinstance(cluster.get("n_genes"), int) and cluster["n_genes"] <= 0:
            errors.append(f"cluster {key}: n_genes must be positive")

        for field in ("top_products", "resistant_phenotype_breakdown", "species_breakdown"):
            for k, v in (cluster.get(field) or {}).items():
                if not isinstance(v, int):
                    errors.append(f"cluster {key}: {field}[{k!r}] is not an int")

        breakdown = cluster.get("resistant_phenotype_breakdown") or {}
        unexpected = set(breakdown) - {"Resistant", "Susceptible", "Unknown"}
        if unexpected:
            warnings.append(f"cluster {key}: unexpected phenotype labels {sorted(unexpected)}")

        # Every gene has exactly one species and one phenotype, so both
        # breakdowns must account for n_genes. A mismatch means a join dropped rows.
        n = cluster.get("n_genes")
        if isinstance(n, int):
            for field in ("species_breakdown", "resistant_phenotype_breakdown"):
                total = sum((cluster.get(field) or {}).values())
                if total != n:
                    errors.append(f"cluster {key}: {field} sums to {total}, n_genes is {n}")

        if not cluster.get("example_genes"):
            warnings.append(f"cluster {key}: example_genes is empty")

    n_clusters = len([k for k in summary if k.isdigit()])
    if n_clusters < 3:
        errors.append(f"only {n_clusters} clusters; the definition of done requires 3+")

    print(f"checked {path}")
    print(f"  clusters: {n_clusters}")
    print(f"  genes:    {sum(c.get('n_genes', 0) for c in summary.values() if isinstance(c, dict)):,}")

    for w in warnings:
        print(f"  WARN  {w}")
    if errors:
        for e in errors:
            print(f"  FAIL  {e}")
        sys.exit(f"\nContract 1 validation FAILED with {len(errors)} error(s)")

    print("\nContract 1 OK - safe to hand to Part B")


if __name__ == "__main__":
    main()
