"use client";

import React from "react";
import { CheckCircle2, Timer, Wrench, PackageX, Star, RotateCcw, CircleDot, Hammer, PauseCircle } from "lucide-react";
import { getEquipmentMaintenanceSummary } from "@/app/actions/maintenanceReport";
import { formatDuration } from "../../timeUtils";
import {
  SummaryLoadError,
  SummaryPeriodBar,
  SummarySkeletonCard,
  useMaintenanceSummary,
} from "./MaintenanceSummaryParts";
import {
  BranchSatisfactionTable,
  FailuresByBrand,
  FailuresByType,
  LowRatingNotes,
  TaskSources,
} from "./EquipmentMaintenanceReports";

type Props = {
  isEn: boolean;
  /** Bump to reload (e.g. after a task was changed in the details panel). */
  refreshKey: number;
};

/** Manager / Supervisor dashboards: summary cards for equipment maintenance. */
export default function EquipmentMaintenanceSummary({ isEn, refreshKey }: Props) {
  const { range, setRange, data, loading, failed, reload } = useMaintenanceSummary(getEquipmentMaintenanceSummary, refreshKey);

  const duration = (mins: number | null) => (mins === null ? "—" : formatDuration(mins, isEn));
  const live = isEn ? "Live — not affected by the period" : "وقتي — لا يتأثر بالفلتر";

  const cards = data
    ? [
        {
          key: "completed",
          value: String(data.completed),
          label: isEn ? "Completed tasks" : "مهام منجزة",
          icon: <CheckCircle2 className="w-5 h-5" />,
          bubble: "bg-emerald-50 text-emerald-600",
        },
        {
          key: "arrival",
          value: duration(data.avgArrivalToStartMins),
          label: isEn ? "Avg. arrival → start" : "متوسط الوصول ← البدء",
          icon: <Timer className="w-5 h-5" />,
          bubble: "bg-sky-50 text-sky-600",
        },
        {
          key: "work",
          value: duration(data.avgWorkMins),
          label: isEn ? "Avg. work time" : "متوسط وقت العمل",
          hint: isEn ? "Excluding time paused" : "بدون وقت الإيقاف",
          icon: <Wrench className="w-5 h-5" />,
          bubble: "bg-sky-50 text-sky-600",
        },
        {
          key: "parts",
          value: data.partsPausedPct === null ? "—" : `${data.partsPausedPct}%`,
          extra: data.avgPartsPauseMins === null ? undefined : duration(data.avgPartsPauseMins),
          label: isEn ? "Paused for parts (avg. pause)" : "أوقفت لقطع غيار (متوسط الإيقاف)",
          hint: isEn ? "Share of completed tasks" : "من المهام المنجزة",
          icon: <PackageX className="w-5 h-5" />,
          bubble: "bg-amber-50 text-amber-600",
        },
        {
          key: "satisfaction",
          value: data.satisfactionPct === null ? "—" : `${data.satisfactionPct}%`,
          label: isEn ? "Branch satisfaction" : "نسبة رضا الفروع",
          hint: isEn ? "Reviewed tasks accepted without rejection" : "المهام المراجَعة المقبولة دون رفض",
          icon: <Star className="w-5 h-5" />,
          bubble: "bg-emerald-50 text-emerald-600",
        },
        {
          key: "reopened",
          value: String(data.reopened),
          valueCls: data.reopened > 0 ? "text-red-600" : undefined,
          label: isEn ? "Reopened" : "أعيد فتحها",
          hint: isEn ? "Rejected and sent back" : "رُفضت وأعيدت للفني",
          icon: <RotateCcw className="w-5 h-5" />,
          bubble: "bg-red-50 text-red-600",
        },
        {
          key: "notStarted",
          value: String(data.notStartedNow),
          valueCls: data.notStartedNow > 0 ? "text-red-600" : undefined,
          label: isEn ? "Not started yet" : "لم يبدأ العمل عليها",
          hint: live,
          icon: <CircleDot className="w-5 h-5" />,
          bubble: "bg-red-50 text-red-600",
        },
        {
          key: "inProgress",
          value: String(data.inProgressNow),
          label: isEn ? "In progress" : "قيد التنفيذ",
          hint: live,
          icon: <Hammer className="w-5 h-5" />,
          bubble: "bg-indigo-50 text-indigo-600",
        },
        {
          key: "onHold",
          value: String(data.onHoldNow),
          valueCls: data.onHoldNow > 0 ? "text-amber-600" : undefined,
          label: isEn ? "Paused for parts" : "متوقفة لقطع غيار",
          hint: live,
          icon: <PauseCircle className="w-5 h-5" />,
          bubble: "bg-amber-50 text-amber-600",
        },
      ]
    : [];

  return (
    <section className="space-y-4" aria-label={isEn ? "Equipment maintenance summary" : "ملخص صيانة الأجهزة"}>
      <SummaryPeriodBar
        isEn={isEn}
        range={range}
        onChange={setRange}
        note={isEn ? "Registered devices — AC, washer, fridge…" : "الأجهزة المسجّلة — مكيف، غسالة، ثلاجة…"}
      />

      {failed && !data ? (
        <SummaryLoadError isEn={isEn} onRetry={reload} />
      ) : (
        <div className={`space-y-4 transition-opacity ${loading && data ? "opacity-50" : ""}`} aria-busy={loading}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data
              ? cards.map((c) => (
                  <div key={c.key} title={c.hint} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
                    <span className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${c.bubble}`}>{c.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-3xl font-black leading-none ${c.valueCls ?? "text-slate-900"}`}>
                        {c.value}
                        {c.extra && <span className="ms-1.5 text-xs font-bold text-slate-500">{c.extra}</span>}
                      </p>
                      <p className="text-sm font-bold text-slate-800 mt-2 leading-snug">{c.label}</p>
                      {c.hint && <p className="text-xs text-slate-400 mt-0.5">{c.hint}</p>}
                    </div>
                  </div>
                ))
              : Array.from({ length: 9 }, (_, i) => <SummarySkeletonCard key={i} />)}
          </div>

          {data && (
            <>
              <BranchSatisfactionTable isEn={isEn} rows={data.branches} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TaskSources isEn={isEn} sources={data.sources} />
                <LowRatingNotes isEn={isEn} ratings={data.lowRatings} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FailuresByType isEn={isEn} rows={data.failures.byType} />
                <FailuresByBrand
                  isEn={isEn}
                  rows={data.failures.byBrand}
                  devicesWithoutBrand={data.failures.devicesWithoutBrand}
                  devices={data.failures.devices}
                />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
