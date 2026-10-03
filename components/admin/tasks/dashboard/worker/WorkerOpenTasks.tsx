"use client";

import React, { useState } from "react";
import type { WorkerTask } from "@/lib/reports/workerDashboard";
import { Clock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { STATUS_TRANSITIONS, TRANSITION_BUTTON_LABEL } from "@/lib/tasks/statuses";
import type { TTaskStatus } from "@/lib/tasks/statuses";

// The single "move forward" step for a task: Assigned → Started → Completed.
// (ON_HOLD / CANCELLED are side exits, handled in the task details panel.)
function nextStep(task: WorkerTask): TTaskStatus | null {
  const options =
    (STATUS_TRANSITIONS as Record<string, Partial<Record<string, TTaskStatus[]>>>)[task.type]?.[task.status] ?? [];
  return options.find((s) => s !== "ON_HOLD" && s !== "CANCELLED") ?? null;
}

export default function WorkerOpenTasks({
  isEn,
  locale,
  tasks,
  onOpenTask,
}: {
  isEn: boolean;
  locale: string;
  tasks: WorkerTask[];
  onOpenTask: (id: string) => void;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function advance(task: WorkerTask, next: TTaskStatus) {
    setBusyId(task.id);
    setErrors((prev) => ({ ...prev, [task.id]: "" }));
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors((prev) => ({ ...prev, [task.id]: data.error ?? (isEn ? "Could not update the task." : "تعذّر تحديث المهمة.") }));
        return;
      }
      router.refresh();
    } catch {
      setErrors((prev) => ({ ...prev, [task.id]: isEn ? "Network error." : "خطأ في الشبكة." }));
    } finally {
      setBusyId(null);
    }
  }

  const t = {
    openTasks: isEn ? "My Open Tasks" : "مهامي المفتوحة",
    sortedByRecency: isEn ? "Sorted by newest" : "مرتبة حسب الأحدث",
    finish: isEn ? "Finish" : "إنهاء",
    working: isEn ? "Working" : "جاري العمل",
    buildingMngr: isEn ? "Building Manager" : "مسؤول المبنى",
    new: isEn ? "New" : "جديد",
    late: isEn ? "Late" : "متأخرة",
    normal: isEn ? "Normal" : "عادي",
    high: isEn ? "High" : "مرتفع",
    hrs: isEn ? "h" : "س",
    mins: isEn ? "m" : "د",
    noTasks: isEn ? "You have no open tasks." : "لا توجد لديك مهام مفتوحة.",
    rejectedNeedRepeat: isEn ? "Rejected - Needs Repeat" : "مرفوضة - تحتاج إعادة",
    start: isEn ? "Start" : "ابدأ",
    openInspection: isEn ? "Open Inspection" : "فتح الفحص",
    details: isEn ? "Details" : "التفاصيل",
    notStarted: isEn ? "Not started" : "لم تبدأ",
  };

  const formatLateTime = (timeMins: number) => {
    if (timeMins < 60) return `${timeMins} ${t.mins}`;
    const h = Math.floor(timeMins / 60);
    const m = timeMins % 60;
    return `${h} ${t.hrs} ${m} ${t.mins}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h3 className="font-bold text-slate-800 text-sm">{t.openTasks}</h3>
        <span className="text-xs text-slate-400 font-medium">{t.sortedByRecency}</span>
      </div>
      <div className="p-5 space-y-4">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">{t.noTasks}</div>
        ) : (
          tasks.map(task => (
            <div key={task.id} className={`border ${task.hasRejection ? 'border-red-300 bg-red-50/20' : 'border-slate-100'} rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center hover:border-nassayem/30 transition-colors gap-4`}>
              
              {/* Task Details */}
              <div className="flex flex-col gap-3 w-full">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-800">
                      {task.title} {task.unitName ? `— الوحدة ${task.unitName}` : ""}
                    </h4>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 shrink-0">
                    {task.type === "CLEANING" ? "🧹" : "🔧"}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  {task.hasRejection ? (
                    <span className="bg-red-100 text-red-700 border border-red-200 text-[11px] font-black px-2 py-1 rounded-md animate-pulse">
                      {t.rejectedNeedRepeat}
                    </span>
                  ) : task.status === "ASSIGNED" ? (
                    <span className="bg-orange-50 text-orange-600 text-[11px] font-bold px-2 py-1 rounded-md">
                      {t.notStarted}
                    </span>
                  ) : (
                    <span className="bg-blue-50 text-blue-600 text-[11px] font-bold px-2 py-1 rounded-md">
                      {t.working}
                    </span>
                  )}
                  <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2 py-1 rounded-md">
                    {t.buildingMngr} · {task.buildingName}
                  </span>
                  
                  {task.isNew && (
                    <span className="bg-purple-100 text-purple-700 text-[11px] font-bold px-2 py-1 rounded-md">
                      {t.new}
                    </span>
                  )}

                  {task.isLate ? (
                    <span className="bg-red-50 text-red-600 text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {t.late} {formatLateTime(task.timeElapsedMins)}
                    </span>
                  ) : task.timeElapsedMins > 0 ? (
                    <span className="bg-blue-50 text-blue-600 text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatLateTime(task.timeElapsedMins)}
                    </span>
                  ) : null}

                  {task.priority === "HIGH" || task.priority === "URGENT" ? (
                    <span className="bg-orange-50 text-orange-600 text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      {t.high}
                    </span>
                  ) : (
                    <span className="bg-emerald-50 text-emerald-600 text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {t.normal}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              {(() => {
                const next = nextStep(task);
                const isBusy = busyId === task.id;
                const isStart = next === "CLEANING_STARTED" || next === "WORK_STARTED" || next === "IN_PROGRESS";
                const label = task.type === "INSPECTION"
                  ? t.openInspection
                  : isStart ? t.start : t.finish;
                return (
                  <div className="flex flex-col items-stretch md:items-end gap-1.5 w-full md:w-auto shrink-0">
                    <div className="flex gap-2">
                      <button
                        onClick={() => onOpenTask(task.id)}
                        className="flex-1 md:flex-none border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors whitespace-nowrap"
                      >
                        {t.details}
                      </button>
                      {task.type === "INSPECTION" ? (
                        <button
                          onClick={() => router.push(`/${locale}/admin/tasks/${task.id}/inspect`)}
                          className="flex-1 md:flex-none bg-teal-700 hover:bg-teal-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm whitespace-nowrap"
                        >
                          {label}
                        </button>
                      ) : next ? (
                        <button
                          onClick={() => advance(task, next)}
                          disabled={isBusy}
                          title={TRANSITION_BUTTON_LABEL[next] ? (isEn ? TRANSITION_BUTTON_LABEL[next]!.labelEn : TRANSITION_BUTTON_LABEL[next]!.labelAr) : undefined}
                          className={`flex-1 md:flex-none flex items-center justify-center gap-2 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm whitespace-nowrap disabled:opacity-60 ${
                            isStart ? "bg-blue-600 hover:bg-blue-700" : "bg-teal-700 hover:bg-teal-800"
                          }`}
                        >
                          {isBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                          {label}
                        </button>
                      ) : null}
                    </div>
                    {errors[task.id] && (
                      <p className="text-xs text-red-600 font-medium">{errors[task.id]}</p>
                    )}
                  </div>
                );
              })()}

            </div>
          ))
        )}
      </div>
    </div>
  );
}
