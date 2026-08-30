import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
