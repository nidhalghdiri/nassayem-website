import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const rawBase = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const baseUrl =
    rawBase.startsWith("http://localhost") || rawBase === ""
      ? "https://www.nassayem.com"
      : rawBase;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/*/admin/",
          "/*/checkout/",
          "/*/properties/*/checkout",
          "/api/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
