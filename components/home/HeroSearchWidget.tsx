"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MONTHLY_DURATION_OPTIONS,
  addMonthsISO,
  formatISODisplay,
  monthsLabel,
  rangeTouchesKhareefISO,
} from "@/lib/monthlyDates";

export default function HeroSearchWidget({ locale }: { locale: string }) {
  const router = useRouter();
  const isEn = locale === "en";

  const [rentType, setRentType] = useState<"daily" | "monthly">("daily");
  const [unitType, setUnitType] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [months, setMonths] = useState(1);

  const today = new Date().toISOString().split("T")[0];
  const isMonthly = rentType === "monthly";

  // Monthly stays are counted in calendar months, not days:
  // 3 months from 17/11/2026 → check-out 17/02/2027.
  const monthlyCheckOut = isMonthly && checkIn ? addMonthsISO(checkIn, months) : "";
  const effectiveCheckOut = isMonthly ? monthlyCheckOut : checkOut;
  const touchesKhareef =
    isMonthly && !!monthlyCheckOut && rangeTouchesKhareefISO(checkIn, monthlyCheckOut);

  const handleCheckInChange = (value: string) => {
    setCheckIn(value);
    if (checkOut && checkOut <= value) setCheckOut("");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({ type: rentType });
    if (unitType) params.set("unitType", unitType);
    if (checkIn) params.set("checkIn", checkIn);
    if (effectiveCheckOut) params.set("checkOut", effectiveCheckOut);
    if (isMonthly) params.set("months", String(months));
    router.push(`/${locale}/properties?${params.toString()}`);
  };

  return (
    <div className="w-full">
      {/* Daily / Monthly tabs — sit on top of the search card */}
      <div className="flex justify-center -mb-2 relative z-10">
        <div className="bg-white/95 backdrop-blur-md border border-[#2a7475]/15 p-1 rounded-full flex gap-1 shadow-md">
          <button
            type="button"
            onClick={() => setRentType("daily")}
            className={`px-5 py-2 text-xs sm:text-sm font-semibold rounded-full transition-all duration-300 ${
              rentType === "daily"
                ? "bg-[#2a7475] text-white shadow-sm"
                : "text-[#1d5455] hover:bg-[#deeff8]"
            }`}
          >
            {isEn ? "Daily Rent" : "إيجار يومي"}
          </button>
          <button
            type="button"
            onClick={() => setRentType("monthly")}
            className={`px-5 py-2 text-xs sm:text-sm font-semibold rounded-full transition-all duration-300 ${
              rentType === "monthly"
                ? "bg-[#2a7475] text-white shadow-sm"
                : "text-[#1d5455] hover:bg-[#deeff8]"
            }`}
          >
            {isEn ? "Monthly Rent" : "إيجار شهري"}
          </button>
        </div>
      </div>

      {/* Horizontal search bar */}
      <form
        onSubmit={handleSearch}
        className="w-full bg-white/95 backdrop-blur-md border border-[#2a7475]/15 rounded-2xl shadow-2xl pt-6 pb-4 px-4 sm:px-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] gap-3 sm:gap-4 items-end"
      >
        {/* Unit Type */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-[#1d5455] tracking-wide uppercase">
            {isEn ? "Unit Type" : "نوع الوحدة"}
          </label>
          <select
            className="w-full bg-[#f5fbfd] text-[#1d5455] font-medium focus:outline-none focus:ring-2 focus:ring-[#2a7475]/40 border border-[#2a7475]/20 rounded-xl px-3 py-3 min-h-[48px] appearance-none cursor-pointer"
            value={unitType}
            onChange={(e) => setUnitType(e.target.value)}
          >
            <option value="">{isEn ? "Any Type" : "أي نوع"}</option>
            <option value="studio">{isEn ? "Studio" : "استوديو"}</option>
            <option value="1br">{isEn ? "1 Bedroom" : "غرفة فقط"}</option>
            <option value="2br">{isEn ? "2 Bedrooms" : "غرفتين وصالة"}</option>
            <option value="3br">{isEn ? "3 Bedrooms" : "ثلاث غرف وصالة"}</option>
            <option value="villa">{isEn ? "Villa" : "فيلا"}</option>
          </select>
        </div>

        {/* Check In */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-[#1d5455] tracking-wide uppercase">
            {isEn ? "Check In" : "الدخول"}
          </label>
          <input
            type="date"
            className="w-full bg-[#f5fbfd] text-[#1d5455] font-medium focus:outline-none focus:ring-2 focus:ring-[#2a7475]/40 border border-[#2a7475]/20 rounded-xl px-3 py-3 min-h-[48px]"
            value={checkIn}
            min={today}
            onChange={(e) => handleCheckInChange(e.target.value)}
          />
        </div>

        {/* Check Out (daily) / Duration in months (monthly) */}
        {isMonthly ? (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-[#1d5455] tracking-wide uppercase">
              {isEn ? "Duration" : "المدة"}
            </label>
            <select
              className="w-full bg-[#f5fbfd] text-[#1d5455] font-medium focus:outline-none focus:ring-2 focus:ring-[#2a7475]/40 border border-[#2a7475]/20 rounded-xl px-3 py-3 min-h-[48px] appearance-none cursor-pointer"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
            >
              {MONTHLY_DURATION_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {monthsLabel(n, isEn)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-[#1d5455] tracking-wide uppercase">
              {isEn ? "Check Out" : "الخروج"}
            </label>
            <input
              type="date"
              className="w-full bg-[#f5fbfd] text-[#1d5455] font-medium focus:outline-none focus:ring-2 focus:ring-[#2a7475]/40 border border-[#2a7475]/20 rounded-xl px-3 py-3 min-h-[48px]"
              value={checkOut}
              min={checkIn || today}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
        )}

        {/* Search Button */}
        <button
          type="submit"
          className="w-full lg:w-auto bg-[#2a7475] hover:bg-[#1d5455] text-white px-6 rounded-xl transition-colors flex justify-center items-center gap-2 shadow-md font-bold text-sm min-h-[48px] sm:col-span-2 lg:col-span-1"
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
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {isEn ? "Search" : "ابحث"}
        </button>

        {/* Monthly stay summary: the computed check-out date */}
        {isMonthly && (
          <div className="sm:col-span-2 lg:col-span-4 -mt-1 text-xs text-[#1d5455]/80">
            {monthlyCheckOut ? (
              <span>
                {isEn
                  ? `${monthsLabel(months, true)} · ${formatISODisplay(checkIn)} → ${formatISODisplay(monthlyCheckOut)}`
                  : `${monthsLabel(months, false)} · من ${formatISODisplay(checkIn)} إلى ${formatISODisplay(monthlyCheckOut)}`}
              </span>
            ) : (
              <span>
                {isEn
                  ? "Pick a check-in date — the check-out is set by the number of months."
                  : "اختر تاريخ الدخول — يُحدَّد تاريخ الخروج حسب عدد الأشهر."}
              </span>
            )}
            {touchesKhareef && (
              <span className="block mt-1 text-amber-700">
                {isEn
                  ? "Monthly rentals pause during Khareef (July–August) — choose a period ending by 30/06."
                  : "الإيجار الشهري متوقف خلال موسم الخريف (يوليو–أغسطس) — اختر فترة تنتهي قبل 30/06."}
              </span>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
