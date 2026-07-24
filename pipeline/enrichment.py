"""
Part A, stage 4 — measure whether the clusters actually carry any signal.

A cluster whose Resistant/Susceptible split simply reproduces the corpus base
rate tells you nothing about resistance, however large it is. Enrichment makes
that explicit:

    enrichment = (share within cluster) / (share across the whole corpus)

1.0 means the cluster looks exactly like the background. Only values meaningfully
away from 1.0 are worth a sentence in the dashboard.

This exists so the LLM layer cannot claim a cluster is "linked to resistance"
when the arithmetic says it is not.

Run:  python pipeline/enrichment.py
Out:  data/cluster_enrichment.json
"""

from __future__ import annotations

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")

# Below this, a cluster is not meaningfully different from the background.
FLAT = 0.25


def enrich(part: dict, n: int, totals: dict, grand: int) -> dict:
    out = {}
    for key, total in totals.items():
        observed = part.get(key, 0) / n if n else 0.0
        expected = total / grand if grand else 0.0
        out[key] = round(observed / expected, 3) if expected else None
    return out


def main() -> None:
    with open(os.path.join(DATA, "cluster_summary.json")) as fh:
        summary = json.load(fh)

    grand = sum(c["n_genes"] for c in summary.values())
    sp_tot: dict[str, int] = {}
    ph_tot: dict[str, int] = {}
    for c in summary.values():
        for k, v in c["species_breakdown"].items():
            sp_tot[k] = sp_tot.get(k, 0) + v
        for k, v in c["resistant_phenotype_breakdown"].items():
            ph_tot[k] = ph_tot.get(k, 0) + v

    clusters = {}
    for cid, c in summary.items():
        n = c["n_genes"]
        species = enrich(c["species_breakdown"], n, sp_tot, grand)
        pheno = enrich(c["resistant_phenotype_breakdown"], n, ph_tot, grand)

        # Only Resistant/Susceptible speak to resistance. Unknown is the
        # virulence-only organism riding along and must not drive a claim.
        signal = max(
            (abs(v - 1) for k, v in pheno.items() if k in ("Resistant", "Susceptible") and v),
            default=0.0,
        )
        clusters[cid] = {
            "n_genes": n,
            "species_enrichment": species,
            "phenotype_enrichment": pheno,
            "max_phenotype_deviation": round(signal, 3),
            "phenotype_signal": signal >= FLAT,
        }

    informative = [cid for cid, c in clusters.items() if c["phenotype_signal"]]
    result = {
        "n_genes": grand,
        "corpus_species_totals": sp_tot,
        "corpus_phenotype_totals": ph_tot,
        "flat_threshold": FLAT,
        "clusters": clusters,
        "clusters_with_phenotype_signal": informative,
        "interpretation": (
            "Enrichment is the share within a cluster divided by the share across "
            "the whole corpus. 1.0 means the cluster is indistinguishable from "
            "background. No cluster may be described as associated with resistance "
            "or susceptibility unless its id appears in clusters_with_phenotype_signal."
        ),
    }

    path = os.path.join(DATA, "cluster_enrichment.json")
    with open(path, "w") as fh:
        json.dump(result, fh, indent=2)

    print(f"{grand:,} genes across {len(clusters)} clusters -> {path}\n")
    for cid, c in clusters.items():
        flag = "SIGNAL" if c["phenotype_signal"] else "flat"
        print(f"  cluster {cid}: n={c['n_genes']:>6}  max phenotype deviation "
              f"{c['max_phenotype_deviation']:.2f}  [{flag}]")
    if informative:
        print(f"\nclusters with phenotype signal: {informative}")
    else:
        print(
            "\nNo cluster shows a phenotype signal. Every cluster reproduces the "
            "corpus base rate, so no resistance association can be claimed for any "
            "of them. Describe the clusters as protein-family groupings only."
        )


if __name__ == "__main__":
    main()
