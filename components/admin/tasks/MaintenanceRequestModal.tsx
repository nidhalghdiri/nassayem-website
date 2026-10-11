"use client";

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { X, Camera, Search, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import {
  getMaintenanceRequestOptions,
  createEquipmentMaintenanceRequest,
  type EquipmentOption,
  type MaintenanceRequestError,
  type MaintenanceRequestOptions,
} from "@/app/actions/maintenanceRequest";
import { ISSUE_OPTIONS_AR, ISSUE_OPTIONS_EN, isOtherIssue } from "@/lib/maintenance/issues";
import { STAFF_ROLE_CONFIG } from "@/lib/tasks/constants";
import type { TStaffRole } from "@/lib/tasks/constants";
import { buildingLabel } from "@/lib/buildingLabel";

// The camera scanner is heavy and only needed on demand
const Scanner = dynamic(() => import("@yudiel/react-qr-scanner").then((m) => m.Scanner), { ssr: false });

type Props = {
  locale: string;
  onClose: () => void;
  onCreated: (result: { taskId: string; technicianName: string }) => void;
};

const COMMON_AREA = "__COMMON__";
const naturalSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export default function MaintenanceRequestModal({ locale, onClose, onCreated }: Props) {
  const isEn = locale === "en";
  const uid = useId();

  // ── Options (loaded when the modal opens) ──────────────────────────────────
  const [options, setOptions] = useState<MaintenanceRequestOptions | null>(null);
  const [loadError, setLoadError] = useState<MaintenanceRequestError | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<"code" | "unit">("code");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [equipment, setEquipment] = useState<EquipmentOption | null>(null);
  const [buildingId, setBuildingId] = useState("");
  const [unitKey, setUnitKey] = useState(""); // "" = all units
  const [technicianId, setTechnicianId] = useState("");
  const [issue, setIssue] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<MaintenanceRequestError | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  const t = {
    title: isEn ? "New maintenance request" : "بلاغ جديد للفني",
    from: isEn ? "From" : "من",
    to: isEn ? "To" : "إلى",
    openShort: isEn ? "open" : "مفتوحة",
    close: isEn ? "Close" : "إغلاق",
    tabCode: isEn ? "Scan / enter code" : "مسح / إدخال الكود",
    tabUnit: isEn ? "Choose unit" : "اختيار الوحدة",
    codePlaceholder: isEn ? "QR code stuck on the device" : "رمز QR الملصق على الجهاز",
    scanCamera: isEn ? "Scan with camera" : "مسح بالكاميرا",
    search: isEn ? "Search" : "بحث",
    building: isEn ? "Building" : "المبنى",
    selectBuilding: isEn ? "Select building" : "اختر المبنى",
    unit: isEn ? "Unit" : "الوحدة",
    allUnits: isEn ? "All units" : "جميع الوحدات",
    unitWord: isEn ? "Unit" : "وحدة",
    commonAreas: isEn ? "Common areas" : "المناطق المشتركة",
    equipment: isEn ? "Equipment" : "الجهاز",
    selectEquipment: isEn ? "Select equipment" : "اختر الجهاز",
    change: isEn ? "Change" : "تغيير",
    commonArea: isEn ? "Common area" : "منطقة مشتركة",
    issueLabel: isEn ? "Issue description" : "وصف المشكلة",
    selectIssue: isEn ? "Select the issue" : "اختر المشكلة",
    detailsLabel: isEn ? "Issue details" : "تفاصيل المشكلة",
    optional: isEn ? "optional" : "اختياري",
    detailsPlaceholder: isEn
      ? "Additional details (optional) — e.g. the guest is in the apartment"
      : "تفاصيل إضافية (اختياري) — مثال: الضيف موجود في الشقة",
    detailsPlaceholderOther: isEn ? "Describe the issue…" : "اكتب وصف المشكلة…",
    cancel: isEn ? "Cancel" : "إلغاء",
    send: isEn ? "Send to technician" : "إرسال للفني",
    sending: isEn ? "Sending…" : "جارٍ الإرسال…",
    loading: isEn ? "Loading equipment…" : "جارٍ تحميل الأجهزة…",
    retry: isEn ? "Try again" : "إعادة المحاولة",
    noTechnicians: isEn ? "No maintenance technicians found." : "لا يوجد فنيو صيانة.",
    noEquipment: isEn ? "No equipment registered for your buildings yet." : "لا توجد أجهزة مسجّلة لمبانيك بعد.",
    cameraTitle: isEn ? "Position the QR code in the frame" : "ضع رمز QR داخل الإطار",
    cameraUnavailable: isEn ? "Camera unavailable — allow camera access or type the code." : "الكاميرا غير متاحة — اسمح بالوصول للكاميرا أو اكتب الكود.",
    notFound: isEn ? "No equipment found with this code in your buildings." : "لا يوجد جهاز بهذا الكود في مبانيك.",
  };

  const errorText: Record<MaintenanceRequestError, string> = {
    UNAUTHORIZED: isEn ? "Your session has expired. Please sign in again." : "انتهت الجلسة. يرجى تسجيل الدخول مجدداً.",
    FORBIDDEN: isEn ? "You do not have permission to send maintenance requests." : "ليست لديك صلاحية إرسال بلاغات الصيانة.",
    INVALID_INPUT: isEn ? "Please complete all required fields." : "يرجى إكمال الحقول المطلوبة.",
    EQUIPMENT_NOT_FOUND: isEn ? "This equipment is not available for your buildings." : "هذا الجهاز غير متاح في مبانيك.",
    TECHNICIAN_INVALID: isEn ? "The selected technician is no longer available." : "الفني المختار غير متاح.",
    SERVER: isEn ? "Something went wrong. Please try again." : "حدث خطأ. يرجى المحاولة مجدداً.",
  };

  // ── Load options ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await getMaintenanceRequestOptions();
    if (!res.ok) {
      setLoadError(res.error);
      setLoading(false);
      return;
    }
    setOptions(res.data);
    setTechnicianId((prev) => prev || res.data.defaultTechnicianId || "");
    if (res.data.buildings.length === 1) setBuildingId(res.data.buildings[0].id);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Esc closes (the camera first, then the modal)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || submitting) return;
      if (cameraOpen) setCameraOpen(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cameraOpen, submitting, onClose]);

  // ── Equipment picking ──────────────────────────────────────────────────────
  const equipments = options?.equipments ?? [];
  const typeName = (e: EquipmentOption) => (isEn ? e.typeEn : e.typeAr);
  const equipmentLabel = (e: EquipmentOption) =>
    `${e.qrCode} — ${typeName(e)}${e.brandModel ? ` (${e.brandModel})` : ""}`;

  function selectEquipment(e: EquipmentOption | null) {
    setEquipment(e);
    setSubmitError(null);
    if (e) {
      // keep the "Choose unit" tab in sync with what was found by code
      setBuildingId(e.buildingId);
      setUnitKey(e.unitNumber ?? COMMON_AREA);
      setCode(e.qrCode);
      setCodeError("");
    }
  }

  function lookupCode(raw: string) {
    const value = raw.trim().toLowerCase();
    if (!value) return;
    const found = equipments.find((e) => e.qrCode.toLowerCase() === value);
    if (found) selectEquipment(found);
    else {
      setEquipment(null);
      setCodeError(t.notFound);
    }
  }

  const buildingEquipments = useMemo(
    () => equipments.filter((e) => e.buildingId === buildingId),
    [equipments, buildingId],
  );
  const unitNumbers = useMemo(
    () => Array.from(new Set(buildingEquipments.map((e) => e.unitNumber).filter(Boolean) as string[])).sort(naturalSort),
    [buildingEquipments],
  );
  const hasCommonAreas = buildingEquipments.some((e) => !e.unitNumber);
  const unitEquipments = buildingEquipments.filter((e) =>
    unitKey === "" ? true : unitKey === COMMON_AREA ? !e.unitNumber : e.unitNumber === unitKey,
  );

  const equipmentBuilding = equipment ? options?.buildings.find((b) => b.id === equipment.buildingId) : null;

  // ── Submit ─────────────────────────────────────────────────────────────────
  const needsDetails = isOtherIssue(issue);
  const canSubmit =
    !!equipment && !!issue && !!technicianId && (!needsDetails || details.trim().length >= 2) && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !equipment) return;
    setSubmitting(true);
    setSubmitError(null);
    const res = await createEquipmentMaintenanceRequest({
      equipmentId: equipment.id,
      assignedToId: technicianId,
      issue,
      details: details.trim(),
      locale,
    });
    if (res.ok) {
      onCreated({ taskId: res.taskId, technicianName: res.technicianName });
      return; // the parent closes the modal
    }
    setSubmitError(res.error);
    setSubmitting(false);
  }

  const requesterRole = options ? STAFF_ROLE_CONFIG[options.requester.role as TStaffRole] : null;
  const fieldCls =
    "w-full px-3.5 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={() => !submitting && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        dir={isEn ? "ltr" : "rtl"}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white w-full sm:max-w-xl max-h-[92vh] sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 shrink-0">
          <div className="min-w-0">
            <h2 id={`${uid}-title`} className="text-lg font-bold text-slate-900">{t.title}</h2>
            {options && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-slate-500">
                <span>
                  {t.from}: <span className="font-semibold text-slate-700">{options.requester.name}</span>
                  {requesterRole && <span className="text-slate-400"> ({isEn ? requesterRole.labelEn : requesterRole.labelAr})</span>}
                </span>
                <span aria-hidden>—</span>
                <label className="flex items-center gap-1.5">
                  {t.to}:
                  <select
                    value={technicianId}
                    onChange={(e) => setTechnicianId(e.target.value)}
                    disabled={submitting || options.technicians.length === 0}
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem max-w-[220px]"
                  >
                    {options.technicians.length === 0 && <option value="">—</option>}
                    {options.technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name} · {tech.openCount} {t.openShort}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label={t.close}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3 text-sm text-slate-500">
              <Loader2 className="w-7 h-7 animate-spin text-nassayem" />
              {t.loading}
            </div>
          ) : loadError || !options ? (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-slate-600">{errorText[loadError ?? "SERVER"]}</p>
              {loadError !== "FORBIDDEN" && loadError !== "UNAUTHORIZED" && (
                <button type="button" onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  <RefreshCw className="w-4 h-4" />
                  {t.retry}
                </button>
              )}
            </div>
          ) : (
            <>
              {options.technicians.length === 0 && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">{t.noTechnicians}</p>
              )}
              {equipments.length === 0 && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">{t.noEquipment}</p>
              )}

              {/* Mode tabs */}
              <div role="tablist" className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-2xl">
                {(["code", "unit"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={`py-2.5 text-sm font-bold rounded-xl transition-all ${
                      mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {m === "code" ? t.tabCode : t.tabUnit}
                  </button>
                ))}
              </div>

              {/* Equipment picker */}
              {mode === "code" ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => { setCode(e.target.value); setCodeError(""); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupCode(code); } }}
                        placeholder={t.codePlaceholder}
                        autoFocus
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                        dir="ltr"
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
                  {codeError && <p className="text-xs font-medium text-red-600">{codeError}</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5" htmlFor={`${uid}-b`}>{t.building}</label>
                      <select
                        id={`${uid}-b`}
                        value={buildingId}
                        onChange={(e) => {
                          setBuildingId(e.target.value);
                          setUnitKey("");
                          if (equipment && equipment.buildingId !== e.target.value) setEquipment(null);
                        }}
                        className={fieldCls}
                      >
                        <option value="">{t.selectBuilding}</option>
                        {options.buildings.map((b) => (
                          <option key={b.id} value={b.id}>{buildingLabel(b, isEn)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5" htmlFor={`${uid}-u`}>{t.unit}</label>
                      <select
                        id={`${uid}-u`}
                        value={unitKey}
                        onChange={(e) => {
                          setUnitKey(e.target.value);
                          if (equipment) setEquipment(null);
                        }}
                        disabled={!buildingId}
                        className={fieldCls}
                      >
                        <option value="">{t.allUnits}</option>
                        {hasCommonAreas && <option value={COMMON_AREA}>{t.commonAreas}</option>}
                        {unitNumbers.map((u) => (
                          <option key={u} value={u}>{t.unitWord} {u}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5" htmlFor={`${uid}-e`}>{t.equipment}</label>
                    <select
                      id={`${uid}-e`}
                      value={equipment && equipment.buildingId === buildingId ? equipment.id : ""}
                      onChange={(e) => selectEquipment(equipments.find((x) => x.id === e.target.value) ?? null)}
                      disabled={!buildingId}
                      className={fieldCls}
                    >
                      <option value="">{t.selectEquipment}</option>
                      {unitEquipments.map((e) => (
                        <option key={e.id} value={e.id}>
                          {unitKey === "" && e.unitNumber ? `${e.unitNumber} · ` : ""}{equipmentLabel(e)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Selected equipment */}
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
                      {equipmentBuilding ? buildingLabel(equipmentBuilding, isEn) : ""}
                      {" · "}
                      {equipment.unitNumber ? `${t.unitWord} ${equipment.unitNumber}` : t.commonArea}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setEquipment(null); setCode(""); }}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900 shrink-0"
                  >
                    {t.change}
                  </button>
                </div>
              )}

              {/* Issue */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-800" htmlFor={`${uid}-i`}>
                  {t.issueLabel} <span className="text-red-500">*</span>
                </label>
                <select
                  id={`${uid}-i`}
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  className={fieldCls}
                >
                  <option value="">{t.selectIssue}</option>
                  {(isEn ? ISSUE_OPTIONS_EN : ISSUE_OPTIONS_AR).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <div>
                  <label className="sr-only" htmlFor={`${uid}-d`}>{t.detailsLabel}</label>
                  <textarea
                    id={`${uid}-d`}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    required={needsDetails}
                    placeholder={needsDetails ? t.detailsPlaceholderOther : t.detailsPlaceholder}
                    className={`${fieldCls} resize-none`}
                  />
                </div>
              </div>

              {submitError && (
                <p role="alert" className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {errorText[submitError]}
                </p>
              )}
            </>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl text-sm font-bold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-nassayem hover:bg-nassayem/90 text-white shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? t.sending : t.send}
          </button>
        </div>
      </form>

      {/* ── Camera overlay ───────────────────────────────────────────────── */}
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
