"""
Generate contract-valid MOCK data for frontend work.

Why this exists: the frontends need something to render while the real pipeline
is being re-run, and hand-editing JSON drifts out of contract. This emits the
same shapes Part A and Part B produce, at any size, deterministically.

It writes to mock/ and NEVER touches data/ or insights/, so a real pipeline run
cannot be clobbered by a mock run.

    python scripts/generate_mock_data.py                    # 6 clusters
    python scripts/generate_mock_data.py --clusters 10 --genes 50000
    python scripts/generate_mock_data.py --all-flat         # no cluster has signal

Outputs (mock/):
    cluster_summary.json      Contract 1
    observations.json         Contract 2
    cluster_enrichment.json   the honesty gate
    timing.json               pipeline stats
    cohort_meta.json          provenance + caveats

Every file is marked as mock. `cluster_summary.json` carries no marker key,
because Contract 1 says top-level keys are cluster ids and nothing else —
consumers iterate it directly, so a stray key would be read as a cluster.
"""

from __future__ import annotations

import argparse
import json
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "mock")

SPECIES = [
    ("Escherichia coli", 0.42),
    ("Klebsiella pneumoniae", 0.33),
    ("Helicobacter pylori", 0.14),
    ("Enterococcus faecalis", 0.05),
    ("Clostridioides difficile", 0.04),
    ("Enterococcus faecium", 0.02),
]

# Product families, so a cluster reads like a real functional grouping rather
# than a bag of unrelated names.
FAMILIES = [
    ("beta-lactam resistance", [
        "beta-lactamase class A", "extended-spectrum beta-lactamase CTX-M",
        "class A carbapenemase KPC", "beta-lactamase TEM", "penicillin-binding protein 2",
    ]),
    ("efflux and transport", [
        "multidrug efflux RND transporter AcrB", "efflux pump membrane fusion protein AcrA",
        "outer membrane channel TolC", "Multidrug efflux pump EmrD (of MFS type)",
        "Uncharacterized MFS-type transporter",
    ]),
    ("aminoglycoside modification", [
        "aminoglycoside N(6')-acetyltransferase", "aminoglycoside O-phosphotransferase APH(3')",
        "16S rRNA methyltransferase ArmA", "aminoglycoside adenylyltransferase",
    ]),
    ("glycopeptide resistance", [
        "vancomycin resistance protein VanA", "D-alanine--D-lactate ligase VanH",
        "D-Ala-D-Ala dipeptidase VanX", "vancomycin B-type resistance protein VanW",
    ]),
    ("virulence and adhesion", [
        "Collagen adhesin", "Outer membrane usher protein FimD",
        "putative fimbrial-like protein", "T6SS component Hcp", "cag island protein",
    ]),
    ("core metabolic", [
        "Translation elongation factor Tu", "Transketolase (EC 2.2.1.1)",
        "UDP-glucose 4-epimerase (EC 5.1.3.2)", "Alanine racemase (EC 5.1.1.1)",
        "hypothetical protein",
    ]),
    ("toxin production", [
        "toxin A TcdA", "toxin B TcdB", "holin-like protein TcdE", "cytolethal distending toxin",
    ]),
]

FLAT = 0.25  # below this deviation a cluster is indistinguishable from background


def weighted_split(total: int, weights: list[float], rng: random.Random) -> list[int]:
    """Split `total` across buckets by weight, jittered, summing back to total."""
    jittered = [max(0.01, w * rng.uniform(0.6, 1.4)) for w in weights]
    s = sum(jittered)
    counts = [int(total * w / s) for w in jittered]
    counts[0] += total - sum(counts)  # absorb rounding so the sum is exact
    return counts


