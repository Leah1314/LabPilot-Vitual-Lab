# Daytona — Sandbox Setup, SSH, and Full Pipeline Bring-Up

**Owner: data/backend.** Everything in this doc runs on your laptop first, then
inside the sandbox over SSH.
**Platform facts verified live 2026-07-24.** See [prompt.md](./prompt.md) for the
project brief and [daytona.md](./daytona.md) for the data science.

This doc is a sequence of **prompts you paste into a coding agent**, in order.
Each prompt is self-contained. Run them one at a time and check the stated
success criterion before moving on.

---

## 0. Before you start

Have ready:

- A Daytona account and `DAYTONA_API_KEY` (app.daytona.io → API keys)
- Terminal with `ssh` available
- Roughly 10 minutes for steps 1–3; after that you are working inside the sandbox

Set the key in your shell now so every later prompt inherits it:

```bash
export DAYTONA_API_KEY="dtn_..."
```

---

## Prompt 1 — Install and authenticate the Daytona CLI

> Install the Daytona CLI on this machine and authenticate it.
>
> On macOS use Homebrew:
> ```bash
> brew install daytonaio/cli/daytona
> ```
> If Homebrew is unavailable or the tap fails, download the binary directly
> (pick the matching arch):
> ```bash
> sudo curl -fL https://github.com/daytona/clients/releases/latest/download/daytona-darwin-arm64 \
>      -o /usr/local/bin/daytona && sudo chmod +x /usr/local/bin/daytona
> ```
> Linux uses `daytona-linux-amd64` / `daytona-linux-arm64`; Windows uses
> `powershell -Command "irm https://get.daytona.io/windows | iex"`.
>
> Then authenticate and confirm:
> ```bash
> daytona login --api-key "$DAYTONA_API_KEY"
> daytona version
> ```
>
> Report the CLI version. Do not proceed if `daytona version` fails.

**Success criterion:** `daytona version` prints a version (0.200.x as of
2026-07-24). The release org in the download URL is `daytona/clients`, **not**
`daytonaio` — a wrong org here 404s.

---

## Prompt 2 — Create the sandbox

Two sandboxes, two purposes. **Create the CPU one first** — it is what serves the
API, and it is not ephemeral. Only create the GPU one if you have committed to
the GPU story (see [daytona.md §3.3](./daytona.md); decide at the 2-hour mark).

> Create a Daytona CPU sandbox for the analysis and serving workload using the
> Python SDK. Write this as a script `pipeline/create_sandbox.py` so it is
> repeatable, do not do it by hand.
>
> ```bash
> pip install daytona
> ```
>
> ```python
> import os
> from daytona import (Daytona, DaytonaConfig, CreateSandboxFromImageParams,
>                      Image, Resources)
>
> daytona = Daytona(DaytonaConfig(api_key=os.environ["DAYTONA_API_KEY"]))
>
> image = (Image.debian_slim("3.11")
>          .pip_install(["pandas", "scipy", "scikit-learn", "networkx",
>                        "fastapi", "uvicorn", "requests", "httpx"]))
>
> sandbox = daytona.create(
>     CreateSandboxFromImageParams(
>         image=image,
>         resources=Resources(cpu=4, memory=8, disk=10),
>         public=True,
>         auto_stop_interval=0,          # CRITICAL — see below
>     ),
>     timeout=0,
>     on_snapshot_create_logs=print,
> )
> print("SANDBOX_ID:", sandbox.id)
> ```
>
> Print and save the sandbox ID to `.sandbox_id` (gitignored). Report the ID.

**Success criterion:** a sandbox ID is printed and `daytona list` shows it as
started.

**`auto_stop_interval` defaults to 15 minutes and fires while your job is
running.** Set it to `0` on anything doing real work. This is the single most
expensive mistake available in this platform.

Per-sandbox non-GPU ceiling is **4 vCPU / 8 GiB RAM / 10 GiB disk** — the values
above are the maximum, not a suggestion. Image tags must be pinned:
`latest`, `lts`, and `stable` are rejected outright.

### GPU variant (only if you are running embeddings)

```python
from daytona import GpuType

sandbox = daytona.create(
    CreateSandboxFromImageParams(
        image=Image.debian_slim("3.11").pip_install(["torch", "fair-esm", "pandas"]),
        resources=Resources(gpu=1, gpu_type=[GpuType.H100, GpuType.RTX_PRO_6000]),
        auto_stop_interval=0,
        ephemeral=True,
    ),
    timeout=600,
)
```

`gpu_type` takes a preference-ordered list and you get the first type with
availability. **Max one GPU per sandbox.** GPU sandboxes are documented as
ephemeral and pinned to `us-east-1` — the region parameter is ignored because of
GPU scarcity. Anything you want to keep must be written to a Volume (Prompt 6).

---

## Prompt 3 — SSH into the sandbox

This is the part that turns the sandbox into a normal dev box.

