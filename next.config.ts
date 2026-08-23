import path from "node:path";
import type { NextConfig } from "next";

const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  // A package-lock.json in C:\Users\matth otherwise makes Next/Turbopack
  // treat the home directory as the workspace root, so @import "tailwindcss"
  // resolves outside this repo.
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "maps.googleapis.com",
        pathname: "/maps/api/place/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
        {
      protocol: 'https',
      hostname: 'uebhforyugmvpqvkzrbt.supabase.co',
    },
    ],
  },
  async rewrites() {
  return [
    {
      source: "/images/:path*",
      destination:
        "https://uebhforyugmvpqvkzrbt.supabase.co/storage/v1/object/public/images/:path*",
    },
  ];
}
};

export default nextConfig;
