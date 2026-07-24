# Fireworks AI — Model Hosting and Observation Generation

**Owner: LLM layer.** You turn computed statistics into readable, trustworthy English.
**Catalog verified 2026-07-24.** See [prompt.md](./prompt.md) for the brief.

Your deliverable is a function that takes a statistics JSON from the Daytona API
and returns an observation card that a microbiologist would not object to.

---

## 1. Connection

Fireworks is OpenAI-compatible, so use the stock OpenAI SDK — there is no
Fireworks-specific client to learn.

- Base URL: `https://api.fireworks.ai/inference/v1`
- Auth: `Authorization: Bearer $FIREWORKS_API_KEY`
- Model IDs: `accounts/fireworks/models/{name}`

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url="https://api.fireworks.ai/inference/v1",
    api_key=os.environ["FIREWORKS_API_KEY"],
)

resp = client.chat.completions.create(
    model="accounts/fireworks/models/deepseek-v4-pro",
    messages=[{"role": "system", "content": SYSTEM_PROMPT},
              {"role": "user", "content": json.dumps(stats)}],
    temperature=0.1,
)
```

```ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.fireworks.ai/inference/v1",
  apiKey: process.env.FIREWORKS_API_KEY,
});
```

Get an API key at https://app.fireworks.ai/settings/users/api-keys.

---

## 2. Model choice

**Primary: `accounts/fireworks/models/deepseek-v4-pro`**

1.6T MoE, **1,048,576-token context**, open weights, confirmed function calling.
Pricing per 1M tokens: **$1.74 uncached input / $0.145 cached input / $3.48 output**.

The cached-input rate is a **12x discount rather than the usual 2x**, and that
shapes the architecture. Your system prompt, grounding rules, and gene reference
tables are a large static prefix resent on every call — after the first request
they cost almost nothing. Put the stable material at the *front* of the prompt so
it caches, and the varying statistics JSON at the end.

**Fallback: `accounts/fireworks/models/deepseek-v4-flash`**

284B MoE, same 1M context, same family and prompt formatting, open weights, and
**12x cheaper** at $0.14 / $0.028 / $0.28. Architecturally a sibling, so you can
switch with no prompt rework. Use Flash for routine card generation and Pro for
anything requiring careful hedging.

**Budget floor: `accounts/fireworks/models/gpt-oss-120b`** — 116B MoE, 131k
context, Apache 2.0, $0.15 / $0.60. Fine for classification or routing sidecars.

Other open options if you need them: `glm-5p2` (743B, 1M ctx, $4.40/M output),
`kimi-k2p6` (1.028T, 262k ctx, $4.00/M output).

### Two exclusions that matter

- **Do not use `qwen3p7-plus`.** It is cheap, fast, and serverless — and it is
  Alibaba's **closed-weights** flagship, exclusive to Fireworks. It fails an
  open-source requirement.
- **Llama 4 is gone** from the catalog entirely; Scout and Maverick were removed.
  The newest Llama is `llama-v3p3-70b-instruct` (131k ctx).

Verify the live catalog before committing — it moves fast:

```bash
curl -H "Authorization: Bearer $FIREWORKS_API_KEY" \
     https://api.fireworks.ai/inference/v1/models
```

---

## 3. The account limit that will break your demo

**Without a payment method on file, you are capped at 10 requests per minute.**
With one, the account-wide limit is 6,000 RPM. New accounts get $1 in free credits.

**Add a payment method before the demo.** It is a five-minute task that will
otherwise ruin your last ten minutes. Ten RPM does not survive a live audience
clicking around a dashboard.

Batch inference bills at 50% of serverless if you pre-generate cards.

---

## 4. Structured output and tool calling

Function calling is confirmed on both DeepSeek V4 models. `tool_choice` accepts
`"auto"` (default), `"none"`, `"required"`, or a specific function object.

Structured output has three modes via `response_format`:

```python
response_format={"type": "json_object"}
response_format={"type": "json_schema", "json_schema": {"name": "Obs", "schema": {...}}}
response_format={"type": "grammar", "grammar": bnf_string}
```

JSON Schema 2020-12 constructs are supported; **external URL `$ref`s are not**.

> **Gotcha:** using `response_format` on a **reasoning model disables reasoning
> output**, and DeepSeek V4 Pro is one. If you want both careful reasoning and a
> constrained shape, **use tool calling instead** — it enforces a schema without
> suppressing reasoning. Also restate the expected JSON in the prompt text, or
> the model can emit whitespace until it hits `max_tokens`.

---

## 5. The observation generator — grounding rules

This is the part that determines whether the project is credible. The LLM's only
job is to turn computed statistics into readable English. **It must never
generate a number.**

Encode these in the system prompt and verify them in the Braintrust eval:

1. **Every numeric claim must be copied verbatim** from the JSON supplied. Pass
   statistics as structured data and instruct the model to quote, never infer,
   never round, never recompute.
2. **Always state the deduplicated strain count** alongside any percentage. A
   percentage without its denominator is the thing that makes these dashboards
   misleading.
3. **Flag single-country or single-year patterns** as possible outbreak artefacts
   rather than general findings. The Daytona API returns `n_countries` and
   `year_range` for exactly this purpose — use them.
4. **No speculation** about mechanism, causation, or clinical significance.
   Co-occurrence is not linkage and is not causation.
5. **Never recommend an antibiotic** for a patient, and never phrase output as
   clinical advice.
6. Distinguish laboratory-measured phenotypes from computational annotations
   whenever both appear.

Every observation card carries a research-prototype disclaimer.

### Prompt shape

```
[STATIC, CACHED PREFIX]
  role + grounding rules above
  gene/abbreviation reference table
  worked example of a good observation and a bad one

[VARYING SUFFIX]
  the statistics JSON for this card
```

Keep `temperature` low (0.1–0.2). You want faithful restatement, not prose variety.

### Failure handling

If the tool call to the Daytona API fails, the model must **surface the failure**,
not answer from memory. An LLM confidently inventing resistance statistics is the
worst possible failure mode for this product. Test this path deliberately.

---

## 6. Traps

1. **No payment method → 10 RPM.** Will not survive the demo.
2. `qwen3p7-plus` — closed weights.
3. `response_format` on DeepSeek V4 Pro silently disabling reasoning; prefer tool
   calling.
4. Putting the varying statistics at the *front* of the prompt, defeating the 12x
   prompt-cache discount.
5. Letting the model compute, round, or recompute any number.
6. Letting the model answer when the tool call failed.
7. Assuming Llama 4 is available — it is not.
