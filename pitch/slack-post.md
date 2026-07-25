# Slack post — #hacksprint-sf-july

**We built LabPilot — an AI research assistant for the people fighting drug-resistant infections.** The bacteria that kill patients with severe pancreatitis come from their own gut, and ICU teams choose antibiotics against them with almost no view of what's actually resistant to what. The data exists; assembling it takes a bioinformatician a week, and most hospitals don't have one. LabPilot does it in an afternoon: it reads real pathogen genomics, analyses 34,466 proteins in 93 seconds on **Daytona's H100**, and lets a researcher just *ask* — in plain English, powered by **Fireworks** and **CopilotKit**. But the part we're proudest of is what it does when the data has nothing to say. Most AI tools, asked "which group is most resistant?", will confidently name one. Ours checked its own results, found no real signal, and now refuses the question — and tells you why. Give it data that genuinely has a pattern and it finds it instantly. **An AI that admits when it doesn't know is the only kind you can use for science.** 🧬

https://github.com/johnqh/daytona_hackathon

*(Also — if you're running anything on a Daytona GPU node, ping us. We hit a few sharp edges getting model weights in there and are happy to save you the hour.)*

---

## Shorter

**We built LabPilot — an AI research assistant for the people fighting drug-resistant infections.** It reads real pathogen genomics, analyses 34,466 proteins in 93 seconds on **Daytona's H100**, and lets a researcher just ask questions in plain English via **Fireworks** + **CopilotKit** — work that normally takes a bioinformatician a week. The part we're proudest of: asked "which group is most resistant?", most AI tools will confidently name one. Ours checked its own results, found no real signal, and refuses the question — then finds the pattern instantly when you give it data that actually has one. **An AI that admits when it doesn't know is the only kind you can use for science.** 🧬

https://github.com/johnqh/daytona_hackathon

---

## If someone asks about the GPU sharp edges (reply-in-thread material, not the main post)

The GPU sandbox couldn't reach `dl.fbaipublicfiles.com`, so the ESM2 weight download died partway with `[Errno 104] Connection reset by peer` every time — fix is to fetch the weights locally and push them onto a Volume, which survives sandbox deletion and makes later runs cache hits. Two neighbours: GPU sandboxes must be ephemeral (`auto_delete_interval=0`, hard-rejected otherwise), and `auto_stop_interval` defaults to 15 minutes and fires *mid-job*.
