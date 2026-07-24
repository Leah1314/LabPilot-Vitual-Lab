# Security Policy

## Research prototype disclaimer

This repository is a **hackathon research prototype**. It is **not** a medical
device, **not** validated for clinical decision-making, and **must not** be used
to guide patient care.

## Reporting a vulnerability

If you discover a security issue in this repository (for example, an SSRF risk
in a dashboard proxy, secret leakage, or dependency RCE):

1. **Do not** open a public GitHub issue with exploit details.
2. Email the repository maintainers via the GitHub profile contact on
   [johnqh](https://github.com/johnqh), or open a **private** security advisory
   on this repo if enabled.
3. Include: affected path, impact, and a minimal reproduction if possible.

## Secrets

- Never commit `.env`, API keys, or Daytona / Fireworks / Anthropic / Braintrust
  credentials. Templates live in `.env.example` files only.
- This repository is **public**. Assume anything pushed is world-readable.
- Rotate any key that may have been exposed.

## Scope notes

- `dashboard/app/api/datasource` proxies user-supplied URLs with intentional
  localhost allowance for local pipelines; link-local metadata IPs are blocked.
  Treat misconfiguration of that route as in-scope for reports.
- Pipeline scripts talk to BV-BRC and Daytona using keys from the environment;
  keep those keys out of logs and commits.
