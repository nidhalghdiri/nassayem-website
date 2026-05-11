"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  getPeriodPricing,
  setUnitOverride,
  clearUnitOverride,
  type PeriodPricingDay,
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

const SIGNIFICANT_DELTA = 0.3; // 30% — highlight rows where override differs by >30%

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export default function PricingOverridesClient({
  locale,
  buildings,
  units,
  initial,
}: {
  locale: string;
  buildings: BuildingOption[];
  units: UnitOption[];
  initial: { buildingId?: string; unitId?: string; focusDate?: string };
}) {
  const isEn = locale === "en";

  const [buildingId, setBuildingId] = useState(initial.buildingId ?? "");
  const [unitId, setUnitId] = useState(initial.unitId ?? "");
  // If focusDate is provided (from calendar deep link), expand around it.
  const initialStart = initial.focusDate ? addDays(initial.focusDate, -3) : todayIso();
  const initialEnd = initial.focusDate ? addDays(initial.focusDate, 3) : addDays(todayIso(), 6);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);

  const [days, setDays] = useState<PeriodPricingDay[]>([]);
  const [isLoading, startLoad] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === unitId) ?? null,
    [units, unitId],
  );

  // Reset unit if it doesn't belong to the selected building.
  useEffect(() => {
    if (unitId) {
      const u = units.find((x) => x.id === unitId);
      if (!u || u.buildingId !== buildingId) setUnitId("");
    }
  }, [buildingId, unitId, units]);

  const filteredUnits = useMemo(
    () => units.filter((u) => !buildingId || u.buildingId === buildingId),
    [units, buildingId],
  );

  const canLoad = buildingId && unitId && startDate && endDate;

  const load = useCallback(() => {
    if (!canLoad || !selectedUnit) return;
    setError(null);
    startLoad(async () => {
      try {
        const res = await getPeriodPricing({
          buildingId,
          unitType: selectedUnit.unitType,
          unitId,
          startDate,
          endDate,
        });
        setDays(res.days);
      } catch (err: any) {
        setError(err?.message || "Failed to load");
      }
    });
  }, [canLoad, selectedUnit, buildingId, unitId, startDate, endDate]);

  // Auto-load when all filters are set + when they change.
  useEffect(() => {
    load();
  }, [load]);

  const updateDayLocal = (date: string, patch: Partial<PeriodPricingDay>) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.date !== date) return d;
        const merged = { ...d, ...patch };
        // Recompute effectivePrice based on override > base rule.
        merged.effectivePrice =
          merged.overridePrice ?? merged.basePrice ?? null;
        merged.isUnpriced = merged.effectivePrice === null;
        return merged;
      }),
    );
  };

  const saveOverride = async (date: string, raw: string) => {
    const trimmed = raw.trim();
    try {
      if (trimmed === "") {
        await clearUnitOverride({ unitId, date });
        updateDayLocal(date, { overridePrice: null });
      } else {
        const num = Number(trimmed);
        if (!Number.isFinite(num)) {
          setError(`Row ${date}: invalid number "${trimmed}"`);
          return;
        }
        const res = await setUnitOverride({ unitId, date, price: num });
        updateDayLocal(date, { overridePrice: res.overridePrice });
      }
    } catch (err: any) {
      setError(err?.message || `Failed to save ${date}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
        <Field label={isEn ? "Unit" : "الوحدة"} required>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            disabled={!buildingId}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/40 disabled:opacity-50"
          >
            <option value="">— {isEn ? "Select" : "اختر"} —</option>
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

      {!canLoad && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-xl text-sm">
          {isEn
            ? "Select a building, a unit, and a date range to load overrides."
            : "اختر مبنى ووحدة ومدى تواريخ لتحميل الاستثناءات."}
        </div>
      )}

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Table */}
      {canLoad && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">
                {selectedUnit
                  ? `${selectedUnit.unitCode ? selectedUnit.unitCode + " — " : ""}${isEn ? selectedUnit.titleEn : selectedUnit.titleAr}`
                  : ""}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {isEn ? "Highlighted rows" : "الصفوف الملوّنة"}: {isEn ? "override differs from base by >30%" : "الاستثناء يختلف عن الأساسي بأكثر من 30%"}.
              </p>
            </div>
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <svg className="animate-spin h-4 w-4 text-nassayem" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {isEn ? "Loading…" : "جاري التحميل…"}
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-start">{isEn ? "Date" : "التاريخ"}</th>
                  <th className="px-4 py-2.5 text-end">{isEn ? "Type Base" : "أساسي للنوع"}</th>
                  <th className="px-4 py-2.5 text-end">{isEn ? "Override" : "الاستثناء"}</th>
                  <th className="px-4 py-2.5 text-end">{isEn ? "Effective" : "الفعلي"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {days.map((d) => (
                  <OverrideRow
                    key={d.date}
                    day={d}
                    onSave={(raw) => saveOverride(d.date, raw)}
                    locale={locale}
                  />
                ))}
                {days.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                      {isEn ? "No dates in range." : "لا تواريخ في المدى."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function OverrideRow({
  day,
  onSave,
  locale,
}: {
  day: PeriodPricingDay;
  onSave: (raw: string) => Promise<void>;
  locale: string;
}) {
  const isEn = locale === "en";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(
    day.overridePrice !== null ? String(day.overridePrice) : "",
  );
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(day.overridePrice !== null ? String(day.overridePrice) : "");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editing, day.overridePrice]);

  const commit = async () => {
    if (!editing) return;
    const original = day.overridePrice !== null ? String(day.overridePrice) : "";
    if (draft.trim() === original.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  };

  const isSignificant =
    day.overridePrice !== null &&
    day.basePrice !== null &&
    day.basePrice > 0 &&
    Math.abs(day.overridePrice - day.basePrice) / day.basePrice > SIGNIFICANT_DELTA;

  return (
    <tr className={isSignificant ? "bg-amber-50/40" : ""}>
      <td className="px-4 py-2 font-mono text-gray-700">{day.date}</td>
      <td className="px-4 py-2 text-end text-gray-600">
        {day.basePrice !== null ? day.basePrice.toFixed(3) : (
          <span className="text-amber-600 text-xs">{isEn ? "unpriced" : "بدون"}</span>
        )}
      </td>
      <td className="px-4 py-2 text-end">
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
            placeholder={isEn ? "blank = clear" : "فارغ = حذف"}
            className="w-28 bg-white border border-nassayem rounded-md px-2 py-1 text-end font-bold focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-end font-bold text-gray-900 hover:text-nassayem"
          >
            {day.overridePrice !== null ? day.overridePrice.toFixed(3) : (
              <span className="text-gray-400 font-medium italic">
                {isEn ? "set" : "تعيين"}
              </span>
            )}
          </button>
        )}
      </td>
      <td className="px-4 py-2 text-end font-bold">
        {day.isUnpriced ? (
          <span className="text-red-600 text-xs">{isEn ? "Unpriced" : "بدون سعر"}</span>
        ) : (
          day.effectivePrice!.toFixed(3)
        )}
      </td>
    </tr>
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
