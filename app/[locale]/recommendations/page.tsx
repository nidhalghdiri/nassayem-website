import Image from "next/image";
import Link from "next/link";
import prisma from "@/lib/prisma";
import type { Metadata } from "next";
import type { RecommendationCategory } from "@prisma/client";
import {
  RECOMMENDATION_CATEGORIES,
  CATEGORY_DISPLAY_ORDER,
} from "@/lib/recommendations";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";
  return {
    title: isEn
      ? "Salalah Recommendations | Nassayem"
      : "توصيات صلالة | نسائم",
    description: isEn
      ? "Curated guide to Salalah during Khareef season — beaches, mountains, waterfalls, restaurants, and events recommended by Nassayem."
      : "دليل مختار لصلالة في موسم الخريف — شواطئ وجبال وشلالات ومطاعم وفعاليات تقترحها نسائم.",
    openGraph: {
      title: isEn
        ? "Salalah Khareef Recommendations"
        : "توصيات خريف صلالة",
      description: isEn
        ? "Beaches, waterfalls, restaurants, and events — handpicked by the Nassayem team."
        : "شواطئ وشلالات ومطاعم وفعاليات — مختارة بعناية من فريق نسائم.",
    },
  };
}

export default async function RecommendationsPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const recommendations = await prisma.recommendation.findMany({
    where: { isPublished: true },
    orderBy: [{ category: "asc" }, { displayOrder: "asc" }, { createdAt: "desc" }],
  });

  // Group by category, preserving the canonical display order.
  const byCategory = new Map<RecommendationCategory, typeof recommendations>();
  for (const r of recommendations) {
    const arr = byCategory.get(r.category) ?? [];
    arr.push(r);
    byCategory.set(r.category, arr);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero */}
      <div className="relative bg-nassayem text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.6),transparent_50%)]" />
        <div className="relative max-w-4xl mx-auto px-4 py-16 md:py-20 text-center">
          <p className="text-xs md:text-sm font-bold tracking-[0.3em] uppercase text-white/70 mb-3">
            {isEn ? "Nassayem Recommends" : "نسائم توصي"}
          </p>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">
            {isEn ? "Discover Salalah" : "اكتشف صلالة"}
          </h1>
          <p className="mt-4 text-base md:text-lg text-white/90 max-w-2xl mx-auto leading-relaxed">
            {isEn
              ? "Our hand-picked guide to beaches, mountains, waterfalls, restaurants, and events in beautiful Dhofar — especially during Khareef season."
              : "دليلنا المختار لشواطئ وجبال وشلالات ومطاعم وفعاليات ظفار الساحرة — وخاصة في موسم الخريف."}
          </p>
        </div>
      </div>

      {/* Empty state */}
      {recommendations.length === 0 ? (
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg
              className="w-10 h-10 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            {isEn ? "Recommendations coming soon" : "التوصيات قادمة قريباً"}
          </h2>
          <p className="text-gray-500 mt-2">
            {isEn
              ? "Our team is putting together the best places to visit in Salalah. Check back soon!"
              : "يقوم فريقنا بإعداد أفضل الأماكن لزيارتها في صلالة. تابعنا قريباً!"}
          </p>
        </div>
      ) : (
        /* Category sections */
        <div className="max-w-5xl mx-auto px-4 py-12 md:py-16 space-y-12 md:space-y-16">
          {CATEGORY_DISPLAY_ORDER.filter(
            (cat) => (byCategory.get(cat)?.length ?? 0) > 0,
          ).map((cat) => {
            const items = byCategory.get(cat) ?? [];
            const cfg = RECOMMENDATION_CATEGORIES[cat];
            return (
              <section key={cat}>
                {/* Section header */}
                <div className="flex items-center gap-3 mb-6">
                  <span
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${cfg.accent} text-white flex items-center justify-center shadow-sm shrink-0`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d={cfg.iconPath}
                      />
                    </svg>
                  </span>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">
                    {isEn ? cfg.labelEn : cfg.labelAr}
                  </h2>
                  <span className="text-sm text-gray-400 ms-1">
                    {items.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {items.map((item) => {
                    const title = isEn ? item.titleEn : item.titleAr;
                    const desc = isEn ? item.descriptionEn : item.descriptionAr;
                    const tags = isEn ? item.tagsEn : item.tagsAr;
                    return (
                      <article
                        key={item.id}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col"
                      >
                        {/* Image */}
                        <div className="relative aspect-[16/10] bg-gray-100">
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt={title}
                              fill
                              sizes="(max-width: 640px) 100vw, 500px"
                              className="object-cover"
                            />
                          ) : (
                            <div
                              className={`w-full h-full bg-gradient-to-br ${cfg.accent} opacity-30 flex items-center justify-center`}
                            >
                              <svg
                                className="w-14 h-14 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="1.5"
                                  d={cfg.iconPath}
                                />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Body */}
                        <div className="p-5 flex flex-col flex-1">
                          <h3 className="text-lg font-extrabold text-gray-900 leading-tight">
                            {title}
                          </h3>
                          {desc && (
                            <p className="text-sm text-gray-600 mt-2 leading-relaxed line-clamp-4">
                              {desc}
                            </p>
                          )}
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {tags.map((tag, i) => (
                                <span
                                  key={i}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.tone}`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.mapUrl && (
                            <a
                              href={item.mapUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="mt-auto pt-4 inline-flex items-center gap-1.5 text-sm font-bold text-nassayem hover:underline"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                              {isEn ? "Open in Maps" : "افتح في الخرائط"}
                            </a>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Footer CTA */}
      <div className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">
            {isEn ? "Stay with Nassayem" : "أقم مع نسائم"}
          </h2>
          <p className="text-gray-500 mb-6">
            {isEn
              ? "Premium furnished apartments in the heart of Salalah."
              : "شقق مفروشة فاخرة في قلب صلالة."}
          </p>
          <Link
            href={`/${locale}/properties`}
            className="inline-flex items-center gap-2 bg-nassayem text-white px-6 py-3 rounded-xl font-bold hover:bg-nassayem-dark transition-colors"
          >
            {isEn ? "Browse Apartments" : "تصفح الشقق"}
            <svg
              className="w-4 h-4 rtl:rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
