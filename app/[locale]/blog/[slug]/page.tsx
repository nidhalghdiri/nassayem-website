import prisma from "@/lib/prisma";
import Image from "next/image";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import JsonLd from "@/components/JsonLd";
import Link from "next/link";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const isEn = locale === "en";

  const post = await prisma.post.findUnique({
    where: { slug, isPublished: true },
  });

  if (!post) return {};

  const title = isEn ? post.titleEn : post.titleAr;
  const description = isEn
    ? post.excerptEn || post.contentEn.substring(0, 160)
    : post.excerptAr || post.contentAr.substring(0, 160);

  return {
    title: `${title} | Nassayem Blog`,
    description,
    alternates: {
      canonical: `https://www.nassayem.com/${locale}/blog/${slug}`,
      languages: {
        en: `https://www.nassayem.com/en/blog/${slug}`,
        ar: `https://www.nassayem.com/ar/blog/${slug}`,
      },
    },
    openGraph: {
      title,
      description,
      type: "article",
      images: post.coverImage ? [{ url: post.coverImage, width: 1200, height: 630 }] : [],
    },
  };
}

export default async function BlogPostDetailsPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const isEn = locale === "en";

  const post = await prisma.post.findUnique({
    where: { slug, isPublished: true },
    include: {
      author: {
        select: { name: true }
      }
    }
  });

  if (!post) return notFound();

  // Structured Data for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": isEn ? post.titleEn : post.titleAr,
    "image": post.coverImage ? [post.coverImage] : [],
    "datePublished": post.createdAt.toISOString(),
    "dateModified": post.updatedAt.toISOString(),
    "author": [{
      "@type": "Organization",
      "name": "Nassayem Salalah",
      "url": "https://nassayem.com"
    }],
    "description": isEn ? post.excerptEn || post.contentEn.substring(0, 160) : post.excerptAr || post.contentAr.substring(0, 160)
  };

  return (
    <article className="min-h-screen bg-white pt-24 pb-16">
      <JsonLd data={jsonLd} />
      
      {/* Hero Section with Title & Image */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link 
          href={`/${locale}/blog`}
          className="inline-flex items-center gap-2 text-sm font-bold text-nassayem hover:text-nassayem-dark mb-8 transition-colors"
        >
          <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          {isEn ? "Back to Blog" : "العودة إلى المدونة"}
        </Link>

        <header className="mb-10">
          <div className="flex items-center gap-3 text-sm text-gray-500 mb-4">
            <span className="font-bold text-nassayem bg-nassayem/10 px-3 py-1 rounded-full uppercase tracking-widest text-[10px]">
              {isEn ? "Article" : "مقال"}
            </span>
            <span className="w-1 h-1 bg-gray-300 rounded-full" />
            <time dateTime={post.createdAt.toISOString()}>
              {format(post.createdAt, "MMMM d, yyyy")}
            </time>
          </div>
          
          <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
            {isEn ? post.titleEn : post.titleAr}
          </h1>

          {post.author?.name && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-400">
                {post.author.name.charAt(0)}
              </div>
              <span className="text-gray-900 font-bold">{post.author.name}</span>
            </div>
          )}
        </header>

        {post.coverImage && (
          <div className="relative aspect-[21/10] rounded-[2.5rem] overflow-hidden mb-12 shadow-xl ring-1 ring-gray-200">
            <Image
              src={post.coverImage}
              alt={isEn ? post.titleEn : post.titleAr}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed space-y-6">
          {(isEn ? post.contentEn : post.contentAr).split('\n').map((para, i) => (
            para.trim() ? <p key={i} className={!isEn ? "text-right dir-rtl" : ""}>{para}</p> : <br key={i} />
          ))}
        </div>

        {/* Share / Footer Section */}
        <footer className="mt-16 pt-10 border-t border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="text-gray-900 font-bold">{isEn ? "Share this article:" : "شارك هذا المقال:"}</span>
              <div className="flex gap-2">
                {/* Simple share buttons placeholders */}
                {[1,2,3].map(i => (
                   <div key={i} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-nassayem/10 hover:text-nassayem cursor-pointer transition-colors">
                     <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
                     </svg>
                   </div>
                ))}
              </div>
            </div>
            <Link 
              href={`/${locale}/blog`}
              className="text-nassayem font-bold hover:underline"
            >
              {isEn ? "See more articles →" : "شاهد المزيد من المقالات ←"}
            </Link>
          </div>
        </footer>
      </div>
    </article>
  );
}
