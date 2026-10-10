"use client";

import React from "react";
import { MapPin, CheckCircle2, XCircle, Clock, Wrench, PackageX, PlayCircle, ChevronRight, History } from "lucide-react";
import type { MaintenanceTask } from "@/lib/reports/maintenanceDashboard";
import { formatDateTimeOman, formatDuration } from "../../timeUtils";

const REVIEW_BADGE: Record<string, { en: string; ar: string; cls: string }> = {
  approved: { en: "Approved by supervisor", ar: "اعتمدها المشرف", cls: "bg-emerald-50 text-emerald-700" },
  approved_receptionist: { en: "Approved by reception", ar: "اعتمدها الاستقبال", cls: "bg-teal-50 text-teal-700" },
  rejected: { en: "Rejected — redo", ar: "مرفوضة — إعادة", cls: "bg-red-50 text-red-600" },
  pending: { en: "Pending review", ar: "بانتظار المراجعة", cls: "bg-orange-50 text-orange-600" },
};

/** Finished / cancelled tasks from the last 30 days, newest first. */
export default function MaintenanceLog({
  isEn, tasks, onOpenTask,
}: {
  isEn: boolean;
  tasks: MaintenanceTask[];
  onOpenTask: (id: string) => void;
}) {
  const t = {
    title: isEn ? "Task log" : "سجل المهام",
    subtitle: isEn ? "Last 30 days" : "آخر 30 يوماً",
    empty: isEn ? "No finished tasks in the last 30 days." : "لا توجد مهام منتهية خلال آخر 30 يوماً.",
    completed: isEn ? "Completed" : "مكتملة",
    cancelled: isEn ? "Cancelled" : "ملغاة",
    arrivalToStart: isEn ? "Arrival → start" : "الوصول ← البدء",
    workTime: isEn ? "Work time" : "وقت العمل",
    paused: isEn ? "Paused for parts" : "إيقاف لقطع غيار",
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <h3 className="font-bold text-slate-800">{t.title}</h3>
        <span className="text-xs text-slate-500 font-medium">{t.subtitle} · {tasks.length}</span>
      </div>

      {tasks.length === 0 ? (
        <div className="py-14 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
          <History className="w-8 h-8 text-slate-300" />
          {t.empty}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {tasks.map((task) => {
            const isCancelled = task.status === "CANCELLED";
            const review = task.review ? REVIEW_BADGE[task.review] : null;
            return (
              <li key={task.id}>
                <button
                  onClick={() => onOpenTask(task.id)}
                  className="w-full text-start px-5 py-4 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{task.title}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-rose-400" />
                        {isEn ? task.buildingNameEn : task.buildingNameAr}
                        {task.unitName ? ` — ${task.unitName}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${isCancelled ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}>
                        {isCancelled ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        {isCancelled ? t.cancelled : t.completed}
                      </span>
                      {review && (
                        <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${review.cls}`}>
                          {isEn ? review.en : review.ar}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-nassayem rtl:rotate-180" />
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
                    {task.completedAt && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDateTimeOman(task.completedAt, isEn)}
                      </span>
                    )}
                    {task.arrivalToStartMins !== null && (
                      <span className="flex items-center gap-1.5">
                        <PlayCircle className="w-3.5 h-3.5" />
                        {t.arrivalToStart}: <b className="text-slate-700">{formatDuration(task.arrivalToStartMins, isEn)}</b>
                      </span>
                    )}
                    {task.workMins !== null && (
                      <span className="flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5" />
                        {t.workTime}: <b className="text-slate-700">{formatDuration(task.workMins, isEn)}</b>
                      </span>
                    )}
                    {task.holdMins > 0 && (
                      <span className="flex items-center gap-1.5 text-amber-700">
                        <PackageX className="w-3.5 h-3.5" />
                        {t.paused}: <b>{formatDuration(task.holdMins, isEn)}</b>
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
