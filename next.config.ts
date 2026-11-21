
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 90],
  },
  async redirects() {
    return [
      { source: "/irevise", destination: "/work/irevise", permanent: true },
      { source: "/codynn", destination: "/work/codynn", permanent: true },
      { source: "/savvy", destination: "/work/em-collection", permanent: true },
      { source: "/xfogofwar", destination: "/work/xfog-of-war", permanent: true },
      { source: "/emcollection", destination: "/work/em-collection", permanent: true },
    ];
  },
};

export default nextConfig;
