import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without this, a stray lockfile
  // in a parent folder (e.g. the home directory) makes Next infer that folder
  // as the root, so Turbopack watches far too many files: huge memory use,
  // slow dev, and out-of-memory restarts ("cannot connect").
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
