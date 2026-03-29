import prisma from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";

export default async function BlogSection({ locale }: { locale: string }) {
  const isEn = locale === "en";

  const posts = await prisma.post.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  if (posts.length === 0) return null;

  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              {isEn ? "Latest from our Blog" : "آخر مقالات مدونتنا"}
            </h2>
            <p className="text-gray-600">
              {isEn
                ? "Insights, travel tips, and stories about the beautiful Salalah and its surroundings."
                : "رؤى، نصائح سفر، وقصص عن صلالة الجميلة والمناطق المحيطة بها."}
            </p>
          </div>
          <Link
            href={`/${locale}/blog`}
            className="inline-flex items-center gap-2 text-nassayem font-bold hover:gap-3 transition-all"
          >
            {isEn ? "Explore all articles" : "استكشف كل المقالات"}
            <svg className="w-5 h-5 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/${locale}/blog/${post.slug}`}
              className="group bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                {post.coverImage ? (
                  <Image
                    src={post.coverImage}
                    alt={isEn ? post.titleEn : post.titleAr}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-nassayem/5 flex items-center justify-center text-nassayem/20">
                    <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="p-8">
                <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
                  <span className="font-bold text-nassayem bg-nassayem/10 px-2 py-0.5 rounded uppercase tracking-wider">
                    {isEn ? "Travel" : "سفر"}
                  </span>
                  <span>{format(post.createdAt, "MMMM d, yyyy")}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-nassayem transition-colors line-clamp-2 leading-snug">
                  {isEn ? post.titleEn : post.titleAr}
                </h3>
                <p className="text-gray-500 text-sm line-clamp-2">
                  {isEn ? post.excerptEn || post.contentEn : post.excerptAr || post.contentAr}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
