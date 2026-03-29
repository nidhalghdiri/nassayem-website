import prisma from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isEn = locale === "en";
  
  return {
    title: isEn ? "Blog | Nassayem Salalah" : "المدونة | نسائم صلالة",
    description: isEn 
      ? "Discover the best travel tips, local guides, and news about Salalah and Oman." 
      : "اكتشف أفضل نصائح السفر، الأدلة المحلية، والأخبار حول صلالة وعمان.",
  };
}

export default async function BlogListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === "en";

  const posts = await prisma.post.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {isEn ? "Our Blog" : "مدونتنا"}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {isEn
              ? "Discover the beauty of Salalah through our latest articles and travel guides."
              : "اكتشف جمال صلالة من خلال أحدث مقالاتنا وأدلة السفر."}
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <p className="text-gray-500">
              {isEn ? "No articles published yet. Check back soon!" : "لا يوجد مقالات منشورة بعد. عد قريباً!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/${locale}/blog/${post.slug}`}
                className="group bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full"
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
                      <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute top-4 start-4">
                    <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-bold text-nassayem uppercase tracking-wider">
                      {format(post.createdAt, "MMM d, yyyy")}
                    </span>
                  </div>
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <h2 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-nassayem transition-colors line-clamp-2">
                    {isEn ? post.titleEn : post.titleAr}
                  </h2>
                  <p className="text-gray-600 text-sm line-clamp-3 mb-6 flex-1">
                    {isEn ? post.excerptEn || post.contentEn : post.excerptAr || post.contentAr}
                  </p>
                  <div className="flex items-center text-nassayem font-bold text-sm gap-1 group-hover:gap-2 transition-all">
                    {isEn ? "Read More" : "اقرأ المزيد"}
                    <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
