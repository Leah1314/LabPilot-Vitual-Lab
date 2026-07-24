#!/usr/bin/env python3
"""Generate Fireworks observations and local faithfulness evals for Part B."""

from __future__ import annotations

import argparse
import json
import os
import re
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import requests
except ImportError:  # pragma: no cover - only used before deps are installed.
    requests = None


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL = "accounts/fireworks/models/deepseek-v4-flash"

SYSTEM_PROMPT = """You are analyzing gene clusters from pathogens implicated in gut-derived infections, including infected pancreatic necrosis.

Grounding rules:
- Write only from the JSON provided by the user.
- Every numeric claim must be copied from the JSON. Do not invent, round, or recompute numbers.
- Do not claim causation, clinical significance, or a treatment recommendation.
- Distinguish lab-measured resistant/susceptible phenotypes from gene-product annotations.
- If the cluster is confined to one country or one year, flag it as a possible outbreak or sampling artefact.

Respond only as JSON with this exact shape:
{"headline": "...", "observation": "..."}
"""

USER_TEMPLATE = """For the cluster below, write:
1. A one-line headline under 12 words
2. A 2-3 sentence research observation grounded only in the data provided

Cluster data:
{cluster_json}
"""

FORBIDDEN_PATTERNS = [
    r"\bcause[sd]?\b",
    r"\bcausal\b",
    r"\bcausation\b",
    r"\brecommend(?:ed|s|ation)?\b",
    r"\btreat(?:s|ment|ed|ing)?\b",
    r"\btherapy\b",
    r"\bpatient(?:s)?\b",
    r"\bempiric antibiotic\b",
]


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def load_local_env() -> None:
    for rel in (".env", ".env.local", "dashboard/.env", "dashboard/.env.local"):
        load_env_file(ROOT / rel)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def resolve_input(path_arg: str | None) -> Path:
    candidates = []
    if path_arg:
        candidates.append((ROOT / path_arg).resolve() if not Path(path_arg).is_absolute() else Path(path_arg))
    candidates.extend([ROOT / "data/cluster_summary.json", ROOT / "dashboard/data/cluster_summary.json"])

    for candidate in candidates:
        if candidate.exists():
            return candidate
    formatted = "\n".join(f"- {p}" for p in candidates)
    raise FileNotFoundError(f"No cluster summary found. Checked:\n{formatted}")


def coerce_mapping(value: Any, field: str) -> dict[str, Any]:
    return value.get(field, {}) if isinstance(value, dict) else {}


def sorted_items(mapping: dict[str, Any]) -> list[tuple[str, int]]:
    items: list[tuple[str, int]] = []
    for key, value in mapping.items():
        if isinstance(value, bool):
            continue
        try:
            items.append((str(key), int(value)))
        except (TypeError, ValueError):
            continue
    return sorted(items, key=lambda item: item[1], reverse=True)


def short_species(name: str) -> str:
    shortcuts = {
        "Escherichia coli": "E. coli",
        "Klebsiella pneumoniae": "K. pneumoniae",
        "Enterococcus faecium": "E. faecium",
        "Enterococcus faecalis": "E. faecalis",
        "Clostridioides difficile": "C. difficile",
        "Helicobacter pylori": "H. pylori",
    }
    return shortcuts.get(name, name)


def product_label(product: str) -> str:
    p = product.lower()
    if "carbapenemase" in p:
        return "Carbapenemase"
    if "beta-lactamase" in p or "lactamase" in p:
        return "Beta-lactamase"
    if "vancomycin" in p or "vana" in p:
        return "VanA"
    if "mcr-1" in p or "mcr" in p:
        return "MCR-1"
    if "toxin" in p:
        return "Toxin"
    if "efflux" in p:
        return "Efflux"
    words = re.findall(r"[A-Za-z0-9'-]+", product)
    return " ".join(words[:2]) if words else "Gene"


def confidence_from_summary(cluster: dict[str, Any]) -> str:
    countries = cluster.get("n_countries")
    strains = cluster.get("n_strains_dedup")
    years = cluster.get("year_range")
    if countries == 1 or (isinstance(years, list) and len(years) == 2 and years[0] == years[1]):
        return "low"
    if isinstance(countries, int) and countries >= 5 and isinstance(strains, int) and strains >= 50:
        return "high"
    return "medium"


