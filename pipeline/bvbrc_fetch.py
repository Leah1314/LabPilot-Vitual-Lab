"""
Part A, stage 1 — pull the BV-BRC tables and assemble sequences.csv.

Outputs (Contract: build planner §1):
    data/bvbrc_amr.csv        lab-measured susceptibility, cohort genomes only
    data/bvbrc_spgene.csv     precomputed AMR + virulence gene calls
    data/bvbrc_metadata.csv   host / source / country / year per genome
    data/sequences.csv        gene_id, sequence, species, resistant_phenotype, product
    pipeline/manifest.json    the pinned genome cohort

Run:  python pipeline/bvbrc_fetch.py
"""

from __future__ import annotations

import json
import os
import sys
import time
from collections import Counter, defaultdict

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bvbrc  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
PIPELINE = os.path.join(ROOT, "pipeline")

# Locked at kickoff. Do not edit mid-hackathon.
#   amr=False marks an organism with too little lab-measured AMR data to quote a
#   resistance statistic for. H. pylori has 265 lab rows against K. pneumoniae's
#   85,291, so it rides along for the gut-health framing on virulence only.
TARGETS = [
    {"taxon_id": 562, "species": "Escherichia coli", "amr": True},
    {"taxon_id": 573, "species": "Klebsiella pneumoniae", "amr": True},
    {"taxon_id": 1352, "species": "Enterococcus faecium", "amr": True},
    {"taxon_id": 1351, "species": "Enterococcus faecalis", "amr": True},
    {"taxon_id": 1496, "species": "Clostridioides difficile", "amr": True},
    {"taxon_id": 210, "species": "Helicobacter pylori", "amr": False},
]

GENOMES_PER_SPECIES = 40

# CARD/NDARO carry the resistance calls, VFDB/PATRIC_VF the virulence factors.
# TCDB and DrugBank are most of the rows in sp_gene and are not what we analyse.
SPGENE_SOURCES = ["CARD", "NDARO", "VFDB", "PATRIC_VF"]

# BV-BRC stores two spellings of the same property in the same field. Filtering
# only the correct one silently discards ~22% of virulence annotations.
PROPERTY_NORMALISE = {
    "virulance factor": "Virulence Factor",
    "virulence factor": "Virulence Factor",
    "antibiotic resistance": "Antibiotic Resistance",
}

# Embedding only makes sense on real proteins. ESM2 also degrades on fragments
# and the batch cost is driven by the longest sequence in the batch.
MIN_AA_LEN = 40
MAX_AA_LEN = 1200


def log(msg: str) -> None:
    print(msg, flush=True)


def cached(filename: str, build):
    """
    Reuse a completed stage. The cohort is pinned to a manifest, so every stage
    is deterministic and a partial run can be resumed without refetching what
    already landed. Delete the CSV (or pass --fresh) to force a refetch.
    """
    path = os.path.join(DATA, filename)
    if "--fresh" not in sys.argv and os.path.exists(path):
        df = pd.read_csv(path, low_memory=False)
        log(f"[cache] reusing {filename} ({len(df):,} rows)")
        return df
    df = build()
    return df


# --------------------------------------------------------------------------
# 1. Cohort selection
# --------------------------------------------------------------------------

def select_cohort() -> dict:
    path = os.path.join(PIPELINE, "manifest.json")
    if "--fresh" not in sys.argv and os.path.exists(path):
        with open(path) as fh:
            manifest = json.load(fh)
        n = sum(len(o["genome_ids"]) for o in manifest["organisms"].values())
        log(f"[cache] reusing pinned manifest ({n} genomes, pinned {manifest['pinned_at']})")
        return manifest
    return _select_cohort()


