import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "media.api-sports.io" },
      { hostname: "crests.football-data.org" },
    ],
  },
};

export default nextConfig;