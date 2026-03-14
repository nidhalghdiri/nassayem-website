import { MetadataRoute } from "next";
import prisma from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://www.nassayem.com";
  const locales = ["en", "ar"];

  // 1. Define your static routes
  const staticPaths = [
    "",
    "/faq",
    "/terms",
    "/privacy",
    "/delivery",
    "/refunds",
    "/contact",
  ];
  const staticRoutes = locales.flatMap((locale) =>
    staticPaths.map((route) => ({
      url: `${baseUrl}/${locale}${route}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: route === "" ? 1.0 : 0.5,
    })),
  );

  // 2. Fetch all active units from Prisma
  // (Adjust 'unit' to match your Prisma schema)
  const units = await prisma.unit.findMany({
    select: { id: true, updatedAt: true },
  });

  // 3. Generate dynamic routes for every unit
  const dynamicRoutes = locales.flatMap((locale) =>
    units.map((unit) => ({
      url: `${baseUrl}/${locale}/units/${unit.id}`,
      lastModified: unit.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  );

  // Combine and return
  return [...staticRoutes, ...dynamicRoutes];
}