def _select_cohort() -> dict:
    """
    Pick a fixed set of genomes per organism and pin them to a manifest, so the
    cohort cannot drift between runs or mid-demo.

    For AMR organisms we rank genomes by how many lab-measured antibiotic
    results they carry - the best-characterised isolates make the phenotype
    label meaningful. For virulence-only organisms we take complete genomes.
    """
    manifest = {"pinned_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "organisms": {}}

    for t in TARGETS:
        taxon, species = t["taxon_id"], t["species"]
        log(f"\n[cohort] {species} (taxon {taxon})")

        if t["amr"]:
            filt = f'and(eq(taxon_id,{taxon}),eq(evidence,%22Laboratory%20Method%22))'
            total = bvbrc.count("genome_amr", filt)
            log(f"    {total:,} lab-measured AMR rows available")

            rows = list(
                bvbrc.paged(
                    "genome_amr",
                    filt,
                    "genome_id,antibiotic,resistant_phenotype",
                    "genome_id",
                    max_rows=bvbrc.PAGE_CAP,
                )
            )
            # Rank by number of distinct antibiotics with a usable call.
            per_genome: dict[str, set] = defaultdict(set)
            for r in rows:
                if r.get("resistant_phenotype") in ("Resistant", "Susceptible"):
                    per_genome[r["genome_id"]].add(r.get("antibiotic"))
            ranked = sorted(per_genome.items(), key=lambda kv: (-len(kv[1]), kv[0]))
            picked = [g for g, _ in ranked[:GENOMES_PER_SPECIES]]
            log(f"    {len(per_genome):,} genomes with usable calls -> pinned {len(picked)}")
        else:
            rows = list(
                bvbrc.paged(
                    "genome",
                    f'and(eq(taxon_id,{taxon}),eq(genome_status,Complete),eq(public,true))',
                    "genome_id,genome_name",
                    "genome_id",
                    max_rows=GENOMES_PER_SPECIES * 4,
                )
            )
            picked = [r["genome_id"] for r in rows[:GENOMES_PER_SPECIES]]
            log(f"    virulence-only organism -> pinned {len(picked)} complete genomes")

        manifest["organisms"][species] = {
            "taxon_id": taxon,
            "amr_available": t["amr"],
            "genome_ids": picked,
        }

    path = os.path.join(PIPELINE, "manifest.json")
    with open(path, "w") as fh:
        json.dump(manifest, fh, indent=2)
    total = sum(len(o["genome_ids"]) for o in manifest["organisms"].values())
    log(f"\n[cohort] pinned {total} genomes -> {path}")
    return manifest


def all_genome_ids(manifest: dict) -> list[str]:
    return [g for o in manifest["organisms"].values() for g in o["genome_ids"]]


def species_of(manifest: dict) -> dict[str, str]:
    return {g: sp for sp, o in manifest["organisms"].items() for g in o["genome_ids"]}


# --------------------------------------------------------------------------
# 2. The three tables
# --------------------------------------------------------------------------

def fetch_amr(manifest: dict) -> pd.DataFrame:
    log("\n[amr] genome_amr, lab-measured only")
    ids = [g for o in manifest["organisms"].values() if o["amr_available"] for g in o["genome_ids"]]
    rows = bvbrc.fetch_by_ids(
        "genome_amr",
        "genome_id",
        ids,
        "genome_id,genome_name,taxon_id,antibiotic,resistant_phenotype,measurement,"
        "measurement_unit,laboratory_typing_method,testing_standard,evidence",
        "genome_id",
        extra='eq(evidence,%22Laboratory%20Method%22)',
        label="amr",
    )
    df = pd.DataFrame(rows)
    if not df.empty:
        # Intermediate is a real clinical category but not a usable binary label.
        df = df[df["resistant_phenotype"].isin(["Resistant", "Susceptible"])]
        df["species"] = df["genome_id"].map(species_of(manifest))
    df.to_csv(os.path.join(DATA, "bvbrc_amr.csv"), index=False)
    log(f"[amr] {len(df):,} rows -> data/bvbrc_amr.csv")
    return df


def fetch_spgene(manifest: dict) -> pd.DataFrame:
    log("\n[spgene] sp_gene, CARD/NDARO/VFDB/PATRIC_VF")
    rows = bvbrc.fetch_by_ids(
        "sp_gene",
        "genome_id",
        all_genome_ids(manifest),
        "genome_id,genome_name,patric_id,gene,product,property,source,"
        "identity,query_coverage,e_value,antibiotics_class",
        "patric_id",
        extra=bvbrc.in_clause("source", SPGENE_SOURCES),
        label="spgene",
    )
    df = pd.DataFrame(rows)
    if not df.empty:
        df = df[df["patric_id"].notna() & (df["patric_id"] != "")]
        df["property_clean"] = (
            df["property"].fillna("").str.strip().str.lower().map(PROPERTY_NORMALISE)
        ).fillna(df["property"])
        df["species"] = df["genome_id"].map(species_of(manifest))
        df = df.drop_duplicates(subset=["patric_id", "source", "product"])
    df.to_csv(os.path.join(DATA, "bvbrc_spgene.csv"), index=False)
    log(f"[spgene] {len(df):,} rows -> data/bvbrc_spgene.csv")
    if not df.empty:
        log(f"[spgene] property mix: {dict(Counter(df['property_clean']).most_common(6))}")
    return df


def fetch_metadata(manifest: dict) -> pd.DataFrame:
    log("\n[metadata] genome")
    rows = bvbrc.fetch_by_ids(
        "genome",
        "genome_id",
        all_genome_ids(manifest),
        "genome_id,genome_name,species,strain,host_name,isolation_source,isolation_country,"
        "geographic_location,collection_year,disease,mlst,genome_status,genome_quality",
        "genome_id",
        label="metadata",
    )
    df = pd.DataFrame(rows)
    df.to_csv(os.path.join(DATA, "bvbrc_metadata.csv"), index=False)
    log(f"[metadata] {len(df):,} rows -> data/bvbrc_metadata.csv")
    return df


# --------------------------------------------------------------------------
# 3. Phenotype labelling
# --------------------------------------------------------------------------

def genome_phenotypes(amr: pd.DataFrame) -> pd.DataFrame:
    """
    Collapse per-antibiotic lab results into one label per genome.

    Rule, stated plainly because the label is only as good as its definition:
    a genome is Resistant if it has more Resistant than Susceptible
    lab-measured results, otherwise Susceptible. Genomes with no lab AMR data
    get Unknown and are never counted as either.

    The raw counts ride along so nothing downstream has to quote a label
    without its denominator.
    """
    if amr.empty:
        return pd.DataFrame(columns=["genome_id", "n_resistant", "n_susceptible", "genome_phenotype"])

    g = (
        amr.groupby("genome_id")["resistant_phenotype"]
        .value_counts()
        .unstack(fill_value=0)
        .reset_index()
    )
    for col in ("Resistant", "Susceptible"):
        if col not in g:
            g[col] = 0
    g = g.rename(columns={"Resistant": "n_resistant", "Susceptible": "n_susceptible"})
    g["genome_phenotype"] = (g["n_resistant"] > g["n_susceptible"]).map(
        {True: "Resistant", False: "Susceptible"}
    )
    return g[["genome_id", "n_resistant", "n_susceptible", "genome_phenotype"]]


# --------------------------------------------------------------------------
# 4. Sequences
# --------------------------------------------------------------------------

def fetch_sequences(spgene: pd.DataFrame, pheno: pd.DataFrame, manifest: dict) -> pd.DataFrame:
    """
    Resolve protein sequences for every sp_gene hit.

    genome_feature does not return aa_sequence through select() - it only
    exposes aa_sequence_md5. The sequence itself lives in the feature_sequence
    collection keyed by that md5, so this is a two-hop join. Identical proteins
    share an md5, so the second hop is deduped and is much smaller than the first.
    """
    log("\n[sequences] hop 1: genome_feature -> aa_sequence_md5")
    feats = bvbrc.fetch_by_ids(
        "genome_feature",
        "patric_id",
        spgene["patric_id"].dropna().unique().tolist(),
        "patric_id,aa_sequence_md5,aa_length,product",
        "patric_id",
        batch=500,
        extra="eq(annotation,PATRIC)",
        label="feature",
    )
    fdf = pd.DataFrame(feats)
    fdf = fdf[fdf.get("aa_sequence_md5").notna() & (fdf["aa_sequence_md5"] != "")]
    fdf = fdf.drop_duplicates(subset=["patric_id"])
    log(f"[sequences] {len(fdf):,} features carry an aa md5")

    if "aa_length" in fdf:
        before = len(fdf)
        fdf = fdf[fdf["aa_length"].between(MIN_AA_LEN, MAX_AA_LEN)]
        log(f"[sequences] length filter {MIN_AA_LEN}-{MAX_AA_LEN}aa: {before:,} -> {len(fdf):,}")

    log("[sequences] hop 2: feature_sequence -> sequence")
    md5s = fdf["aa_sequence_md5"].unique().tolist()
    log(f"[sequences] {len(md5s):,} distinct proteins to resolve")
    seqs = bvbrc.fetch_by_ids(
        "feature_sequence",
        "md5",
        md5s,
        "md5,sequence,sequence_type",
        "md5",
        batch=500,
        label="sequence",
    )
    sdf = pd.DataFrame(seqs)
    sdf = sdf[sdf["sequence_type"] == "AA"].drop_duplicates(subset=["md5"])

    out = fdf.merge(sdf[["md5", "sequence"]], left_on="aa_sequence_md5", right_on="md5", how="inner")

    # Attach the sp_gene annotation and the genome-level phenotype.
    ann = (
        spgene.sort_values("source")
        .drop_duplicates(subset=["patric_id"])[
            ["patric_id", "genome_id", "species", "gene", "product", "property_clean", "source"]
        ]
        .rename(columns={"product": "sp_product"})
    )
    out = out.merge(ann, on="patric_id", how="inner")
    out = out.merge(pheno, on="genome_id", how="left")
    out["resistant_phenotype"] = out["genome_phenotype"].fillna("Unknown")

    out["gene_id"] = out["patric_id"]
    out["product"] = out["sp_product"].fillna(out.get("product_x", "")).replace("", "hypothetical protein")

    cols = [
        "gene_id", "sequence", "species", "resistant_phenotype", "product",
        "gene", "property_clean", "source", "genome_id", "aa_length",
        "n_resistant", "n_susceptible",
    ]
    out = out[[c for c in cols if c in out.columns]].drop_duplicates(subset=["gene_id"])
    out.to_csv(os.path.join(DATA, "sequences.csv"), index=False)

    log(f"[sequences] {len(out):,} sequences -> data/sequences.csv")
    log(f"[sequences] species mix: {dict(Counter(out['species']).most_common())}")
    log(f"[sequences] phenotype mix: {dict(Counter(out['resistant_phenotype']).most_common())}")
    return out


def main() -> None:
    os.makedirs(DATA, exist_ok=True)
    t0 = time.time()

    manifest = select_cohort()
    amr = cached("bvbrc_amr.csv", lambda: fetch_amr(manifest))
    spgene = cached("bvbrc_spgene.csv", lambda: fetch_spgene(manifest))
    cached("bvbrc_metadata.csv", lambda: fetch_metadata(manifest))
    pheno = genome_phenotypes(amr)
    seqs = fetch_sequences(spgene, pheno, manifest)

    meta = {
        "pinned_at": manifest["pinned_at"],
        "source": "BV-BRC (bv-brc.org), annotations from CARD, NDARO, VFDB, PATRIC_VF",
        "n_genomes": len(all_genome_ids(manifest)),
        "n_amr_rows_lab_measured": int(len(amr)),
        "n_spgene_rows": int(len(spgene)),
        "n_sequences": int(len(seqs)),
        "genome_phenotype_rule": (
            "A genome is labelled Resistant when it has more Resistant than Susceptible "
            "lab-measured antibiotic results, otherwise Susceptible. Genomes with no "
            "lab-measured AMR data are labelled Unknown and counted as neither. "
            "Intermediate results are excluded."
        ),
        "caveats": [
            "sp_gene calls are computational annotations, not laboratory measurements.",
            "Helicobacter pylori is included for virulence only; it has 265 lab-measured "
            "AMR rows and no resistance statistic should be quoted for it.",
            "Genomes are not deduplicated by strain, so clonal oversampling in the public "
            "database can inflate any within-cluster concentration.",
        ],
    }
    with open(os.path.join(DATA, "cohort_meta.json"), "w") as fh:
        json.dump(meta, fh, indent=2)

    log(f"\n[done] {time.time() - t0:.0f}s total. data/cohort_meta.json written.")


if __name__ == "__main__":
    main()
