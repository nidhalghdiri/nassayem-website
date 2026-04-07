"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HeroSearchWidget({ locale }: { locale: string }) {
  const router = useRouter();
  const isEn = locale === "en";

  const [rentType, setRentType] = useState<"daily" | "monthly">("daily");
  const [unitType, setUnitType] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({
      type: rentType,
      unitType,
      checkIn,
      checkOut,
    });
    router.push(`/${locale}/properties?${params.toString()}`);
  };

  return (
    <div className="w-full max-w-xl flex flex-col">
      {/* Rent Type Toggle */}
      <div className="bg-[#deeff8]/70 backdrop-blur-md border border-[#2a7475]/20 p-1 rounded-full mb-4 flex gap-1 shadow-sm self-start">
        <button
          onClick={() => setRentType("daily")}
          className={`px-5 py-2 text-sm font-semibold rounded-full transition-all duration-300 ${
            rentType === "daily"
              ? "bg-[#2a7475] text-white shadow-md"
              : "text-[#1d5455] hover:bg-[#deeff8]"
          }`}
        >
          {isEn ? "Daily Rent" : "إيجار يومي"}
        </button>
        <button
          onClick={() => setRentType("monthly")}
          className={`px-5 py-2 text-sm font-semibold rounded-full transition-all duration-300 ${
            rentType === "monthly"
              ? "bg-[#2a7475] text-white shadow-md"
              : "text-[#1d5455] hover:bg-[#deeff8]"
          }`}
        >
          {isEn ? "Monthly Rent" : "إيجار شهري"}
        </button>
      </div>

      {/* Search Card */}
      <form
        onSubmit={handleSearch}
        className="w-full bg-[#deeff8]/85 backdrop-blur-md border border-[#2a7475]/20 rounded-2xl shadow-xl p-4 flex flex-col gap-3"
      >
        {/* Unit Type */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-[#1d5455] tracking-wide uppercase">
            {isEn ? "Unit Type" : "نوع الوحدة"}
          </label>
          <select
            className="w-full bg-white/70 text-[#1d5455] font-medium focus:outline-none border border-[#2a7475]/20 rounded-xl px-4 py-3 appearance-none cursor-pointer"
            value={unitType}
            onChange={(e) => setUnitType(e.target.value)}
          >
            <option value="">{isEn ? "Any Type" : "أي نوع"}</option>
            <option value="studio">{isEn ? "Studio" : "استوديو"}</option>
            <option value="1br">{isEn ? "1 Bedroom" : "غرفة وصالة"}</option>
            <option value="2br">{isEn ? "2 Bedrooms" : "غرفتين وصالة"}</option>
            <option value="villa">{isEn ? "Villa" : "فيلا"}</option>
          </select>
        </div>

        {/* Dates Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Check In */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-[#1d5455] tracking-wide uppercase">
              {isEn ? "Check In" : "الدخول"}
            </label>
            <input
              type="date"
              className="w-full bg-white/70 text-[#1d5455] font-medium focus:outline-none border border-[#2a7475]/20 rounded-xl px-4 py-3 min-h-[48px]"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
            />
          </div>

          {/* Check Out */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-[#1d5455] tracking-wide uppercase">
              {isEn ? "Check Out" : "الخروج"}
            </label>
            <input
              type="date"
              className="w-full bg-white/70 text-[#1d5455] font-medium focus:outline-none border border-[#2a7475]/20 rounded-xl px-4 py-3 min-h-[48px]"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
        </div>

        {/* Search Button */}
        <button
          type="submit"
          className="w-full bg-[#2a7475] hover:bg-[#1d5455] text-white py-3.5 rounded-xl transition-colors flex justify-center items-center gap-2 shadow-md font-bold text-sm"
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
          {isEn ? "Search Properties" : "ابحث عن وحدات"}
        </button>
      </form>
    </div>
  );
}
