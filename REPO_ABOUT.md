# GitHub repository About settings

The GitHub **About** panel (description, website, topics) requires **admin** on
`johnqh/daytona_hackathon`. Collaborators with push-only access cannot set it via
API (GitHub returns 404).

Repo owner (`johnqh`) — run once:

```bash
gh repo edit johnqh/daytona_hackathon \
  --description "Gut-to-pancreas pathogen AMR dashboard: BV-BRC → Daytona H100 ESM2 clustering → grounded Fireworks/CopilotKit insights. Research prototype — not for clinical use." \
  --homepage "https://github.com/johnqh/daytona_hackathon#quickstart-demo-with-committed-data" \
  --add-topic amr \
  --add-topic pathogen \
  --add-topic bv-brc \
  --add-topic daytona \
  --add-topic esm2 \
  --add-topic copilotkit \
  --add-topic fireworks-ai \
  --add-topic nextjs \
  --add-topic bioinformatics \
  --add-topic hackathon \
  --add-topic antimicrobial-resistance \
  --add-topic gpu
```

Or in the GitHub UI: **Settings → General → Repository details**

Suggested fields:

| Field | Value |
|---|---|
| **Description** | Gut-to-pancreas pathogen AMR dashboard: BV-BRC → Daytona H100 ESM2 clustering → grounded Fireworks/CopilotKit insights. Research prototype — not for clinical use. |
| **Website** | `https://github.com/johnqh/daytona_hackathon#quickstart-demo-with-committed-data` |
| **Topics** | `amr`, `pathogen`, `bv-brc`, `daytona`, `esm2`, `copilotkit`, `fireworks-ai`, `nextjs`, `bioinformatics`, `hackathon`, `antimicrobial-resistance`, `gpu` |

In-repo About copy for humans/judges: [ABOUT.md](./ABOUT.md).
