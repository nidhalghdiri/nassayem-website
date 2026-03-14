import { MetadataRoute } from "next";
import prisma from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://www.nassayem.com";

  // 1. Define your static routes
  const staticRoutes = [
    "",
    "/faq",
    "/terms",
    "/privacy",
    "/delivery",
    "/refunds",
    "/contact",
  ].map((route) => ({
    url: `${baseUrl}/en${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: route === "" ? 1.0 : 0.5,
  }));

  // 2. Fetch all active units from Prisma
  // (Adjust 'unit' to match your Prisma schema)
  const units = await prisma.unit.findMany({
    select: { id: true, updatedAt: true },
  });

  // 3. Generate dynamic routes for every unit
  const dynamicRoutes = units.map((unit) => ({
    url: `${baseUrl}/en/units/${unit.id}`, // Adjust this URL structure to match your app
    lastModified: unit.updatedAt,
    changeFrequency: "daily" as const,
    priority: 0.8, // Properties are highly important
  }));

  // Combine and return
  return [...staticRoutes, ...dynamicRoutes];
}
