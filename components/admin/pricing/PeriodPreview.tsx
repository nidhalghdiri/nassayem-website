"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  getPeriodPricing,
  type PeriodPricingResult,
} from "@/app/actions/pricing";
import type { UnitType } from "@prisma/client";

type BuildingOption = { id: string; nameEn: string; nameAr: string };
type UnitOption = {
  id: string;
  buildingId: string;
  unitType: UnitType;
  unitCode: string | null;
  titleEn: string;
  titleAr: string;
};

const UNIT_TYPES: { value: UnitType; en: string; ar: string }[] = [
  { value: "STUDIO", en: "Studio", ar: "استوديو" },
  { value: "ONE_BEDROOM", en: "1 Bedroom", ar: "غرفة وصالة" },
  { value: "TWO_BEDROOM", en: "2 Bedrooms", ar: "غرفتين وصالة" },
  { value: "THREE_BEDROOM", en: "3 Bedrooms", ar: "ثلاث غرف وصالة" },
  { value: "VILLA", en: "Villa", ar: "فيلا" },
];

type Props = {
  locale: string;
  buildings: BuildingOption[];
  units: UnitOption[];
  // Optional initial values — useful when embedding on context pages
  // (e.g. the Calendar screen pre-fills the building + unit type + month).
  initial?: {
    buildingId?: string;
    unitType?: UnitType;
    unitId?: string | null;
    startDate?: string;
    endDate?: string;
  };
  // Default panel open?
  defaultOpen?: boolean;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export default function PeriodPreview({
  locale,
  buildings,
  units,
  initial,
  defaultOpen = false,
}: Props) {
  const isEn = locale === "en";

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [buildingId, setBuildingId] = useState(initial?.buildingId ?? "");
  const [unitType, setUnitType] = useState<UnitType | "">(
    initial?.unitType ?? "",
  );
  const [unitId, setUnitId] = useState<string>(initial?.unitId ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayIso());
  const [endDate, setEndDate] = useState(
    initial?.endDate ?? addDays(todayIso(), 6),
  );
  const [result, setResult] = useState<PeriodPricingResult | null>(null);
  const [isLoading, startLoad] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Reset unit selection when building or type changes (units must match).
  useEffect(() => {
    if (unitId) {
      const u = units.find((x) => x.id === unitId);
      if (!u || u.buildingId !== buildingId || (unitType && u.unitType !== unitType)) {
        setUnitId("");
      }
    }
  }, [buildingId, unitType, unitId, units]);

  const filteredUnits = useMemo(
    () =>
      units.filter(
        (u) =>
          (!buildingId || u.buildingId === buildingId) &&
          (!unitType || u.unitType === unitType),
      ),
    [units, buildingId, unitType],
  );

  const canRun = buildingId && unitType && startDate && endDate;

  const runPreview = () => {
    setError(null);
    if (!canRun) {
      setError(
        isEn
          ? "Building, unit type, start, and end dates are all required."
          : "المبنى ونوع الوحدة وتاريخا البداية والنهاية مطلوبة.",
      );
      return;
    }
    if (startDate > endDate) {
      setError(isEn ? "Start date must be before end date." : "تاريخ البداية يجب أن يسبق النهاية.");
      return;
    }
    startLoad(async () => {
      try {
        const data = await getPeriodPricing({
          buildingId,
          unitType: unitType as UnitType,
          unitId: unitId || null,
          startDate,
          endDate,
        });
        setResult(data);
      } catch (err: any) {
        setError(err?.message || "Failed to compute preview");
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-nassayem/10 text-nassayem flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2a4 4 0 014-4h6m0 0l-3-3m3 3l-3 3M3 3h6a4 4 0 014 4v0" />
            </svg>
          </div>
          <h3 className="font-bold text-gray-900">
            {isEn ? "Period Preview" : "معاينة الفترة"}
          </h3>
          {result && result.totals.unpricedNights > 0 && (
            <span className="inline-flex bg-red-50 text-red-700 px-2 py-0.5 rounded-full text-[11px] font-bold">
              {result.totals.unpricedNights} {isEn ? "unpriced" : "بدون سعر"}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Field label={isEn ? "Building" : "المبنى"} required>
              <select
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/40"
              >
                <option value="">— {isEn ? "Select" : "اختر"} —</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {isEn ? b.nameEn : b.nameAr}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={isEn ? "Unit Type" : "نوع الوحدة"} required>
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value as UnitType | "")}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/40"
              >
                <option value="">— {isEn ? "Select" : "اختر"} —</option>
                {UNIT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {isEn ? t.en : t.ar}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={isEn ? "Unit (optional)" : "الوحدة (اختياري)"}>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/40"
              >
                <option value="">{isEn ? "Use type base only" : "السعر الأساسي للنوع فقط"}</option>
                {filteredUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unitCode ? `${u.unitCode} — ` : ""}
                    {isEn ? u.titleEn : u.titleAr}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={isEn ? "Start date" : "تاريخ البداية"} required>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/40"
              />
            </Field>
            <Field label={isEn ? "End date" : "تاريخ النهاية"} required>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/40"
              />
            </Field>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {isEn ? "Both dates inclusive." : "كلا التاريخين شاملان."}
            </p>
            <button
              type="button"
              onClick={runPreview}
              disabled={isLoading || !canRun}
              className="px-4 py-2 rounded-xl bg-nassayem text-white font-bold text-sm hover:bg-nassayem-dark transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isEn ? "Run preview" : "تشغيل المعاينة"}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {/* Summary cards */}
          {result && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard
                  label={isEn ? "Nights" : "الليالي"}
                  value={String(result.totals.nights)}
                  hint={
                    result.totals.unpricedNights > 0
                      ? isEn
                        ? `${result.totals.pricedNights} priced`
                        : `${result.totals.pricedNights} مُسعّرة`
                      : null
                  }
                />
                <SummaryCard
                  label={isEn ? "Initial price" : "السعر الأول"}
                  value={formatPrice(result.totals.initialPrice, isEn)}
                />
                <SummaryCard
                  label={isEn ? "Final price" : "السعر الأخير"}
                  value={formatPrice(result.totals.finalPrice, isEn)}
                />
                <SummaryCard
                  label={isEn ? "Total" : "الإجمالي"}
                  value={
                    result.totals.total === null
                      ? isEn ? "— (unpriced days)" : "— (أيام بدون سعر)"
                      : formatPrice(result.totals.total, isEn)
                  }
                  tone={result.totals.total === null ? "text-red-600" : "text-gray-900"}
                />
              </div>

              {/* Per-day breakdown */}
              <div className="overflow-hidden rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="px-4 py-2.5 text-start">{isEn ? "Date" : "التاريخ"}</th>
                      <th className="px-4 py-2.5 text-end">{isEn ? "Base" : "الأساسي"}</th>
                      <th className="px-4 py-2.5 text-end">{isEn ? "Override" : "الاستثناء"}</th>
                      <th className="px-4 py-2.5 text-end">{isEn ? "Effective" : "الفعلي"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.days.map((d) => (
                      <tr key={d.date} className={d.isUnpriced ? "bg-red-50/50" : ""}>
                        <td className="px-4 py-2 font-mono text-gray-700">{d.date}</td>
                        <td className="px-4 py-2 text-end text-gray-600">
                          {d.basePrice !== null ? d.basePrice.toFixed(3) : "—"}
                        </td>
                        <td className="px-4 py-2 text-end text-gray-600">
                          {d.overridePrice !== null ? d.overridePrice.toFixed(3) : "—"}
                        </td>
                        <td className="px-4 py-2 text-end font-bold">
                          {d.isUnpriced ? (
                            <span className="text-red-600">
                              {isEn ? "Unpriced" : "بدون سعر"}
                            </span>
                          ) : (
                            d.effectivePrice!.toFixed(3)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">
        {label}
        {required && <span className="text-red-500 ms-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "text-gray-900",
}: {
  label: string;
  value: string;
  hint?: string | null;
  tone?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3">
      <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold">{label}</p>
      <p className={`text-lg font-extrabold mt-0.5 ${tone}`}>{value}</p>
      {hint && <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>}
    </div>
  );
}

function formatPrice(p: number | null, isEn: boolean) {
  if (p === null) return "—";
  return `${p.toFixed(3)} ${isEn ? "OMR" : "ر.ع"}`;
}
