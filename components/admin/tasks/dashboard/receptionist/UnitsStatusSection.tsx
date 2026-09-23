"use client";

import React from "react";
import { Check, AlertCircle } from "lucide-react";

export default function UnitsStatusSection({ isEn }: { isEn: boolean }) {
  const t = {
    unitsStatus: isEn ? "Units Status" : "حالة الوحدات",
    unitsCount: isEn ? "24 units" : "24 وحدة",
    readiness: isEn ? "Today's Readiness — Check-in/Check-out" : "جاهزية اليوم — دخول وخروج الضيوف",
    quickClean: isEn ? "+ Quick Cleaning Task" : "+ مهمة تنظيف سريعة",
    ready: isEn ? "Ready" : "جاهزة",
    pendingAudit: isEn ? "Pending Audit" : "بانتظار تدقيق",
    pendingCleaning: isEn ? "Pending Cleaning" : "بانتظار تنظيف",
    issue: isEn ? "Issue" : "بها مشكلة",
    details: isEn ? "Details" : "تفاصيل",
  };

  // Generate 24 dummy units
  const units = Array.from({ length: 24 }).map((_, i) => {
    const num = 101 + i + (i > 11 ? 100 - 12 : 0); // 101-112, 201-212 approx, just dummy numbers
    let status = "ready";
    let icon = null;
    
    // Assign some statuses based on the screenshot
    if ([104, 110, 117].includes(num)) {
      status = "pending_cleaning";
      icon = "🧹";
    } else if ([106, 114, 122].includes(num)) {
      status = "pending_audit";
      icon = "⏳";
    } else if (num === 108) {
      status = "issue";
      icon = "!";
    } else {
      icon = "✓";
    }

    return { num, status, icon };
  });

  const timeline = [
    {
      time: "12:00",
      unit: "الوحدة 205",
      desc: "مغادرة ضيف — بانتظار تنظيف",
      badge: "مطلوب تنظيف",
      badgeClass: "bg-orange-100 text-orange-700",
      badgeDot: "bg-orange-500",
    },
    {
      time: "14:00",
      unit: "الوحدة 310",
      desc: "وصول ضيف — الوحدة جاهزة",
      badge: "جاهزة",
      badgeClass: "bg-emerald-100 text-emerald-700",
      badgeDot: "bg-emerald-500",
    },
    {
      time: "14:30",
      unit: "الوحدة 118",
      desc: "مغادرة ضيف — تنظيف جارِ",
      badge: "قيد المتابعة",
      badgeClass: "bg-blue-100 text-blue-700",
      badgeDot: "bg-blue-500",
    },
    {
      time: "16:00",
      unit: "الوحدة 402",
      desc: "وصول ضيف — بانتظار تدقيق نهائي",
      badge: "قيد المتابعة",
      badgeClass: "bg-blue-100 text-blue-700",
      badgeDot: "bg-blue-500",
    },
  ];

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
          {/* Vertical Line */}
          <div className="absolute right-8 top-6 bottom-6 w-px bg-slate-100"></div>

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