def fallback_observation(cluster_id: str, cluster: dict[str, Any]) -> dict[str, Any]:
    products = sorted_items(coerce_mapping(cluster, "top_products"))
    species = sorted_items(coerce_mapping(cluster, "species_breakdown"))
    phenotypes = coerce_mapping(cluster, "resistant_phenotype_breakdown")
    n_genes = cluster.get("n_genes")
    resistant = phenotypes.get("Resistant")
    susceptible = phenotypes.get("Susceptible")
    strains = cluster.get("n_strains_dedup")
    countries = cluster.get("n_countries")
    years = cluster.get("year_range")

    top_product, top_count = products[0] if products else ("reported products", n_genes)
    second_product = products[1] if len(products) > 1 else None
    dominant_species, species_count = species[0] if species else ("the reported species", n_genes)
    headline = f"{product_label(top_product)} cluster in {short_species(dominant_species)}"

    if second_product:
        first_sentence = (
            f"This cluster contains {n_genes} genes, led by {top_product} ({top_count}) "
            f"and {second_product[0]} ({second_product[1]})."
        )
    else:
        first_sentence = f"This cluster contains {n_genes} genes, led by {top_product} ({top_count})."

    second_sentence = (
        f"The species breakdown is dominated by {dominant_species} ({species_count}), "
        f"with lab-measured phenotypes reported as {resistant} Resistant and "
        f"{susceptible} Susceptible"
    )
    if strains is not None:
        second_sentence += f" across {strains} deduplicated strains"
    second_sentence += "."

    artefact = isinstance(countries, int) and countries <= 1
    if isinstance(years, list) and len(years) == 2:
        artefact = artefact or years[0] == years[1]

    if artefact:
        if isinstance(years, list) and len(years) == 2 and years[0] == years[1]:
            third_sentence = (
                f"Because the pattern is confined to a single country or collection year ({years[0]}), "
                "read it as a possible outbreak or sampling artefact."
            )
        else:
            third_sentence = (
                "Because the pattern is confined to a single country or collection window, "
                "read it as a possible outbreak or sampling artefact."
            )
    elif isinstance(countries, int) and isinstance(years, list) and len(years) == 2:
        third_sentence = (
            f"The supporting rows span {countries} countries and {years[0]} to {years[1]}, "
            "so the observation is not limited to a single-country, single-year subset."
        )
    else:
        third_sentence = "Interpret this as a grounded research observation, not clinical guidance."

    return {
        "headline": headline,
        "observation": " ".join([first_sentence, second_sentence, third_sentence]),
        "confidence": confidence_from_summary(cluster),
    }


def strip_json_response(text: str) -> dict[str, Any]:
    stripped = text.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", stripped, flags=re.DOTALL | re.IGNORECASE)
    if fence:
        stripped = fence.group(1).strip()

    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        start = stripped.find("{")
        end = stripped.rfind("}")
        if start < 0 or end < start:
            raise
        parsed = json.loads(stripped[start : end + 1])

    if not isinstance(parsed, dict):
        raise ValueError("Fireworks response was not a JSON object")
    if not isinstance(parsed.get("headline"), str) or not isinstance(parsed.get("observation"), str):
        raise ValueError("Fireworks response did not include headline and observation strings")
    return {"headline": parsed["headline"].strip(), "observation": parsed["observation"].strip()}


def call_fireworks(cluster_id: str, cluster: dict[str, Any], model: str) -> tuple[dict[str, Any], int]:
    if requests is None:
        raise RuntimeError("requests is not installed")

    api_key = os.environ.get("FIREWORKS_API_KEY")
    if not api_key:
        raise RuntimeError("FIREWORKS_API_KEY is not set")

    cluster_payload = {"cluster_id": cluster_id, **cluster}
    prompt = USER_TEMPLATE.format(cluster_json=json.dumps(cluster_payload, indent=2, sort_keys=True))
    start = time.perf_counter()
    response = requests.post(
        "https://api.fireworks.ai/inference/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 300,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        },
        timeout=60,
    )
    latency_ms = round((time.perf_counter() - start) * 1000)
    if not response.ok:
        raise RuntimeError(f"Fireworks HTTP {response.status_code}: {response.text[:500]}")
    payload = response.json()
    text = payload["choices"][0]["message"]["content"]
    return strip_json_response(text), latency_ms


