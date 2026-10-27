"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { X, Loader2, AlertTriangle, RefreshCw, QrCode, Hammer } from "lucide-react";
import {
  getMaintenanceRequestOptions,
  createMaintenanceRequest,
  type EquipmentOption,
  type MaintenanceRequestError,
  type MaintenanceRequestInput,
  type MaintenanceRequestOptions,
} from "@/app/actions/maintenanceRequest";
import { ISSUE_OPTIONS_AR, ISSUE_OPTIONS_EN, isOtherIssue } from "@/lib/maintenance/issues";
import { OTHER_JOB_KEY, type OtherCategoryKey } from "@/lib/maintenance/categories";
import { DEFAULT_REQUEST_PRIORITY, REQUEST_PRIORITIES } from "@/lib/maintenance/requestPriority";
import { TASK_SIZES, TASK_SIZE_LABELS, type TaskSize } from "@/lib/maintenance/taskSize";
import { STAFF_ROLE_CONFIG } from "@/lib/tasks/constants";
import type { TStaffRole, TTaskPriority } from "@/lib/tasks/constants";
import { isSelfOnlyRequester } from "@/lib/tasks/permissions";
import EquipmentPicker from "./maintenance-request/EquipmentPicker";
import LocationPicker from "./maintenance-request/LocationPicker";
import OtherProblemFields from "./maintenance-request/OtherProblemFields";
import PhotoAttachments, { uploadTaskPhotos, type PendingPhoto } from "./PhotoAttachments";

export type MaintenanceRequestCreated = {
  taskId: string;
  requestNumber: number;
  technicianName: string;
  /** Photos that could not be uploaded (the request itself was created). */
  photoFailures: number;
};

type Props = {
  locale: string;
  onClose: () => void;
  onCreated: (result: MaintenanceRequestCreated) => void;
};

type Kind = "EQUIPMENT" | "OTHER";

