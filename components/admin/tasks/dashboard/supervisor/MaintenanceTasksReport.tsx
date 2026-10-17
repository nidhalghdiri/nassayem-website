"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle, RefreshCw, RotateCcw, ChevronRight, ChevronLeft } from "lucide-react";
import { getMaintenanceTasksReport } from "@/app/actions/maintenanceReport";
import { CATEGORY_LABELS, categoryLabel, roomLabel } from "@/lib/maintenance/categories";
import type {
  MaintenanceCategoryFilter,
  MaintenanceReportResult,
  MaintenanceReportRow,
  MaintenanceSourceFilter,
  MaintenanceStage,
  MaintenanceStatusFilter,
} from "@/lib/reports/maintenanceTasksReport";
import { STAFF_ROLE_CONFIG } from "@/lib/tasks/constants";
import type { TStaffRole } from "@/lib/tasks/constants";
import { formatDuration } from "../../timeUtils";

type BuildingOption = { id: string; nameEn: string; nameAr: string; shortName?: string | null };

type Props = {
  isEn: boolean;
  buildings: BuildingOption[];
  onOpenTask: (id: string) => void;
  /** Bump to reload the report (e.g. after a task was changed in the details panel). */
  refreshKey: number;
};

type Filters = {
  buildingId: string;
  status: MaintenanceStatusFilter;
  source: MaintenanceSourceFilter;
  category: MaintenanceCategoryFilter;
  from: string;
  to: string;
};

const DEFAULT_FILTERS: Filters = { buildingId: "", status: "NOT_CLOSED", source: "ALL", category: "ALL", from: "", to: "" };

const STAGE_BADGE: Record<MaintenanceStage, string> = {
  NEW: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700",
  ON_HOLD: "bg-amber-50 text-amber-700",
  AWAITING_REVIEW: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-600",
  CANCELLED: "bg-slate-100 text-slate-400",
};

