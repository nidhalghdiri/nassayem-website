"use client";

// Monthly pricing editor: one card per building, one row per unit type the
// building has, with the "شامل" and "غير شامل" monthly rates side by side.
// Each row saves on its own (Save button or Enter); clearing both rates stops
// monthly stays for that building + type.

import { useState, useTransition } from "react";
import { saveMonthlyPrice, type MonthlyGridRow } from "@/app/actions/monthlyPricing";
import type { UnitType } from "@prisma/client";

const UNIT_TYPES_META: Record<string, { en: string; ar: string }> = {
  STUDIO: { en: "Studio", ar: "استوديو" },
  ONE_BEDROOM: { en: "1 Bedroom", ar: "غرفة فقط" },
  TWO_BEDROOM: { en: "2 Bedrooms", ar: "غرفتين وصالة" },
  THREE_BEDROOM: { en: "3 Bedrooms", ar: "ثلاث غرف وصالة" },
  VILLA: { en: "Villa", ar: "فيلا" },
};

type RowState = {
  inclusive: string;
  exclusive: string;
  saved: { inclusive: string; exclusive: string };
  status: "idle" | "saving" | "saved" | "error";
  error?: string;
};

const toInput = (v: number | null) => (v === null ? "" : String(v));
const keyOf = (buildingId: string, unitType: UnitType) => `${buildingId}|${unitType}`;

function PriceInput({
  label,
  hint,
  value,
  onChange,
  onEnter,
  isEn,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  isEn: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-gray-500 mb-1" title={hint}>
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.5"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onEnter())}
          placeholder={isEn ? "Not offered" : "غير متاح"}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg ps-3 pe-12 py-2 text-sm font-semibold text-gray-900 placeholder:font-normal placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-nassayem/40 focus:bg-white"
          dir="ltr"
        />
        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
          {isEn ? "OMR" : "ر.ع"}
        </span>
      </div>
    </label>
  );
}

export default function MonthlyPricingClient({
  locale,
  grid,
}: {
  locale: string;
  grid: MonthlyGridRow[];
}) {
  const isEn = locale === "en";
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const b of grid) {
      for (const t of b.unitTypes) {
        const inclusive = toInput(t.inclusivePrice);
        const exclusive = toInput(t.exclusivePrice);
        init[keyOf(b.buildingId, t.unitType)] = {
          inclusive,
          exclusive,
          saved: { inclusive, exclusive },
          status: "idle",
        };
      }
    }
    return init;
  });

  const update = (key: string, patch: Partial<RowState>) =>
    setRows((r) => ({ ...r, [key]: { ...r[key], ...patch } }));

  const save = (buildingId: string, unitType: UnitType) => {
    const key = keyOf(buildingId, unitType);
    const row = rows[key];
    const parse = (s: string) => (s.trim() === "" ? null : Number(s));
    const inclusivePrice = parse(row.inclusive);
    const exclusivePrice = parse(row.exclusive);
    update(key, { status: "saving", error: undefined });
    startTransition(async () => {
      try {
        const res = await saveMonthlyPrice({ buildingId, unitType, inclusivePrice, exclusivePrice, locale });
        if (res.ok) {
          update(key, { status: "saved", saved: { inclusive: row.inclusive, exclusive: row.exclusive } });
          setTimeout(() => setRows((r) => (r[key]?.status === "saved" ? { ...r, [key]: { ...r[key], status: "idle" } } : r)), 2000);
        } else {
          update(key, { status: "error", error: res.error });
        }
      } catch (e) {
        update(key, { status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    });
  };

  if (grid.length === 0) {
    return (
      <p className="text-center text-gray-500 py-12 bg-white rounded-2xl border border-gray-100">
        {isEn ? "No buildings with units yet." : "لا توجد مبانٍ تحتوي وحدات بعد."}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {grid.map((b) => (
        <section key={b.buildingId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <h2 className="px-5 py-3 bg-gray-50 border-b border-gray-100 font-bold text-gray-900">
            {isEn ? b.buildingNameEn : b.buildingNameAr}
          </h2>
          <div className="divide-y divide-gray-100">
            {b.unitTypes.map((t) => {
              const key = keyOf(b.buildingId, t.unitType);
              const row = rows[key];
              const dirty = row.inclusive !== row.saved.inclusive || row.exclusive !== row.saved.exclusive;
              const offered = row.saved.inclusive !== "" || row.saved.exclusive !== "";
              return (
                <div key={key} className="px-5 py-4 grid grid-cols-2 sm:grid-cols-[1.2fr_1fr_1fr_auto] gap-3 items-end">
                  <div className="col-span-2 sm:col-span-1 self-center">
                    <p className="font-semibold text-gray-900 text-sm">
                      {isEn ? UNIT_TYPES_META[t.unitType]?.en : UNIT_TYPES_META[t.unitType]?.ar}
                    </p>
                    <p className="text-xs text-gray-400">
                      {t.unitCount} {isEn ? (t.unitCount === 1 ? "unit" : "units") : "وحدة"}
                      {" · "}
                      <span className={offered ? "text-emerald-600 font-semibold" : "text-gray-400"}>
                        {offered ? (isEn ? "Monthly offered" : "الشهري متاح") : (isEn ? "No monthly" : "لا يوجد شهري")}
                      </span>
                    </p>
                  </div>
                  <PriceInput
                    isEn={isEn}
                    label={isEn ? "Utilities included (شامل)" : "شامل الماء والكهرباء"}
                    hint={isEn ? "Water and electricity included" : "شامل الماء والكهرباء"}
                    value={row.inclusive}
                    onChange={(v) => update(key, { inclusive: v, status: "idle" })}
                    onEnter={() => dirty && save(b.buildingId, t.unitType)}
                  />
                  <PriceInput
                    isEn={isEn}
                    label={isEn ? "Not included (غير شامل)" : "غير شامل"}
                    hint={isEn ? "Water and electricity paid separately" : "الماء والكهرباء على المستأجر"}
                    value={row.exclusive}
                    onChange={(v) => update(key, { exclusive: v, status: "idle" })}
                    onEnter={() => dirty && save(b.buildingId, t.unitType)}
                  />
                  <div className="col-span-2 sm:col-span-1 flex sm:block items-center gap-2">
                    <button
                      type="button"
                      onClick={() => save(b.buildingId, t.unitType)}
                      disabled={!dirty || row.status === "saving"}
                      className="w-full sm:w-24 px-4 py-2 rounded-lg text-sm font-bold bg-nassayem text-white hover:bg-nassayem-dark disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                    >
                      {row.status === "saving"
                        ? "…"
                        : row.status === "saved"
                          ? isEn ? "Saved ✓" : "تم ✓"
                          : isEn ? "Save" : "حفظ"}
                    </button>
                  </div>
                  {row.status === "error" && row.error && (
                    <p className="col-span-2 sm:col-span-4 text-xs text-red-600">{row.error}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