> Mint an SSH access token for the sandbox and open a shell in it.
>
> CLI route (simplest):
> ```bash
> daytona ssh <SANDBOX_ID> --expires 240
> ```
>
> SDK route, when you need the raw token for scripting or an IDE:
> ```python
> sandbox = daytona.get(os.environ["SANDBOX_ID"])
> ssh_access = sandbox.create_ssh_access(expires_in_minutes=240)
> print(f"ssh {ssh_access.token}@ssh.app.daytona.io")
> ```
>
> The **token is the username** — `ssh <token>@ssh.app.daytona.io`. There is no
> key to install and no host to configure.
>
> Once connected, verify the environment:
> ```bash
> python --version && nvidia-smi || echo "no GPU (expected on CPU sandbox)"
> df -h /
> ```
>
> Report whether you got a shell and what Python version is present.

**Token expiry defaults differ between surfaces** — the CLI documents 24 hours,
the SDK documents 60 minutes. Pass the value explicitly on both and you never
have to care which doc was right. Set it longer than your hackathon.

Revoke when done: `sandbox.revoke_ssh_access(token=...)`, or

```bash
curl 'https://app.daytona.io/api/sandbox/<SANDBOX_ID>/ssh-access?token=<TOKEN>' \
  --request DELETE --header "Authorization: Bearer $DAYTONA_API_KEY"
```

Omit `?token=` to revoke every token for that sandbox.

### Editing in VS Code / Cursor over SSH

Install the Remote–SSH extension, open the Remote Explorer, and paste the same
`ssh <token>@ssh.app.daytona.io` command as a new host. JetBrains Gateway accepts
the identical command. This is documented for VS Code and JetBrains; Cursor and
Windsurf are covered only on the Daytona blog, so treat them as likely-but-check.

> **Not documented either way:** whether SSH access works on GPU sandboxes. Test
> it in the first ten minutes if the GPU path matters to you, and fall back to
> `sandbox.process.exec(...)` if it does not.

---

## Prompt 4 — Set up the project inside the sandbox

> Inside the SSH session, clone the repo and install the pipeline dependencies.
>
> ```bash
> git clone <REPO_URL> ~/work && cd ~/work
> pip install -r pipeline/requirements.txt
> python -c "import pandas, scipy, sklearn, fastapi; print('deps ok')"
> ```
>
> Create `~/work/.env` from `.env.example` and populate it from the values I give
> you. **Never commit `.env`** — this repo is public.
>
> Report the output of `pip list | head -30` so I can confirm the image built
> what I expected.

If the image already pip-installed everything at Prompt 2, this is a no-op and
that is the point — the declarative image is the reproducible part, the SSH
session is for iteration.

---

## Prompt 5 — Pull and pin the BV-BRC cohort

> Write `pipeline/fetch.py` that queries the BV-BRC REST API at
> `https://www.bv-brc.org/api` and writes CSVs to `data/`.
>
> Pull, for the target organisms in [daytona.md §2.1](./daytona.md):
> - `sp_gene` — precomputed resistance and virulence calls, filtered to
>   `source` in (CARD, NDARO) for resistance and (VFDB, PATRIC_VF) for virulence
> - `genome_amr` — filtered to `evidence == "Laboratory Method"` only
> - `genome` — metadata: host, isolation source, country, collection year
>
> Working query shape:
> ```bash
> curl -s "https://www.bv-brc.org/api/sp_gene/?and(eq(genome_id,573.5781),eq(source,CARD))&select(genome_id,gene,product,property,identity)&limit(25000)&http_accept=text/csv"
> ```
>
> Obey these, all of which cost ~20 minutes each if discovered live:
> - There is a hard **25,000-row cap**. `limit(50000)` silently returns 25,000
>   with no error. Page with `sort()` + cursor.
> - **Scope by genome, not species.** *E. coli* has 287M `sp_gene` rows.
>   Select a few hundred genome IDs first, then `in(genome_id,(...))`.
> - Match `property` **case-insensitively on both** `Virulence Factor` and the
>   misspelled `Virulance factor` — filtering only the correct spelling silently
>   discards 22% of virulence annotations.
> - Row counts come from the `Content-Range` header, via `limit(1)` and `curl -D -`.
> - URL-encode slashes in drug names (`trimethoprim%2Fsulfamethoxazole`).
>
> **Write the selected genome IDs to `data/cohort_manifest.json` with a
> timestamp.** Every downstream number must be reproducible against that exact
> cohort, and the cohort must not shift mid-demo.
>
> Report row counts per collection and the number of pinned genomes.

**Success criterion:** `data/cohort_manifest.json` exists, and re-running
`fetch.py` produces byte-identical CSVs.

---

## Prompt 6 — Persist results to a Volume

Do this **before** any GPU work, not after.

> Create a Daytona Volume and mount it, so results survive sandbox deletion.
>
> ```python
> from daytona import CreateSandboxFromImageParams, VolumeMount
>
> volume = daytona.volume.create("amr-results")
> # then pass volumes=[VolumeMount(volume_id=volume.id, mount_path="/mnt/results")]
> # in CreateSandboxFromImageParams when creating the sandbox
> ```
>
> Volumes are S3-backed FUSE mounts. They persist after the sandbox is removed,
> can be mounted into several sandboxes at once, and do not count against the
> storage quota. Mount paths must be absolute and cannot be `/proc`, `/sys`,
> `/dev`, or `/etc`.
>
> Point every pipeline output path at `/mnt/results`. Report `daytona volume list`.

