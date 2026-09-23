"use client";

import React from "react";
import { Clock, CheckCircle2 } from "lucide-react";

export default function LiveTasksSection({ isEn }: { isEn: boolean }) {
  const t = {
    staffPerformance: isEn ? "Building staff performance" : "أداء موظفي المبنى",
    thisWeek: isEn ? "This week" : "هذا الأسبوع",
    liveTasks: isEn ? "Current tasks in the building" : "المهام الجارية بالمبنى",
    directlyFromSystem: isEn ? "Live from the system" : "مباشر من النظام",
  };

  const staff = [
    { name: "فؤاد عبدالله يحيى", role: "تنظيف", score: 97, avatar: "ف" },
    { name: "محمد محي الدين", role: "صيانة", score: 85, avatar: "م" },
    { name: "سالم الكندي", role: "استقبال", score: 90, avatar: "س" },
  ];

  const liveTasks = [
    {
      title: "تنظيف عميق — الوحدة 302",
      user: "فؤاد عبدالله يحيى",
      badge: "جاري العمل",
      badgeBg: "bg-slate-100",
      badgeText: "text-slate-600",
      icon: "🧹"
    },
    {
      title: "Check out (304B) — تنظيف متوسط",
      user: "فؤاد عبدالله يحيى",
      badge: "جاري العمل",
      badgeBg: "bg-slate-100",
      badgeText: "text-slate-600",
      icon: "🧹"
    },
    {
      title: "تنظيف عادي — الوحدة 118",
      user: "فؤاد عبدالله يحيى",
      badge: "بانتظار الاعتماد • قبل 22 دقيقة",
      badgeBg: "bg-blue-100",
      badgeText: "text-blue-700",
      icon: "🧹",
      iconColor: "text-blue-500"
    },
    {
      title: "تنظيف عميق — الوحدة 207",
      user: "محمد اريفور رحمن",
      badge: "اعتمدها الاستقبال — بانتظار اعتماد المشرف",
      badgeBg: "bg-emerald-100",
      badgeText: "text-emerald-700",
      icon: "🧹",
      showCheck: true
    }
  ];

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
            {staff.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                <div className="text-lg font-black text-slate-800 w-8">{s.score}</div>
                <div className="flex flex-col items-end flex-1 mr-4">
                  <div className="font-bold text-slate-800 text-sm">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.role}</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-lg shadow-sm border border-orange-200 ml-4 shrink-0">
                  {s.avatar}
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
          {liveTasks.map((task, idx) => (
            <div key={idx} className="border border-slate-100 rounded-2xl p-4 flex justify-between items-center hover:border-nassayem/30 transition-colors">
              <div className="flex flex-col gap-2 w-full">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-slate-800 text-sm">{task.title}</h4>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 shrink-0">
                    {task.icon}
                  </div>
                </div>
                <div className="flex items-center justify-between w-full">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 ${task.badgeBg} ${task.badgeText}`}>
                    {task.showCheck && <CheckCircle2 className="w-3 h-3" />}
                    {task.badge}
                  </span>
                  <span className="text-xs text-slate-500">{task.user}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
