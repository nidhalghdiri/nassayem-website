"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import {
  MONTHLY_DURATION_OPTIONS,
  addMonthsISO,
  calendarMonthsBetweenISO,
  formatISODisplay,
  monthsLabel,
  rangeTouchesKhareefISO,
} from "@/lib/monthlyDates";

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
  const [unitType, setUnitType] = useState(searchParams.get("unitType") || "");
  const [dates, setDates] = useState({
    checkIn: searchParams.get("checkIn") || "",
    checkOut: searchParams.get("checkOut") || "",
  });

  // Monthly stays: a duration in calendar months instead of a check-out date.
  const [months, setMonths] = useState(() => {
    const fromUrl = Number(searchParams.get("months"));
    if (Number.isInteger(fromUrl) && fromUrl >= 1 && fromUrl <= 12) return fromUrl;
    const fromDates = calendarMonthsBetweenISO(
      searchParams.get("checkIn") || "",
      searchParams.get("checkOut") || "",
    );
    return fromDates && fromDates <= 12 ? fromDates : 1;
  });
  // Water & electricity filter for monthly rates: "" (any) | included | excluded.
  const [utilities, setUtilities] = useState(searchParams.get("utilities") || "");

  const today = new Date().toISOString().split("T")[0];
  const isMonthly = rentType === "monthly";
  const touchesKhareef =
    isMonthly && !!dates.checkIn && !!dates.checkOut &&
    rangeTouchesKhareefISO(dates.checkIn, dates.checkOut);

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

  // Update a stay date. Changing check-in clears a now-invalid check-out so
  // pricing never runs on an out-of-order range.
  const handleDateChange = (field: "checkIn" | "checkOut", value: string) => {
    const next = { ...dates, [field]: value };
    if (field === "checkIn" && next.checkOut && next.checkOut <= value) {
      next.checkOut = "";
    }
    setDates(next);
    applyFilters({
      checkIn: next.checkIn || null,
      checkOut: next.checkOut || null,
    });
  };

  // Monthly: check-in + N months → check-out exactly N calendar months later
  // (3 months from 17/11/2026 → 17/02/2027).
  const handleMonthlyChange = (checkIn: string, n: number) => {
    const checkOut = checkIn ? addMonthsISO(checkIn, n) : "";
    setDates({ checkIn, checkOut });
    setMonths(n);
    applyFilters({
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      months: String(n),
    });
  };

  const switchRentType = (type: "daily" | "monthly") => {
    setRentType(type);
    if (type === "monthly") {
      const checkOut = dates.checkIn ? addMonthsISO(dates.checkIn, months) : "";
      setDates({ checkIn: dates.checkIn, checkOut });
      applyFilters({
        type,
        checkIn: dates.checkIn || null,
        checkOut: checkOut || null,
        months: String(months),
      });
    } else {
      setUtilities("");
      applyFilters({ type, months: null, utilities: null });
    }
  };

  // Reset every filter field, including the stay dates.
  const clearAll = () => {
    setUnitType("");
    setRentType("daily");
    setMonths(1);
    setUtilities("");
    setPriceRange({ min: "", max: "" });
    setDates({ checkIn: "", checkOut: "" });
    router.push(pathname, { scroll: false });
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

  const unitTypeOptions = [
    { value: "studio", labelEn: "Studio", labelAr: "استوديو" },
    { value: "1br", labelEn: "1 Bedroom", labelAr: "غرفة فقط" },
    { value: "2br", labelEn: "2 Bedrooms", labelAr: "غرفتين وصالة" },
    { value: "3br", labelEn: "3 Bedrooms", labelAr: "ثلاث غرف وصالة" },
    { value: "villa", labelEn: "Villa", labelAr: "فيلا" },
  ];

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm sticky top-24">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          {isEn ? "Filters" : "عوامل التصفية"}
        </h2>
        <button
          onClick={clearAll}
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
            onClick={() => switchRentType("daily")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${rentType === "daily" ? "bg-white text-nassayem shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
          >
            {isEn ? "Daily" : "يومي"}
          </button>
          <button
            onClick={() => switchRentType("monthly")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${rentType === "monthly" ? "bg-white text-nassayem shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
          >
            {isEn ? "Monthly" : "شهري"}
          </button>
        </div>
      </div>

      {/* Stay Dates — daily: check-in/check-out; monthly: check-in + months */}
      <div className="mb-8">
        <h3 className="font-semibold text-gray-900 mb-4">
          {isMonthly
            ? isEn ? "Stay Period" : "مدة الإقامة"
            : isEn ? "Stay Dates" : "تواريخ الإقامة"}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              {isEn ? "Check-in" : "تاريخ الدخول"}
            </label>
            <input
              type="date"
              value={dates.checkIn}
              min={today}
              onChange={(e) =>
                isMonthly
                  ? handleMonthlyChange(e.target.value, months)
                  : handleDateChange("checkIn", e.target.value)
              }
              className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:border-nassayem focus:ring-1 focus:ring-nassayem transition-all cursor-pointer"
            />
          </div>
          {isMonthly ? (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  {isEn ? "Number of months" : "عدد الأشهر"}
                </label>
                <select
                  value={months}
                  onChange={(e) => handleMonthlyChange(dates.checkIn, Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:border-nassayem focus:ring-1 focus:ring-nassayem transition-all cursor-pointer"
                >
                  {MONTHLY_DURATION_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {monthsLabel(n, isEn)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-2.5 text-sm">
                <span className="text-xs text-gray-500 block mb-0.5">
                  {isEn ? "Check-out" : "تاريخ الخروج"}
                </span>
                {dates.checkOut ? (
                  <span className="font-semibold text-gray-900">
                    {formatISODisplay(dates.checkOut)}
                  </span>
                ) : (
                  <span className="text-gray-400 text-xs">
                    {isEn ? "Set automatically from check-in + months" : "يُحدَّد تلقائيًا من تاريخ الدخول وعدد الأشهر"}
                  </span>
                )}
              </div>
              {touchesKhareef && (
                <p className="text-xs text-amber-700">
                  {isEn
                    ? "Monthly rentals pause during Khareef (July–August) — choose a period ending by 30/06."
                    : "الإيجار الشهري متوقف خلال موسم الخريف (يوليو–أغسطس) — اختر فترة تنتهي قبل 30/06."}
                </p>
              )}
            </>
          ) : (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                {isEn ? "Check-out" : "تاريخ الخروج"}
              </label>
              <input
                type="date"
                value={dates.checkOut}
                min={dates.checkIn || today}
                onChange={(e) => handleDateChange("checkOut", e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:border-nassayem focus:ring-1 focus:ring-nassayem transition-all cursor-pointer"
              />
            </div>
          )}
        </div>
      </div>

      {/* Water & electricity — monthly rates only */}
      {isMonthly && (
        <div className="mb-8">
          <h3 className="font-semibold text-gray-900 mb-4">
            {isEn ? "Water & Electricity" : "الماء والكهرباء"}
          </h3>
          <div className="flex bg-gray-50 p-1 rounded-xl">
            {[
              { value: "", labelEn: "Any", labelAr: "الكل" },
              { value: "included", labelEn: "Included", labelAr: "شامل" },
              { value: "excluded", labelEn: "Not included", labelAr: "غير شامل" },
            ].map((opt) => (
              <button
                key={opt.value || "any"}
                onClick={() => {
                  setUtilities(opt.value);
                  applyFilters({ utilities: opt.value || null });
                }}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${utilities === opt.value ? "bg-white text-nassayem shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
              >
                {isEn ? opt.labelEn : opt.labelAr}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Unit Type */}
      <div className="mb-8">
        <h3 className="font-semibold text-gray-900 mb-4">
          {isEn ? "Unit Type" : "نوع الوحدة"}
        </h3>
        <select
          value={unitType}
          onChange={(e) => {
            setUnitType(e.target.value);
            applyFilters({ unitType: e.target.value || null });
          }}
          className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:border-nassayem focus:ring-1 focus:ring-nassayem transition-all cursor-pointer"
        >
          <option value="">{isEn ? "Any Type" : "أي نوع"}</option>
          {unitTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {isEn ? opt.labelEn : opt.labelAr}
            </option>
          ))}
        </select>
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
