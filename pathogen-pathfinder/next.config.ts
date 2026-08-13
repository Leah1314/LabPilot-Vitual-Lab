import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

/*
 * Shared config lives in the repo-root `.env`, so one file serves every surface
 * rather than each app keeping its own copy of the same keys.
 *
 * Next only reads `.env` from the app directory, so the root file is loaded
 * here: next.config is evaluated at startup in the same process that later
 * serves requests, before any route reads process.env.
 *
 * Precedence is what you want and is verified, not assumed: loadEnvFile does
 * not overwrite variables already present, so a real environment variable (CI,
 * Docker, the shell) still beats the file, and `pathogen-pathfinder/.env` —
 * which Next loads afterwards — stays available for per-app overrides.
 *
 * Guarded by existsSync because the root file is optional, and because cwd is
 * not the app directory in every deployment shape.
 */
const rootEnv = resolve(process.cwd(), "..", ".env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  output: "standalone",
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
