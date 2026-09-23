"use client";

import React from "react";
import { Check, X as CloseIcon } from "lucide-react";
import type { LeaderboardEmployee } from "@/lib/reports/employeeRanking";

interface Props {
  employee: LeaderboardEmployee;
  onClose: () => void;
}

export default function EmployeeDetailsModal({ employee, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-[550px] max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <div className="sticky top-0 bg-white/95 backdrop-blur z-10 p-6 pb-4 border-b border-slate-100 flex flex-col items-center">
          <h2 className="text-xl font-bold text-slate-800 mb-1">{employee.name}</h2>
          <p className="text-sm text-slate-500 mb-4">
            {employee.role} · {employee.location} — {employee.dateRange}
          </p>
          
          <div className="flex items-center gap-3 mb-2 flex-wrap justify-center">
            {employee.isEmployeeOfWeek && (
              <span className="bg-orange-500 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
                ⭐ موظف الأسبوع
              </span>
            )}
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-full text-xs font-bold">
              الترتيب {employee.rank} من {employee.totalEmployees}
            </span>
            <span className="bg-orange-50 text-orange-700 border border-orange-100 px-3 py-1.5 rounded-full text-xs font-bold">
              الإجمالي {employee.totalScore}%
            </span>
          </div>
        </div>

        <div className="p-6 pt-2">
          {/* Scores Table */}
          <div className="mb-6">
            <div className="grid grid-cols-12 text-xs font-medium text-slate-400 mb-2 px-2">
              <div className="col-span-5">المعيار</div>
              <div className="col-span-3 text-center">النقاط</div>
              <div className="col-span-4 text-start">التفاصيل</div>
            </div>
            
            <div className="space-y-1">
              {[
                { label: "حجم الإنتاجية", score: employee.productivity?.score || 0, note: employee.productivity?.note || "", max: 30 },
                { label: "الالتزام بالوقت", score: employee.timeAdherence?.score || 0, note: employee.timeAdherence?.note || "", max: 30 },
                { label: "جودة العمل", score: employee.workQuality?.score || 0, note: employee.workQuality?.note || "", max: 20 },
                { label: "التوثيق وسرعة الاستجابة", score: employee.docAndResponse?.score || 0, note: employee.docAndResponse?.note || "", max: 10 },
                { label: "تقييم المشرف", score: employee.supervisorEval?.score || 0, note: employee.supervisorEval?.note || "", max: 10 },
              ].map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 py-3 px-2 border-t border-slate-50 text-sm items-center hover:bg-slate-50 transition-colors rounded-lg">
                  <div className="col-span-5 font-bold text-slate-700">{item.label}</div>
                  <div className="col-span-3 text-center font-bold text-slate-800">
                    {item.max} / {item.score.toFixed(1)}
                  </div>
                  <div className="col-span-4 text-start text-slate-500 text-xs">
                    {item.note}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-2 text-center text-xs font-bold text-slate-700 bg-slate-50 py-2 rounded-lg">
              المهام: {employee.taskCount}
            </div>
          </div>

          {/* Supervisor Notes */}
          <div>
            <h3 className="font-bold text-slate-800 mb-3 text-sm">ملاحظات الأسبوع ({employee.supervisorNotes.length})</h3>
            <div className="space-y-3">
              {employee.supervisorNotes.map((note) => (
                <div key={note.id} className={`p-4 rounded-2xl flex items-start gap-3 border ${note.type === 'positive' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
                  {note.type === 'positive' ? (
                    <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <CloseIcon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={`text-sm font-bold ${note.type === 'positive' ? 'text-emerald-900' : 'text-red-900'}`}>
                      {note.text}
                    </p>
                    <p className={`text-xs mt-1.5 ${note.type === 'positive' ? 'text-emerald-600/80' : 'text-red-600/80'}`}>
                      {note.category} · {note.timeAgo}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="sticky bottom-0 bg-white/95 backdrop-blur p-4 border-t border-slate-100 flex justify-center">
          <button 
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-8 rounded-xl transition-colors text-sm w-full sm:w-auto"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
