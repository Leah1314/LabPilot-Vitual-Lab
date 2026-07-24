"""
Part A, stage 3 — run the embedding + clustering job on a Daytona GPU sandbox.

Usage:
    export DAYTONA_API_KEY=...
    python pipeline/run_on_daytona.py            # H100
    python pipeline/run_on_daytona.py --gpu RTX-4090   # cheaper, still fine for a 35M model

What this handles that will otherwise cost you the hackathon:

  * auto_stop_interval defaults to 15 minutes and fires even while your job is
    running. It is set to 0 here.
  * A GPU sandbox filesystem is DELETED when the sandbox stops. Results are
    downloaded before teardown, and the volume mount keeps the ESM2 weights and
    embeddings across runs.
  * Long jobs go through a session with run_async, not process.exec, so the call
    does not block on a single HTTP timeout.
"""

from __future__ import annotations

import argparse
import os
import sys
import time

from daytona import (
    CreateSandboxFromImageParams,
    Daytona,
    DaytonaConfig,
    GpuType,
    Image,
    Resources,
    SessionExecuteRequest,
    VolumeMount,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKDIR = "/home/daytona/work"
VOLUME_NAME = "amr-cache"
VOLUME_PATH = "/mnt/cache"

# Files the job needs, and files it produces.
UPLOAD = ["pipeline/gpu_embedding_cluster.py", "data/sequences.csv"]
DOWNLOAD = ["data/cluster_summary.json", "data/timing.json", "data/gene_clusters.csv"]

# The sandbox cannot reach dl.fbaipublicfiles.com - the download dies with
# "[Errno 104] Connection reset by peer" partway through. So the weights are
# fetched here, where the network works, and pushed to the volume. The volume
# survives sandbox deletion, so this is a one-time cost.
ESM_WEIGHT_URLS = {
    "esm2_t12_35M_UR50D.pt": "https://dl.fbaipublicfiles.com/fair-esm/models/esm2_t12_35M_UR50D.pt",
    "esm2_t12_35M_UR50D-contact-regression.pt": "https://dl.fbaipublicfiles.com/fair-esm/regression/esm2_t12_35M_UR50D-contact-regression.pt",
}
REMOTE_CKPT_DIR = f"{VOLUME_PATH}/torch/hub/checkpoints"


def log(msg: str) -> None:
    print(f"[daytona] {msg}", flush=True)


def load_dotenv() -> None:
    """Read .env from the repo root. Real environment always wins."""
    path = os.path.join(ROOT, ".env")
    if not os.path.exists(path):
        return
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def local_weight_dir() -> str:
    """Where torch caches hub checkpoints on this machine."""
    root = os.environ.get("TORCH_HOME") or os.path.join(
        os.environ.get("XDG_CACHE_HOME", os.path.expanduser("~/.cache")), "torch"
    )
    return os.path.join(root, "hub", "checkpoints")


def ensure_local_weights() -> str:
    """Download the ESM2 checkpoints here if they are not already cached."""
    import urllib.request

    ckpt_dir = local_weight_dir()
    os.makedirs(ckpt_dir, exist_ok=True)
    for name, url in ESM_WEIGHT_URLS.items():
        path = os.path.join(ckpt_dir, name)
        if os.path.exists(path) and os.path.getsize(path) > 0:
            continue
        log(f"downloading {name} locally ({url})")
        urllib.request.urlretrieve(url, path)
    return ckpt_dir


def push_weights(sandbox) -> None:
    """Copy the checkpoints onto the volume, skipping any already there."""
    ckpt_dir = ensure_local_weights()
    sandbox.process.exec(f"mkdir -p {REMOTE_CKPT_DIR}")
    for name in ESM_WEIGHT_URLS:
        local = os.path.join(ckpt_dir, name)
        if not os.path.exists(local):
            continue
        probe = sandbox.process.exec(f"test -s {REMOTE_CKPT_DIR}/{name} && echo present || echo absent")
        if "present" in (probe.result or ""):
            log(f"weights {name} already on volume")
            continue
        with open(local, "rb") as fh:
            sandbox.fs.upload_file(fh.read(), f"{REMOTE_CKPT_DIR}/{name}")
        log(f"pushed {name} to volume")


def build_image() -> Image:
    # Tags must be pinned - latest/lts/stable are rejected outright.
    return (
        Image.debian_slim("3.11")
        .pip_install(
            [
                "torch==2.5.1",
                "fair-esm==2.0.0",
                "numpy==2.1.3",
                "pandas==2.2.3",
                "scikit-learn==1.5.2",
            ]
        )
        # Keep model weights on the volume so a re-run does not redownload them.
        .env({"TORCH_HOME": f"{VOLUME_PATH}/torch", "DATA_DIR": f"{WORKDIR}/data"})
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gpu", default="H100", help="H100 | H200 | RTX-PRO-6000 | RTX-4090 | RTX-5090")
    ap.add_argument("--keep", action="store_true", help="leave the sandbox running afterwards")
    # This account caps at 4 vCPU / 8 GiB per sandbox even on GPU nodes, despite
    # the platform docs quoting up to 16 vCPU / 192 GB. Asking for more is a hard
    # rejection, not a silent downgrade. Raise these only if a create call proves
    # the quota is higher.
    ap.add_argument("--cpu", type=int, default=4)
    ap.add_argument("--memory", type=int, default=8)
    ap.add_argument("--disk", type=int, default=10)
    args = ap.parse_args()

    load_dotenv()
    if not os.environ.get("DAYTONA_API_KEY"):
        sys.exit("DAYTONA_API_KEY is not set (checked the environment and .env)")
    if not os.path.exists(os.path.join(ROOT, "data/sequences.csv")):
        sys.exit("data/sequences.csv missing - run pipeline/bvbrc_fetch.py first")

    daytona = Daytona(DaytonaConfig(api_key=os.environ["DAYTONA_API_KEY"]))

    volume = daytona.volume.get(VOLUME_NAME, create=True)
    log(f"volume {VOLUME_NAME} ready")

    log(f"creating {args.gpu} sandbox (this builds the image on first run)")
    t0 = time.time()
    sandbox = daytona.create(
        CreateSandboxFromImageParams(
            image=build_image(),
            # gpu=1 is the per-sandbox maximum.
            resources=Resources(
                cpu=args.cpu, memory=args.memory, disk=args.disk,
                gpu=1, gpu_type=GpuType(args.gpu),
            ),
            volumes=[VolumeMount(volume_id=volume.id, mount_path=VOLUME_PATH)],
            # Fires even mid-job at its 15 minute default. Must be 0.
            auto_stop_interval=0,
            # Must be 0 for GPU sandboxes. The API hard-rejects anything else
            # with "GPU sandboxes must be ephemeral; set autoDeleteInterval to
            # 0", so a GPU sandbox cannot be kept around for inspection after
            # it stops. auto_stop_interval=0 above is what keeps it alive while
            # the job runs; results are downloaded before teardown and the ESM2
            # weights live on the volume, which survives deletion.
            auto_delete_interval=0,
        ),
        timeout=0,
        on_snapshot_create_logs=lambda l: print("  " + l.rstrip(), flush=True),
    )
    log(f"sandbox {sandbox.id} up in {time.time() - t0:.0f}s")

    try:
        sandbox.process.exec(f"mkdir -p {WORKDIR}/data {WORKDIR}/pipeline")
        for rel in UPLOAD:
            with open(os.path.join(ROOT, rel), "rb") as fh:
                sandbox.fs.upload_file(fh.read(), f"{WORKDIR}/{rel}")
            log(f"uploaded {rel}")

        push_weights(sandbox)

        gpu = sandbox.process.exec("nvidia-smi --query-gpu=name,memory.total --format=csv,noheader")
        log(f"GPU: {gpu.result.strip()}")

        session = "embed"
        sandbox.process.create_session(session)
        cmd = sandbox.process.execute_session_command(
            session,
            SessionExecuteRequest(
                command=f"cd {WORKDIR} && python pipeline/gpu_embedding_cluster.py 2>&1",
                run_async=True,
            ),
        )

        log("job running, streaming logs")
        seen = 0
        while True:
            # get_session_command_logs returns a SessionCommandLogsResponse,
            # not a string. `.output` is stdout and stderr combined.
            resp = sandbox.process.get_session_command_logs(session, cmd.cmd_id)
            logs = (getattr(resp, "output", None) or "") if resp else ""
            if len(logs) > seen:
                print(logs[seen:], end="", flush=True)
                seen = len(logs)
            info = sandbox.process.get_session_command(session, cmd.cmd_id)
            if info.exit_code is not None:
                log(f"job finished, exit code {info.exit_code}")
                if info.exit_code != 0:
                    raise SystemExit("embedding job failed - see logs above")
                break
            time.sleep(3)

        os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
        for rel in DOWNLOAD:
            data = sandbox.fs.download_file(f"{WORKDIR}/{rel}")
            with open(os.path.join(ROOT, rel), "wb") as fh:
                fh.write(data)
            log(f"downloaded {rel}")

    finally:
        if args.keep:
            log(f"sandbox {sandbox.id} left running - remember to stop it, GPUs bill by the hour")
        else:
            # The filesystem is destroyed here. Everything needed is already local.
            sandbox.delete()
            log("sandbox deleted")


if __name__ == "__main__":
    main()
