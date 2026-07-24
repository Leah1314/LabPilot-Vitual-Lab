# GitHub repository About settings

Canonical values for the **About** panel — description, website, topics — so the
repo sidebar, `ABOUT.md`, and `README.md` do not drift apart.

> Setting these needs **admin** on `johnqh/daytona_hackathon`. Push-only
> collaborators get a 404 from the API. Repo owner (`johnqh`) runs it once.

## Values

| Field | Value | Limit |
|---|---|---|
| **Description** | Integrated AMR system for gut-derived pathogens in infected pancreatic necrosis: BV-BRC → Daytona H100 ESM2 → Fireworks → CopilotKit. Research prototype, not for clinical use. | ≤ 350 chars |
| **Website** | `https://github.com/johnqh/daytona_hackathon#full-stack-quickstart-use-all-the-tools` | — |
| **Topics** | `antimicrobial-resistance` `amr` `bioinformatics` `genomics` `bv-brc` `daytona` `fireworks-ai` `esm2` `protein-embeddings` `gpu` `copilotkit` `nextjs` `tanstack-start` `llm` `hackathon` | ≤ 20 topics |

GitHub truncates the description at 350 characters. Keep the not-for-clinical-use
clause — it is the last thing that should be cut for length.

## Apply

```bash
gh repo edit johnqh/daytona_hackathon \
  --description "Integrated AMR system for gut-derived pathogens in infected pancreatic necrosis: BV-BRC → Daytona H100 ESM2 → Fireworks → CopilotKit. Research prototype, not for clinical use." \
  --homepage "https://github.com/johnqh/daytona_hackathon#full-stack-quickstart-use-all-the-tools" \
  --add-topic antimicrobial-resistance --add-topic amr \
  --add-topic bioinformatics --add-topic genomics --add-topic bv-brc \
  --add-topic daytona --add-topic fireworks-ai --add-topic esm2 \
  --add-topic protein-embeddings --add-topic gpu \
  --add-topic copilotkit --add-topic nextjs --add-topic tanstack-start \
  --add-topic llm --add-topic hackathon
```

By hand: **Settings → General → Repository details**.

## Why these topics

- `amr` and `antimicrobial-resistance` both stay — people search both.
- `daytona`, `fireworks-ai`, `copilotkit`, `esm2` name the live sponsor stack.
- `tanstack-start` sits beside `nextjs` because three UIs share the contracts:
  `dashboard/` and `pathogen-pathfinder/` (Next.js) plus `Insight Uploader/`
  (TanStack Start).
- Add `braintrust` once remote Braintrust logging is wired; today faithfulness
  is written locally to `eval/braintrust_results.json`.

In-repo About copy: [ABOUT.md](./ABOUT.md).
