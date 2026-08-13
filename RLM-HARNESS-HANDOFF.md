# Proposed RLM Harness for LabPilot Virtual Lab

## Context and ownership

This document describes **Prateek's proposed addition** to LabPilot Virtual Lab.
It is not a description of functionality already implemented by the original
LabPilot project creator, and it should not be read as claiming ownership of the
existing dashboard, APIs, experimental model, or product direction.

LabPilot already provides the virtual-lab workflow and API connections. My
separate contribution is a governed Recursive Language Model (RLM) harness that
could operate across those capabilities without replacing them.

## The idea

The proposed addition is a **Virtual Lab Run Engine**.

Instead of asking one model to absorb the entire lab state and return a single
answer, a bounded root model decomposes a scientific objective into smaller
investigations. Each child receives only the relevant API results. The root then
synthesizes their findings into one evidence-linked lab-run receipt.

Example objective:

> Find the next experiment that most reduces uncertainty without leaving the
> measured evidence boundary.

Example recursive run:

```text
Scientific objective
├── Evidence branch
│   └── inspect experiment observations and provenance
├── Model branch
│   └── inspect deterministic analysis and virtual simulations
├── Skeptic branch
│   └── test alternatives, sensitivity, and counter-evidence
└── Operations branch
    └── check whether the proposed experiment is executable
```

The final output is not merely a chat answer. It is a **Lab Run Receipt** containing:

- the scientific objective;
- APIs and evidence consulted;
- delegated questions and branch findings;
- simulations or robustness checks performed;
- the proposed next experiment;
- the strongest counterargument;
- unresolved uncertainty and limitations;
- evidence references and an ordered execution trace;
- an explicit requirement for human approval.

## What I am bringing from my separate RLM work

I have separately built and run a small RLM harness with these properties:

- bounded recursion depth, model calls, tool calls, time, and approximate tokens;
- caller-supplied tools rather than unrestricted model side effects;
- child delegation with compact results returned to the root;
- an append-only JSONL event ledger covering model, child, and tool activity;
- deterministic terminal grading performed outside the model;
- evidence references carried into a content-addressed result receipt.

That implementation was developed in another project. It is a reference for the
control pattern, not functionality that should be assumed to exist in LabPilot.

## How it could use LabPilot's existing capabilities

The current LabPilot APIs can be exposed to the harness as typed capabilities:

```text
get_experiment       -> existing experiment state
load_datasource      -> connected evidence and provenance
analyze_experiment   -> deterministic model analysis
simulate_candidate   -> bounded virtual prediction
compare_candidates   -> deterministic comparison or sensitivity checks
propose_experiment   -> a proposal only, with no side effect
```

The harness should consume structured API results, not credentials or arbitrary
URLs. Authentication, validation, budgets, and side effects remain owned by the
LabPilot application.

## Authority boundary

The RLM may investigate, compare, challenge, and propose. It must not:

- generate or alter measured observations;
- replace deterministic numerical analysis;
- represent a virtual prediction as a laboratory measurement;
- approve its own recommendation;
- directly persist or schedule an experiment;
- bypass the existing human-approval step.

The existing experiment-planning endpoint remains outside model authority. The
harness may propose a call, but a scientist must explicitly approve it before the
application performs the mutation.

## Why this is additive

LabPilot remains the source of experiment state, numerical analysis, simulation,
approval, and persistence. The RLM harness adds a recursive investigation layer
over those capabilities:

```text
LabPilot today
observations -> analysis -> simulation -> recommendation -> human approval

Proposed addition
observations -> bounded recursive investigation -> traceable receipt
             -> recommendation -> human approval
```

The intended value is context distribution and traceability across a larger
virtual lab. It is not a request to rewrite the dashboard around a new agent
framework.

## Suggested first joint slice

Give the harness one existing candidate experiment and ask it to both support and
challenge that candidate using only current read-only APIs. Return one receipt next
to the existing approval control. Keep every existing direct route operational.

That slice is enough to determine whether recursive investigation adds useful
scientific decision support before expanding the integration.