export default function MaintenanceRequestModal({ locale, onClose, onCreated }: Props) {
  const isEn = locale === "en";
  const uid = useId();

  // ── Options (loaded when the modal opens) ──────────────────────────────────
  const [options, setOptions] = useState<MaintenanceRequestOptions | null>(null);
  const [loadError, setLoadError] = useState<MaintenanceRequestError | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [kind, setKind] = useState<Kind>("EQUIPMENT");
  // Location — shared by both kinds so switching keeps the building and unit
  const [buildingId, setBuildingId] = useState("");
  /** undefined = not chosen, null = common area, string = unit id */
  const [unitId, setUnitId] = useState<string | null | undefined>(undefined);
  const [room, setRoom] = useState("");
  const [place, setPlace] = useState("");
  // Equipment
  const [equipment, setEquipment] = useState<EquipmentOption | null>(null);
  const [issue, setIssue] = useState("");
  // Other maintenance
  const [category, setCategory] = useState<OtherCategoryKey | "">("");
  const [job, setJob] = useState("");
  // Shared
  const [details, setDetails] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  /** null = not chosen yet (required, no default so sizes are picked deliberately) */
  const [taskSize, setTaskSize] = useState<TaskSize | null>(null);
  const [priority, setPriority] = useState<TTaskPriority>(DEFAULT_REQUEST_PRIORITY);
  /** null = not answered yet (only asked when the request is for a unit) */
  const [guestInUnit, setGuestInUnit] = useState<boolean | null>(null);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [submitError, setSubmitError] = useState<MaintenanceRequestError | null>(null);

  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  const t = {
    title: isEn ? "New maintenance request" : "بلاغ صيانة جديد",
    from: isEn ? "From" : "من",
    to: isEn ? "To" : "إلى",
    openShort: isEn ? "open" : "مفتوحة",
    close: isEn ? "Close" : "إغلاق",
    step1: isEn ? "What needs fixing?" : "ما الذي يحتاج إصلاحاً؟",
    step2Equipment: isEn ? "Which device?" : "أي جهاز؟",
    step2Other: isEn ? "Where?" : "أين؟",
    step3: isEn ? "What's wrong?" : "ما المشكلة؟",
    kindEquipment: isEn ? "Equipment" : "جهاز",
    kindEquipmentHint: isEn ? "A registered device — AC, washer, fridge" : "جهاز مسجّل — مكيف، غسالة، ثلاجة",
    kindOther: isEn ? "Other maintenance" : "صيانة أخرى",
    kindOtherHint: isEn ? "Plumbing, electrical, furniture, painting, installation…" : "سباكة، كهرباء، أثاث، دهان، تركيب…",
    issueLabel: isEn ? "Issue description" : "وصف المشكلة",
    selectIssue: isEn ? "Select the issue" : "اختر المشكلة",
    detailsPlaceholder: isEn
      ? "Additional details (optional) — e.g. it stops after a few minutes"
      : "تفاصيل إضافية (اختياري) — مثال: يتوقف بعد عدة دقائق",
    detailsPlaceholderOther: isEn ? "Describe the issue…" : "اكتب وصف المشكلة…",
    occupancy: isEn ? "Is a guest in the apartment now?" : "هل الضيف موجود في الشقة الآن؟",
    occupied: isEn ? "Yes — guest staying" : "نعم — ضيف مقيم",
    vacant: isEn ? "No — apartment vacant" : "لا — الشقة شاغرة",
    priority: isEn ? "Priority" : "الأولوية",
    taskSize: isEn ? "Task size" : "حجم المهمة",
    cancel: isEn ? "Cancel" : "إلغاء",
    send: isEn ? "Send to technician" : "إرسال للفني",
    sending: isEn ? "Sending…" : "جارٍ الإرسال…",
    loading: isEn ? "Loading…" : "جارٍ التحميل…",
    retry: isEn ? "Try again" : "إعادة المحاولة",
    noTechnicians: isEn ? "No maintenance technicians found." : "لا يوجد فنيو صيانة.",
  };

  const errorText: Record<MaintenanceRequestError, string> = {
    UNAUTHORIZED: isEn ? "Your session has expired. Please sign in again." : "انتهت الجلسة. يرجى تسجيل الدخول مجدداً.",
    FORBIDDEN: isEn ? "You do not have permission to send maintenance requests." : "ليست لديك صلاحية إرسال بلاغات الصيانة.",
    INVALID_INPUT: isEn ? "Please complete all required fields." : "يرجى إكمال الحقول المطلوبة.",
    EQUIPMENT_NOT_FOUND: isEn ? "This device is not available for your buildings." : "هذا الجهاز غير متاح في مبانيك.",
    LOCATION_INVALID: isEn ? "This location is not available. Choose the building and unit again." : "هذا الموقع غير متاح. اختر المبنى والوحدة مجدداً.",
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

  // Esc closes the modal (the camera handles its own overlay)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !submitting) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  const units = options?.units ?? [];
  const equipments = options?.equipments ?? [];

  // ── Location + device handling (kept in sync between both kinds) ───────────
  const unitNameOf = (id: string | null | undefined) => (typeof id === "string" ? units.find((u) => u.id === id)?.name : undefined);
  const deviceMatchesUnit = (e: EquipmentOption, id: string | null | undefined) =>
    id === undefined ? true : id === null ? !e.unitNumber : e.unitNumber === unitNameOf(id);

  function changeBuilding(id: string) {
    setBuildingId(id);
    setUnitId(undefined);
    setRoom("");
    setPlace("");
    if (equipment && equipment.buildingId !== id) setEquipment(null);
  }

  function changeUnit(value: string | null | undefined) {
    setUnitId(value);
    setRoom("");
    if (value !== null) setPlace("");
    if (equipment && !deviceMatchesUnit(equipment, value)) setEquipment(null);
  }

  function selectEquipment(e: EquipmentOption | null) {
    setEquipment(e);
    setSubmitError(null);
    if (e) {
      // the location follows the device, so the other path starts from the same place
      setBuildingId(e.buildingId);
      setUnitId(
        e.unitNumber
          ? units.find((u) => u.buildingId === e.buildingId && u.name === e.unitNumber)?.id
          : null,
      );
      setRoom("");
      setPlace("");
    }
  }

  function switchKind(next: Kind) {
    if (next === kind || submitting) return;
    setKind(next);
    setSubmitError(null);
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  const detailsLen = details.trim().length;
  const otherNeedsDetails = category === "OTHER" || job === OTHER_JOB_KEY;
  const needsPlace = unitId === null;
  // Occupancy is asked only for a unit — never for a common area
  const isForUnit = kind === "EQUIPMENT" ? !!equipment?.unitNumber : typeof unitId === "string";

  let missing: string | null = null;
  if (kind === "EQUIPMENT") {
    if (!equipment) missing = isEn ? "Choose the device" : "اختر الجهاز";
    else if (!issue) missing = isEn ? "Choose the issue" : "اختر المشكلة";
    else if (isOtherIssue(issue) && detailsLen < 2) missing = isEn ? "Describe the issue" : "اكتب وصف المشكلة";
  } else {
    if (!buildingId) missing = isEn ? "Choose the building" : "اختر المبنى";
    else if (unitId === undefined) missing = isEn ? "Choose the unit or common area" : "اختر الوحدة أو المنطقة المشتركة";
    else if (needsPlace && place.trim().length < 2) missing = isEn ? "Say where in the common area" : "حدد المكان في المنطقة المشتركة";
    else if (!category) missing = isEn ? "Choose a category" : "اختر التصنيف";
    else if (category !== "OTHER" && !job) missing = isEn ? "Choose the job" : "اختر العمل المطلوب";
    else if (otherNeedsDetails && detailsLen < 2) missing = isEn ? "Describe the work needed" : "اكتب العمل المطلوب";
  }
  if (!missing && !taskSize) missing = isEn ? "Choose the task size" : "اختر حجم المهمة";
  if (!missing && isForUnit && guestInUnit === null) missing = isEn ? "Say if a guest is in the apartment" : "حدد إن كان الضيف موجوداً في الشقة";
  if (!missing && !technicianId) missing = isEn ? "Choose a technician" : "اختر الفني";
  const canSubmit = !missing && !submitting;

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);

    const base = {
      assignedToId: technicianId,
      taskSize: taskSize!, // canSubmit requires it
      priority,
      guestInUnit: isForUnit ? guestInUnit : null,
      locale,
      details: details.trim(),
    };
    const input: MaintenanceRequestInput =
      kind === "EQUIPMENT"
        ? { kind: "EQUIPMENT", equipmentId: equipment!.id, issue, ...base }
        : {
            kind: "OTHER",
            buildingId,
            unitId: unitId ?? null,
            place: place.trim(),
            room,
            category,
            job,
            ...base,
          };

    const res = await createMaintenanceRequest(input);
    if (!res.ok) {
      setSubmitError(res.error);
      setSubmitting(false);
      return;
    }

    // The request exists — now upload the photos, one request each
    let photoFailures = 0;
    if (photos.length > 0) {
      setUploadProgress({ done: 0, total: photos.length });
      photoFailures = (await uploadTaskPhotos(res.taskId, photos, (done, total) => setUploadProgress({ done, total }))).failed;
    }
    onCreated({ taskId: res.taskId, requestNumber: res.requestNumber, technicianName: res.technicianName, photoFailures });
  }

  const requesterRole = options ? STAFF_ROLE_CONFIG[options.requester.role as TStaffRole] : null;
  // A technician's request is always their own — the server forces this too.
  const selfOnly = options ? isSelfOnlyRequester(options.requester.role as TStaffRole) : false;
  const busy = submitting || uploadProgress !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        dir={isEn ? "ltr" : "rtl"}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white w-full sm:max-w-xl max-h-[94vh] sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
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
                {selfOnly ? (
                  <span>
                    {t.to}: <span className="font-semibold text-slate-700">{options.technicians[0]?.name ?? options.requester.name}</span>
                    <span className="text-slate-400"> ({isEn ? "yourself" : "نفسك"})</span>
                  </span>
                ) : (
                  <label className="flex items-center gap-1.5">
                    {t.to}:
                    <select
                      value={technicianId}
                      onChange={(e) => setTechnicianId(e.target.value)}
                      disabled={busy || options.technicians.length === 0}
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
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t.close}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-6">
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

              {/* 1 · What needs fixing? */}
              <section className="space-y-3">
                <StepHeading n={1} title={t.step1} />
                <div role="radiogroup" aria-label={t.step1} className="grid grid-cols-2 gap-3">
                  {([
                    { key: "EQUIPMENT", icon: QrCode, label: t.kindEquipment, hint: t.kindEquipmentHint },
                    { key: "OTHER", icon: Hammer, label: t.kindOther, hint: t.kindOtherHint },
                  ] as const).map(({ key, icon: Icon, label, hint }) => {
                    const selected = kind === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => switchKind(key)}
                        className={`text-start rounded-2xl border-2 p-3.5 transition-all ${
                          selected
                            ? "border-nassayem bg-nassayem/5 shadow-sm"
                            : "border-slate-200 bg-white hover:border-nassayem/40 hover:bg-slate-50"
                        }`}
                      >
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${selected ? "bg-nassayem text-white" : "bg-slate-100 text-slate-500"}`}>
                          <Icon className="w-5 h-5" />
                        </span>
                        <span className={`block text-sm font-bold ${selected ? "text-nassayem" : "text-slate-800"}`}>{label}</span>
                        <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">{hint}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 2 · Which device? / Where? */}
              <section className="space-y-3">
                <StepHeading n={2} title={kind === "EQUIPMENT" ? t.step2Equipment : t.step2Other} />
                {kind === "EQUIPMENT" ? (
                  <EquipmentPicker
                    isEn={isEn}
                    buildings={options.buildings}
                    equipments={equipments}
                    units={units}
                    equipment={equipment}
                    onSelect={selectEquipment}
                    buildingId={buildingId}
                    onBuildingChange={changeBuilding}
                    unitId={unitId}
                    onUnitChange={changeUnit}
                    onReportAsOther={() => switchKind("OTHER")}
                  />
                ) : (
                  <LocationPicker
                    isEn={isEn}
                    buildings={options.buildings}
                    units={units}
                    buildingId={buildingId}
                    onBuildingChange={changeBuilding}
                    unitId={unitId}
                    onUnitChange={changeUnit}
                    mode="other"
                    room={room}
                    onRoomChange={setRoom}
                    place={place}
                    onPlaceChange={setPlace}
                  />
                )}

                {isForUnit && (
                  <div role="radiogroup" aria-label={t.occupancy} className="space-y-2">
                    <p className="text-sm font-bold text-slate-800">
                      {t.occupancy} <span className="text-red-500">*</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <ChoicePill selected={guestInUnit === true} disabled={busy} onClick={() => setGuestInUnit(true)}>
                        {t.occupied}
                      </ChoicePill>
                      <ChoicePill selected={guestInUnit === false} disabled={busy} onClick={() => setGuestInUnit(false)}>
                        {t.vacant}
                      </ChoicePill>
                    </div>
                  </div>
                )}
              </section>

              {/* 3 · What's wrong? */}
              <section className="space-y-4">
                <StepHeading n={3} title={t.step3} />
                {kind === "EQUIPMENT" ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-800" htmlFor={`${uid}-i`}>
                      {t.issueLabel} <span className="text-red-500">*</span>
                    </label>
                    <select
                      id={`${uid}-i`}
                      value={issue}
                      onChange={(e) => setIssue(e.target.value)}
                      className="w-full px-3.5 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
                    >
                      <option value="">{t.selectIssue}</option>
                      {(isEn ? ISSUE_OPTIONS_EN : ISSUE_OPTIONS_AR).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <label className="sr-only" htmlFor={`${uid}-d`}>{isEn ? "Details" : "التفاصيل"}</label>
                    <textarea
                      id={`${uid}-d`}
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      rows={3}
                      maxLength={1000}
                      required={isOtherIssue(issue)}
                      placeholder={isOtherIssue(issue) ? t.detailsPlaceholderOther : t.detailsPlaceholder}
                      className="w-full px-3.5 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem resize-none"
                    />
                  </div>
                ) : (
                  <OtherProblemFields
                    isEn={isEn}
                    category={category}
                    onCategoryChange={(c) => { setCategory(c); setJob(""); }}
                    job={job}
                    onJobChange={setJob}
                    details={details}
                    onDetailsChange={setDetails}
                  />
                )}

                <PhotoAttachments isEn={isEn} photos={photos} onChange={setPhotos} disabled={busy} />

                {/* Task size — compares technician performance on like-for-like work */}
                <div role="radiogroup" aria-label={t.taskSize} className="space-y-2">
                  <p className="text-sm font-bold text-slate-800">
                    {t.taskSize} <span className="text-red-500">*</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TASK_SIZES.map((size) => (
                      <ChoicePill key={size} selected={taskSize === size} disabled={busy} onClick={() => setTaskSize(size)}>
                        {isEn ? TASK_SIZE_LABELS[size].en : TASK_SIZE_LABELS[size].ar}
                      </ChoicePill>
                    ))}
                  </div>
                </div>

                {/* Priority — sets how soon the work is due */}
                <div role="radiogroup" aria-label={t.priority} className="space-y-2">
                  <p className="text-sm font-bold text-slate-800">
                    {t.priority} <span className="text-red-500">*</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {REQUEST_PRIORITIES.map((p) => (
                      <ChoicePill key={p.key} selected={priority === p.key} disabled={busy} onClick={() => setPriority(p.key)}>
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.dot}`} aria-hidden />
                        {isEn ? p.en : p.ar}
                      </ChoicePill>
                    ))}
                  </div>
                </div>
              </section>

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
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 px-5 py-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
          {missing && !busy && options && (
            <p className="text-xs font-medium text-slate-500 me-auto" aria-live="polite">{missing}</p>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-5 py-2.5 rounded-xl text-sm font-bold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-nassayem hover:bg-nassayem/90 text-white shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {uploadProgress
              ? (isEn ? `Uploading photos ${uploadProgress.done}/${uploadProgress.total}…` : `جارٍ رفع الصور ${uploadProgress.done}/${uploadProgress.total}…`)
              : submitting ? t.sending : t.send}
          </button>
        </div>
      </form>
    </div>
  );
}

function ChoicePill({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-bold transition-colors ${
        selected
          ? "bg-nassayem border-nassayem text-white shadow-sm"
          : "bg-slate-50 border-slate-200 text-slate-700 hover:border-nassayem/40 hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function StepHeading({ n, title }: { n: number; title: string }) {
  return (
    <h3 className="flex items-center gap-2.5 text-sm font-bold text-slate-800">
      <span className="w-6 h-6 rounded-full bg-nassayem text-white text-xs font-black flex items-center justify-center shrink-0">{n}</span>
      {title}
    </h3>
  );
}
