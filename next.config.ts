import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
