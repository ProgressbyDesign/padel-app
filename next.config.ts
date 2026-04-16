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
