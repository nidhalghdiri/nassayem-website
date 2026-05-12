"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  calculateBookingPrice,
  checkUnitAvailability,
} from "@/app/actions/booking";
import { gtagEvent } from "@/lib/gtag";

type BookingWidgetProps = {
  unitId: string;
  unitName: string;
  priceDaily: number | null;
  priceMonthly: number | null;
  rentType: string;
  locale: string;
};

export default function BookingWidget({
  unitId,
  unitName,
  priceDaily,
  priceMonthly,
  rentType,
  locale,
}: BookingWidgetProps) {
  const router = useRouter();
  const isEn = locale === "en";

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("1");

  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceDetails, setPriceDetails] = useState<any>(null);

  // Determine the display price (fallback if dates aren't selected yet)
  const displayPrice = rentType === "MONTHLY" ? priceMonthly : priceDaily;
  const priceLabel =
    rentType === "MONTHLY"
      ? isEn
        ? "OMR / month"
        : "ر.ع / شهر"
      : isEn
        ? "OMR / night"
        : "ر.ع / ليلة";

  const khareefMessage = isEn
    ? "If you want to book in Khareef season (July & August), please contact administration at +968 99551237"
    : "إذا كنت ترغب في الحجز خلال موسم الخريف (يوليو وأغسطس)، يرجى التواصل مع الإدارة على الرقم 96899551237+";

  // True when any stay night (check-in inclusive, check-out exclusive) falls in
  // July (6) or August (7). The check-out date itself is the morning of
  // departure — it must not count as a stay night.
  const rangeIsKhareef = (start: string, end: string) => {
    if (!start || !end) return false;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return false;
    const cursor = new Date(s);
    while (cursor < e) {
      const m = cursor.getMonth();
      if (m === 6 || m === 7) return true;
      cursor.setDate(cursor.getDate() + 1);
    }
    return false;
  };

  useEffect(() => {
    if (!checkIn || !checkOut) {
      setError(null);
      setPriceDetails(null);
      return;
    }

    // Pre-set the khareef error SYNCHRONOUSLY so the Reserve button disables
    // on this render — before any network round-trip. If a promotion covers
    // the dates, calculateBookingPrice succeeds below and we clear the error.
    const looksKhareef = rangeIsKhareef(checkIn, checkOut);
    if (looksKhareef) {
      setError(khareefMessage);
      setPriceDetails(null);
    } else {
      setError(null);
    }

    let cancelled = false;
    (async () => {
      setIsCalculating(true);
      try {
        const availability = await checkUnitAvailability(unitId, checkIn, checkOut);
        if (cancelled) return;
        if (!availability.available) {
          setError(
            availability.error ||
              (isEn ? "Dates unavailable" : "التواريخ غير متاحة"),
          );
          setPriceDetails(null);
          return;
        }

        const pricing = await calculateBookingPrice(unitId, checkIn, checkOut);
        if (cancelled) return;
        // Made it through (server-side khareef gate did not trip).
        setError(null);
        setPriceDetails(pricing);
      } catch {
        if (cancelled) return;
        // Next.js obscures Server Action error messages in production, so
        // we cannot rely on err.message to identify the failure. Use the
        // synchronous date check as the source of truth — if the stay
        // touches July/August, show the bilingual khareef notice; otherwise
        // a generic message. Never display the raw thrown error to users.
        if (rangeIsKhareef(checkIn, checkOut)) {
          setError(khareefMessage);
        } else {
          setError(isEn ? "Error calculating price" : "خطأ في حساب السعر");
        }
        setPriceDetails(null);
      } finally {
        if (!cancelled) setIsCalculating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut, unitId, isEn, khareefMessage]);

  const handleReserve = () => {
    if (!checkIn || !checkOut) {
      setError(
        isEn
          ? "Please select check-in and check-out dates."
          : "يرجى تحديد تواريخ الدخول والخروج.",
      );
      return;
    }

    // Last-line client gate: block khareef dates until the server has
    // returned a valid priceDetails. If priceDetails is populated, the
    // server already authorized the booking — either via a promotion,
    // via the pricing module (per-day rates set for every stay night),
    // or both. We trust that. If priceDetails is null, the server either
    // rejected it (state hasn't settled) or hasn't responded yet — block.
    if (rangeIsKhareef(checkIn, checkOut) && !priceDetails) {
      setError(khareefMessage);
      return;
    }

    // Require a successful price calculation — never let the user navigate
    // to checkout while we're still computing or an error is showing.
    if (error || isCalculating || !priceDetails) return;

    gtagEvent("begin_checkout", {
      currency: "OMR",
      value: priceDetails?.grandTotal ?? undefined,
      items: [
        {
          item_id: unitId,
          item_name: unitName,
          item_category: rentType,
          price: priceDetails?.grandTotal ?? undefined,
          quantity: 1,
        },
      ],
    });

    const params = new URLSearchParams({ checkIn, checkOut, guests });
    router.push(
      `/${locale}/properties/${unitId}/checkout?${params.toString()}`,
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xl lg:sticky lg:top-28 mb-8 lg:mb-0">
      <div className="flex items-end gap-1 mb-6">
        <span className="text-3xl font-extrabold text-gray-900">
          {displayPrice}
        </span>
        <span className="text-gray-500 font-medium pb-1">{priceLabel}</span>
      </div>

      {/* Form Inputs */}
      <div className="border border-gray-300 rounded-xl overflow-hidden mb-4 focus-within:ring-2 focus-within:ring-nassayem/50 transition-all">
        <div className="flex border-b border-gray-300">
          <div className="w-1/2 p-3 border-e border-gray-300 relative">
            <label className="block text-xs font-bold text-gray-900 uppercase">
              {isEn ? "Check-in" : "دخول"}
            </label>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              min={new Date().toISOString().split("T")[0]} // Prevent past dates
              className="w-full mt-1 text-sm text-gray-900 focus:outline-none bg-transparent font-medium cursor-pointer"
            />
          </div>
          <div className="w-1/2 p-3 relative">
            <label className="block text-xs font-bold text-gray-900 uppercase">
              {isEn ? "Checkout" : "خروج"}
            </label>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              min={checkIn || new Date().toISOString().split("T")[0]} // Must be after check-in
              className="w-full mt-1 text-sm text-gray-900 focus:outline-none bg-transparent font-medium cursor-pointer"
            />
          </div>
        </div>
        <div className="p-3">
          <label className="block text-xs font-bold text-gray-900 uppercase">
            {isEn ? "Guests" : "الضيوف"}
          </label>
          <select
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
            className="w-full mt-1 text-sm text-gray-900 focus:outline-none appearance-none bg-transparent cursor-pointer font-medium"
          >
            <option value="1">1 {isEn ? "guest" : "ضيف"}</option>
            <option value="2">2 {isEn ? "guests" : "ضيوف"}</option>
            <option value="3">3 {isEn ? "guests" : "ضيوف"}</option>
            <option value="4">4 {isEn ? "guests" : "ضيوف"}</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 font-medium">
          {error}
        </div>
      )}

      {/* Reserve Button — disabled until we have a successful priceDetails so
          the user can never navigate to checkout during the calc round-trip. */}
      <button
        onClick={handleReserve}
        disabled={isCalculating || !!error || !priceDetails}
        className="w-full bg-nassayem text-white py-4 rounded-xl font-bold text-lg hover:bg-nassayem-dark transition-colors mb-4 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
      >
        {isCalculating ? (
          <svg
            className="animate-spin h-6 w-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        ) : isEn ? (
          "Reserve"
        ) : (
          "احجز الآن"
        )}
      </button>

      <p className="text-center text-gray-500 text-sm mb-6">
        {isEn ? "You won't be charged yet" : "لن يتم خصم المبلغ الآن"}
      </p>

      {/* Dynamic Price Breakdown */}
      {priceDetails && (
        <div className="animate-in fade-in duration-300">
          {priceDetails.promotion && (
            <div className="mb-4 p-3 rounded-xl bg-gradient-to-br from-[#2a7475]/10 to-[#deeff8] border border-[#2a7475]/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 bg-[#2a7475] text-white px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
                  </svg>
                  {isEn ? "Promotion" : "عرض"}
                </span>
                <span className="text-xs font-bold text-[#1d5455] truncate">
                  {isEn ? priceDetails.promotion.titleEn : priceDetails.promotion.titleAr}
                </span>
              </div>
              <div className="flex items-baseline gap-2 text-sm">
                <span className="text-gray-400 line-through">
                  {priceDetails.promotion.regularPrice} {isEn ? "OMR" : "ر.ع"}
                </span>
                <span className="text-[#2a7475] font-extrabold text-lg">
                  {priceDetails.promotion.promoPrice} {isEn ? "OMR" : "ر.ع"}
                </span>
                <span className="text-xs text-gray-500">
                  {isEn ? "/ night" : "/ ليلة"}
                </span>
              </div>
              {priceDetails.promotion.savings > 0 && (
                <p className="text-xs text-green-700 font-bold mt-1">
                  {isEn
                    ? `You save ${priceDetails.promotion.savings} OMR`
                    : `وفرت ${priceDetails.promotion.savings} ر.ع`}
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 border-b border-gray-200 pb-4 text-gray-600 text-sm">
            {priceDetails.promotion && (
              <div className="flex justify-between text-gray-400">
                <span>
                  {isEn ? "Original" : "السعر الأصلي"}
                </span>
                <span className="line-through">
                  {priceDetails.promotion.originalBaseRent} {isEn ? "OMR" : "ر.ع"}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="underline">
                {priceDetails.calculationMethod}
              </span>
              <span>
                {priceDetails.baseRent} {isEn ? "OMR" : "ر.ع"}
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 font-extrabold text-gray-900 text-lg">
            <span>{isEn ? "Total" : "المجموع"}</span>
            <span>
              {priceDetails.grandTotal} {isEn ? "OMR" : "ر.ع"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
