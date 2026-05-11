"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  getMonthlyPricingGrid,
  setBasePrice,
  clearBasePrice,
  copyMonthlyPricing,
  type MonthlyGridCell,
} from "@/app/actions/pricing";
import type { UnitType } from "@prisma/client";

type BuildingOption = { id: string; nameEn: string; nameAr: string };

const UNIT_TYPES: { value: UnitType; en: string; ar: string }[] = [
  { value: "STUDIO", en: "Studio", ar: "استوديو" },
  { value: "ONE_BEDROOM", en: "1 Bedroom", ar: "غرفة وصالة" },
  { value: "TWO_BEDROOM", en: "2 Bedrooms", ar: "غرفتين وصالة" },
  { value: "THREE_BEDROOM", en: "3 Bedrooms", ar: "ثلاث غرف وصالة" },
  { value: "VILLA", en: "Villa", ar: "فيلا" },
];

function monthLabel(year: number, month: number, isEn: boolean) {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString(isEn ? "en-US" : "ar-OM", {
    year: "numeric",
    month: "long",
  });
}

export default function PricingCalendarClient({
  locale,
  buildings,
}: {
  locale: string;
  buildings: BuildingOption[];
}) {
  const isEn = locale === "en";
  const today = new Date();

  const [buildingId, setBuildingId] = useState(buildings[0]?.id ?? "");
  const [unitType, setUnitType] = useState<UnitType>(UNIT_TYPES[0].value);
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth() + 1); // 1-12

  const [cells, setCells] = useState<MonthlyGridCell[]>([]);
  const [isLoading, startLoad] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [showCopyDialog, setShowCopyDialog] = useState(false);

  const loadGrid = useCallback(() => {
    if (!buildingId || !unitType) return;
    setError(null);
    startLoad(async () => {
      try {
        const data = await getMonthlyPricingGrid({ buildingId, unitType, year, month });
        setCells(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load grid");
      }
    });
  }, [buildingId, unitType, year, month]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  // ─── Cell mutation handlers ──────────────────────────────────

  const updateCellLocal = (date: string, patch: Partial<MonthlyGridCell>) => {
    setCells((prev) => prev.map((c) => (c.date === date ? { ...c, ...patch } : c)));
  };

  const saveCell = async (date: string, raw: string) => {
    const trimmed = raw.trim();
    try {
      if (trimmed === "") {
        await clearBasePrice({ buildingId, unitType, date });
        updateCellLocal(date, { basePrice: null });
      } else {
        const num = Number(trimmed);
        if (!Number.isFinite(num)) {
          setError(`Row ${date}: invalid number "${trimmed}"`);
          return;
        }
        const res = await setBasePrice({ buildingId, unitType, date, price: num });
        updateCellLocal(date, { basePrice: res.basePrice });
      }
    } catch (err: any) {
      setError(err?.message || `Failed to save ${date}`);
    }
  };

  const onCopy = async (payload: {
    sourceYear: number;
    sourceMonth: number;
    sourceBuildingId: string;
    sourceUnitType: UnitType;
    overwrite: boolean;
  }) => {
    try {
      const res = await copyMonthlyPricing({
        source: {
          buildingId: payload.sourceBuildingId,
          unitType: payload.sourceUnitType,
          year: payload.sourceYear,
          month: payload.sourceMonth,
        },
        target: { buildingId, unitType, year, month },
        overwrite: payload.overwrite,
      });
      setShowCopyDialog(false);
      // Reload grid to reflect copy
      loadGrid();
      setError(
        isEn
          ? `Copied: ${res.written} written, ${res.skipped} skipped.`
          : `تم النسخ: ${res.written} مكتوب، ${res.skipped} متجاوز.`,
      );
    } catch (err: any) {
      setError(err?.message || "Copy failed");
    }
  };

  // ─── Month navigation ────────────────────────────────────────

  const prevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else setMonth(month + 1);
  };

  // ─── Grid layout ─────────────────────────────────────────────

  const firstWeekday = useMemo(
    () => new Date(Date.UTC(year, month - 1, 1)).getUTCDay(), // 0=Sun
    [year, month],
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-end gap-3">
        <Field label={isEn ? "Building" : "المبنى"}>
          <select
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/40"
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {isEn ? b.nameEn : b.nameAr}
              </option>
            ))}
          </select>
        </Field>
        <Field label={isEn ? "Unit Type" : "نوع الوحدة"}>
          <select
            value={unitType}
            onChange={(e) => setUnitType(e.target.value as UnitType)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/40"
          >
            {UNIT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {isEn ? t.en : t.ar}
              </option>
            ))}
          </select>
        </Field>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center"
            aria-label={isEn ? "Previous month" : "الشهر السابق"}
          >
            <svg className="w-4 h-4 rtl:scale-x-[-1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="px-3 py-1.5 font-bold text-gray-900 min-w-[12rem] text-center">
            {monthLabel(year, month, isEn)}
          </div>
          <button
            type="button"
            onClick={nextMonth}
            className="w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center"
            aria-label={isEn ? "Next month" : "الشهر التالي"}
          >
            <svg className="w-4 h-4 rtl:scale-x-[-1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setShowCopyDialog(true)}
            className="ml-2 px-3 py-2 rounded-xl bg-nassayem/10 text-nassayem text-xs font-bold hover:bg-nassayem hover:text-white transition-colors"
          >
            {isEn ? "Copy from…" : "نسخ من…"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" /> {isEn ? "Priced" : "مُسعّر"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" /> {isEn ? "Unpriced" : "بدون سعر"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-amber-500">★</span> {isEn ? "Has per-unit override" : "يوجد استثناء لوحدة"}
        </span>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Weekday header */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100 text-xs font-bold uppercase tracking-wider text-gray-500">
          {(isEn
            ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
            : ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
          ).map((d) => (
            <div key={d} className="px-3 py-2 text-center">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {/* Leading blanks */}
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`blank-${i}`} className="min-h-[96px] bg-gray-50/50 border-e border-b border-gray-100" />
          ))}
          {cells.map((cell) => {
            const day = Number(cell.date.split("-")[2]);
            return (
              <CalendarCell
                key={cell.date}
                cell={cell}
                day={day}
                locale={locale}
                onSave={(raw) => saveCell(cell.date, raw)}
                overrideHref={`/${locale}/admin/pricing/overrides?buildingId=${buildingId}&date=${cell.date}`}
              />
            );
          })}
        </div>
        {isLoading && (
          <div className="border-t border-gray-100 px-6 py-3 text-xs text-gray-500 flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-nassayem" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {isEn ? "Loading grid…" : "جاري تحميل الشبكة…"}
          </div>
        )}
      </div>

      {/* Copy dialog */}
      {showCopyDialog && (
        <CopyDialog
          locale={locale}
          buildings={buildings}
          currentBuildingId={buildingId}
          currentUnitType={unitType}
          currentYear={year}
          currentMonth={month}
          onCancel={() => setShowCopyDialog(false)}
          onConfirm={onCopy}
        />
      )}
    </div>
  );
}

