# Fireworks — Hosting an Open-Source Model

**Owner: LLM layer.** Your deliverable is a model endpoint the dashboard can call,
running open weights, with a model ID you can paste into the CopilotKit runtime.
**All facts verified live 2026-07-24**, including against the `firectl` 1.7.29
binary. See [fireworks.md](./fireworks.md) for prompt design and grounding rules —
this doc is only about getting a model *hosted*.

---

## 1. Pick a hosting mode before you type anything

Fireworks has three, and they are not interchangeable.

| Mode | What it is | Billing | Use when |
|---|---|---|---|
| **Serverless** | Fireworks already hosts the model | Per token | Default. Zero setup. |
| **On-demand** | Dedicated GPU replicas of a catalog model | Per GPU-second | You need predictable latency or a model that is not serverless |
| **Custom upload** | Your own or a HuggingFace checkpoint, deployed on-demand | Per GPU-second | The model is not in the catalog at all |

**Start serverless.** It requires no GPUs, no waiting, and no teardown, and
`gpt-oss-120b` — Apache-2.0, genuinely open weights, 131k context, function
calling, $0.15/$0.60 per 1M tokens — is available serverless today. If serverless
covers you, skip to §5 and spend the saved hour on the dashboard.

Move to on-demand only for a concrete reason: a demo that must not contend for
shared capacity, or a model whose weights you need to control. Custom base models
and LoRA adapters **can only run on dedicated deployments** — serverless LoRA
hosting no longer exists, so any tutorial describing it is obsolete.

---

## 2. firectl

```bash
brew tap fw-ai/firectl && brew install firectl        # macOS

# Linux
wget -O firectl.gz https://storage.googleapis.com/fireworks-public/firectl/stable/linux-amd64.gz
gunzip firectl.gz && sudo install firectl /usr/local/bin/

firectl signin        # browser OAuth; `firectl signin <ACCOUNT_ID>` for SSO
firectl whoami
firectl version       # 1.7.29 as of 2026-07-24
```

Non-interactive auth: the global flags `--api-key <key>` and `-a/--account-id`,
or `firectl set-api-key`, which writes `~/.fireworks/auth.ini`.

> **The CLI is noun-verb**: `firectl deployment create`, `firectl model create`.
> The `firectl create deployment` form in older blog posts and tutorials no
> longer parses. This will be the first thing that bites you if you copy from a
> search result.

There is no public source repo for `firectl` — it ships as a binary from a GCS
bucket, and the `fw-ai/homebrew-firectl` tap holds only the formula.

---

## 3. On-demand deployment of a catalog model

```bash
firectl deployment create accounts/fireworks/models/gpt-oss-120b \
        --deployment-shape fast \
        --accelerator-type NVIDIA_H100_80GB \
        --accelerator-count 1 \
        --min-replica-count 0 \
        --max-replica-count 1 \
        --scale-up-window 30s \
        --scale-down-window 5m \
        --scale-to-zero-window 5m \
        --wait
```

`--wait` blocks until `State: READY`. Without it, poll:

```bash
firectl deployment list
firectl deployment get <DEPLOYMENT_ID>
```

**Flags that matter**, taken from the 1.7.29 binary rather than the docs:

- `--accelerator-type` accepts exactly `NVIDIA_A100_80GB`, `NVIDIA_H100_80GB`,
  `NVIDIA_H200_141GB`, `AMD_MI300X_192GB`. **B200 is on the pricing page but not
  in the CLI enum** — do not plan around it.
- `--deployment-shape` presets: `fast` (low latency), `throughput`, `minimal`.
  For a chat dashboard you want `fast`.
- `--min-replica-count 0` enables scale-to-zero. `--scale-to-zero-window`
  defaults to **1h**; set it to `5m` unless you enjoy paying for an idle H100.
