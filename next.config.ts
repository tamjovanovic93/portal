import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without this, a stray
  // /Users/user/package-lock.json makes Next infer the home folder as the root,
  // so Turbopack watches the entire home directory — huge memory use, slow
  // dev, and out-of-memory restarts ("cannot connect").
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
