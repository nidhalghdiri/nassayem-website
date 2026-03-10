"use client";

import dynamic from "next/dynamic";
import AnimatedSection from "@/components/ui/AnimatedSection";

// Dynamically import the map with SSR disabled to prevent window/document errors
const Map = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 rounded-3xl flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-4 border-nassayem border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-gray-500 font-medium">Loading Map...</p>
    </div>
  ),
});

export default function LocationsMap({ locale }: { locale: string }) {
  const isEn = locale === "en";

  return (
    <section className="py-24 bg-gray-50 border-t border-gray-200">
      <AnimatedSection className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-sm font-bold text-nassayem tracking-widest uppercase mb-3">
            {isEn ? "Explore The Map" : "استكشف الخريطة"}
          </h2>
          <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {isEn
              ? "Our Prime Locations in Salalah"
              : "مواقعنا المميزة في صلالة"}
          </h3>
          <p className="text-gray-600 text-lg">
            {isEn
              ? "Discover our strategically placed buildings, from the vibrant heart of the city to serene beachfronts."
              : "اكتشف مبانينا ذات المواقع الاستراتيجية، من قلب المدينة النابض بالحياة إلى الواجهات البحرية الهادئة."}
          </p>
        </div>

        {/* Map Container */}
        <div className="w-full h-[500px] md:h-[600px] rounded-3xl shadow-xl border border-gray-200 p-2 bg-white relative z-10">
          <Map locale={locale} />
        </div>
      </AnimatedSection>
    </section>
  );
}