- `--precision` accepts `FP8`, `FP16`, `FP4`, `BF16`.
- Speculative decoding is **on by default** with an automatic drafter. Tune with
  `--draft-model` / `--draft-token-count` (typically 4) or
  `--ngram-speculation-length` (mutually exclusive with `--draft-model`).
- `--enable-addons` turns on LoRA addons and is **incompatible with FP8/FP4** —
  BF16 only.
- `--max-concurrency-per-replica` — requests beyond it get HTTP 429.

### Calling the deployment

The model ID for inference is the composed form:

```
accounts/fireworks/models/gpt-oss-120b#accounts/<ACCOUNT_ID>/deployments/<DEPLOYMENT_ID>
```

`accounts/<ACCOUNT_ID>/deployments/<DEPLOYMENT_ID>` alone also works as the
`model` parameter. Put whichever you use in `FIREWORKS_MODEL` as an env var —
the dashboard should never have this string hard-coded, because you will switch
models under time pressure.

---

## 4. Uploading your own open-weights model

Only do this if the model genuinely is not in the catalog. There is **no direct
HuggingFace pull** — you download the checkpoint yourself, then upload.

```bash
hf download <org>/<model> --local-dir ./ckpt

firectl model create my-model ./ckpt
firectl model get accounts/<ACCOUNT_ID>/models/my-model      # wait for State: READY
firectl deployment create accounts/<ACCOUNT_ID>/models/my-model --wait
```

Cloud-staged sources work too:

```bash
firectl model create my-model s3://bucket/path --role-arn arn:aws:iam::123456789012:role/MyRole
firectl model create my-lora  gs://bucket/path --base-model accounts/fireworks/models/base-model
```

`--hugging-face-url` only records the URL as metadata for managed fine-tuning; it
does **not** fetch weights.

**Required files:** `config.json`, `*.safetensors` (or `*.bin`) plus
`*.index.json`, and `tokenizer.json` / `tokenizer.model`.

**Supported architectures:** Llama 1–4, Qwen (incl. Qwen3 and Qwen2.5-VL),
DeepSeek V1–V3, Mistral/Mixtral, Gemma, Phi, Falcon, DBRX, and others.

**A `quantization_config` block in `config.json` is not supported.** Upload
FP16/BF16 weights and quantize at deploy time with `--precision FP8` or `FP4`.
Quantized serving is H100-class hardware.

Useful flags: `--supports-tools`, `--supports-image-input`, `--embedding`,
`--public=false`, `--enable-resumable-upload`.

> **Not documented anywhere I could find:** maximum model size and expected
> upload duration. The import poll duration defaults to 2h, which tells you what
> scale they expect. A 70B checkpoint is hundreds of gigabytes. **In a four-hour
> hackathon, uploading a custom base model is a bad bet** — use a catalog model
> unless the custom weights are the point of the project.

### LoRA adapters

- **Live merge** (recommended, one adapter, zero serving overhead):
  `firectl deployment create accounts/<ACCOUNT_ID>/models/<FINE_TUNED_MODEL_ID>`
- **Multi-LoRA**: create the base deployment with `--enable-addons`, then
  `firectl load-lora <MODEL_ID> --deployment <DEPLOYMENT_ID>`
- LoRA rank must be between 4 and 64. Tier 1 includes 100 LoRA slots.

---

## 5. Inference

OpenAI-compatible, so use the stock OpenAI SDK — there is no Fireworks client to
learn.

```python
import os
from openai import OpenAI

client = OpenAI(api_key=os.environ["FIREWORKS_API_KEY"],
                base_url="https://api.fireworks.ai/inference/v1")

resp = client.chat.completions.create(
    model=os.environ["FIREWORKS_MODEL"],
    messages=[{"role": "system", "content": SYSTEM_PROMPT},
              {"role": "user", "content": json.dumps(stats)}],
    temperature=0.1,
    response_format={"type": "json_schema", "json_schema": {...}},
)
```

Structured output supports JSON mode with JSON Schema 2020-12 enforced during
generation, and BNF grammar mode. External URL `$ref`s are not supported.

