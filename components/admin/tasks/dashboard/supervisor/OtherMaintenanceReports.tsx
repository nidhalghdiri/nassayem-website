"use client";

import React, { useState } from "react";
import type {
  OtherMaintenanceSummary,
  RecurringFaultRow,
  TechnicianPerformanceRow,
  TechnicianSizeFilter,
} from "@/lib/reports/maintenanceSummary";
import { RECURRING_DAYS, RECURRING_MIN, TECHNICIAN_SIZE_FILTERS } from "@/lib/reports/maintenanceSummary";
import { TASK_SIZE_LABELS } from "@/lib/maintenance/taskSize";
import { categoryLabel, roomLabel } from "@/lib/maintenance/categories";
import { formatDuration } from "../../timeUtils";

// Other maintenance tab — technician performance, requests by type and by
// building, and units with recurring requests.

const card = "bg-white rounded-2xl border border-slate-100 shadow-sm p-5";
const dash = <span className="text-slate-300">—</span>;

function CardHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
      <h2 className="text-base font-bold text-slate-800">{title}</h2>
      <span className="text-xs text-slate-400">{hint}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-slate-500">{text}</p>;
}

/** Horizontal bars, longest = the biggest count. */
function CountBars({ rows, labelWidth = "w-24" }: { rows: { key: string; label: string; count: number }[]; labelWidth?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-4 text-sm">
          <span className={`${labelWidth} shrink-0 font-bold text-slate-800 truncate`} title={r.label}>{r.label}</span>
          <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-nassayem" style={{ width: `${Math.max((r.count / max) * 100, 2)}%` }} />
          </div>
          <span className="w-8 shrink-0 text-end font-black text-slate-800 tabular-nums">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

export function TechnicianPerformance({
  isEn,
  bySize,
}: {
  isEn: boolean;
  bySize: Record<TechnicianSizeFilter, TechnicianPerformanceRow[]>;
}) {
  const [size, setSize] = useState<TechnicianSizeFilter>("ALL");
  const rows = bySize[size];
  const headers = [
    isEn ? "Technician" : "الفني",
    isEn ? "Specialty" : "التخصص",
    isEn ? "Completed" : "مهام مكتملة",
    isEn ? "Avg. completion" : "متوسط الإنجاز",
    isEn ? "On time (SLA)" : "الالتزام بـ SLA",
    isEn ? "Satisfaction" : "الرضا",
  ];
  const sizeLabel = (f: TechnicianSizeFilter) =>
    f === "ALL" ? (isEn ? "All sizes" : "كل الأحجام") : isEn ? TASK_SIZE_LABELS[f].en : TASK_SIZE_LABELS[f].ar;

  return (
    <section className={card} aria-label={isEn ? "Technician performance" : "أداء الفنيين"}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-800">{isEn ? "Technician performance" : "أداء الفنيين"}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {isEn ? `${rows.length} active technicians` : `${rows.length} فنيين نشطين`}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
          {isEn ? "Task size" : "حجم المهمة"}
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as TechnicianSizeFilter)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
          >
            {TECHNICIAN_SIZE_FILTERS.map((f) => (
              <option key={f} value={f}>{sizeLabel(f)}</option>
            ))}
          </select>
        </label>
      </div>
      {rows.length === 0 ? (
        <Empty
          text={
            size === "ALL"
              ? isEn ? "No technician activity in this period." : "لا يوجد نشاط للفنيين في هذه الفترة."
              : isEn ? "No tasks of this size in this period." : "لا توجد مهام بهذا الحجم في هذه الفترة."
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100">
                {headers.map((h) => (
                  <th key={h} scope="col" className="px-2 py-2.5 text-start font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-2 py-3 text-slate-800 whitespace-nowrap">{r.name}</td>
                  <td className="px-2 py-3 text-slate-600 whitespace-nowrap">{r.specialty ? categoryLabel(r.specialty, isEn) ?? r.specialty : dash}</td>
                  <td className="px-2 py-3 text-slate-800 tabular-nums">{r.completed}</td>
                  <td className="px-2 py-3 text-slate-700 whitespace-nowrap">{r.avgCompletionMins === null ? dash : formatDuration(r.avgCompletionMins, isEn)}</td>
                  <td className="px-2 py-3 text-slate-700 tabular-nums">{r.slaPct === null ? dash : `${r.slaPct}%`}</td>
                  <td className="px-2 py-3 text-slate-700 tabular-nums whitespace-nowrap">{r.avgRating === null ? dash : `${r.avgRating} / 5`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function RequestsByType({ isEn, rows }: { isEn: boolean; rows: OtherMaintenanceSummary["byCategory"] }) {
  return (
    <section className={card} aria-label={isEn ? "Requests by type" : "توزيع الأعطال حسب النوع"}>
      <CardHeader title={isEn ? "Requests by type" : "توزيع الأعطال حسب النوع"} hint={isEn ? "Number of requests" : "عدد البلاغات"} />
      {rows.length === 0 ? (
        <Empty text={isEn ? "No requests in this period." : "لا توجد بلاغات في هذه الفترة."} />
      ) : (
        <CountBars
          labelWidth="w-32"
          rows={rows.map((r) => ({
            key: r.category ?? "none",
            label: r.category ? categoryLabel(r.category, isEn) ?? r.category : isEn ? "Uncategorized (older)" : "غير مصنف (أقدم)",
            count: r.count,
          }))}
        />
      )}
    </section>
  );
}

export function RequestsByBuilding({ isEn, rows }: { isEn: boolean; rows: OtherMaintenanceSummary["byBuilding"] }) {
  return (
    <section className={card} aria-label={isEn ? "Requests by building" : "الأعطال حسب المبنى"}>
      <CardHeader
        title={isEn ? "Requests by building" : "الأعطال حسب المبنى"}
        hint={isEn ? "The most requests may need preventive maintenance" : "الأكثر بلاغات يحتاج صيانة وقائية"}
      />
      {rows.length === 0 ? (
        <Empty text={isEn ? "No requests in this period." : "لا توجد بلاغات في هذه الفترة."} />
      ) : (
        <CountBars labelWidth="w-32" rows={rows.map((r) => ({ key: r.buildingId, label: isEn ? r.nameEn : r.nameAr, count: r.count }))} />
      )}
    </section>
  );
}

export function RecurringFaults({ isEn, rows }: { isEn: boolean; rows: RecurringFaultRow[] }) {
  const location = (r: RecurringFaultRow) => {
    const building = isEn ? r.buildingNameEn : r.buildingNameAr;
    const where = r.unitName ? `${isEn ? "Unit" : "شقة"} ${r.unitName}` : roomLabel(r.place, isEn);
    return `${building} — ${where}`;
  };
  const issue = (r: RecurringFaultRow) =>
    r.topCategory ? `${r.topIssue} (${categoryLabel(r.topCategory, isEn) ?? r.topCategory})` : r.topIssue;

  return (
    <section className={card} aria-label={isEn ? "Recurring faults on the same unit" : "أعطال متكررة على نفس الوحدة"}>
      <h2 className="text-base font-bold text-slate-800">{isEn ? "Recurring faults on the same unit" : "أعطال متكررة على نفس الوحدة"}</h2>
      <p className="text-xs text-slate-400 mt-1 mb-3">
        {isEn
          ? `${RECURRING_MIN} or more requests within ${RECURRING_DAYS} days — a sign of a root problem`
          : `${RECURRING_MIN} بلاغات أو أكثر خلال ${RECURRING_DAYS} يوماً — إشارة لمشكلة جذرية`}
      </p>
      {rows.length === 0 ? (
        <Empty text={isEn ? "No recurring faults — good news." : "لا توجد أعطال متكررة — خبر جيد."} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100">
                <th scope="col" className="px-2 py-2.5 text-start font-semibold">{isEn ? "Building / unit" : "المبنى / الوحدة"}</th>
                <th scope="col" className="px-2 py-2.5 text-start font-semibold">{isEn ? "Requests" : "عدد البلاغات"}</th>
                <th scope="col" className="px-2 py-2.5 text-start font-semibold">{isEn ? "Most common issue" : "النوع الغالب"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="px-2 py-3 text-slate-800">{location(r)}</td>
                  <td className="px-2 py-3 whitespace-nowrap">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${r.count > RECURRING_MIN ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>
                      {r.count} {isEn ? "requests" : "بلاغات"}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-slate-700">{issue(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
