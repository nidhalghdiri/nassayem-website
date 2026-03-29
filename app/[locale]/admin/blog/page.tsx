import prisma from "@/lib/prisma";
import Link from "next/link";
import { format } from "date-fns";
import Image from "next/image";

export default async function BlogAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === "en";

  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {isEn ? "Blog Management" : "إدارة المدونة"}
          </h1>
          <p className="text-gray-500 mt-1">
            {isEn
              ? "Write and manage articles to enhance your SEO and reach more guests."
              : "اكتب ودر مقالاتك لتعزيز ظهورك في محركات البحث والوصول للمزيد من الضيوف."}
          </p>
        </div>
        <Link
          href={`/${locale}/admin/blog/new`}
          className="bg-nassayem hover:bg-nassayem-dark text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          {isEn ? "New Article" : "مقال جديد"}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {posts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 2v4a2 2 0 002 2h4" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9H8m2 4H8m5 4h-5" />
              </svg>
            </div>
            <h3 className="text-gray-900 font-bold text-lg">
              {isEn ? "No articles yet" : "لا يوجد مقالات بعد"}
            </h3>
            <p className="text-gray-500 mb-6">
              {isEn ? "Start by creating your first blog post." : "ابدأ بإنشاء أول مقال لك."}
            </p>
            <Link
              href={`/${locale}/admin/blog/new`}
              className="text-nassayem font-bold hover:underline"
            >
              {isEn ? "Create Article →" : "إنشاء مقال ←"}
            </Link>
          </div>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-2xl border border-gray-100 p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center gap-5 hover:shadow-md transition-shadow"
            >
              <div className="relative w-full md:w-32 h-24 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0">
                {post.coverImage ? (
                  <Image
                    src={post.coverImage}
                    alt={isEn ? post.titleEn : post.titleAr}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    post.isPublished ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {post.isPublished ? (isEn ? "Published" : "منشور") : (isEn ? "Draft" : "مسودة")}
                  </span>
                  <span className="text-xs text-gray-400">
                    {format(post.createdAt, "PPP")}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 truncate">
                  {isEn ? post.titleEn : post.titleAr}
                </h3>
                <p className="text-sm text-gray-500 line-clamp-1">
                  {isEn ? post.excerptEn || post.contentEn : post.excerptAr || post.contentAr}
                </p>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Link
                  href={`/${locale}/admin/blog/${post.id}/edit`}
                  className="flex-1 md:flex-none text-center px-4 py-2 rounded-lg bg-gray-50 text-gray-700 font-bold hover:bg-gray-100 transition-colors text-sm"
                >
                  {isEn ? "Edit" : "تعديل"}
                </Link>
                <Link
                  href={`/${locale}/blog/${post.slug}`}
                  target="_blank"
                  className="flex-1 md:flex-none text-center px-4 py-2 rounded-lg bg-nassayem/10 text-nassayem font-bold hover:bg-nassayem/20 transition-colors text-sm"
                >
                  {isEn ? "View" : "عرض"}
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
