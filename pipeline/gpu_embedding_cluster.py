"""
Part A, stage 2 — ESM2 embedding + KMeans clustering on the Daytona GPU sandbox.

Inference only. No training: 3-4 hours is not enough to build, validate and tune
a model, and a rushed one is worse than no model at all. ESM2 is pretrained and
used purely to turn each protein into a vector.

Input :  data/sequences.csv   (gene_id, sequence, species, resistant_phenotype, product)
Output:  data/cluster_summary.json   per Contract 1
         data/embeddings.npy         cached vectors, so re-clustering is instant
         data/timing.json            wall-clock for the demo narrative

Run:  python pipeline/gpu_embedding_cluster.py
"""

from __future__ import annotations

import argparse
import json
import os
import time
from collections import Counter

import numpy as np
import pandas as pd
import torch
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.environ.get("DATA_DIR", os.path.join(ROOT, "data"))

# esm2_t12_35M_UR50D: 12 layers, 35M params, 480-dim embeddings. Deliberately
# the small variant - the larger ESM2 checkpoints cost minutes of download and
# a lot of VRAM for no benefit at hackathon scale.
MODEL_NAME = "esm2_t12_35M_UR50D"
REPR_LAYER = 12
BATCH_SIZE = 32
MAX_LEN = 1022  # ESM2 positional embedding limit, minus BOS/EOS

K_RANGE = range(4, 13)
TOP_PRODUCTS = 8
EXAMPLE_GENES = 5


def log(msg: str) -> None:
    print(msg, flush=True)