> **Gotcha carried over from [fireworks.md](./fireworks.md):** `response_format`
> on a *reasoning* model disables reasoning output. If you want both careful
> reasoning and a constrained shape, use tool calling instead — it enforces a
> schema without suppressing reasoning. Restate the expected JSON in the prompt
> text either way, or the model can emit whitespace until `max_tokens`.

Confirm the live catalog before committing to a model ID — it moves fast:

```bash
curl -H "Authorization: Bearer $FIREWORKS_API_KEY" \
     https://api.fireworks.ai/inference/v1/models
```

### Open-weights model picks

- **`accounts/fireworks/models/gpt-oss-120b`** — the default. Apache-2.0,
  serverless, 131k context, function calling, $0.15/$0.60 per 1M. Fireworks uses
  it in their own on-demand quickstart.
- **`gpt-oss-20b`** — $0.07/$0.30, when you want cheaper and faster.
- `deepseek-v4-flash` ($0.14/$0.28) is attractive for structured output and
  shares prompt formatting with `deepseek-v4-pro`, so switching between them
  needs no prompt rework.

> **Verify the license on the model's library page before claiming "open
> source" on stage.** The 2026-generation catalog headliners (Kimi K2.6/K2.7,
> GLM 5.1/5.2, MiniMax M3, Nemotron 3 Ultra, DeepSeek V4) mostly descend from
> open-weights lineages, but I could not confirm each current model's license
> individually. `gpt-oss-*` is the one I can state as Apache-2.0 without
> qualification.
>
> **Do not use `qwen3p7-plus`** — cheap, fast, serverless, and Alibaba's
> **closed-weights** flagship. It fails an open-source requirement.
>
> **Llama 4 is gone** from the catalog. The newest Llama is
> `llama-v3p3-70b-instruct` (131k context).

---

## 6. Cost control and teardown

```bash
firectl deployment delete <DEPLOYMENT_ID>       # aliases: rm, remove
```

Published on-demand rates: **H100 80GB $7.00/hr, H200 141GB $7.00/hr, B200
$10.00/hr, B300 $12.00/hr** per GPU, billed per GPU-second with no charge for
start-up time. A100 and MI300X prices are not published. Deployments with
`--min-replica-count 0` are auto-deleted after 7 days of no traffic — that is a
cleanup mechanism, not a cost control. **Delete deployments when you stop
demoing.**

Serverless is per-token, with a 50% discount on cached input and 50% off batch.

---

## 7. Account limits that will break the demo

**A valid payment method and billing profile are required for Tier 1**, which is
where new accounts land. Free serverless credits are $1. Default on-demand quota
is 8 GPUs per accelerator type plus 100 LoRA slots, with a $50/month budget cap
at Tier 1.

Serverless rate limits are adaptive per account per model: 21.6M total prompt
TPM, 5.4M uncached prompt TPM, 216k generated TPM, growing with spend tier.

**Add the payment method before the demo, not during it.** It is a five-minute
task that otherwise ruins your last ten minutes.

---

## 8. Traps

1. `firectl create deployment` — wrong word order, the CLI is noun-verb.
2. No payment method on file. Tier 1 requires one; the free credit is $1.
3. `--scale-to-zero-window` left at its **1h** default, burning GPU-hours on idle.
4. Forgetting `firectl deployment delete` after the demo.
5. Scale-from-zero returns **HTTP 503** while spinning up — the client needs
   retry logic, and cold-start duration is not documented.
6. `--enable-addons` combined with FP8/FP4 — incompatible, BF16 only.
7. `quantization_config` left in a custom `config.json` — unsupported; quantize
   with `--precision` at deploy.
8. Planning around B200 via `--accelerator-type` — it is not in the CLI enum.
9. Uploading a large custom checkpoint during a four-hour hackathon.
10. Calling a model "open source" without checking its license page.
11. Hard-coding the model ID instead of reading `FIREWORKS_MODEL` from env.