// ─── Single calendar cell with inline editing ────────────────────────

function CalendarCell({
  cell,
  day,
  locale,
  onSave,
  overrideHref,
}: {
  cell: MonthlyGridCell;
  day: number;
  locale: string;
  onSave: (raw: string) => Promise<void>;
  overrideHref: string;
}) {
  const isEn = locale === "en";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(
    cell.basePrice !== null ? String(cell.basePrice) : "",
  );
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(cell.basePrice !== null ? String(cell.basePrice) : "");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editing, cell.basePrice]);

  const commit = async () => {
    if (!editing) return;
    const original = cell.basePrice !== null ? String(cell.basePrice) : "";
    if (draft.trim() === original.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div
      className={`min-h-[96px] border-e border-b border-gray-100 p-2 flex flex-col gap-1 relative group ${
        cell.basePrice === null ? "bg-amber-50/30" : "bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-bold">{day}</span>
        <div className="flex items-center gap-1">
          {cell.hasUnitOverride && (
            <span title={isEn ? "Has per-unit override" : "يوجد استثناء"} className="text-amber-500 text-xs">
              ★
            </span>
          )}
          {cell.basePrice !== null ? (
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          )}
        </div>
      </div>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          step="0.001"
          min="0"
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setEditing(false);
            }
          }}
          className="w-full bg-white border border-nassayem rounded-md px-1.5 py-1 text-sm font-bold focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-start text-sm font-bold text-gray-900 hover:text-nassayem leading-tight"
        >
          {cell.basePrice !== null ? cell.basePrice.toFixed(3) : (
            <span className="text-gray-400 font-medium italic">
              {isEn ? "set" : "تعيين"}
            </span>
          )}
        </button>
      )}
      <Link
        href={overrideHref}
        className="mt-auto text-[10px] text-gray-400 hover:text-nassayem opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {isEn ? "Overrides →" : "الاستثناءات ←"}
      </Link>
      {saving && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
          <svg className="animate-spin h-4 w-4 text-nassayem" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ─── Copy dialog ────────────────────────────────────────────────────

function CopyDialog({
  locale,
  buildings,
  currentBuildingId,
  currentUnitType,
  currentYear,
  currentMonth,
  onCancel,
  onConfirm,
}: {
  locale: string;
  buildings: BuildingOption[];
  currentBuildingId: string;
  currentUnitType: UnitType;
  currentYear: number;
  currentMonth: number;
  onCancel: () => void;
  onConfirm: (payload: {
    sourceYear: number;
    sourceMonth: number;
    sourceBuildingId: string;
    sourceUnitType: UnitType;
    overwrite: boolean;
  }) => Promise<void>;
}) {
  const isEn = locale === "en";
  // Default source = previous month, same building+type.
  const initialSource = (() => {
    if (currentMonth === 1) return { y: currentYear - 1, m: 12 };
    return { y: currentYear, m: currentMonth - 1 };
  })();
  const [srcYear, setSrcYear] = useState(initialSource.y);
  const [srcMonth, setSrcMonth] = useState(initialSource.m);
  const [srcBuildingId, setSrcBuildingId] = useState(currentBuildingId);
  const [srcUnitType, setSrcUnitType] = useState<UnitType>(currentUnitType);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          {isEn ? "Copy prices from…" : "نسخ الأسعار من…"}
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <Field label={isEn ? "From Building" : "من مبنى"}>
            <select
              value={srcBuildingId}
              onChange={(e) => setSrcBuildingId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm"
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {isEn ? b.nameEn : b.nameAr}
                </option>
              ))}
            </select>
          </Field>
          <Field label={isEn ? "From Unit Type" : "من نوع وحدة"}>
            <select
              value={srcUnitType}
              onChange={(e) => setSrcUnitType(e.target.value as UnitType)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm"
            >
              {UNIT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {isEn ? t.en : t.ar}
                </option>
              ))}
            </select>
          </Field>
          <Field label={isEn ? "Year" : "السنة"}>
            <input
              type="number"
              value={srcYear}
              onChange={(e) => setSrcYear(Number(e.target.value))}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm"
            />
          </Field>
          <Field label={isEn ? "Month" : "الشهر"}>
            <select
              value={srcMonth}
              onChange={(e) => setSrcMonth(Number(e.target.value))}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {monthLabel(srcYear, m, isEn)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2 mt-4 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
            className="w-4 h-4 accent-nassayem"
          />
          {isEn
            ? "Overwrite existing prices in target month"
            : "استبدال الأسعار الموجودة في الشهر الهدف"}
        </label>
        <p className="text-xs text-gray-500 mt-1">
          {isEn
            ? "By default, only empty cells in the current view are filled."
            : "افتراضيًا، تُملأ الخلايا الفارغة فقط في العرض الحالي."}
        </p>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            {isEn ? "Cancel" : "إلغاء"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm({
                sourceYear: srcYear,
                sourceMonth: srcMonth,
                sourceBuildingId: srcBuildingId,
                sourceUnitType: srcUnitType,
                overwrite,
              });
              setBusy(false);
            }}
            className="px-5 py-2 rounded-xl font-bold text-white bg-nassayem hover:bg-nassayem-dark disabled:opacity-50 transition-colors"
          >
            {isEn ? "Copy" : "نسخ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