def load_sequences(limit: int | None = None) -> pd.DataFrame:
    path = os.path.join(DATA, "sequences.csv")
    df = pd.read_csv(path)
    df = df[df["sequence"].notna() & (df["sequence"].str.len() > 0)]
    df["sequence"] = df["sequence"].str.upper().str.replace(r"[^A-Z]", "", regex=True)
    df = df.drop_duplicates(subset=["gene_id"]).reset_index(drop=True)
    if limit:
        # Stratified by species so a smoke-test subset still exercises every
        # branch of the summary builder.
        # groupby().head() keeps every column; groupby().apply() would consume
        # `species` as the group key and drop it from the frame.
        per = max(1, limit // df["species"].nunique())
        df = df.loc[df.groupby("species").head(per).index].reset_index(drop=True)
        log(f"[load] --limit active: sampled down to {len(df):,}")
    log(f"[load] {len(df):,} sequences from {path}")
    return df


def embed(df: pd.DataFrame) -> tuple[np.ndarray, float]:
    """
    Mean-pool the per-residue representations into one vector per protein.

    Sequences are sorted by length before batching so each batch pads to a
    similar length - on a batch of mixed 50aa and 1200aa proteins most of the
    GPU time would otherwise go into padding.
    """
    import esm

    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cpu":
        log("[embed] WARNING: no CUDA device, running on CPU (much slower)")
    else:
        log(f"[embed] device: {torch.cuda.get_device_name(0)}")

    # Load from the esm package, NOT torch.hub.load("facebookresearch/esm:main").
    # torch.hub hits the GitHub API to validate the repo and fails with
    # "HTTP 403: rate limit exceeded" from shared/cloud IPs. esm.pretrained
    # pulls weights straight from dl.fbaipublicfiles.com and caches under
    # TORCH_HOME, which the Daytona run points at a persistent volume.
    log(f"[embed] loading {MODEL_NAME}")
    model, alphabet = getattr(esm.pretrained, MODEL_NAME)()
    batch_converter = alphabet.get_batch_converter()
    model = model.to(device).eval()

    order = np.argsort(df["sequence"].str.len().to_numpy())
    seqs = df["sequence"].to_numpy()
    ids = df["gene_id"].to_numpy()

    out = np.zeros((len(df), model.embed_dim), dtype=np.float32)

    t0 = time.time()
    with torch.no_grad():
        for start in range(0, len(order), BATCH_SIZE):
            idx = order[start : start + BATCH_SIZE]
            batch = [(str(ids[i]), seqs[i][:MAX_LEN]) for i in idx]
            _, _, toks = batch_converter(batch)
            toks = toks.to(device)

            res = model(toks, repr_layers=[REPR_LAYER])["representations"][REPR_LAYER]

            # Mask out BOS, EOS and padding before averaging, so short proteins
            # in a long-padded batch are not diluted toward zero.
            mask = (toks != alphabet.padding_idx) & (toks != alphabet.cls_idx) & (toks != alphabet.eos_idx)
            m = mask.unsqueeze(-1).float()
            pooled = (res * m).sum(1) / m.sum(1).clamp(min=1)
            out[idx] = pooled.float().cpu().numpy()

            done = min(start + BATCH_SIZE, len(order))
            if done % (BATCH_SIZE * 10) == 0 or done == len(order):
                rate = done / (time.time() - t0)
                log(f"[embed] {done:,}/{len(order):,}  ({rate:.0f} seq/s)")

    if device == "cuda":
        torch.cuda.synchronize()
    elapsed = time.time() - t0
    log(f"[embed] {len(df):,} sequences in {elapsed:.1f}s ({len(df) / elapsed:.0f} seq/s)")
    return out, elapsed


def choose_k(X: np.ndarray) -> tuple[int, dict]:
    """Pick k by silhouette score over a sample - full silhouette is O(n^2)."""
    rng = np.random.default_rng(0)
    sample = rng.choice(len(X), size=min(3000, len(X)), replace=False)
    Xs = X[sample]

    scores = {}
    best_k, best_score = None, -1.0
    for k in K_RANGE:
        if k >= len(Xs):
            break
        labels = KMeans(n_clusters=k, n_init=4, random_state=0).fit_predict(Xs)
        s = float(silhouette_score(Xs, labels))
        scores[k] = round(s, 4)
        log(f"[cluster] k={k}  silhouette={s:.4f}")
        if s > best_score:
            best_k, best_score = k, s
    log(f"[cluster] selected k={best_k} (silhouette {best_score:.4f})")
    return best_k, scores


def build_summary(df: pd.DataFrame) -> dict:
    """
    Emit Contract 1 exactly: top-level keys are cluster ids as strings, and
    nothing else lives at the top level. Part B iterates this dict directly.
    """
    summary: dict[str, dict] = {}
    for cid, grp in df.groupby("cluster"):
        products = Counter(grp["product"].fillna("unknown").astype(str))
        phenotypes = Counter(grp["resistant_phenotype"].fillna("Unknown").astype(str))
        species = Counter(grp["species"].fillna("unknown").astype(str))

        summary[str(cid)] = {
            "n_genes": int(len(grp)),
            "example_genes": grp["gene_id"].head(EXAMPLE_GENES).tolist(),
            "top_products": dict(products.most_common(TOP_PRODUCTS)),
            "resistant_phenotype_breakdown": dict(phenotypes.most_common()),
            "species_breakdown": dict(species.most_common()),
        }
    return dict(sorted(summary.items(), key=lambda kv: int(kv[0])))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, help="embed only N sequences (smoke test / CPU fallback)")
    ap.add_argument("--out", default="cluster_summary.json", help="output filename in DATA_DIR")
    args = ap.parse_args()

    df = load_sequences(args.limit)
    if df.empty:
        raise SystemExit("sequences.csv is empty - run pipeline/bvbrc_fetch.py first")

    X, embed_seconds = embed(df)
    np.save(os.path.join(DATA, "embeddings.npy"), X)

    # L2-normalise so KMeans on Euclidean distance behaves like cosine
    # similarity, which is the right geometry for language-model embeddings.
    Xn = X / np.linalg.norm(X, axis=1, keepdims=True).clip(min=1e-9)

    t0 = time.time()
    k, scores = choose_k(Xn)
    df["cluster"] = KMeans(n_clusters=k, n_init=10, random_state=0).fit_predict(Xn)
    cluster_seconds = time.time() - t0

    summary = build_summary(df)
    with open(os.path.join(DATA, args.out), "w") as fh:
        json.dump(summary, fh, indent=2)

    df[["gene_id", "cluster", "species", "resistant_phenotype", "product"]].to_csv(
        os.path.join(DATA, "gene_clusters.csv"), index=False
    )

    device = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    timing = {
        "n_sequences": int(len(df)),
        "model": MODEL_NAME,
        "device": device,
        "embedding_seconds": round(embed_seconds, 2),
        "sequences_per_second": round(len(df) / embed_seconds, 1),
        "clustering_seconds": round(cluster_seconds, 2),
        "k_selected": int(k),
        "silhouette_by_k": scores,
        # The demo headline. Quote this number, not a remembered one.
        "headline": f"{len(df):,} proteins embedded in {embed_seconds:.1f}s on {device}",
    }
    with open(os.path.join(DATA, "timing.json"), "w") as fh:
        json.dump(timing, fh, indent=2)

    log(f"\n[done] {len(summary)} clusters -> {os.path.join(DATA, args.out)}")
    log(f"[done] {timing['headline']}")
    for cid, c in summary.items():
        top = next(iter(c["top_products"]), "?")
        log(f"    cluster {cid}: {c['n_genes']:>4} genes  {top[:52]}")


if __name__ == "__main__":
    main()
