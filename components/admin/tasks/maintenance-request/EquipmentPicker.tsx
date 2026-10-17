"use client";

import React, { useId, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Camera, Search, X, CheckCircle2, ArrowRightLeft } from "lucide-react";
import type { EquipmentOption, UnitOption } from "@/app/actions/maintenanceRequest";
import { buildingLabel } from "@/lib/buildingLabel";
import LocationPicker from "./LocationPicker";

// The camera scanner is heavy and only needed on demand
const Scanner = dynamic(() => import("@yudiel/react-qr-scanner").then((m) => m.Scanner), { ssr: false });

type BuildingOption = { id: string; nameEn: string; nameAr: string; shortName: string | null };

type Props = {
  isEn: boolean;
  buildings: BuildingOption[];
  equipments: EquipmentOption[];
  units: UnitOption[];
  equipment: EquipmentOption | null;
  /** Pick (or clear) the device; the parent keeps building / unit in sync. */
  onSelect: (e: EquipmentOption | null) => void;
  buildingId: string;
  onBuildingChange: (id: string) => void;
  unitId: string | null | undefined;
  onUnitChange: (value: string | null | undefined) => void;
  /** "Can't find the device" shortcut → the Other maintenance path. */
  onReportAsOther: () => void;
  disabled?: boolean;
};

