import type { NextConfig } from "next";

// Set only by .github/workflows/gh-pages.yml. GitHub Pages serves static files
// and nothing else, so that build also deletes src/app/api before running —
// POST/PATCH/DELETE handlers cannot be exported, and the agent has no server to
// run on regardless. The default build stays `standalone` for Docker.
const staticExport = process.env.STATIC_EXPORT === "1";

// A project page is served from a subdirectory named after the repo, so every
// asset URL needs the prefix. "Vitual" is the upstream repo's own misspelling —
// it must match exactly or the deployed site 404s on all of its assets.
const REPO_BASE_PATH = "/LabPilot-Vitual-Lab";

const nextConfig: NextConfig = {
  output: staticExport ? "export" : "standalone",
  // trailingSlash so /dashboard resolves to /dashboard/index.html on a host
  // with no rewrite rules. Left off the server build, which routes for itself.
  ...(staticExport ? { basePath: REPO_BASE_PATH, trailingSlash: true } : {}),
  serverExternalPackages: ["@copilotkit/runtime"],
  env: {
    // The public Threads UI flag is DERIVED from the server-side license token.
    // Set COPILOTKIT_LICENSE_TOKEN (only) to enable Threads — do not set this flag
    // directly. NOTE: NEXT_PUBLIC_* resolves at BUILD time while the runtime reads
    // the token per-request, so the UI gate and runtime agree only when the token is
    // present at build time (the standard `next dev` / host-build flow). For a
    // standalone/Docker image built without the token and injected at runtime, set
    // COPILOTKIT_LICENSE_TOKEN at build time too (or gate the UI at runtime) so the
    // baked flag reflects it.
    NEXT_PUBLIC_COPILOTKIT_THREADS_ENABLED: process.env.COPILOTKIT_LICENSE_TOKEN
      ? "true"
      : "false",
  },
  typescript: {
    // Docker route override uses HttpAgent which has a type mismatch with CopilotRuntime
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