/** Supervisor dashboard: every maintenance request, filterable, with timings. */
export default function MaintenanceTasksReport({ isEn, buildings, onOpenTask, refreshKey }: Props) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<MaintenanceReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);

  const t = {
    title: isEn ? "Maintenance tasks" : "مهام الصيانة",
    branch: isEn ? "Branch" : "الفرع",
    allBranches: isEn ? "All branches" : "جميع الفروع",
    status: isEn ? "Status" : "الحالة",
    source: isEn ? "Source" : "المصدر",
    allSources: isEn ? "All sources" : "جميع المصادر",
    type: isEn ? "Type" : "النوع",
    allTypes: isEn ? "All types" : "جميع الأنواع",
    uncategorized: isEn ? "Older (no category)" : "أقدم (بدون تصنيف)",
    request: isEn ? "Request" : "الطلب",
    arrivalFrom: isEn ? "Arrival date — from" : "تاريخ الوصول — من",
    arrivalTo: isEn ? "to" : "إلى",
    reset: isEn ? "Reset filters" : "إعادة ضبط الفلاتر",
    device: isEn ? "Device" : "الجهاز",
    location: isEn ? "Location" : "الموقع",
    issue: isEn ? "Issue" : "المشكلة",
    sourceCol: isEn ? "Source" : "المصدر",
    statusCol: isEn ? "Status" : "الحالة",
    arrivalToStart: isEn ? "Arrival → start" : "الوصول ← البدء",
    parts: isEn ? "Spare parts" : "قطع الغيار",
    sinceCreation: isEn ? "Since creation" : "منذ الإنشاء",
    details: isEn ? "Details" : "التفاصيل",
    no: isEn ? "No" : "لا",
    yes: isEn ? "Yes" : "نعم",
    ongoing: isEn ? "ongoing" : "مستمر",
    unitWord: isEn ? "Unit" : "شقة",
    commonArea: isEn ? "Common area" : "منطقة مشتركة",
    prev: isEn ? "Previous" : "السابق",
    next: isEn ? "Next" : "التالي",
    tasksWord: isEn ? "tasks" : "مهمة",
    empty: isEn ? "No maintenance tasks match these filters." : "لا توجد مهام صيانة مطابقة لهذه الفلاتر.",
    loadFailed: isEn ? "Could not load the report." : "تعذّر تحميل التقرير.",
    retry: isEn ? "Try again" : "إعادة المحاولة",
    totalTime: isEn ? "Total time from creation to completion" : "الوقت الكلي من الإنشاء حتى الإنجاز",
  };

  const statusOptions: { value: MaintenanceStatusFilter; label: string }[] = [
    { value: "NOT_CLOSED", label: isEn ? "Not closed" : "غير المغلقة" },
    { value: "ALL", label: isEn ? "All statuses" : "كل الحالات" },
    { value: "NEW", label: isEn ? "New — not started" : "جديدة — لم يبدأ العمل" },
    { value: "IN_PROGRESS", label: isEn ? "In progress" : "قيد التنفيذ" },
    { value: "ON_HOLD", label: isEn ? "Paused — waiting for parts" : "متوقفة — بانتظار قطع غيار" },
    { value: "AWAITING_REVIEW", label: isEn ? "Completed — awaiting review" : "منجزة — بانتظار التقييم" },
    { value: "CLOSED", label: isEn ? "Closed" : "مغلقة" },
    { value: "CANCELLED", label: isEn ? "Cancelled" : "ملغاة" },
  ];

  const sourceOptions: { value: MaintenanceSourceFilter; label: string }[] = [
    { value: "ALL", label: t.allSources },
    { value: "RECEPTIONIST", label: isEn ? "Reception" : "الاستقبال" },
    { value: "SUPERVISOR", label: isEn ? "Supervisor" : "المشرف" },
    { value: "MANAGER", label: isEn ? "Manager" : "المدير" },
    { value: "HOUSEKEEPING", label: isEn ? "Housekeeping" : "تدبير المنازل" },
    { value: "MAINTENANCE", label: isEn ? "Maintenance" : "الصيانة" },
  ];

  const categoryOptions: { value: MaintenanceCategoryFilter; label: string }[] = [
    { value: "ALL", label: t.allTypes },
    ...(Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[]).map((k) => ({
      value: k as MaintenanceCategoryFilter,
      label: isEn ? CATEGORY_LABELS[k].en : CATEGORY_LABELS[k].ar,
    })),
    { value: "UNCATEGORIZED", label: t.uncategorized },
  ];

  // ── Data loading (the newest request wins when filters change quickly) ────
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setFailed(false);
    const res = await getMaintenanceTasksReport({
      buildingId: filters.buildingId || undefined,
      status: filters.status,
      source: filters.source,
      category: filters.category,
      from: filters.from || undefined,
      to: filters.to || undefined,
      page,
    });
    if (id !== requestId.current) return;
    if (res.ok) setResult(res.data);
    else setFailed(true);
    setLoading(false);
  }, [filters, page]);

  useEffect(() => { load(); }, [load, refreshKey]);

  function updateFilter(patch: Partial<Filters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  const isDefault = JSON.stringify(filters) === JSON.stringify(DEFAULT_FILTERS);

  // ── Cell helpers ───────────────────────────────────────────────────────────
  const stageLabel = (row: MaintenanceReportRow) => {
    switch (row.stage) {
      case "NEW": return isEn ? "New — not started" : "جديدة — لم يبدأ العمل";
      case "IN_PROGRESS": return isEn ? "In progress" : "قيد التنفيذ";
      case "ON_HOLD": return isEn ? "Paused — waiting for parts" : "متوقفة — بانتظار قطع غيار";
      case "AWAITING_REVIEW":
        return row.awaitingReview === "approved_receptionist"
          ? (isEn ? "Reception approved — awaiting supervisor" : "اعتمدها الاستقبال — بانتظار المشرف")
          : (isEn ? "Completed — awaiting review" : "منجزة — بانتظار التقييم");
      case "CLOSED": return isEn ? "Closed" : "مغلقة";
      case "CANCELLED": return isEn ? "Cancelled" : "ملغاة";
    }
  };

  const sourceLabel = (row: MaintenanceReportRow) => {
    const { role } = row.source;
    if (role === "RECEPTIONIST") return `${isEn ? "Reception" : "استقبال"} ${isEn ? row.source.buildingNameEn : row.source.buildingNameAr}`;
    if (role === "SUPERVISOR") return isEn ? "Supervisor" : "المشرف";
    if (role === "MANAGER") return isEn ? "Manager" : "المدير";
    const conf = STAFF_ROLE_CONFIG[role as TStaffRole];
    return conf ? (isEn ? conf.labelEn : conf.labelAr) : role;
  };

  const rows = result?.rows ?? [];
  const selectCls =
    "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem";

  return (
    <section className="space-y-4" aria-label={t.title}>
      <h2 className="text-lg font-bold text-slate-800">{t.title}</h2>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <label className="block">
            <span className="block text-xs font-bold text-slate-500 mb-1.5">{t.branch}</span>
            <select value={filters.buildingId} onChange={(e) => updateFilter({ buildingId: e.target.value })} className={selectCls}>
              <option value="">{t.allBranches}</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{isEn ? b.shortName || b.nameEn : b.shortName || b.nameAr}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-slate-500 mb-1.5">{t.status}</span>
            <select value={filters.status} onChange={(e) => updateFilter({ status: e.target.value as MaintenanceStatusFilter })} className={selectCls}>
              {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-slate-500 mb-1.5">{t.source}</span>
            <select value={filters.source} onChange={(e) => updateFilter({ source: e.target.value as MaintenanceSourceFilter })} className={selectCls}>
              {sourceOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-slate-500 mb-1.5">{t.type}</span>
            <select value={filters.category} onChange={(e) => updateFilter({ category: e.target.value as MaintenanceCategoryFilter })} className={selectCls}>
              {categoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-slate-500 mb-1.5">{t.arrivalFrom}</span>
            <input type="date" dir="ltr" value={filters.from} max={filters.to || undefined} onChange={(e) => updateFilter({ from: e.target.value })} className={selectCls} />
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-slate-500 mb-1.5">{t.arrivalTo}</span>
            <input type="date" dir="ltr" value={filters.to} min={filters.from || undefined} onChange={(e) => updateFilter({ to: e.target.value })} className={selectCls} />
          </label>
        </div>
        {!isDefault && (
          <button
            type="button"
            onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}
            className="mt-3 flex items-center gap-1.5 text-xs font-bold text-nassayem hover:text-nassayem/80"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t.reset}
          </button>
        )}
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {failed && !result ? (
          <div className="py-14 flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-slate-600">{t.loadFailed}</p>
            <button type="button" onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <RefreshCw className="w-4 h-4" />
              {t.retry}
            </button>
          </div>
        ) : !result ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-nassayem" />
          </div>
        ) : (
          <>
            <div className={`overflow-x-auto transition-opacity ${loading ? "opacity-50" : ""}`} aria-busy={loading}>
              <table className="w-full min-w-[1000px] text-sm text-start">
                <thead>
                  <tr className="text-xs font-bold text-slate-500 border-b border-slate-200">
                    {[t.request, t.device, t.location, t.issue, t.sourceCol, t.statusCol, t.arrivalToStart, t.parts, t.sinceCreation].map((h) => (
                      <th key={h} scope="col" className="px-4 py-3.5 text-start whitespace-nowrap">{h}</th>
                    ))}
                    <th scope="col" className="px-4 py-3.5"><span className="sr-only">{t.details}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-14 text-center text-slate-500">{t.empty}</td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70 transition-colors align-middle">
                        {/* Request number */}
                        <td className="px-4 py-3.5 whitespace-nowrap font-black text-slate-900 tabular-nums" dir="ltr">#{row.requestNumber}</td>
                        {/* Device / job */}
                        <td className="px-4 py-3.5 min-w-[150px]">
                          <p className="font-bold text-slate-900">{row.deviceName}</p>
                          {row.deviceCode && <p className="text-xs text-slate-400 mt-0.5 font-mono" dir="ltr">{row.deviceCode}</p>}
                          {row.category && row.category !== "EQUIPMENT" && (
                            <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                              {categoryLabel(row.category, isEn)}
                            </span>
                          )}
                        </td>
                        {/* Location */}
                        <td className="px-4 py-3.5 min-w-[130px]">
                          <p className="font-semibold text-slate-800">{isEn ? row.buildingNameEn : row.buildingNameAr}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {row.unitName ? `${t.unitWord} ${row.unitName}` : t.commonArea}
                            {roomLabel(row.room, isEn) ? ` • ${roomLabel(row.room, isEn)}` : ""}
                          </p>
                        </td>
                        {/* Issue */}
                        <td className="px-4 py-3.5 min-w-[160px] max-w-[240px]">
                          <p className="text-slate-800 line-clamp-2" title={row.issue ?? undefined}>{row.issue || "—"}</p>
                        </td>
                        {/* Source */}
                        <td className="px-4 py-3.5 min-w-[110px] text-slate-700" title={row.source.name}>{sourceLabel(row)}</td>
                        {/* Status */}
                        <td className="px-4 py-3.5 min-w-[170px]">
                          <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full ${STAGE_BADGE[row.stage]}`}>{stageLabel(row)}</span>
                          <p className="text-[11px] text-slate-400 mt-1">{row.technicianName}</p>
                        </td>
                        {/* Arrival → start */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-700">
                          {row.arrivalToStartMins === null ? <span className="text-slate-300">—</span> : formatDuration(row.arrivalToStartMins, isEn)}
                        </td>
                        {/* Spare parts */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {row.parts.used ? (
                            <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                              {t.yes} — {formatDuration(row.parts.mins, isEn)}{row.parts.ongoing ? ` (${t.ongoing})` : ""}
                            </span>
                          ) : (
                            <span className="text-slate-400">{t.no}</span>
                          )}
                        </td>
                        {/* Since creation */}
                        <td
                          className={`px-4 py-3.5 whitespace-nowrap ${
                            row.stage === "NEW" ? "font-bold text-red-600" : row.elapsedIsFinal ? "text-slate-400" : "text-slate-700"
                          }`}
                          title={row.elapsedIsFinal ? t.totalTime : undefined}
                        >
                          {formatDuration(row.elapsedMins, isEn)}
                        </td>
                        {/* Details */}
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => onOpenTask(row.id)}
                            className="px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:border-nassayem/40 transition-colors whitespace-nowrap"
                          >
                            {t.details}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-slate-100">
              <span className="text-sm text-slate-500">{result.total} {t.tasksWord}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={result.page <= 1 || loading}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4 hidden rtl:block" />
                  <ChevronLeft className="w-4 h-4 rtl:hidden" />
                  {t.prev}
                </button>
                <span className="text-sm font-bold text-slate-600 tabular-nums px-1">{result.page} / {result.pageCount}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(result.pageCount, p + 1))}
                  disabled={result.page >= result.pageCount || loading}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t.next}
                  <ChevronLeft className="w-4 h-4 hidden rtl:block" />
                  <ChevronRight className="w-4 h-4 rtl:hidden" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
