"use client";

import React from "react";
import { Clock, User, ChevronRight } from "lucide-react";
import type { DashboardTask } from "@/lib/reports/receptionistDashboard";
import { TASK_TYPE_CONFIG, TASK_PRIORITY_CONFIG } from "@/lib/tasks/constants";
import type { TTaskType, TTaskPriority } from "@/lib/tasks/constants";
import { STATUS_CONFIG } from "@/lib/tasks/statuses";
import type { TTaskStatus } from "@/lib/tasks/statuses";
import { formatDateTimeOman } from "../../timeUtils";
import type { LeaderboardEmployee } from "@/lib/reports/employeeRanking";

export default function LiveTasksSection({ 
  isEn,
  liveTasks,
  staff,
  onOpenTask,
}: { 
  isEn: boolean;
  liveTasks: DashboardTask[];
  staff: LeaderboardEmployee[];
  onOpenTask: (id: string) => void;
}) {
  const t = {
    staffPerformance: isEn ? "Building staff performance" : "أداء موظفي المبنى",
    thisWeek: isEn ? "This week" : "هذا الأسبوع",
    liveTasks: isEn ? "Current tasks in the building" : "المهام الجارية بالمبنى",
    directlyFromSystem: isEn ? "Live from the system" : "مباشر من النظام",
    noTasks: isEn ? "No current tasks in this building" : "لا توجد مهام جارية حالياً",
    noStaff: isEn ? "No staff assigned" : "لا يوجد موظفين معينين",
    due: isEn ? "Due" : "الاستحقاق",
    overdue: isEn ? "Overdue" : "متأخرة",
  };
  const now = Date.now();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Staff Performance */}
      <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800">{t.staffPerformance}</h3>
          <span className="text-xs text-slate-500 font-medium">{t.thisWeek}</span>
        </div>
        <div className="p-5 overflow-y-auto hide-scrollbar flex-1">
          <div className="space-y-4">
            {staff.length === 0 && (
              <div className="text-center text-slate-500 text-sm mt-8">{t.noStaff}</div>
            )}
            {staff.map((s, idx) => (
              <div key={s.id} className="flex items-center justify-between pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                <div className="text-lg font-black text-slate-800 w-8">{s.totalScore}</div>
                <div className="flex flex-col items-end flex-1 mr-4">
                  <div className="font-bold text-slate-800 text-sm">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.role}</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-lg shadow-sm border border-orange-200 ml-4 shrink-0">
                  {s.name.charAt(0)}
                </div>
                <div className="text-sm font-bold text-slate-400 w-4 text-center shrink-0">
                  {idx + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Tasks */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800">{t.liveTasks}</h3>
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {t.directlyFromSystem}
          </span>
        </div>
        <div className="p-5 overflow-y-auto hide-scrollbar flex-1 space-y-3">
          {liveTasks.length === 0 && (
            <div className="text-center text-slate-500 text-sm mt-8">{t.noTasks}</div>
          )}
          {liveTasks.map((task) => {
            const type = TASK_TYPE_CONFIG[task.taskType as TTaskType];
            const status = STATUS_CONFIG[task.status as TTaskStatus];
            const priority = TASK_PRIORITY_CONFIG[task.priority as TTaskPriority];
            const isOverdue = new Date(task.dueDate).getTime() < now;

            return (
              <button
                key={task.id}
                onClick={() => onOpenTask(task.id)}
                className={`w-full text-start border rounded-2xl p-4 hover:border-nassayem/40 hover:shadow-sm transition-all group ${isOverdue ? "border-red-200 bg-red-50/20" : "border-slate-100"}`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {type && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${type.bg} ${type.text}`}>
                          {isEn ? type.labelEn : type.labelAr}
                        </span>
                      )}
                      <h4 className="font-bold text-slate-800 text-sm truncate">
                        {task.taskTitle} {task.unitName ? `— ${task.unitName}` : ""}
                      </h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {status && (
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${status.badge}`}>
                        {isEn ? status.labelEn : status.labelAr}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-nassayem rtl:rotate-180" />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
                  <span className={`flex items-center gap-1 ${isOverdue ? "text-red-600 font-bold" : ""}`}>
                    <Clock className="w-3.5 h-3.5" />
                    {t.due}: {formatDateTimeOman(task.dueDate, isEn)}
                    {isOverdue && (
                      <span className="ms-1 bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold">{t.overdue}</span>
                    )}
                  </span>
                  {priority && (
                    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium ${priority.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                      {isEn ? priority.labelEn : priority.labelAr}
                    </span>
                  )}
                  <span className="flex items-center gap-1 ms-auto">
                    <User className="w-3.5 h-3.5" />
                    <span className="font-semibold text-slate-700">{task.assignedUserName}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
