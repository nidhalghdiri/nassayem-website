import Link from "next/link";

export default function KhareefBanner({ locale }: { locale: string }) {
  const isEn = locale === "en";

  return (
    // <section> provides proper semantic structure for this block
    <section className="relative bg-gradient-to-r from-emerald-800 to-teal-900 text-white overflow-hidden rounded-3xl shadow-2xl my-16 mx-4 sm:mx-6 lg:mx-auto max-w-7xl">
      {/* Optional: Add a subtle decorative background overlay if you have a pattern image */}
      <div className="absolute inset-0 bg-black opacity-10"></div>

      <div className="relative px-8 py-16 md:px-16 md:py-20 flex flex-col items-center text-center">
        {/* Supporting SEO Heading */}
        <h2 className="text-3xl md:text-5xl font-extrabold mb-6 tracking-tight">
          {isEn ? "Khareef Salalah 2026 Awaits" : "خريف صلالة 2026 بانتظارك"}
        </h2>

        {/* Your Exact SEO-Optimized Target Sentence */}
        <p className="text-lg md:text-2xl text-emerald-50 max-w-4xl leading-relaxed mb-10 font-medium">
          {isEn
            ? "Looking for premium furnished apartments in Salalah? Nassayem offers the perfect family accommodation for your Khareef Salalah 2026 vacation."
            : "هل تبحث عن شقق مفروشة فاخرة في صلالة؟ تقدم نسائم أماكن الإقامة العائلية المثالية لقضاء عطلة خريف صلالة 2026."}
        </p>

        {/* Call to Action Button */}
        <Link
          href={`/${locale}/properties`} // Change this to your actual properties/search route
          className="inline-block bg-white text-emerald-900 font-bold text-lg px-10 py-4 rounded-full shadow-xl hover:bg-emerald-50 hover:scale-105 transition-transform duration-300"
        >
          {isEn ? "Book Your Family Suite Today" : "احجز جناحك العائلي اليوم"}
        </Link>
      </div>
    </section>
  );
}
