import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/** Repo root. `packages/config/chains.json` lives above `web/`, so the bundler needs it. */
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Network parameters and deployed addresses live in packages/config/chains.json, which
  // is shared with the contracts side. Pointing the bundler at the repo root keeps that
  // one file the single source of truth instead of maintaining a second copy in here
  // that can silently drift.
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,

  // Dev only. Next blocks cross-origin requests to /_next/* by default, and it treats
  // 127.0.0.1 as a different origin from localhost — which silently 403s every chunk when
  // the browser (or a headless smoke test) uses the numeric form.
  allowedDevOrigins: ["127.0.0.1", "localhost", "[::1]"],

  // The interface never renders user-supplied HTML, and every remote asset a school points
  // at is untrusted by definition. Logos and banners go through a plain <img> so the fetch
  // happens in the visitor's browser — a school cannot make our server request arbitrary
  // URLs on its behalf.
  images: { unoptimized: true },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
