"use client";

import React, { useId, useMemo, useState } from "react";
import { Building2, Search, MapPin } from "lucide-react";
import type { UnitOption } from "@/app/actions/maintenanceRequest";
import { buildingLabel } from "@/lib/buildingLabel";
import { COMMON_AREA_PLACES, ROOMS } from "@/lib/maintenance/categories";

type BuildingOption = { id: string; nameEn: string; nameAr: string; shortName: string | null };

export const naturalSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

type Props = {
  isEn: boolean;
  buildings: BuildingOption[];
  units: UnitOption[];
  buildingId: string;
  onBuildingChange: (id: string) => void;
  /** undefined = nothing chosen yet, null = common area, string = a unit id */
  unitId: string | null | undefined;
  onUnitChange: (value: string | null | undefined) => void;
  /**
   * "other": the exact place is required — a unit, or a named place in a common area.
   * "equipment": only narrows down the device list, so everything is optional.
   */
  mode: "equipment" | "other";
  room?: string;
  onRoomChange?: (room: string) => void;
  place?: string;
  onPlaceChange?: (place: string) => void;
};

/** Building → unit (tap a chip) → room (units) or place (common areas). */
export default function LocationPicker({
  isEn, buildings, units, buildingId, onBuildingChange, unitId, onUnitChange, mode,
  room = "", onRoomChange, place = "", onPlaceChange,
}: Props) {
  const uid = useId();
  const [search, setSearch] = useState("");

  const t = {
    building: isEn ? "Building" : "المبنى",
    selectBuilding: isEn ? "Select building" : "اختر المبنى",
    unit: isEn ? "Unit" : "الوحدة",
    optional: isEn ? "optional" : "اختياري",
    commonArea: isEn ? "Common area" : "منطقة مشتركة",
    searchUnit: isEn ? "Search unit…" : "ابحث عن الوحدة…",
    noMatch: isEn ? "No unit matches your search." : "لا توجد وحدة مطابقة.",
    room: isEn ? "Room" : "الغرفة",
    place: isEn ? "Where in the common area?" : "أين في المنطقة المشتركة؟",
    placePlaceholder: isEn ? "e.g. Lobby, 3rd floor corridor" : "مثال: اللوبي، ممر الطابق الثالث",
  };

  const buildingUnits = useMemo(
    () => units.filter((u) => u.buildingId === buildingId).sort((a, b) => naturalSort(a.name, b.name)),
    [units, buildingId],
  );
  const q = search.trim().toLowerCase();
  const shown = q ? buildingUnits.filter((u) => u.name.toLowerCase().includes(q)) : buildingUnits;
  const building = buildings.find((b) => b.id === buildingId);

  const chip = (selected: boolean) =>
    `px-3 py-1.5 rounded-xl border text-sm font-semibold transition-colors ${
      selected
        ? "bg-nassayem text-white border-nassayem shadow-sm"
        : "bg-white text-slate-700 border-slate-200 hover:border-nassayem/50 hover:bg-nassayem/5"
    }`;

  return (
    <div className="space-y-4">
      {/* Building */}
      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1.5" htmlFor={`${uid}-b`}>{t.building}</label>
        {buildings.length === 1 ? (
          <div className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800">
            <Building2 className="w-4 h-4 text-nassayem shrink-0" />
            {buildingLabel(buildings[0], isEn)}
          </div>
        ) : (
          <select
            id={`${uid}-b`}
            value={buildingId}
            onChange={(e) => { setSearch(""); onBuildingChange(e.target.value); }}
            className="w-full px-3.5 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
          >
            <option value="">{t.selectBuilding}</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{buildingLabel(b, isEn)}</option>
            ))}
          </select>
        )}
      </div>

      {/* Unit */}
      {buildingId && (
        <div>
          <p className="block text-xs font-bold text-slate-500 mb-1.5">
            {t.unit}
            {mode === "equipment" && <span className="font-medium text-slate-400"> ({t.optional})</span>}
            {building && <span className="font-medium text-slate-400"> · {buildingLabel(building, isEn)}</span>}
          </p>

          {buildingUnits.length > 12 && (
            <div className="relative mb-2">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.searchUnit}
                dir="ltr"
                className="w-full ps-9 pe-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
              />
            </div>
          )}

          <div role="group" aria-label={t.unit} className="max-h-44 overflow-y-auto flex flex-wrap gap-2 p-0.5">
            <button
              type="button"
              aria-pressed={unitId === null}
              onClick={() => onUnitChange(unitId === null ? undefined : null)}
              className={`${chip(unitId === null)} flex items-center gap-1.5`}
            >
              <MapPin className="w-3.5 h-3.5" />
              {t.commonArea}
            </button>
            {shown.map((u) => (
              <button
                key={u.id}
                type="button"
                aria-pressed={unitId === u.id}
                onClick={() => onUnitChange(unitId === u.id ? undefined : u.id)}
                className={chip(unitId === u.id)}
                dir="ltr"
              >
                {u.name}
              </button>
            ))}
            {shown.length === 0 && q && <span className="text-xs text-slate-400 py-1.5">{t.noMatch}</span>}
          </div>
        </div>
      )}

      {/* Common area: where exactly */}
      {mode === "other" && buildingId && unitId === null && (
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1.5" htmlFor={`${uid}-p`}>
            {t.place} <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {COMMON_AREA_PLACES.map((p) => {
              const label = isEn ? p.en : p.ar;
              return (
                <button key={p.key} type="button" aria-pressed={place === label} onClick={() => onPlaceChange?.(place === label ? "" : label)} className={chip(place === label)}>
                  {label}
                </button>
              );
            })}
          </div>
          <input
            id={`${uid}-p`}
            type="text"
            value={place}
            maxLength={80}
            onChange={(e) => onPlaceChange?.(e.target.value)}
            placeholder={t.placePlaceholder}
            className="w-full px-3.5 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
          />
        </div>
      )}

      {/* Unit: which room (optional) */}
      {mode === "other" && typeof unitId === "string" && (
        <div>
          <p className="block text-xs font-bold text-slate-500 mb-1.5">
            {t.room} <span className="font-medium text-slate-400">({t.optional})</span>
          </p>
          <div role="group" aria-label={t.room} className="flex flex-wrap gap-2">
            {ROOMS.map((r) => (
              <button key={r.key} type="button" aria-pressed={room === r.key} onClick={() => onRoomChange?.(room === r.key ? "" : r.key)} className={chip(room === r.key)}>
                {isEn ? r.en : r.ar}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
