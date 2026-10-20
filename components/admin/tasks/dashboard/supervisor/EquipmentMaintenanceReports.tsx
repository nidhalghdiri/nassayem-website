"use client";

import React from "react";
import { Star } from "lucide-react";
import type { BranchSatisfactionRow, FailureRow, LowRating } from "@/lib/reports/maintenanceSummary";
import { FAILURES_BY_TYPE_DAYS, FAILURES_MIN_DEVICES, LOW_RATING_MAX } from "@/lib/reports/maintenanceSummary";
import { STAFF_ROLE_CONFIG, type TStaffRole } from "@/lib/tasks/constants";
import { formatDuration } from "../../timeUtils";

// Equipment maintenance tab — branch satisfaction table, where the requests
// came from, the low closing ratings with their comments, and failures by
// device type and by brand.

const card = "bg-white rounded-2xl border border-slate-100 shadow-sm";

/** ≥ 90% green, ≥ 75% orange, below red. */
function ratingColor(pct: number) {
  return pct >= 90 ? "bg-green-600" : pct >= 75 ? "bg-orange-600" : "bg-red-600";
}

export function BranchSatisfactionTable({ isEn, rows }: { isEn: boolean; rows: BranchSatisfactionRow[] }) {
  const rated = rows.filter((r) => r.satisfactionPct !== null);
  // Flag the least satisfied branch only when there is something to compare it with
  const lowest = rated.length > 1 ? rated.reduce((min, r) => (r.satisfactionPct! < min.satisfactionPct! ? r : min)) : null;
  const lowestId = lowest && rated.some((r) => r.satisfactionPct !== lowest.satisfactionPct) ? lowest.buildingId : null;
  const dash = <span className="text-slate-300">—</span>;
  const headers = [
    isEn ? "Branch" : "الفرع",
    isEn ? "Completed" : "مهام منجزة",
    isEn ? "Satisfaction" : "نسبة الرضا",
    isEn ? "Arrival → start" : "الوصول ← البدء",
    isEn ? "Paused for parts" : "أوقفت لقطع غيار",
    isEn ? "Reopened" : "أعيد فتحها",
  ];

  return (
    <section className={`${card} p-5`} aria-label={isEn ? "Branch satisfaction" : "رضا الفروع"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="text-base font-bold text-slate-800">{isEn ? "Branch satisfaction with the technicians" : "رضا الفروع عن الفني"}</h2>
        <span className="text-xs text-slate-400">
          {isEn ? "Satisfaction = reviewed tasks accepted without rejection" : "نسبة الرضا = المهام المراجَعة المقبولة دون رفض"}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">{isEn ? "No equipment maintenance in this period." : "لا توجد صيانة أجهزة في هذه الفترة."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-xs font-semibold text-slate-400 border-b border-slate-100">
                {headers.map((h) => (
                  <th key={h} scope="col" className="px-3 py-3 text-start font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.buildingId}>
                  <td className="px-3 py-4 font-bold text-slate-900 whitespace-nowrap">
                    {isEn ? r.buildingNameEn : r.buildingNameAr}
                    {r.buildingId === lowestId && (
                      <span className="ms-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                        {isEn ? "Lowest" : "الأقل رضا"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-4 text-slate-700 tabular-nums">{r.completed}</td>
                  <td className="px-3 py-4 min-w-[220px]">
                    {r.satisfactionPct === null ? dash : (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="w-11 shrink-0 font-black text-slate-900 tabular-nums">{r.satisfactionPct}%</span>
                          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${ratingColor(r.satisfactionPct)}`} style={{ width: `${r.satisfactionPct}%` }} />
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 text-end">
                          {r.reviewed} {isEn ? (r.reviewed === 1 ? "review" : "reviews") : "تقييم"}
                        </p>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-4 text-slate-700 whitespace-nowrap">
                    {r.avgArrivalToStartMins === null ? dash : formatDuration(r.avgArrivalToStartMins, isEn)}
                  </td>
                  <td className="px-3 py-4 text-slate-700 whitespace-nowrap">
                    {r.partsPaused === 0 ? dash : (
                      <>
                        <span className="tabular-nums">{r.partsPaused}</span>
                        {r.avgPartsPauseMins !== null && (
                          <span className="ms-1.5 text-xs text-slate-400">({formatDuration(r.avgPartsPauseMins, isEn)})</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    {r.reopened === 0 ? dash : <span className="font-bold text-red-600 tabular-nums">{r.reopened}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function TaskSources({ isEn, sources }: { isEn: boolean; sources: { role: string; count: number }[] }) {
  const max = Math.max(1, ...sources.map((s) => s.count));
  const label = (role: string) => {
    if (role === "RECEPTIONIST") return isEn ? "Reception" : "الاستقبال";
    if (role === "SUPERVISOR") return isEn ? "Supervisor" : "المشرف";
    if (role === "MANAGER") return isEn ? "Manager" : "المدير";
    const conf = STAFF_ROLE_CONFIG[role as TStaffRole];
    return conf ? (isEn ? conf.labelEn : conf.labelAr) : role;
  };

  return (
    <section className={`${card} p-5`} aria-label={isEn ? "Task sources" : "مصدر المهام"}>
      <h2 className="text-base font-bold text-slate-800 mb-4">{isEn ? "Task sources" : "مصدر المهام"}</h2>
      {sources.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{isEn ? "No new requests in this period." : "لا توجد طلبات جديدة في هذه الفترة."}</p>
      ) : (
        <ul className="space-y-3">
          {sources.map((s) => (
            <li key={s.role} className="flex items-center gap-4 text-sm">
              <span className="w-24 shrink-0 text-slate-700">{label(s.role)}</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${(s.count / max) * 100}%` }} />
              </div>
              <span className="w-16 shrink-0 text-xs text-slate-400 text-end">
                {s.count} {isEn ? (s.count === 1 ? "task" : "tasks") : "مهمة"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A small picture for the common device types (matched on the name). */
function typeIcon(nameAr: string, nameEn: string) {
  const name = `${nameAr} ${nameEn}`.toLowerCase();
  if (name.includes("غسال") || name.includes("wash")) return "🫧";
  if (name.includes("ثلاج") || name.includes("fridge") || name.includes("refrig")) return "🧊";
  if (name.includes("مكيف") || /\bac\b/.test(name) || name.includes("air con")) return "❄️";
  return "🔧";
}

function FailureBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, 2)}%` }} />
    </div>
  );
}

export function FailuresByType({ isEn, rows }: { isEn: boolean; rows: FailureRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.failures));
  return (
    <section className={`${card} p-5`} aria-label={isEn ? "Failures by type" : "الأعطال حسب النوع"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-base font-bold text-slate-800">{isEn ? "Failures by type" : "الأعطال حسب النوع"}</h2>
        <span className="text-xs text-slate-400">
          {isEn ? `Last ${FAILURES_BY_TYPE_DAYS} days` : `آخر ${FAILURES_BY_TYPE_DAYS} يوماً`}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{isEn ? "No devices registered." : "لا توجد أجهزة مسجّلة."}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-4 text-sm">
              <span className="w-28 shrink-0 text-slate-700">
                <span aria-hidden className="me-1.5">{typeIcon(r.typeNameAr, r.typeNameEn)}</span>
                {isEn ? r.typeNameEn : r.typeNameAr}
              </span>
              <FailureBar pct={(r.failures / max) * 100} color={r.failures > 0 ? "bg-blue-600" : "bg-slate-200"} />
              <span className="w-28 shrink-0 text-xs text-slate-500 text-end tabular-nums" title={isEn ? `${r.devices} devices` : `${r.devices} جهاز`}>
                <span className="font-bold text-slate-800">{r.failures}</span> ({r.per100} /100)
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function FailuresByBrand({
  isEn,
  rows,
  devicesWithoutBrand,
  devices,
}: {
  isEn: boolean;
  rows: FailureRow[];
  devicesWithoutBrand: number;
  devices: number;
}) {
  const max = Math.max(0.1, ...rows.map((r) => r.per100));
  const missingMostBrands = devices > 0 && devicesWithoutBrand / devices > 0.5;
  return (
    <section className={`${card} p-5`} aria-label={isEn ? "Failures by brand" : "الأعطال حسب الماركة"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-base font-bold text-slate-800">{isEn ? "Failures by brand" : "الأعطال حسب الماركة"}</h2>
        <span className="text-xs text-slate-400">
          {isEn ? "Per 100 devices — last 12 months" : "لكل 100 جهاز — آخر 12 شهراً"}
        </span>
      </div>
      {rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((r, i) => (
            <li key={r.key} className="flex items-center gap-4 text-sm">
              <span className="w-32 shrink-0 text-slate-700 leading-snug">
                {isEn ? r.typeNameEn : r.typeNameAr} — <span dir="auto">{r.brand}</span>
              </span>
              <FailureBar pct={(r.per100 / max) * 100} color={i === 0 ? "bg-red-700" : "bg-blue-600"} />
              <span className="w-28 shrink-0 text-xs text-slate-500 text-end tabular-nums">
                <span className="font-bold text-slate-800">{r.per100}</span> ({r.failures}/{r.devices})
              </span>
            </li>
          ))}
        </ul>
      )}
      {(rows.length === 0 || missingMostBrands) && (
        <p className={`text-sm text-slate-500 ${rows.length > 0 ? "mt-4 pt-3 border-t border-slate-100 text-xs" : "py-6 text-center"}`}>
          {missingMostBrands
            ? isEn
              ? `${devicesWithoutBrand} of ${devices} devices have no brand recorded. Add the brand to each device on the Equipment page to compare brands.`
              : `${devicesWithoutBrand} من ${devices} جهاز بدون ماركة مسجّلة. أضف الماركة لكل جهاز في صفحة الأجهزة لمقارنة الماركات.`
            : isEn
              ? `No brand with at least ${FAILURES_MIN_DEVICES} devices had a failure in the last 12 months.`
              : `لا توجد ماركة لديها ${FAILURES_MIN_DEVICES} أجهزة على الأقل وتعطلت في آخر 12 شهراً.`}
        </p>
      )}
    </section>
  );
}

export function LowRatingNotes({ isEn, ratings }: { isEn: boolean; ratings: LowRating[] }) {
  return (
    <section className={`${card} p-5`} aria-label={isEn ? "Rating notes" : "ملاحظات التقييم"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="text-base font-bold text-slate-800">{isEn ? "Rating notes" : "ملاحظات التقييم"}</h2>
        <span className="text-xs text-slate-400">
          {isEn ? `Ratings of ${LOW_RATING_MAX} stars or fewer` : `التقييمات ${LOW_RATING_MAX} نجوم فأقل`}
        </span>
      </div>
      {ratings.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{isEn ? "No low ratings in this period." : "لا توجد تقييمات منخفضة في هذه الفترة."}</p>
      ) : (
        <ul className="space-y-2.5">
          {ratings.map((r) => (
            <li key={`${r.requestNumber}-${String(r.ratedAt)}`} className="rounded-xl border border-slate-100 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                  <span dir="ltr">#{r.requestNumber}</span> • {isEn ? r.buildingNameEn : r.buildingNameAr}
                </span>
                <span className="flex items-center gap-1.5 shrink-0" aria-label={`${r.rating}/5`}>
                  <span className="flex" dir="ltr">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i <= r.rating ? "fill-amber-500 text-amber-500" : "text-amber-300"}`} />
                    ))}
                  </span>
                  <span className="text-xs font-black text-amber-700 tabular-nums">{r.rating * 20}%</span>
                </span>
              </div>
              <p className="mt-1.5 text-sm text-slate-800">{r.comment}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
