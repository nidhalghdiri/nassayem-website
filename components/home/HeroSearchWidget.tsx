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
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
      {/* Rent Type Toggle */}
      <div className="bg-[#deeff8]/60 backdrop-blur-md border border-[#2a7475]/20 p-1 rounded-full mb-6 flex gap-1 shadow-sm">
        <button
          onClick={() => setRentType("daily")}
          className={`px-6 py-2 text-sm font-semibold rounded-full transition-all duration-300 ${
            rentType === "daily"
              ? "bg-[#2a7475] text-white shadow-md"
              : "text-[#1d5455] hover:bg-[#deeff8]"
          }`}
        >
          {isEn ? "Daily Rent" : "إيجار يومي"}
        </button>
        <button
          onClick={() => setRentType("monthly")}
          className={`px-6 py-2 text-sm font-semibold rounded-full transition-all duration-300 ${
            rentType === "monthly"
              ? "bg-[#2a7475] text-white shadow-md"
              : "text-[#1d5455] hover:bg-[#deeff8]"
          }`}
        >
          {isEn ? "Monthly Rent" : "إيجار شهري"}
        </button>
      </div>

      {/* Main Search Bar */}
      <form
        onSubmit={handleSearch}
        className="w-full bg-[#deeff8]/80 backdrop-blur-md border border-[#2a7475]/20 rounded-full shadow-xl flex flex-col md:flex-row items-center divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-[#2a7475]/15 p-2"
      >
        {/* Unit Type */}
        <div className="flex-1 w-full px-6 py-2 cursor-pointer hover:bg-[#deeff8] rounded-full transition-colors">
          <label className="block text-xs font-bold text-[#1d5455] tracking-wide uppercase mb-1">
            {isEn ? "Unit Type" : "نوع الوحدة"}
          </label>
          <select
            className="w-full bg-transparent text-[#2a7475] font-medium focus:outline-none appearance-none cursor-pointer"
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

        {/* Check In */}
        <div className="flex-1 w-full px-6 py-2 hover:bg-[#deeff8] rounded-full transition-colors">
          <label className="block text-xs font-bold text-[#1d5455] tracking-wide uppercase mb-1">
            {isEn ? "Check In" : "تسجيل الدخول"}
          </label>
          <input
            type="date"
            className="w-full bg-transparent text-[#2a7475] font-medium focus:outline-none"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
          />
        </div>

        {/* Check Out */}
        <div className="flex-1 w-full px-6 py-2 hover:bg-[#deeff8] rounded-full transition-colors">
          <label className="block text-xs font-bold text-[#1d5455] tracking-wide uppercase mb-1">
            {isEn ? "Check Out" : "تسجيل الخروج"}
          </label>
          <input
            type="date"
            className="w-full bg-transparent text-[#2a7475] font-medium focus:outline-none"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </div>

        {/* Search Button */}
        <div className="px-2 w-full md:w-auto mt-2 md:mt-0">
          <button
            type="submit"
            className="w-full md:w-auto bg-[#2a7475] hover:bg-[#1d5455] text-white p-4 rounded-full transition-colors flex justify-center items-center shadow-md"
          >
            <svg
              className="w-5 h-5 md:me-2"
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
            <span className="md:hidden font-bold">
              {isEn ? "Search" : "ابحث"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
