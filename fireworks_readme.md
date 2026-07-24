# Fireworks Step B and Dashboard Deployment

This repo deploys the Next.js dashboard from `daytona_hackathon/dashboard`.
Fireworks is used server-side for CopilotKit chat and for regenerating Step B
observations. Never commit API keys.

## 1. Local setup

From the hackathon repo root:

```bash
cd /Users/johnhuang/projects/daytona_hackathon
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-step-b.txt
```

Create the dashboard env file:

```bash
cd /Users/johnhuang/projects/daytona_hackathon/dashboard
cp .env.example .env.local
```

Edit `dashboard/.env.local`:

```bash
FIREWORKS_API_KEY=your_fireworks_key_here
FIREWORKS_MODEL=accounts/fireworks/models/deepseek-v4-flash
COPILOTKIT_TELEMETRY_DISABLED=true
```

Optional, only when the Daytona API is running:

```bash
PIPELINE_URL=https://your-daytona-api-url
```

If `PIPELINE_URL` is unset, the dashboard uses the static JSON fixtures in
`dashboard/data/`.

## 2. Generate Step B outputs

From the hackathon repo root:

```bash
cd /Users/johnhuang/projects/daytona_hackathon
.venv/bin/python scripts/generate_observations.py --require-fireworks
```

Expected outputs:

```text
data/cluster_summary.json
insights/observations.json
eval/braintrust_results.json
```

If Part A has not produced `data/cluster_summary.json`, the script falls back to
`dashboard/data/cluster_summary.json`.

Sync the generated Part B data into the dashboard:

```bash
cd /Users/johnhuang/projects/daytona_hackathon/dashboard
bun run sync-data
```

## 3. Validate before deploy

```bash
cd /Users/johnhuang/projects/daytona_hackathon
.venv/bin/python -m json.tool insights/observations.json >/dev/null
.venv/bin/python -m json.tool eval/braintrust_results.json >/dev/null

cd dashboard
bun run typecheck
bun run build
```

## 4. Deploy to Vercel

From the dashboard directory:

```bash
cd /Users/johnhuang/projects/daytona_hackathon/dashboard
bunx vercel
```

Use these settings if prompted:

```text
Framework: Next.js
Root directory: daytona_hackathon/dashboard
Build command: bun run build
Output directory: .next
Install command: bun install
```

Add these environment variables in the Vercel project settings:

```text
FIREWORKS_API_KEY=your_fireworks_key_here
FIREWORKS_MODEL=accounts/fireworks/models/deepseek-v4-flash
COPILOTKIT_TELEMETRY_DISABLED=true
```

Optional:

```text
PIPELINE_URL=https://your-daytona-api-url
```

Deploy production:

```bash
bunx vercel --prod
```

## 5. Demo checks

After deploy:

- Open the Vercel URL and confirm cluster cards render.
- Confirm the pipeline readout shows the eval score from
  `insights/observations.json`.
- Ask the Copilot panel a grounded question, such as:
  `What is resistant in cluster 0?`
- If `PIPELINE_URL` is unset, the header should read `MOCK`.
- If `PIPELINE_URL` is set and reachable, the header should read `LIVE`.

## 6. Troubleshooting

If Fireworks calls fail locally, verify the key is visible to the process:

```bash
cd /Users/johnhuang/projects/daytona_hackathon
test -n "$FIREWORKS_API_KEY" && echo set || echo missing
```

If the key is only in `dashboard/.env.local`, either export it before running
the Step B script or run the script from the repo root; it automatically loads
`.env`, `.env.local`, `dashboard/.env`, and `dashboard/.env.local`.

If the deployed chat fails, confirm `FIREWORKS_API_KEY` is set in Vercel and is
not prefixed with `NEXT_PUBLIC_`.