GPU sandbox filesystems are deleted on stop. Embeddings written anywhere else are
gone the moment the sandbox idles out.

---

## Prompt 7 — Compute the statistics

> Write `pipeline/analyze.py` that builds a genome × gene presence/absence matrix
> from `sp_gene` and computes:
> - pairwise co-occurrence between resistance determinants — lift, Jaccard, and
>   Fisher exact p-value with FDR correction
> - co-occurrence between resistance determinants and virulence factors
> - association between gene presence and lab-measured phenotype from `genome_amr`
> - a co-occurrence edge list for the network view
>
> **Deduplicate by strain before counting.** At minimum collapse genomes with
> identical resistance-gene profiles; better, group by MLST or clonal complex from
> metadata. Emit **both** `n_genomes_raw` and `n_strains_dedup` on every single
> statistic, plus `n_countries` and `year_range`.
>
> This is not optional polish. Public genome databases are wildly oversampled for
> outbreak strains and resistance genes ride on shared plasmids, so an
> undeduplicated co-occurrence percentage is an artefact of sampling, not a
> finding. See [daytona.md §3.2](./daytona.md) for the citations to have ready
> when a judge pushes on this.
>
> Report the top 10 pairs by lift, with both counts shown.

**Success criterion:** every row of output carries a deduplicated strain count,
and the gap between raw and deduplicated is visible.

---

## Prompt 8 — Serve it, and verify from a real browser

> Write `api/main.py`, a FastAPI app exposing:
> ```
> GET /cohort                      → organisms, genome counts, pinned date
> GET /cooccurrence?organism=&min_support=
> GET /resistance-profile?organism=
> GET /genome/analyze              → see dashboard.md, POST for uploads
> GET /healthz
> ```
>
> Set CORS explicitly with `fastapi.middleware.cors.CORSMiddleware` allowing the
> frontend origin — CORS behaviour through the Daytona preview proxy is not
> documented, so assume nothing is added for you.
>
> Run it on port 8000, then expose it:
> ```python
> pv = sandbox.get_preview_link(8000)
> print(pv.url)     # https://8000-{sandboxId}.proxy.daytona.work
> ```
>
> The sandbox was created with `public=True`, so no auth header is needed. If you
> need a private sandbox instead, pass the token as the `x-daytona-preview-token`
> header, or use `sandbox.create_signed_preview_url(8000, expires_in_seconds=3600)`
> — **set the expiry explicitly**, the TypeScript SDK default is 60 seconds.
>
> Then verify end to end: open the preview URL in an actual browser, and run a
> `fetch()` from the frontend's origin in the browser console. Report both the
> URL and whether the cross-origin fetch succeeded.

**Success criterion:** a real browser on the venue network gets JSON from
`/healthz`. Conference wifi blocks odd ports with some regularity — **find that
out at hour one, not at hour four.**

---

## Reference — verified facts

| | CPU sandbox | GPU sandbox |
|---|---|---|
| vCPU | max 4 | up to 16 |
| RAM | max 8 GiB | up to 192 GB |
| Disk | max 10 GiB | up to 512 GB |
| Filesystem on stop | persists | deleted — ephemeral |

- SDKs: `pip install daytona` (0.200.2), `npm install @daytona/sdk` (0.200.1).
  **`@daytonaio/sdk` is deprecated** — same API, renamed package.
- `github.com/daytonaio/daytona` was frozen in June 2026 and development moved
  private. Do not use the repo as an API reference.
- GPU types: `H100`, `H200`, `RTX_PRO_6000`, `RTX_4090`, `RTX_5090`.
- Method names differ by language: Python `sandbox.process.exec(...)`,
  TypeScript `sandbox.process.executeCommand(...)`.
- Long jobs: `create_session` + `execute_session_command(..., run_async=True)` +
  `get_session_command_logs(...)`.
- Free tier: $200 in free compute, no card needed for the trial. Published
  per-hour GPU rates circulating online are **not** on Daytona's own pricing
  page — check the console for your actual burn rate rather than quoting a
  number you cannot source.

---

## Traps

1. `auto_stop_interval` left at its 15-minute default, killing a running job.
2. GPU filesystem deleted on stop — results lost because they were not on a Volume.
3. The silent 25,000-row cap on BV-BRC queries.
4. Querying `sp_gene` species-wide — *E. coli* is 287M rows.
5. Filtering only `Virulence Factor` and losing 22% of rows to `Virulance factor`.
6. Presenting `Computational Method` rows as laboratory data.
7. Reporting co-occurrence without lineage deduplication — the one that
   invalidates the science.
8. Not verifying browser → preview-URL CORS until demo time.
9. Image tag left as `latest` — rejected, and the error arrives at build time.
10. Assuming the SSH token default expiry; pass `--expires` / `expires_in_minutes`
    explicitly.
