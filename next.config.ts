// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co", // This allows any Supabase project domain
      },
      {
        protocol: "https",
        hostname: "**.r2.dev", // Cloudflare R2 public development domains
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com", // Keeping this for your placeholders
      },
    ],
  },
};

export default nextConfig;
