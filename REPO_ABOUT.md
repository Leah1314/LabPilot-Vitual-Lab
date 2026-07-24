# GitHub repository About settings

Canonical values for the **About** panel — description, website, topics — so the
repo sidebar, `ABOUT.md`, and `README.md` do not drift apart.

> Setting these needs **admin** on `johnqh/daytona_hackathon`. Push-only
> collaborators get a 404 from the API. Repo owner (`johnqh`) runs it once.

## Values

| Field | Value | Limit |
|---|---|---|
| **Description** | Gut-to-pancreas pathogen AMR dashboard: BV-BRC → Daytona H100 ESM2 clustering → grounded Fireworks/CopilotKit insights. Research prototype — not for clinical use. | 162 / 350 chars |
| **Website** | `https://github.com/johnqh/daytona_hackathon#quickstart-demo-with-committed-data` | — |
| **Topics** | `antimicrobial-resistance` `amr` `bioinformatics` `genomics` `bv-brc` `daytona` `fireworks-ai` `esm2` `protein-embeddings` `gpu` `copilotkit` `nextjs` `tanstack-start` `llm` `hackathon` | 15 / 20 topics |

GitHub truncates the description at 350 characters. Keep any rewrite under it,
and keep the not-for-clinical-use clause — it is the last thing that should be
cut for length.

## Apply

```bash
gh repo edit johnqh/daytona_hackathon \
  --description "Gut-to-pancreas pathogen AMR dashboard: BV-BRC → Daytona H100 ESM2 clustering → grounded Fireworks/CopilotKit insights. Research prototype — not for clinical use." \
  --homepage "https://github.com/johnqh/daytona_hackathon#quickstart-demo-with-committed-data" \
  --add-topic antimicrobial-resistance --add-topic amr \
  --add-topic bioinformatics --add-topic genomics --add-topic bv-brc \
  --add-topic daytona --add-topic fireworks-ai --add-topic esm2 \
  --add-topic protein-embeddings --add-topic gpu \
  --add-topic copilotkit --add-topic nextjs --add-topic tanstack-start \
  --add-topic llm --add-topic hackathon
```

By hand: **Settings → General → Repository details**.

## Why these topics

- `amr` and `antimicrobial-resistance` both stay. Redundant to read, but people
  search both, and topics are a discovery surface rather than prose.
- `tanstack-start` sits beside `nextjs` because the repo ships three frontends:
  `dashboard/` and `pathogen-pathfinder/` are Next.js, `Insight Uploader/` is
  TanStack Start.
- `braintrust` is deliberately absent — `eval/braintrust_results.json` reports
  `braintrust_api_key_present: false`, and tagging it would advertise an
  integration that has not run.
- To drop below ten, cut `amr`, `gpu`, `llm`, `hackathon` and
  `protein-embeddings` first.

In-repo About copy for humans and judges: [ABOUT.md](./ABOUT.md).