def number_tokens(value: str) -> list[str]:
    return re.findall(r"(?<![A-Za-z])\d+(?:\.\d+)?(?![A-Za-z])", value)


def faithfulness_scorer(cluster_id: str, cluster: dict[str, Any], observation: dict[str, Any]) -> dict[str, Any]:
    source = {"cluster_id": cluster_id, **cluster}
    source_text = json.dumps(source, sort_keys=True)
    supported_numbers = set(number_tokens(source_text))
    observed_text = f"{observation.get('headline', '')} {observation.get('observation', '')}"
    observed_numbers = number_tokens(observed_text)
    unsupported_numbers = sorted({n for n in observed_numbers if n not in supported_numbers})

    lower_text = observed_text.lower()
    forbidden_hits = [
        pattern.strip(r"\b").replace("\\", "")
        for pattern in FORBIDDEN_PATTERNS
        if re.search(pattern, lower_text, flags=re.IGNORECASE)
    ]

    years = cluster.get("year_range")
    confined = cluster.get("n_countries") == 1 or (
        isinstance(years, list) and len(years) == 2 and years[0] == years[1]
    )
    caveat_terms = ("single", "one country", "one collection year", "outbreak", "artefact", "artifact", "confined")
    has_caveat = any(term in lower_text for term in caveat_terms)

    if observed_numbers:
        number_score = max(0.0, 1.0 - (len(unsupported_numbers) / len(observed_numbers)))
    else:
        number_score = 1.0
    overclaim_score = 0.0 if forbidden_hits else 1.0
    artefact_score = 1.0 if not confined or has_caveat else 0.0
    score = round((0.6 * number_score) + (0.25 * overclaim_score) + (0.15 * artefact_score), 2)

    return {
        "name": "faithfulness",
        "score": score,
        "checks": {
            "observed_numbers": observed_numbers,
            "unsupported_numbers": unsupported_numbers,
            "forbidden_phrases": forbidden_hits,
            "artefact_caveat_required": confined,
            "artefact_caveat_present": has_caveat,
        },
    }


def eval_note(eval_result: dict[str, Any]) -> str | None:
    checks = eval_result["checks"]
    notes: list[str] = []
    if checks["unsupported_numbers"]:
        notes.append(f"Unsupported numbers: {', '.join(checks['unsupported_numbers'])}.")
    if checks["forbidden_phrases"]:
        notes.append(f"Potential overclaim phrases: {', '.join(checks['forbidden_phrases'])}.")
    if checks["artefact_caveat_required"] and not checks["artefact_caveat_present"]:
        notes.append("Single-country or single-year pattern was not caveated.")
    return " ".join(notes) if notes else None


