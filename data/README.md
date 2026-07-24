# Sample / fixture dataset

Committed outputs from a completed LabPilot pipeline run so the UI and demos
boot without re-billing GPU/LLM.

| File | What it is |
|---|---|
| `sequences.csv` | 34,466 protein sequences (cohort proteins) |
| `bvbrc_amr.csv` | Lab-filtered AMR phenotype calls |
| `bvbrc_spgene.csv` | Speciality gene / AMR+virulence annotations |
| `bvbrc_metadata.csv` | Genome host / source / geography metadata |
| `gene_clusters.csv` | Per-gene cluster assignments |
| `cluster_summary.json` | Contract 1 — cluster stats for the UI |
| `cluster_enrichment.json` | Honesty gate (phenotype signal check) |
| `cohort_meta.json` | Cohort provenance |
| `timing.json` | Measured H100 embed timing (93.0s) |

**Not committed:** `embeddings.npy` (large, regenerable on Daytona).

**Research fixture — not for clinical use.**
