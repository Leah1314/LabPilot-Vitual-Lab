# Slack post — #hacksprint-sf-july

**LabPilot** — we pulled real antimicrobial-resistance data from BV-BRC for the gut-derived pathogens behind infected pancreatic necrosis, then ran ESM2 protein embeddings on a **Daytona H100**: 34,466 proteins in **93.0 s** (370 seq/s), against 5 seq/s measured on our own CPU — a 74x speedup that turned a two-hour step into a 90-second one. Then the interesting part: we checked whether the resulting clusters actually separate resistant from susceptible isolates, and **they don't** — every cluster reproduces the corpus base rate to within 11% — so instead of shipping a pretty "resistance cluster" chart we made that verdict a hard runtime gate, and the CopilotKit + Fireworks agent is now structurally unable to claim a resistance link the arithmetic doesn't support (swap in a dataset that *does* have signal and the same agent finds it immediately). One gotcha worth sharing for anyone else on GPU sandboxes: **the GPU sandbox couldn't reach `dl.fbaipublicfiles.com`** — the ESM2 weight download died partway with `[Errno 104] Connection reset by peer` every time — so we fetch the weights locally and push them onto a **Volume**, which survives sandbox deletion and makes every later run a cache hit. Two neighbours of that same bug also cost us time: GPU sandboxes are **required** to be ephemeral (`auto_delete_interval=0`, hard-rejected otherwise), and `auto_stop_interval` defaults to 15 minutes and **fires mid-job**, so a long embedding run dies silently at minute 15 unless you set it to 0.

https://github.com/johnqh/daytona_hackathon

---

## Shorter variant (if the above is too long for the channel)

**LabPilot** — real BV-BRC antimicrobial-resistance data → ESM2 embeddings on a **Daytona H100**: 34,466 proteins in **93.0 s**, vs 5 seq/s on our CPU (74x). The headline finding is a negative one — the clusters carry no resistance signal — so we made that a hard runtime gate, and the CopilotKit + Fireworks agent literally can't claim a link the arithmetic doesn't support. One gotcha for anyone else using GPU sandboxes: **ours couldn't reach `dl.fbaipublicfiles.com`** and the ESM2 weight download died with `[Errno 104] Connection reset by peer`, so we push the weights onto a **Volume** instead (survives deletion, later runs are cache hits). Also worth knowing: GPU sandboxes must be ephemeral (`auto_delete_interval=0`), and `auto_stop_interval` defaults to 15 min and fires *mid-job*.

https://github.com/johnqh/daytona_hackathon