def run(args: argparse.Namespace) -> int:
    load_local_env()
    input_path = resolve_input(args.input)
    cluster_summary = read_json(input_path)
    if not isinstance(cluster_summary, dict) or not cluster_summary:
        raise ValueError(f"{input_path} must contain a non-empty cluster summary object")

    model = args.model or os.environ.get("FIREWORKS_MODEL") or DEFAULT_MODEL
    api_key_available = bool(os.environ.get("FIREWORKS_API_KEY"))
    use_fireworks = api_key_available and not args.offline
    if args.require_fireworks and not use_fireworks:
        raise RuntimeError("FIREWORKS_API_KEY is not visible to this process")

    observations: list[dict[str, Any]] = []
    evals: list[dict[str, Any]] = []
    latencies: list[int] = []
    generated_modes: dict[str, str] = {}

    for cluster_id in sorted(cluster_summary.keys(), key=lambda value: int(value) if str(value).isdigit() else str(value)):
        cluster = cluster_summary[cluster_id]
        if not isinstance(cluster, dict):
            raise ValueError(f"Cluster {cluster_id} must be an object")

        mode = "fireworks" if use_fireworks else "fallback"
        try:
            if use_fireworks:
                generated, latency_ms = call_fireworks(cluster_id, cluster, model)
                latencies.append(latency_ms)
            else:
                generated = fallback_observation(cluster_id, cluster)
                latency_ms = 0
        except Exception as exc:
            if args.require_fireworks:
                raise
            mode = "fallback"
            generated = fallback_observation(cluster_id, cluster)
            latency_ms = 0
            print(f"Cluster {cluster_id}: Fireworks failed, used fallback: {exc}", file=sys.stderr)

        eval_result = faithfulness_scorer(cluster_id, cluster, generated)
        note = eval_note(eval_result)
        eval_score = eval_result["score"]

        confidence = generated.get("confidence")
        if confidence not in {"high", "medium", "low"}:
            confidence = "high" if eval_score >= 0.85 else "medium" if eval_score >= 0.7 else "low"

        row = {
            "cluster_id": str(cluster_id),
            "headline": generated["headline"],
            "observation": generated["observation"],
            "confidence": confidence,
            "eval_score": eval_score,
            "supporting_gene_count": cluster.get("n_genes"),
        }
        if latency_ms:
            row["llm_latency_ms"] = latency_ms
        if note:
            row["eval_note"] = note
        observations.append(row)

        evals.append(
            {
                "cluster_id": str(cluster_id),
                "score": eval_score,
                "mode": mode,
                "llm_latency_ms": latency_ms if latency_ms else None,
                "details": eval_result,
            }
        )
        generated_modes[str(cluster_id)] = mode

    mean_score = round(sum(item["score"] for item in evals) / len(evals), 3)
    median_latency = round(statistics.median(latencies)) if latencies else None
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    observations_file = {
        "generated_at": generated_at,
        "clusters": observations,
        "pipeline_stats": {
            "sequences_embedded": None,
            "embedding_seconds": None,
            "embedding_hardware": None,
            "llm_median_latency_ms": median_latency,
            "llm_model": model if use_fireworks else None,
            "eval_mean_faithfulness": mean_score,
            "eval_n_examples": len(evals),
        },
    }

    eval_file = {
        "generated_at": generated_at,
        "project": "amr-observation-faithfulness",
        "input_path": str(input_path.relative_to(ROOT) if input_path.is_relative_to(ROOT) else input_path),
        "model": model if use_fireworks else None,
        "fireworks_used": use_fireworks,
        "braintrust_api_key_present": bool(os.environ.get("BRAINTRUST_API_KEY")),
        "mean_faithfulness": mean_score,
        "n_examples": len(evals),
        "results": evals,
    }

    root_input = ROOT / "data/cluster_summary.json"
    if not root_input.exists():
        write_json(root_input, cluster_summary)
    write_json(ROOT / args.output, observations_file)
    write_json(ROOT / args.eval_output, eval_file)

    print(f"Read cluster summary: {input_path}")
    print(f"Wrote observations: {ROOT / args.output}")
    print(f"Wrote eval results: {ROOT / args.eval_output}")
    print(f"Clusters: {len(observations)}")
    print(f"Fireworks used: {use_fireworks}")
    if use_fireworks:
        print(f"Model: {model}")
        print(f"Median latency: {median_latency} ms")
    else:
        print("Model: local deterministic fallback")
    print(f"Mean faithfulness: {mean_score}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", help="Path to cluster_summary.json, relative to repo root by default")
    parser.add_argument("--output", default="insights/observations.json")
    parser.add_argument("--eval-output", default="eval/braintrust_results.json")
    parser.add_argument("--model", default=os.environ.get("FIREWORKS_MODEL", DEFAULT_MODEL))
    parser.add_argument("--offline", action="store_true", help="Skip Fireworks and use deterministic grounded generation")
    parser.add_argument("--require-fireworks", action="store_true", help="Fail if Fireworks cannot be used")
    args = parser.parse_args()
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
