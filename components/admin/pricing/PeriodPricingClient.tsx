"use client";

import { useState, useTransition } from "react";
import { setPeriodPricing } from "@/app/actions/pricing";
import type { UnitType } from "@prisma/client";

type BuildingOption = { id: string; nameEn: string; nameAr: string };

const UNIT_TYPES: { value: UnitType; en: string; ar: string }[] = [
  { value: "STUDIO", en: "Studio", ar: "استوديو" },
  { value: "ONE_BEDROOM", en: "1 Bedroom", ar: "غرفة وصالة" },
  { value: "TWO_BEDROOM", en: "2 Bedrooms", ar: "غرفتين وصالة" },
  { value: "THREE_BEDROOM", en: "3 Bedrooms", ar: "ثلاث غرف وصالة" },
  { value: "VILLA", en: "Villa", ar: "فيلا" },
];

export default function PeriodPricingClient({
  locale,
  buildings,
}: {
  locale: string;
  buildings: BuildingOption[];
}) {
  const isEn = locale === "en";

  const [buildingId, setBuildingId] = useState(buildings[0]?.id ?? "");
  const [unitType, setUnitType] = useState<UnitType>(UNIT_TYPES[0].value);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [price, setPrice] = useState("");
  const [overwrite, setOverwrite] = useState(true);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    written: number;
    skipped: number;
    totalDays: number;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError(isEn ? "Enter a valid non-negative price." : "أدخل سعراً صحيحاً غير سالب.");
      return;
    }
    if (!fromDate || !toDate) {
      setError(isEn ? "Please pick both From and To dates." : "يرجى اختيار تاريخ البداية والنهاية.");
      return;
    }
    if (fromDate > toDate) {
      setError(
        isEn
          ? "From date must be on or before To date."
          : "يجب أن يكون تاريخ البداية قبل تاريخ النهاية أو مساوياً له.",
      );
      return;
    }

    startTransition(async () => {
      try {
        const res = await setPeriodPricing({
          buildingId,
          unitType,
          fromDate,
          toDate,
          price: priceNum,
          overwrite,
        });
        setResult(res);
      } catch (err: any) {
        setError(err?.message || (isEn ? "Failed to save" : "فشل الحفظ"));
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Building */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            {isEn ? "Building" : "المبنى"} <span className="text-red-500">*</span>
          </label>
          <select
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            required
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50"
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {isEn ? b.nameEn : b.nameAr}
              </option>
            ))}
          </select>
        </div>

        {/* Unit Type */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            {isEn ? "Unit Type" : "نوع الوحدة"} <span className="text-red-500">*</span>
          </label>
          <select
            value={unitType}
            onChange={(e) => setUnitType(e.target.value as UnitType)}
            required
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50"
          >
            {UNIT_TYPES.map((u) => (
              <option key={u.value} value={u.value}>
                {isEn ? u.en : u.ar}
              </option>
            ))}
          </select>
        </div>

        {/* From Date */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            {isEn ? "From Date" : "من تاريخ"} <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            required
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50"
          />
        </div>

        {/* To Date */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            {isEn ? "To Date" : "إلى تاريخ"} <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            min={fromDate || undefined}
            required
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50"
          />
        </div>

        {/* Price */}
        <div className="md:col-span-2">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            {isEn ? "Daily Price (OMR)" : "السعر اليومي (ر.ع)"}{" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            min="0"
            step="0.001"
            required
            placeholder={isEn ? "e.g. 35.000" : "مثلاً 35.000"}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50"
            dir="ltr"
          />
          <p className="text-xs text-gray-400 mt-1">
            {isEn
              ? "This price will apply to every day in the selected range."
              : "سيُطبَّق هذا السعر على كل يوم ضمن المدة المحددة."}
          </p>
        </div>
      </div>

      {/* Overwrite toggle */}
      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 bg-gray-50">
        <input
          type="checkbox"
          checked={overwrite}
          onChange={(e) => setOverwrite(e.target.checked)}
          className="w-5 h-5 text-nassayem rounded-md focus:ring-nassayem border-gray-300"
        />
        <div>
          <p className="font-bold text-gray-900 text-sm">
            {isEn ? "Overwrite existing prices in this range" : "استبدال الأسعار الموجودة ضمن المدة"}
          </p>
          <p className="text-xs text-gray-500">
            {isEn
              ? "Uncheck to fill only the days that have no price yet."
              : "ألغِ التحديد لتعبئة الأيام التي لا تحتوي على سعر فقط."}
          </p>
        </div>
      </label>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 font-medium">
          {error}
        </div>
      )}

      {result && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-sm rounded-xl border border-emerald-100">
          <p className="font-bold mb-1">
            {isEn ? "Period saved" : "تم حفظ المدة"}
          </p>
          <p>
            {isEn
              ? `${result.written} day${result.written === 1 ? "" : "s"} written, ${result.skipped} skipped, out of ${result.totalDays} total.`
              : `تم حفظ ${result.written} يوم، وتمّ تخطّي ${result.skipped}، من أصل ${result.totalDays} يوم.`}
          </p>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="bg-nassayem text-white px-8 py-3 rounded-xl font-bold hover:bg-nassayem-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isPending ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {isEn ? "Saving..." : "جارٍ الحفظ..."}
            </>
          ) : isEn ? (
            "Apply Period Price"
          ) : (
            "تطبيق سعر المدة"
          )}
        </button>
      </div>
    </form>
  );
}
