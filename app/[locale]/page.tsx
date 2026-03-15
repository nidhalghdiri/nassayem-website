import HeroSearchWidget from "@/components/home/HeroSearchWidget";
import Link from "next/link";
import Image from "next/image";
import AnimatedSection from "@/components/ui/AnimatedSection";
import ContactSection from "@/components/home/ContactSection";
import PropertyCard from "@/components/properties/PropertyCard";
import LocationsMap from "@/components/home/LocationsMap";
import prisma from "@/lib/prisma";
import KhareefBanner from "@/components/marketing/KhareefBanner";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  // Fetch real data from database
  const buildings = await prisma.building.findMany({
    take: 3,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { units: true } } },
  });

  const featuredUnits = await prisma.unit.findMany({
    where: { isPublished: true },
    take: 4,
    orderBy: { createdAt: "desc" },
    include: {
      images: { orderBy: { displayOrder: "asc" } },
      building: true,
    },
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: "Nassayem Salalah",
    image: "https://www.nassayem.com/logo.png",
    "@id": "https://www.nassayem.com",
    url: "https://www.nassayem.com",
    telephone: "+968 99551237",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Salalah",
      addressRegion: "Dhofar",
      addressCountry: "OM",
    },
    priceRange: "$$",
  };

  return (
    <div className="flex flex-col min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* 1. HERO SECTION */}
      <section className="relative h-[85vh] min-h-[600px] flex items-center justify-center">
        <div className="absolute inset-0 bg-gray-900/40 z-10" />
        <div
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2070&auto=format&fit=crop')",
          }}
        />

        <div className="relative z-20 w-full px-4 sm:px-6 lg:px-8 mt-16">
          <AnimatedSection className="text-center mb-12">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 drop-shadow-lg tracking-tight">
              {isEn ? "Nassayem Salalah" : "نسائم صلالة"}
            </h1>
            <p className="text-xl md:text-2xl text-white/90 font-light drop-shadow-md max-w-2xl mx-auto">
              {isEn
                ? "Elevated living. Exceptional stays. Experience the comfort of home with the luxury of a hotel."
                : "حياة راقية. إقامات استثنائية. استمتع براحة المنزل مع فخامة الفنادق."}
            </p>
          </AnimatedSection>
          <AnimatedSection delay={0.2}>
            <HeroSearchWidget locale={locale} />
          </AnimatedSection>
        </div>
      </section>

      {/* 2. THE NASSAYEM STANDARD (New: Highlighting Hospitality Services) */}
      <section className="py-20 bg-white">
        <AnimatedSection className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-sm font-bold text-nassayem tracking-widest uppercase mb-3">
              {isEn ? "The Nassayem Standard" : "معيار نسائم"}
            </h2>
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900">
              {isEn
                ? "Redefining Serviced Apartments"
                : "إعادة تعريف الشقق المخدومة"}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: "M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5",
                titleEn: "24/7 Concierge",
                titleAr: "خدمة كونسيرج 24/7",
                descEn:
                  "Round-the-clock support to ensure your stay is flawless.",
                descAr: "دعم على مدار الساعة لضمان إقامة خالية من العيوب.",
              },
              {
                icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
                titleEn: "Hotel-Grade Cleaning",
                titleAr: "تنظيف بمستوى فندقي",
                descEn:
                  "Meticulous housekeeping and premium linens for every guest.",
                descAr: "عناية فائقة بالنظافة وبياضات فاخرة لكل ضيف.",
              },
              {
                icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
                titleEn: "Secure & Maintained",
                titleAr: "أمن وصيانة دورية",
                descEn:
                  "Smart locks, secure buildings, and rapid-response maintenance.",
                descAr: "أقفال ذكية، مباني آمنة، واستجابة سريعة للصيانة.",
              },
              {
                icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
                titleEn: "Local Experiences",
                titleAr: "تجارب محلية",
                descEn:
                  "Curated guides and partnerships to explore the best of Dhofar.",
                descAr: "أدلة وشراكات منتقاة لاستكشاف أفضل ما في ظفار.",
              },
            ].map((service, idx) => (
              <div
                key={idx}
                className="bg-gray-50 rounded-2xl p-8 hover:shadow-lg transition-shadow border border-gray-100"
              >
                <div className="w-12 h-12 bg-nassayem text-white rounded-xl flex items-center justify-center mb-6">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d={service.icon}
                    />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-3">
                  {isEn ? service.titleEn : service.titleAr}
                </h4>
                <p className="text-gray-600 leading-relaxed">
                  {isEn ? service.descEn : service.descAr}
                </p>
              </div>
            ))}
          </div>
        </AnimatedSection>
      </section>

      {/* 3. EXPLORE BY BUILDING (Grid Layout) */}
      <section className="py-20 bg-gray-50 w-full">
        <AnimatedSection className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {isEn ? "Our Managed Buildings" : "مبانينا المدارة"}
          </h2>
          <p className="text-gray-600 mb-10">
            {isEn
              ? "Strategic locations with exclusive Nassayem amenities."
              : "مواقع استراتيجية مع مرافق نسائم الحصرية."}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {buildings.map((building, idx) => (
              <Link
                href={`/${locale}/buildings/${building.id}`}
                key={building.id}
                className="group block relative h-80 rounded-2xl overflow-hidden"
              >
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors z-10" />
                {/* Fallback image logic for buildings since we don't have a building image table yet */}
                <Image
                  // Use the uploaded image, or a fallback if you forgot to upload one
                  src={
                    building.imageUrl ||
                    "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?q=80&w=800&auto=format&fit=crop"
                  }
                  alt={isEn ? building.nameEn : building.nameAr}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute bottom-0 inset-x-0 p-6 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                  <div className="bg-nassayem text-white text-xs font-bold px-2 py-1 rounded-md inline-block mb-2">
                    {isEn ? "Exclusive Management" : "إدارة حصرية"}
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">
                    {isEn ? building.nameEn : building.nameAr}
                  </h3>
                  <p className="text-white/90 font-medium">
                    {building._count.units}{" "}
                    {isEn ? "Serviced Units" : "وحدات مخدومة"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </AnimatedSection>
      </section>

      {/* 4. FEATURED UNITS */}
      <section className="py-20 bg-white">
        <AnimatedSection className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {isEn ? "Handpicked Serviced Stays" : "إقامات مخدومة منتقاة لك"}
              </h2>
              <p className="text-gray-600">
                {isEn
                  ? "Ready for daily and monthly check-ins."
                  : "جاهزة لتسجيل الدخول اليومي والشهري."}
              </p>
            </div>
            <Link
              href={`/${locale}/properties`}
              className="hidden sm:block text-nassayem font-bold hover:underline transition-all"
            >
              {isEn ? "View Portfolio →" : "عرض المحفظة ←"}
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredUnits.map((unit) => (
              <PropertyCard key={unit.id} unit={unit} locale={locale} />
            ))}
          </div>

          {featuredUnits.length === 0 && (
            <div className="col-span-4 text-center py-10 text-gray-500">
              {isEn ? "No units published yet." : "لم يتم نشر وحدات بعد."}
            </div>
          )}
        </AnimatedSection>
      </section>

      {/* 5. PROPERTY MANAGEMENT CTA (New: Targeting Owners) */}
      <section className="py-16">
        <AnimatedSection className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl overflow-hidden bg-nassayem flex flex-col md:flex-row items-center justify-between shadow-2xl">
            {/* Abstract Background Pattern */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "radial-gradient(#ffffff 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            ></div>
          </div>
        </AnimatedSection>
      </section>

      {/* 6. MISSION, VISION, MESSAGE (Upgraded UI with your exact text) */}
      <section className="py-24 bg-gray-50 border-t border-gray-200">
        <AnimatedSection className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">
              {isEn ? "The Nassayem Philosophy" : "فلسفة نسائم"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Mission */}
            <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 hover:-translate-y-1 transition-transform duration-300">
              <div className="w-14 h-14 bg-nassayem/10 text-nassayem rounded-2xl flex items-center justify-center mb-6">
                <svg
                  className="w-7 h-7"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {isEn ? "Our Mission" : "مهمتنا"}
              </h3>
              <p className="text-gray-600 leading-relaxed text-lg">
                {isEn
                  ? "To provide seamless, high-quality property management and rental experiences that elevate the standard of living in Salalah."
                  : "تقديم تجارب إدارة وتأجير عقارات سلسة وعالية الجودة ترتقي بمستوى المعيشة في صلالة."}
              </p>
            </div>

            {/* Vision */}
            <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 hover:-translate-y-1 transition-transform duration-300">
              <div className="w-14 h-14 bg-nassayem/10 text-nassayem rounded-2xl flex items-center justify-center mb-6">
                <svg
                  className="w-7 h-7"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {isEn ? "Our Vision" : "رؤيتنا"}
              </h3>
              <p className="text-gray-600 leading-relaxed text-lg">
                {isEn
                  ? "To create a new and ideal image in the world of serviced apartments and to become the leading real estate development company in Dhofar."
                  : "خلق صوره جديدة مثالية في عالم الشقق الفندقية و نكون شركة التطوير العقاري الرائدة في ظفار"}
              </p>
            </div>

            {/* Message */}
            <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 hover:-translate-y-1 transition-transform duration-300">
              <div className="w-14 h-14 bg-nassayem/10 text-nassayem rounded-2xl flex items-center justify-center mb-6">
                <svg
                  className="w-7 h-7"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {isEn ? "Our Message" : "رسالتنا"}
              </h3>
              <p className="text-gray-600 leading-relaxed text-lg">
                {isEn
                  ? "Providing a distinguished stay experience built on quality, comfort, and a strategic location, while remaining committed to authentic Omani and Arab hospitality."
                  : "تقديم تجربة إقامة متميزة ترتكز على الجودة و الراحة و الموقع الاستراتيجي مع الالتزام بالضيافة العمانية و العربية الاصيلة."}
              </p>
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* 7. CONTACT US & SOCIAL MEDIA */}
      <ContactSection locale={locale} />
      {/* 8. LOCATIONS MAP (New Interactive Map Section) */}
      <LocationsMap locale={locale} />

      <KhareefBanner locale={locale} />
    </div>
  );
}
