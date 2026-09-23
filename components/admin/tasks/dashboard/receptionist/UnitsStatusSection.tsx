"use client";

import React from "react";
import type { UnitStatusInfo, TimelineEvent } from "@/lib/reports/receptionistDashboard";

export default function UnitsStatusSection({ 
  isEn,
  units,
  timeline
}: { 
  isEn: boolean;
  units: UnitStatusInfo[];
  timeline: TimelineEvent[];
}) {
  const t = {
    unitsStatus: isEn ? "Units Status" : "حالة الوحدات",
    unitsCount: isEn ? `${units.length} units` : `${units.length} وحدة`,
    readiness: isEn ? "Today's Readiness" : "جاهزية اليوم",
    quickClean: isEn ? "+ Quick Cleaning Task" : "+ مهمة تنظيف سريعة",
    ready: isEn ? "Ready" : "جاهزة",
    pendingAudit: isEn ? "Pending Audit" : "بانتظار تدقيق",
    pendingCleaning: isEn ? "Pending Cleaning" : "بانتظار تنظيف",
    issue: isEn ? "Issue" : "بها مشكلة",
    details: isEn ? "Details" : "تفاصيل",
    noEvents: isEn ? "No events today" : "لا توجد أحداث اليوم",
    noUnits: isEn ? "No units in this building" : "لا توجد وحدات في هذا المبنى",
  };

  const getStatusClasses = (status: string) => {
    switch (status) {
      case "ready": return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "pending_cleaning": return "bg-orange-50 text-orange-700 border-orange-100";
      case "pending_audit": return "bg-blue-50 text-blue-700 border-blue-100";
      case "issue": return "bg-red-50 text-red-700 border-red-200";
      default: return "bg-slate-50";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Today's Readiness Timeline */}
      <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[600px]">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800">{t.readiness}</h3>
          <button className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
            {t.quickClean}
          </button>
        </div>
        <div className="p-6 overflow-y-auto hide-scrollbar flex-1 relative">
          {timeline.length > 0 && <div className="absolute right-8 top-6 bottom-6 w-px bg-slate-100"></div>}
          
          {timeline.length === 0 && (
            <div className="text-center text-slate-500 text-sm mt-8">{t.noEvents}</div>
          )}

          <div className="space-y-8 relative">
            {timeline.map((item, idx) => (
              <div key={idx} className="flex gap-4 items-start">
                <button className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold transition-colors w-20 shrink-0 h-10">
                  {t.details}
                </button>
                <div className="flex-1 border-b border-slate-100 pb-6 flex flex-col items-end">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 mb-2 ${item.badgeClass}`}>
                    {item.badge}
                    <span className={`w-1.5 h-1.5 rounded-full ${item.badgeDot}`}></span>
                  </span>
                  <div className="font-bold text-slate-800 text-sm">{item.unit}</div>
                  <div className="text-xs text-slate-500 mt-1">{item.desc}</div>
                </div>
                <div className="w-14 text-right pt-2 font-black text-slate-800 shrink-0 bg-white relative z-10 text-sm">
                  {item.time}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Units Grid */}
      <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[600px]">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800">{t.unitsStatus}</h3>
          <span className="text-xs text-slate-500 font-medium">{t.unitsCount}</span>
        </div>
        <div className="p-6 flex-1 overflow-y-auto hide-scrollbar">
          {units.length === 0 && (
            <div className="text-center text-slate-500 text-sm mt-8">{t.noUnits}</div>
          )}
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-6">
            {units.map((u) => (
              <div 
                key={u.num} 
                className={`aspect-square rounded-xl border flex flex-col items-center justify-center p-2 transition-transform hover:scale-105 cursor-pointer shadow-sm ${getStatusClasses(u.status)}`}
              >
                <div className="text-xs mb-1 font-black opacity-80 h-4">
                  {u.icon === "✓" ? <Check className="w-3 h-3" /> : u.icon === "!" ? <AlertCircle className="w-3 h-3 text-red-500" /> : u.icon}
                </div>
                <div className="font-black text-sm">{u.num}</div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] font-bold border-t border-slate-100 pt-4 text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> {t.ready}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> {t.pendingAudit}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span> {t.pendingCleaning}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500"></span> {t.issue}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
