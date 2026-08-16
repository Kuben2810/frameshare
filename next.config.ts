import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["sharp", "archiver", "pg"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Optimize for low-memory container environments
  experimental: {
    cpus: 1,
  },
};

export default nextConfig;
