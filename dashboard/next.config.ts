import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ~/projects carries its own lockfile, so Turbopack otherwise infers the
  // workspace root well above this app and resolves modules from there.
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