def build(n_clusters: int, n_genes: int, all_flat: bool, seed: int) -> dict:
    rng = random.Random(seed)

    sizes = weighted_split(n_genes, [rng.uniform(0.5, 2.0) for _ in range(n_clusters)], rng)
    base_resistant = 0.57  # corpus-wide resistant fraction

    summary: dict[str, dict] = {}
    truth: dict[str, dict] = {}

    for i in range(n_clusters):
        n = max(4, sizes[i])
        fam_name, products = FAMILIES[i % len(FAMILIES)]

        # Most clusters flat; a couple given real signal unless --all-flat, so the
        # UI's gating can be exercised in both states.
        has_signal = (not all_flat) and i in (1, 3)
        skew = 1.0 if all_flat else (1.45 if i == 1 else 0.55 if i == 3 else 1.0)
        r_frac = min(0.95, max(0.05, base_resistant * skew * rng.uniform(0.97, 1.03)))

        unknown = int(n * 0.14 * rng.uniform(0.5, 1.5))
        remaining = n - unknown
        resistant = int(remaining * r_frac)
        susceptible = remaining - resistant

        sp_counts = weighted_split(n, [w for _, w in SPECIES], rng)
        species_breakdown = {
            name: c for (name, _), c in zip(SPECIES, sp_counts) if c > 0
        }

        prod_counts = weighted_split(
            max(len(products) * 8, n // 12), [rng.uniform(0.6, 1.6) for _ in products], rng
        )
        top_products = dict(
            sorted(
                {p: c for p, c in zip(products, prod_counts) if c > 0}.items(),
                key=lambda kv: -kv[1],
            )
        )

        genome = f"{rng.choice([562, 573, 1351, 1352, 1496, 210])}.{rng.randint(1000, 9999)}"
        summary[str(i)] = {
            "n_genes": n,
            "example_genes": [
                f"fig|{genome}.peg.{rng.randint(10, 6000)}" for _ in range(5)
            ],
            "top_products": top_products,
            "resistant_phenotype_breakdown": {
                "Resistant": resistant,
                "Susceptible": susceptible,
                "Unknown": unknown,
            },
            "species_breakdown": species_breakdown,
        }
        truth[str(i)] = {"family": fam_name, "has_signal": has_signal}

    return {"summary": summary, "truth": truth}


def enrichment(summary: dict) -> dict:
    grand = sum(c["n_genes"] for c in summary.values())
    sp_tot: dict[str, int] = {}
    ph_tot: dict[str, int] = {}
    for c in summary.values():
        for k, v in c["species_breakdown"].items():
            sp_tot[k] = sp_tot.get(k, 0) + v
        for k, v in c["resistant_phenotype_breakdown"].items():
            ph_tot[k] = ph_tot.get(k, 0) + v

    def ratio(part, n, totals):
        out = {}
        for k, tot in totals.items():
            obs = part.get(k, 0) / n if n else 0
            exp = tot / grand if grand else 0
            out[k] = round(obs / exp, 3) if exp else None
        return out

    clusters = {}
    for cid, c in summary.items():
        n = c["n_genes"]
        ph = ratio(c["resistant_phenotype_breakdown"], n, ph_tot)
        dev = max(
            (abs(v - 1) for k, v in ph.items() if k in ("Resistant", "Susceptible") and v),
            default=0.0,
        )
        clusters[cid] = {
            "n_genes": n,
            "species_enrichment": ratio(c["species_breakdown"], n, sp_tot),
            "phenotype_enrichment": ph,
            "max_phenotype_deviation": round(dev, 3),
            "phenotype_signal": dev >= FLAT,
        }

    return {
        "MOCK": True,
        "n_genes": grand,
        "corpus_species_totals": sp_tot,
        "corpus_phenotype_totals": ph_tot,
        "flat_threshold": FLAT,
        "clusters": clusters,
        "clusters_with_phenotype_signal": [
            cid for cid, c in clusters.items() if c["phenotype_signal"]
        ],
        "interpretation": (
            "Enrichment is the share within a cluster divided by the share across the "
            "whole corpus. 1.0 means indistinguishable from background. No cluster may "
            "be described as associated with resistance unless its id appears in "
            "clusters_with_phenotype_signal."
        ),
    }


def observations(summary: dict, truth: dict, enrich: dict) -> dict:
    """
    Mock observations that obey the same grounding rules as the real generator:
    every number is copied from the cluster summary, and a cluster is only
    described as enriched when the enrichment gate says it is.
    """
    out = []
    for cid, c in summary.items():
        ph = c["resistant_phenotype_breakdown"]
        top = list(c["top_products"].items())[:2]
        dom_species, dom_n = max(c["species_breakdown"].items(), key=lambda kv: kv[1])
        signal = cid in enrich["clusters_with_phenotype_signal"]
        fam = truth[cid]["family"]
        dev = enrich["clusters"][cid]["max_phenotype_deviation"]

        lead = ", ".join(f"{p} ({n})" for p, n in top)
        if signal:
            tail = (
                f"This cluster does depart from the corpus base rate "
                f"(deviation {dev}), so the phenotype split is worth investigating, "
                f"though co-occurrence is not linkage and not causation."
            )
            conf = "medium"
        else:
            tail = (
                "The phenotype split matches the corpus base rate, so this cluster "
                "does not distinguish resistant from susceptible isolates."
            )
            conf = "high"

        out.append({
            "cluster_id": cid,
            "headline": f"{fam.capitalize()} cluster dominated by {dom_species}",
            "observation": (
                f"This cluster contains {c['n_genes']} genes, led by {lead}. "
                f"The species breakdown is dominated by {dom_species} ({dom_n}), with "
                f"lab-measured phenotypes reported as {ph['Resistant']} Resistant and "
                f"{ph['Susceptible']} Susceptible. {tail}"
            ),
            "confidence": conf,
            "eval_score": round(0.82 + (hash(cid) % 15) / 100, 2),
            "supporting_gene_count": c["n_genes"],
        })

    return {
        "MOCK": True,
        "generated_at": "2026-07-24T00:00:00Z",
        "clusters": out,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--clusters", type=int, default=6)
    ap.add_argument("--genes", type=int, default=34000)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--all-flat", action="store_true",
                    help="give no cluster a phenotype signal, like the real dataset")
    ap.add_argument("--out", default=OUT)
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    built = build(args.clusters, args.genes, args.all_flat, args.seed)
    summary, truth = built["summary"], built["truth"]
    enrich = enrichment(summary)
    obs = observations(summary, truth, enrich)

    files = {
        "cluster_summary.json": summary,
        "cluster_enrichment.json": enrich,
        "observations.json": obs,
        "timing.json": {
            "MOCK": True,
            "n_sequences": args.genes,
            "model": "esm2_t12_35M_UR50D",
            "device": "MOCK - not a real GPU run",
            "embedding_seconds": round(args.genes / 370.5, 2),
            "sequences_per_second": 370.5,
            "clustering_seconds": 6.9,
            "k_selected": args.clusters,
            "headline": f"MOCK: {args.genes:,} proteins (not a measured run)",
        },
        "cohort_meta.json": {
            "MOCK": True,
            "source": "SYNTHETIC - generated by scripts/generate_mock_data.py",
            "warning": "Not real BV-BRC data. Never quote these numbers in a demo.",
            "n_genomes": 240,
            "n_sequences": args.genes,
        },
    }

    for name, payload in files.items():
        with open(os.path.join(args.out, name), "w") as fh:
            json.dump(payload, fh, indent=2)

    with open(os.path.join(args.out, "README.md"), "w") as fh:
        fh.write(
            "# MOCK DATA — SYNTHETIC, NOT REAL\n\n"
            "Generated by `scripts/generate_mock_data.py` for frontend development.\n"
            "These numbers are invented. **Never quote them in a demo or a README.**\n\n"
            "The real dataset lives in `../data/` and `../insights/`.\n\n"
            "Shapes match Contract 1 (`cluster_summary.json`) and Contract 2\n"
            "(`observations.json`) exactly, so swapping in the real files is a\n"
            "path change and nothing more.\n"
        )

    gate = enrich["clusters_with_phenotype_signal"]
    print(f"wrote {len(files) + 1} files to {args.out}/")
    print(f"  clusters: {args.clusters}   genes: {args.genes:,}")
    print(f"  clusters_with_phenotype_signal: {gate or '[] (all flat, like the real data)'}")
    for cid, c in enrich["clusters"].items():
        flag = "SIGNAL" if c["phenotype_signal"] else "flat"
        print(f"    cluster {cid}: n={c['n_genes']:>6}  deviation {c['max_phenotype_deviation']:.2f}  [{flag}]")


if __name__ == "__main__":
    main()
