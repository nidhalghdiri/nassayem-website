"use client";

import React from "react";
import type { WorkerStats } from "@/lib/reports/workerDashboard";

export default function WorkerStatsSection({ isEn, stats }: { isEn: boolean; stats: WorkerStats }) {
  const t = {
    acceptanceRate: isEn ? "First-time Acceptance Rate" : "نسبة القبول من أول مرة",
    pendingAudit: isEn ? "Pending Supervisor Audit" : "بانتظار تدقيق المشرف",
    completedThisWeek: isEn ? "Completed this week" : "أنجزتها هذا الأسبوع",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-center text-left" dir={isEn ? "ltr" : "rtl"}>
        <div className="text-xs font-bold text-slate-500 mb-2">{t.acceptanceRate}</div>
        <div className="text-3xl font-black text-slate-800 flex items-baseline gap-1">
          {stats.firstTimeAcceptanceRate} <span className="text-sm font-bold text-slate-500">%</span>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-center text-left" dir={isEn ? "ltr" : "rtl"}>
        <div className="text-xs font-bold text-slate-500 mb-2">{t.pendingAudit}</div>
        <div className="text-3xl font-black text-orange-600">{stats.pendingAuditCount}</div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-center text-left" dir={isEn ? "ltr" : "rtl"}>
        <div className="text-xs font-bold text-slate-500 mb-2">{t.completedThisWeek}</div>
        <div className="text-3xl font-black text-slate-800">{stats.completedThisWeekCount}</div>
      </div>
    </div>
  );
}
