import React from "react";
import type { BuildingAuditStatus } from "@/lib/reports/supervisorAudit";

export default function LastAuditPerBuilding({ data, locale }: { data: BuildingAuditStatus[]; locale: string }) {
  const isEn = locale === "en";

  const t = {
    title: isEn ? "Last Audit per Building" : "آخر تدقيق لكل مبنى",
    building: isEn ? "Building" : "المبنى",
    lastTour: isEn ? "Last Tour" : "آخر جولة",
    today: isEn ? "Today" : "اليوم",
    yesterday: isEn ? "Yesterday" : "أمس",
    daysAgo: isEn ? "days ago" : "أيام",
    before: isEn ? "" : "قبل",
    never: isEn ? "Never" : "لم يتم",
  };

  const formatTimeAgo = (dateStr: Date | null) => {
    if (!dateStr) return <span className="text-slate-400">{t.never}</span>;
    
    const now = new Date();
    const date = new Date(dateStr);
    
    // reset time to compare days
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffTime = Math.abs(nowDay.getTime() - dateDay.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    if (diffDays === 0) return t.today;
    if (diffDays === 1) return t.yesterday;
    return isEn ? `${diffDays} ${t.daysAgo}` : `${t.before} ${diffDays} ${t.daysAgo}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden h-full">
      <div className="p-5">
        <h2 className="font-bold text-slate-800">{t.title}</h2>
      </div>

      <div className="px-5 pb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className={`font-normal pb-3 ${isEn ? "text-left" : "text-right"}`}>{t.building}</th>
              <th className={`font-normal pb-3 ${isEn ? "text-right" : "text-left"}`}>{t.lastTour}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => (
              <tr key={item.buildingId} className={idx !== data.length - 1 ? "border-b border-slate-50" : ""}>
                <td className="py-3.5 font-bold text-slate-700">{item.name}</td>
                <td className={`py-3.5 ${isEn ? "text-right" : "text-left"}`}>
                  <div className={`flex items-center justify-end gap-2 ${isEn ? "flex-row" : "flex-row-reverse"}`}>
                    <span className={`font-medium ${item.isLate ? "text-slate-800" : "text-slate-500"}`}>
                      {formatTimeAgo(item.lastAuditAt)}
                    </span>
                    {item.isLate && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={2} className="py-8 text-center text-slate-500 text-sm">
                  {isEn ? "No buildings assigned." : "لا توجد مباني مسندة."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
