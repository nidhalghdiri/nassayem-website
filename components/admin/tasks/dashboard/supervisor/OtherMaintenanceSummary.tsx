"use client";

import React, { useState } from "react";
import { getOtherMaintenanceSummary, getOtherCardTasks } from "@/app/actions/maintenanceReport";
import CardDrilldownModal from "./CardDrilldownModal";
import MaintenanceExportButton from "./MaintenanceExportButton";
import { OTHER_CARDS, type OtherCard } from "@/lib/reports/maintenanceDrilldown";
import type { SummaryPeriod } from "@/lib/reports/maintenanceSummary";
import {
  splitDuration,
  SummaryLoadError,
  SummaryPeriodBar,
  SummarySkeletonCard,
  useMaintenanceSummary,
} from "./MaintenanceSummaryParts";
import { RecurringFaults, RequestsByBuilding, RequestsByType, TechnicianPerformance } from "./OtherMaintenanceReports";

type Props = {
  isEn: boolean;
  /** Bump to reload (e.g. after a task was changed in the details panel). */
  refreshKey: number;
  /** Open a task from a card's list. */
  onOpenTask: (id: string) => void;
};

/** Manager / Supervisor dashboards: summary cards for non-equipment maintenance. */
export default function OtherMaintenanceSummary({ isEn, refreshKey, onOpenTask }: Props) {
  const [openCard, setOpenCard] = useState<OtherCard | null>(null);
  const { range, setRange, data, loading, failed, reload } = useMaintenanceSummary(getOtherMaintenanceSummary, refreshKey);

  const requestsLabel: Record<SummaryPeriod, string> = {
    TODAY: isEn ? "Requests today" : "طلبات اليوم",
    "7D": isEn ? "Requests, last 7 days" : "طلبات آخر 7 أيام",
    "30D": isEn ? "Requests, last 30 days" : "طلبات آخر 30 يوم",
    CUSTOM: isEn ? "Requests in the chosen period" : "طلبات الفترة المحددة",
  };
  const live = isEn ? "Live — not affected by the period" : "وقتي — لا يتأثر بالفلتر";
  const none = { value: "—", unit: "" };

  const cards = data
    ? [
        {
          key: "requests",
          value: String(data.requests),
          unit: "",
          color: "text-slate-900",
          title: requestsLabel[range.period],
          hint: isEn ? `Across ${data.buildings} buildings` : `عبر ${data.buildings} مباني`,
        },
        {
          key: "response",
          ...(data.avgResponseMins === null ? none : splitDuration(data.avgResponseMins, isEn)),
          color: "text-slate-900",
          title: isEn ? "Average response time" : "متوسط وقت الاستجابة",
          hint: isEn ? "From creation to pickup" : "من الإنشاء حتى الاستلام",
        },
        {
          key: "completion",
          ...(data.avgCompletionMins === null ? none : splitDuration(data.avgCompletionMins, isEn)),
          color: "text-slate-900",
          title: isEn ? "Average full completion time" : "متوسط وقت الإنجاز الكامل",
          hint: isEn ? "From pickup to completion" : "من الاستلام حتى الإغلاق",
        },
        {
          key: "overdue",
          value: String(data.overdueNow),
          unit: "",
          color: data.overdueNow > 0 ? "text-red-600" : "text-slate-900",
          title: isEn ? "Overdue now" : "مهام متأخرة الآن",
          hint: live,
        },
        {
          key: "open",
          value: String(data.openNow),
          unit: "",
          color: data.openNow > 0 ? "text-red-600" : "text-slate-900",
          title: isEn ? "Open now" : "مهام مفتوحة الآن",
          hint: live,
        },
        {
          key: "rating",
          ...(data.avgRating === null ? none : { value: String(data.avgRating), unit: "/5" }),
          color: "text-emerald-600",
          title: isEn ? "Average requester satisfaction" : "متوسط رضا الطالبين",
          hint: isEn ? "From closing ratings" : "من تقييمات الإغلاق",
        },
      ]
    : [];

  return (
    <section className="space-y-4" aria-label={isEn ? "Other maintenance summary" : "ملخص الصيانة الأخرى"}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex-1 min-w-[240px]">
          <SummaryPeriodBar
            isEn={isEn}
            range={range}
            onChange={setRange}
            note={isEn ? "Plumbing, electrical, furniture and other non-equipment requests" : "طلبات السباكة والكهرباء والأثاث وغيرها — بدون الأجهزة"}
          />
        </div>
        <MaintenanceExportButton isEn={isEn} report="other" range={range} />
      </div>

      {failed && !data ? (
        <SummaryLoadError isEn={isEn} onRetry={reload} />
      ) : (
        <div className={`space-y-4 transition-opacity ${loading && data ? "opacity-50" : ""}`} aria-busy={loading}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data
              ? cards.map((c) => {
                  const drillable = (OTHER_CARDS as readonly string[]).includes(c.key);
                  const body = (
                    <>
                      <p className={`text-3xl font-black tabular-nums ${c.color}`}>
                        {c.value}
                        {c.unit && <span className="text-base font-bold ms-1">{c.unit}</span>}
                      </p>
                      <p className="mt-2 text-sm font-bold text-slate-800">{c.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{c.hint}</p>
                    </>
                  );
                  return drillable ? (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setOpenCard(c.key as OtherCard)}
                      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-start transition-all hover:shadow-md hover:border-nassayem/40 focus:outline-none focus:ring-2 focus:ring-nassayem/30"
                    >
                      {body}
                    </button>
                  ) : (
                    <div key={c.key} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                      {body}
                    </div>
                  );
                })
              : Array.from({ length: 6 }, (_, i) => <SummarySkeletonCard key={i} />)}
          </div>

          {data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TechnicianPerformance isEn={isEn} bySize={data.technicians} />
              <RequestsByType isEn={isEn} rows={data.byCategory} />
              <RequestsByBuilding isEn={isEn} rows={data.byBuilding} />
              <RecurringFaults isEn={isEn} rows={data.recurring} />
            </div>
          )}
        </div>
      )}

      {openCard && (
        <CardDrilldownModal
          isEn={isEn}
          title={cards.find((c) => c.key === openCard)?.title ?? ""}
          accentClass="bg-slate-100 text-slate-600"
          range={range}
          load={(r) => getOtherCardTasks(openCard, r)}
          onClose={() => setOpenCard(null)}
          onOpenTask={(id) => { setOpenCard(null); onOpenTask(id); }}
        />
      )}
    </section>
  );
}
