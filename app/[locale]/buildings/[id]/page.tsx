import Image from "next/image";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import PropertyCard from "@/components/properties/PropertyCard";
import Link from "next/link";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function BuildingDetailsPage({ params }: PageProps) {
  const { locale, id } = await params;
  const isEn = locale === "en";

  // Fetch the building and all its published units
  const building = await prisma.building.findUnique({
    where: { id },
    include: {
      units: {
        where: { isPublished: true },
        include: {
          images: { orderBy: { displayOrder: "asc" } },
          building: true, // Needed for the PropertyCard prop
        },
      },
    },
  });

  if (!building) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 1. Building Hero Section */}
      <div className="relative h-[50vh] min-h-[400px] w-full">
        <Image
          src={
            building.imageUrl ||
            "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?q=80&w=2000&auto=format&fit=crop"
          }
          alt={isEn ? building.nameEn : building.nameAr}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="bg-nassayem text-white text-xs font-bold px-3 py-1.5 rounded-md inline-block mb-4 shadow-sm">
            {isEn ? "Exclusive Management" : "إدارة حصرية"}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            {isEn ? building.nameEn : building.nameAr}
          </h1>
          <p className="text-xl text-white/90 flex items-center gap-2">
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
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {isEn ? building.locationEn : building.locationAr}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 2. Main Content & Description */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {isEn ? "About the Building" : "عن المبنى"}
              </h2>
              <p className="text-gray-600 leading-relaxed text-lg whitespace-pre-line">
                {isEn ? building.descriptionEn : building.descriptionAr}
                {!building.descriptionEn &&
                  !building.descriptionAr &&
                  (isEn ? "No description available." : "لا يوجد وصف متاح.")}
              </p>
            </div>

            {/* Units Grid */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center justify-between">
                {isEn ? "Available Units" : "الوحدات المتاحة"}
                <span className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold">
                  {building.units.length} {isEn ? "Units" : "وحدات"}
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {building.units.map((unit) => (
                  <PropertyCard key={unit.id} unit={unit} locale={locale} />
                ))}
              </div>
              {building.units.length === 0 && (
                <div className="bg-white p-10 rounded-2xl text-center border border-gray-100">
                  <p className="text-gray-500">
                    {isEn
                      ? "No units currently published in this building."
                      : "لا توجد وحدات منشورة حالياً في هذا المبنى."}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 3. Sidebar (Contact & Map) */}
          <div className="space-y-6">
            {/* Contact Manager Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-6">
                <div className="w-16 h-16 bg-nassayem text-white rounded-full flex items-center justify-center text-2xl font-bold">
                  N
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">
                    {isEn ? "Property Manager" : "مدير العقار"}
                  </h3>
                  <p className="text-nassayem font-medium text-sm">
                    Nassayem Salalah
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <a
                  href="tel:+96812345678"
                  className="w-full flex items-center justify-center gap-2 bg-gray-50 hover:bg-nassayem hover:text-white text-gray-900 py-3 rounded-xl font-bold transition-colors border border-gray-200 hover:border-nassayem"
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
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  +968 1234 5678
                </a>
                <a
                  href="https://wa.me/96812345678"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold transition-colors shadow-sm"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  {isEn ? "WhatsApp Us" : "تواصل عبر واتساب"}
                </a>
              </div>
            </div>

            {/* Static Map View (Fallback if Leaflet isn't needed here, or you can insert Leaflet) */}
            {building.latitude && building.longitude && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-4">
                  {isEn ? "Location" : "الموقع"}
                </h3>
                <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden relative flex items-center justify-center border border-gray-200">
                  <Link
                    href={`https://maps.google.com/?q=${building.latitude},${building.longitude}`}
                    target="_blank"
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/5 hover:bg-black/10 transition-colors"
                  >
                    <svg
                      className="w-10 h-10 text-nassayem drop-shadow-md mb-2"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    <span className="bg-white px-3 py-1 rounded-md text-sm font-bold text-gray-900 shadow-sm">
                      {isEn ? "Open in Google Maps" : "فتح في خرائط جوجل"}
                    </span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
