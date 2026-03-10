"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function FilterSidebar({ locale }: { locale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEn = locale === "en";

  // State for filters, initialized from URL if available
  const [priceRange, setPriceRange] = useState({
    min: searchParams.get("min") || "",
    max: searchParams.get("max") || "",
  });
  const [rentType, setRentType] = useState(searchParams.get("type") || "daily");

  // Amenities as an array
  const currentAmenities = searchParams.get("amenities")?.split(",") || [];

  // Update URL when filters change
  const applyFilters = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(newParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const toggleAmenity = (amenity: string) => {
    let updated;
    if (currentAmenities.includes(amenity)) {
      updated = currentAmenities.filter((a) => a !== amenity);
    } else {
      updated = [...currentAmenities, amenity];
    }
    applyFilters({ amenities: updated.length > 0 ? updated.join(",") : null });
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm sticky top-24">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          {isEn ? "Filters" : "عوامل التصفية"}
        </h2>
        <button
          onClick={() => router.push(pathname)}
          className="text-sm text-gray-500 hover:text-nassayem underline"
        >
          {isEn ? "Clear all" : "مسح الكل"}
        </button>
      </div>

      {/* Rental Type */}
      <div className="mb-8">
        <h3 className="font-semibold text-gray-900 mb-4">
          {isEn ? "Rental Type" : "نوع الإيجار"}
        </h3>
        <div className="flex bg-gray-50 p-1 rounded-xl">
          <button
            onClick={() => {
              setRentType("daily");
              applyFilters({ type: "daily" });
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${rentType === "daily" ? "bg-white text-nassayem shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
          >
            {isEn ? "Daily" : "يومي"}
          </button>
          <button
            onClick={() => {
              setRentType("monthly");
              applyFilters({ type: "monthly" });
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${rentType === "monthly" ? "bg-white text-nassayem shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
          >
            {isEn ? "Monthly" : "شهري"}
          </button>
        </div>
      </div>

      {/* Price Range */}
      <div className="mb-8 border-t border-gray-100 pt-6">
        <h3 className="font-semibold text-gray-900 mb-4">
          {isEn ? "Price Range (OMR)" : "نطاق السعر (ر.ع)"}
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">
              {isEn ? "Min" : "الحد الأدنى"}
            </label>
            <input
              type="number"
              placeholder="0"
              value={priceRange.min}
              onChange={(e) =>
                setPriceRange({ ...priceRange, min: e.target.value })
              }
              onBlur={() => applyFilters({ min: priceRange.min })}
              className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-nassayem focus:ring-1 focus:ring-nassayem transition-all"
            />
          </div>
          <div className="w-4 h-[1px] bg-gray-300 mt-5"></div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">
              {isEn ? "Max" : "الحد الأقصى"}
            </label>
            <input
              type="number"
              placeholder="500"
              value={priceRange.max}
              onChange={(e) =>
                setPriceRange({ ...priceRange, max: e.target.value })
              }
              onBlur={() => applyFilters({ max: priceRange.max })}
              className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-nassayem focus:ring-1 focus:ring-nassayem transition-all"
            />
          </div>
        </div>
      </div>

      {/* Amenities */}
      <div className="border-t border-gray-100 pt-6">
        <h3 className="font-semibold text-gray-900 mb-4">
          {isEn ? "Amenities" : "المرافق"}
        </h3>
        <div className="space-y-3">
          {[
            { id: "wifi", labelEn: "High-speed WiFi", labelAr: "واي فاي سريع" },
            { id: "pool", labelEn: "Swimming Pool", labelAr: "مسبح" },
            { id: "gym", labelEn: "Fitness Center", labelAr: "صالة رياضية" },
            { id: "sea_view", labelEn: "Sea View", labelAr: "إطلالة بحرية" },
            { id: "parking", labelEn: "Free Parking", labelAr: "موقف مجاني" },
          ].map((amenity) => (
            <label
              key={amenity.id}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="relative flex items-center justify-center w-5 h-5">
                <input
                  type="checkbox"
                  checked={currentAmenities.includes(amenity.id)}
                  onChange={() => toggleAmenity(amenity.id)}
                  className="peer appearance-none w-5 h-5 border border-gray-300 rounded-md checked:bg-nassayem checked:border-nassayem transition-all cursor-pointer"
                />
                <svg
                  className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                {isEn ? amenity.labelEn : amenity.labelAr}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
