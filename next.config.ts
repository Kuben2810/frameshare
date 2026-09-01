import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel packages Next.js output itself. Standalone output is only needed by
  // the Docker deployment and causes Vercel's post-build trace step to fail.
  output: process.env.VERCEL ? undefined : "standalone",
  turbopack: {
    root: process.cwd(),
  },
  serverExternalPackages: ["sharp", "archiver", "pg"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/gallery/:slug*",
        destination: "/g/:slug*",
      },
      {
        source: "/galleries/:slug*",
        destination: "/g/:slug*",
      },
    ];
  },
};

export default nextConfig;
