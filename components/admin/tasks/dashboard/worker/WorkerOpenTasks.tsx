"use client";

import React from "react";
import type { WorkerTask } from "@/lib/reports/workerDashboard";
import { Clock } from "lucide-react";
import { useRouter } from "next/navigation";

export default function WorkerOpenTasks({ isEn, tasks }: { isEn: boolean; tasks: WorkerTask[] }) {
  const router = useRouter();

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
            <div key={task.id} className="border border-slate-100 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center hover:border-nassayem/30 transition-colors gap-4">
              
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
                  <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2 py-1 rounded-md">
                    {t.working}
                  </span>
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

              {/* Action Button */}
              <button 
                onClick={() => router.push(`/admin/tasks/${task.id}/inspect`)}
                className="w-full md:w-auto bg-teal-700 hover:bg-teal-800 text-white px-8 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm shrink-0 whitespace-nowrap"
              >
                {t.finish}
              </button>

            </div>
          ))
        )}
      </div>
    </div>
  );
}
