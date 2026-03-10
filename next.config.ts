// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co", // This allows any Supabase project domain
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com", // Keeping this for your placeholders
      },
    ],
  },
};

export default nextConfig;
