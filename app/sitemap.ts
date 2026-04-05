import { MetadataRoute } from "next";
import prisma from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.nassayem.com";
  const locales = ["en", "ar"];

  // 1. Static routes
  const staticPaths = [
    { path: "", priority: 1.0, freq: "weekly" as const },
    { path: "/properties", priority: 0.9, freq: "daily" as const },
    { path: "/blog", priority: 0.7, freq: "weekly" as const },
    { path: "/contact", priority: 0.6, freq: "monthly" as const },
    { path: "/faq", priority: 0.6, freq: "monthly" as const },
    { path: "/terms", priority: 0.3, freq: "monthly" as const },
    { path: "/privacy", priority: 0.3, freq: "monthly" as const },
    { path: "/delivery", priority: 0.3, freq: "monthly" as const },
    { path: "/refunds", priority: 0.3, freq: "monthly" as const },
  ];

  const staticRoutes: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    staticPaths.map(({ path, priority, freq }) => ({
      url: `${baseUrl}/${locale}${path}`,
      lastModified: new Date(),
      changeFrequency: freq,
      priority,
    })),
  );

  // 2. Property (unit) detail pages
  const units = await prisma.unit.findMany({
    where: { isPublished: true },
    select: { id: true, updatedAt: true },
  });

  const propertyRoutes: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    units.map((unit) => ({
      url: `${baseUrl}/${locale}/properties/${unit.id}`,
      lastModified: unit.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  );

  // 3. Building pages
  const buildings = await prisma.building.findMany({
    select: { id: true, updatedAt: true },
  });

  const buildingRoutes: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    buildings.map((b) => ({
      url: `${baseUrl}/${locale}/buildings/${b.id}`,
      lastModified: b.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  );

  // 4. Blog posts
  const posts = await prisma.post.findMany({
    where: { isPublished: true },
    select: { slug: true, updatedAt: true },
  });

  const blogRoutes: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    posts.map((post) => ({
      url: `${baseUrl}/${locale}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  );

  return [...staticRoutes, ...propertyRoutes, ...buildingRoutes, ...blogRoutes];
}
