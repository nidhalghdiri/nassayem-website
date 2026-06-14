"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Prisma } from "@prisma/client";

// Define the type to include the relations we fetch from Prisma
type UnitWithRelations = Prisma.UnitGetPayload<{
  include: { images: true; building: true };
}>;

type CardPrice = {
  dailyAverage: number;
  grandTotal: number;
  totalNights: number;
  hasPromotion: boolean;
};

export default function PropertyCard({
  unit,
  locale,
  checkIn,
  checkOut,
  price,
}: {
  unit: UnitWithRelations;
  locale: string;
  checkIn?: string;
  checkOut?: string;
  price?: CardPrice | null;
}) {
  const isEn = locale === "en";
  const [currentIndex, setCurrentIndex] = useState(0);

  // Carry the selected stay dates into the details page so its booking widget
  // opens pre-filled (and immediately shows the price) instead of blank.
  const detailsHref =
    checkIn && checkOut
      ? `/${locale}/properties/${unit.id}?checkIn=${checkIn}&checkOut=${checkOut}`
      : `/${locale}/properties/${unit.id}`;

  const isMonthly = unit.rentType === "MONTHLY";
  const perLabel = isMonthly
    ? isEn
      ? "/ month"
      : "/ شهر"
    : isEn
      ? "/ night"
      : "/ ليلة";

  // Use uploaded images, or fallback to a placeholder if none exist
  const images =
    unit.images.length > 0
      ? unit.images.map((img) => img.url)
      : [
          "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?q=80&w=600&auto=format&fit=crop",
        ];

  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  return (
    <Link href={detailsHref} className="group block">
      {/* Slider Container */}
      <div className="aspect-[4/3] rounded-2xl overflow-hidden mb-4 relative shadow-sm">
        <Image
          src={images[currentIndex]}
          alt={isEn ? unit.titleEn : unit.titleAr}
          fill
          className="object-cover transition-transform duration-500"
        />

        {/* Badges */}
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold text-nassayem shadow-sm z-10">
          {unit.rentType === "MONTHLY"
            ? isEn
              ? "Monthly"
              : "شهري"
            : isEn
              ? "Daily"
              : "يومي"}
        </div>

        {/* Slider Controls (Appear on Hover if multiple images exist) */}
        {images.length > 1 && (
          <div className="absolute inset-0 flex items-center justify-between p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              onClick={prevImage}
              className="bg-white/80 hover:bg-white rounded-full p-1.5 shadow-md transform transition-transform hover:scale-110"
            >
              <svg
                className="w-5 h-5 text-gray-800 rtl:rotate-180"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              onClick={nextImage}
              className="bg-white/80 hover:bg-white rounded-full p-1.5 shadow-md transform transition-transform hover:scale-110"
            >
              <svg
                className="w-5 h-5 text-gray-800 rtl:rotate-180"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Dots */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
            {images.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all ${idx === currentIndex ? "w-4 bg-white" : "w-1.5 bg-white/60"}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-gray-900 text-lg line-clamp-1">
            {isEn ? unit.titleEn : unit.titleAr}
          </h3>
          <p className="text-gray-500 text-sm mt-1 line-clamp-1">
            {isEn ? unit.building.nameEn : unit.building.nameAr}
          </p>
        </div>
      </div>

      {/* Rooms & Baths Icons */}
      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
        <span className="flex items-center gap-1.5">
          <svg
            className="w-4 h-4 text-nassayem"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          {unit.beds} {isEn ? "Beds" : "أسرة"}
        </span>
        <span className="flex items-center gap-1.5">
          <svg
            className="w-4 h-4 text-nassayem"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {unit.bathrooms} {isEn ? "Baths" : "حمامات"}
        </span>
      </div>

      <div className="mt-3 border-t border-gray-100 pt-3">
        {price ? (
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-extrabold text-gray-900">
                  {price.dailyAverage}
                </span>
                <span className="text-sm font-medium text-gray-500">
                  {isEn ? "OMR" : "ر.ع"} {perLabel}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {isEn
                  ? `Total ${price.grandTotal} OMR · ${price.totalNights} night${price.totalNights === 1 ? "" : "s"}`
                  : `الإجمالي ${price.grandTotal} ر.ع · ${price.totalNights} ${price.totalNights === 1 ? "ليلة" : "ليالٍ"}`}
              </p>
            </div>
            {price.hasPromotion && (
              <span className="shrink-0 inline-flex items-center bg-nassayem/10 text-nassayem font-bold text-[10px] uppercase tracking-wide px-2 py-1 rounded-full">
                {isEn ? "Promo" : "عرض"}
              </span>
            )}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 bg-nassayem/10 text-nassayem font-bold text-sm px-4 py-2 rounded-xl group-hover:bg-nassayem group-hover:text-white transition-colors">
            {isEn ? "Show Price" : "عرض السعر"}
            <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        )}
      </div>
    </Link>
  );
}