/** Find the faulty device: scan / type its QR code, or building → unit → device. */
export default function EquipmentPicker({
  isEn, buildings, equipments, units, equipment, onSelect, buildingId, onBuildingChange, unitId, onUnitChange, onReportAsOther,
}: Props) {
  const uid = useId();
  const [tab, setTab] = useState<"code" | "unit">("code");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  const t = {
    tabCode: isEn ? "Scan / enter code" : "مسح / إدخال الكود",
    tabUnit: isEn ? "Choose unit" : "اختيار الوحدة",
    codePlaceholder: isEn ? "QR code stuck on the device" : "رمز QR الملصق على الجهاز",
    scanCamera: isEn ? "Scan with camera" : "مسح بالكاميرا",
    search: isEn ? "Search" : "بحث",
    equipment: isEn ? "Device" : "الجهاز",
    selectEquipment: isEn ? "Select the device" : "اختر الجهاز",
    change: isEn ? "Change" : "تغيير",
    unitWord: isEn ? "Unit" : "وحدة",
    commonArea: isEn ? "Common area" : "منطقة مشتركة",
    notFound: isEn ? "No device with this code in your buildings." : "لا يوجد جهاز بهذا الكود في مبانيك.",
    noDevices: isEn ? "No devices are registered here." : "لا توجد أجهزة مسجّلة هنا.",
    reportOther: isEn ? "Not a registered device? Report it as other maintenance" : "ليس جهازاً مسجّلاً؟ أبلغ عنه كصيانة أخرى",
    cameraTitle: isEn ? "Position the QR code in the frame" : "ضع رمز QR داخل الإطار",
    cameraUnavailable: isEn ? "Camera unavailable — allow camera access or type the code." : "الكاميرا غير متاحة — اسمح بالوصول للكاميرا أو اكتب الكود.",
    close: isEn ? "Close" : "إغلاق",
  };

  const typeName = (e: EquipmentOption) => (isEn ? e.typeEn : e.typeAr);
  const equipmentLabel = (e: EquipmentOption) =>
    `${e.qrCode} — ${typeName(e)}${e.brandModel ? ` (${e.brandModel})` : ""}`;

  function lookupCode(raw: string) {
    const value = raw.trim().toLowerCase();
    if (!value) return;
    const found = equipments.find((e) => e.qrCode.toLowerCase() === value);
    if (found) {
      setCodeError(false);
      setCode(found.qrCode);
      onSelect(found);
    } else {
      onSelect(null);
      setCodeError(true);
    }
  }

  // Devices matching the building / unit chosen in the "Choose unit" tab
  const unitName = useMemo(
    () => (typeof unitId === "string" ? units.find((u) => u.id === unitId)?.name : undefined),
    [units, unitId],
  );
  const listed = useMemo(
    () =>
      equipments.filter((e) => {
        if (e.buildingId !== buildingId) return false;
        if (unitId === undefined) return true;
        return unitId === null ? !e.unitNumber : e.unitNumber === unitName;
      }),
    [equipments, buildingId, unitId, unitName],
  );
  const building = equipment ? buildings.find((b) => b.id === equipment.buildingId) : undefined;

  const linkBtn =
    "mt-2 flex items-center gap-1.5 text-xs font-bold text-nassayem hover:text-nassayem/80 underline underline-offset-2";

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div role="tablist" className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-2xl">
        {(["code", "unit"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={tab === m}
            onClick={() => setTab(m)}
            className={`py-2.5 text-sm font-bold rounded-xl transition-all ${
              tab === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {m === "code" ? t.tabCode : t.tabUnit}
          </button>
        ))}
      </div>

      {tab === "code" ? (
        <div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={code}
                onChange={(e) => { setCode(e.target.value); setCodeError(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupCode(code); } }}
                placeholder={t.codePlaceholder}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                dir="ltr"
                aria-label={t.codePlaceholder}
                className={`w-full ps-3.5 pe-12 py-3 text-sm rounded-xl bg-white border-2 border-nassayem/50 focus:outline-none focus:ring-4 focus:ring-nassayem/15 focus:border-nassayem font-mono uppercase placeholder:normal-case placeholder:font-sans ${isEn ? "" : "text-right placeholder:text-right"}`}
              />
              <button
                type="button"
                onClick={() => { setCameraError(false); setCameraOpen(true); }}
                aria-label={t.scanCamera}
                title={t.scanCamera}
                className={`absolute top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-nassayem transition-colors ${isEn ? "right-2.5" : "left-2.5"}`}
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => lookupCode(code)}
              disabled={!code.trim()}
              className="flex items-center gap-2 px-5 rounded-xl bg-nassayem hover:bg-nassayem/90 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search className="w-4 h-4" />
              {t.search}
            </button>
          </div>
          {codeError && (
            <div className="mt-2">
              <p className="text-xs font-medium text-red-600">{t.notFound}</p>
              <button type="button" onClick={onReportAsOther} className={linkBtn}>
                <ArrowRightLeft className="w-3.5 h-3.5" />
                {t.reportOther}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <LocationPicker
            isEn={isEn}
            buildings={buildings}
            units={units}
            buildingId={buildingId}
            onBuildingChange={onBuildingChange}
            unitId={unitId}
            onUnitChange={onUnitChange}
            mode="equipment"
          />
          {buildingId && (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5" htmlFor={`${uid}-e`}>{t.equipment}</label>
              <select
                id={`${uid}-e`}
                value={equipment && listed.some((x) => x.id === equipment.id) ? equipment.id : ""}
                onChange={(e) => onSelect(equipments.find((x) => x.id === e.target.value) ?? null)}
                disabled={listed.length === 0}
                className="w-full px-3.5 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">{listed.length === 0 ? t.noDevices : t.selectEquipment}</option>
                {listed.map((e) => (
                  <option key={e.id} value={e.id}>
                    {unitId === undefined && e.unitNumber ? `${e.unitNumber} · ` : ""}{equipmentLabel(e)}
                  </option>
                ))}
              </select>
              {listed.length === 0 && (
                <button type="button" onClick={onReportAsOther} className={linkBtn}>
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  {t.reportOther}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* The chosen device */}
      {equipment && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm text-slate-900">
              {typeName(equipment)}
              {equipment.brandModel && <span className="font-medium text-slate-500"> · {equipment.brandModel}</span>}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              <span className="font-mono font-semibold" dir="ltr">{equipment.qrCode}</span>
              {" · "}
              {building ? buildingLabel(building, isEn) : ""}
              {" · "}
              {equipment.unitNumber ? `${t.unitWord} ${equipment.unitNumber}` : t.commonArea}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { onSelect(null); setCode(""); setCodeError(false); }}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 shrink-0"
          >
            {t.change}
          </button>
        </div>
      )}

      {/* Camera overlay */}
      {cameraOpen && (
        <div className="fixed inset-0 z-[80] bg-black flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setCameraOpen(false)}
            aria-label={t.close}
            className="absolute top-5 end-5 z-10 text-white bg-white/15 hover:bg-white/25 p-2.5 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="w-full max-w-md p-4">
            <h3 className="text-white text-center mb-4 font-medium">{t.cameraTitle}</h3>
            <div className="rounded-2xl overflow-hidden border-2 border-white/20">
              <Scanner
                onScan={(result) => {
                  const raw = result?.[0]?.rawValue;
                  if (!raw) return;
                  setCameraOpen(false);
                  setCode(raw);
                  lookupCode(raw);
                }}
                onError={() => setCameraError(true)}
                components={{ finder: true }}
                styles={{ container: { width: "100%" } }}
              />
            </div>
            {cameraError && <p className="mt-3 text-center text-sm text-amber-300">{t.cameraUnavailable}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
