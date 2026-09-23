"use client";

import React from "react";
import { Clock } from "lucide-react";
import type { DashboardTask } from "@/lib/reports/receptionistDashboard";
import type { LeaderboardEmployee } from "@/lib/reports/employeeRanking";

export default function LiveTasksSection({ 
  isEn,
  liveTasks,
  staff
}: { 
  isEn: boolean;
  liveTasks: DashboardTask[];
  staff: LeaderboardEmployee[];
}) {
  const t = {
    staffPerformance: isEn ? "Building staff performance" : "أداء موظفي المبنى",
    thisWeek: isEn ? "This week" : "هذا الأسبوع",
    liveTasks: isEn ? "Current tasks in the building" : "المهام الجارية بالمبنى",
    directlyFromSystem: isEn ? "Live from the system" : "مباشر من النظام",
    noTasks: isEn ? "No current tasks in this building" : "لا توجد مهام جارية حالياً",
    noStaff: isEn ? "No staff assigned" : "لا يوجد موظفين معينين",
  };

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
            let badgeBg = "bg-slate-100";
            let badgeText = "text-slate-600";
            let badgeStr = isEn ? task.status : "جاري العمل";
            if (task.status === "ASSIGNED") {
              badgeBg = "bg-orange-100"; badgeText = "text-orange-700"; badgeStr = isEn ? "Assigned" : "بانتظار العامل";
            }

            return (
              <div key={task.id} className="border border-slate-100 rounded-2xl p-4 flex justify-between items-center hover:border-nassayem/30 transition-colors">
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-slate-800 text-sm">
                      {task.taskTitle} {task.unitName ? `— ${task.unitName}` : ""}
                    </h4>
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 shrink-0">
                      🧹
                    </div>
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 ${badgeBg} ${badgeText}`}>
                      {badgeStr}
                    </span>
                    <span className="text-xs text-slate-500">{task.assignedUserName}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}
