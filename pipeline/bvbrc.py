"""
Thin BV-BRC REST client.

Everything here exists because of a specific trap verified live on 2026-07-24:

  * The API silently caps every query at 25,000 rows. `limit(50000)` returns
    25,000 with a 200 and no warning, so all paging goes through `paged()`.
  * Long `in(...)` clauses blow past URL length limits on GET, so every query
    is issued as POST with the RQL in the body.
  * `aa_sequence` is NOT retrievable from `genome_feature` via select(). It has
    to be joined: genome_feature.aa_sequence_md5 -> feature_sequence.md5.
  * Real row counts only come back in the Content-Range header.
  * A raw space in a literal is rejected with "Illegal character in query
    string encountered", so literals must be percent-encoded even in a POST
    body: eq(evidence,%22Laboratory%20Method%22), not eq(evidence,"Laboratory Method").
"""

from __future__ import annotations

import sys
import time
from typing import Iterator
from urllib.parse import quote

import requests

BASE = "https://www.bv-brc.org/api"

# The API caps here regardless of what you ask for. Do not raise it.
PAGE_CAP = 25_000

_session = requests.Session()
_session.headers.update({"Content-Type": "application/rqlquery+x-www-form-urlencoded"})


def _post(collection: str, rql: str, accept: str = "application/json", retries: int = 4):
    """Issue one RQL query as POST. Retries on transient failures."""
    last = None
    for attempt in range(retries):
        try:
            r = _session.post(
                f"{BASE}/{collection}/",
                data=rql.encode("utf-8"),
                headers={"Accept": accept},
                timeout=180,
            )
            if r.status_code == 200:
                return r
            last = f"HTTP {r.status_code}: {r.text[:200]}"
        except requests.RequestException as exc:
            last = str(exc)
        sleep = 2**attempt
        print(f"    retry {attempt + 1}/{retries} after {sleep}s ({last})", file=sys.stderr)
        time.sleep(sleep)
    raise RuntimeError(f"{collection} query failed after {retries} attempts: {last}\nRQL: {rql[:300]}")


def count(collection: str, filt: str) -> int:
    """Total matching rows, read from the Content-Range header."""
    r = _post(collection, f"{filt}&limit(1)")
    rng = r.headers.get("Content-Range", "")
    return int(rng.split("/")[-1]) if "/" in rng else 0


def paged(
    collection: str,
    filt: str,
    select: str,
    sort_field: str,
    page_size: int = PAGE_CAP,
    max_rows: int | None = None,
) -> Iterator[dict]:
    """
    Page through a query. A stable sort is mandatory: without it the API can
    return overlapping or missing rows across pages.
    """
    start = 0
    while True:
        size = page_size if max_rows is None else min(page_size, max_rows - start)
        if size <= 0:
            return
        rql = f"{filt}&select({select})&sort(+{sort_field})&limit({size},{start})"
        rows = _post(collection, rql).json()
        if not rows:
            return
        yield from rows
        if len(rows) < size:
            return
        start += len(rows)
        if max_rows is not None and start >= max_rows:
            return


def in_clause(field: str, values) -> str:
    """
    RQL in(...) clause.

    Every value is percent-encoded. patric_ids look like `fig|573.5781.peg.4811`
    and the raw pipe makes the RQL parser fail with the very unhelpful
    "query.args[1].join is not a function". Wrapping values in double quotes
    does NOT work - only percent-encoding does.
    """
    joined = ",".join(quote(str(v), safe=".-_") for v in values)
    return f"in({field},({joined}))"


def q(value: str) -> str:
    """
    Quote a literal for RQL. Slashes in drug names
    (trimethoprim/sulfamethoxazole) silently return zero rows unencoded.
    """
    return quote(str(value), safe="")


def fetch_by_ids(
    collection: str,
    field: str,
    ids: list[str],
    select: str,
    sort_field: str,
    batch: int = 150,
    extra: str | None = None,
    label: str = "",
) -> list[dict]:
    """
    Fetch rows for a large id list by chunking the in(...) clause.
    `extra` is an additional filter ANDed with the id clause.
    """
    out: list[dict] = []
    ids = list(dict.fromkeys(ids))  # dedupe, preserve order
    for i in range(0, len(ids), batch):
        chunk = ids[i : i + batch]
        clause = in_clause(field, chunk)
        filt = f"and({clause},{extra})" if extra else clause
        out.extend(paged(collection, filt, select, sort_field))
        done = min(i + batch, len(ids))
        print(f"    {label or collection}: {done}/{len(ids)} ids -> {len(out)} rows", flush=True)
    return out
