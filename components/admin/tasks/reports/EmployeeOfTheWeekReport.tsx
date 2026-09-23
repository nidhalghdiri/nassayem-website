"use client";

import React, { useState } from "react";
import { Star, AlertTriangle, BarChart3, AlertCircle } from "lucide-react";
import EmployeeDetailsModal from "./EmployeeDetailsModal";
import type { LeaderboardEmployee } from "@/lib/reports/employeeRanking";

interface Props {
  employees: LeaderboardEmployee[];
  lastWeekEmployees?: LeaderboardEmployee[];
}

export default function EmployeeOfTheWeekReport({ employees, lastWeekEmployees = [] }: Props) {
  const [selectedEmployee, setSelectedEmployee] = useState<LeaderboardEmployee | null>(null);
  const [showLastWeek, setShowLastWeek] = useState(false);
  
  const currentEmployees = showLastWeek ? lastWeekEmployees : employees;

  if (!currentEmployees || currentEmployees.length === 0) {
    return (
      <div className="bg-white min-h-screen p-6 font-sans text-slate-800 flex items-center justify-center" dir="rtl">
        <p className="text-slate-500">لا توجد بيانات متاحة لهذا الأسبوع.</p>
      </div>
    );
  }

  const bestEmployee = currentEmployees[0];
  const lowestEmployee = currentEmployees[currentEmployees.length - 1];
  const teamAverage = (currentEmployees.reduce((acc, curr) => acc + curr.totalScore, 0) / currentEmployees.length).toFixed(1);

  return (
    <div className="bg-white p-6 font-sans text-slate-800 rounded-3xl" dir="rtl">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">تقرير موظف الأسبوع</h1>
            <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">جديد</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-500">{currentEmployees[0]?.dateRange}</span>
            <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
              <button 
                onClick={() => setShowLastWeek(true)}
                className={`${showLastWeek ? 'bg-white font-bold text-slate-800 shadow-sm' : 'font-medium text-slate-500 hover:text-slate-800'} px-4 py-1.5 text-sm rounded-md transition-colors`}
              >
                الأسبوع السابق
              </button>
              <button 
                onClick={() => setShowLastWeek(false)}
                className={`${!showLastWeek ? 'bg-white font-bold text-slate-800 shadow-sm' : 'font-medium text-slate-500 hover:text-slate-800'} px-4 py-1.5 text-sm rounded-md transition-colors`}
              >
                آخر 7 أيام
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-orange-50/30 border border-orange-200 rounded-2xl p-5 flex flex-col justify-center relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-orange-800/70 mb-1">موظف الأسبوع</p>
                <p className="text-lg font-bold text-orange-900">{bestEmployee.name} — {bestEmployee.totalScore}%</p>
              </div>
              <Star className="w-8 h-8 text-orange-400 fill-orange-400 opacity-20 absolute -left-2 -bottom-2 w-24 h-24" />
              <Star className="w-6 h-6 text-orange-400 fill-orange-400" />
            </div>
          </div>

          <div className="bg-red-50/50 border border-red-200 rounded-2xl p-5 flex flex-col justify-center">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-red-800/70 mb-1">يحتاج تنبيه</p>
                <p className="text-lg font-bold text-red-900">{lowestEmployee.name} — {lowestEmployee.totalScore}%</p>
              </div>
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-center">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">متوسط الفريق</p>
                <p className="text-lg font-bold text-slate-800">{teamAverage}%</p>
              </div>
              <BarChart3 className="w-6 h-6 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-4 py-4 w-12 text-center">#</th>
                  <th className="px-4 py-4">الموظف</th>
                  <th className="px-2 py-4 text-center">حجم الإنتاجية<br/><span className="text-[10px] font-normal">من 30</span></th>
                  <th className="px-2 py-4 text-center">الالتزام بالوقت<br/><span className="text-[10px] font-normal">من 30</span></th>
                  <th className="px-2 py-4 text-center">جودة العمل<br/><span className="text-[10px] font-normal">من 20</span></th>
                  <th className="px-2 py-4 text-center">التوثيق والاستجابة<br/><span className="text-[10px] font-normal">من 10</span></th>
                  <th className="px-2 py-4 text-center">تقييم المشرف<br/><span className="text-[10px] font-normal">من 10</span></th>
                  <th className="px-4 py-4 text-center">الإجمالي</th>
                  <th className="px-4 py-4 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentEmployees.map((emp, idx) => (
                  <tr 
                    key={emp.id} 
                    onClick={() => setSelectedEmployee(emp)}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                  >
                    <td className="px-4 py-4 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-bold text-slate-800">{emp.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{emp.role} · {emp.location} · {emp.taskCount} مهمة</p>
                        </div>
                        {emp.isEmployeeOfWeek && <Star className="w-4 h-4 text-orange-400 fill-orange-400 mr-2" />}
                      </div>
                    </td>
                    <ScoreCell score={emp.productivity?.score || 0} note={emp.productivity?.note || ""} />
                    <ScoreCell score={emp.timeAdherence?.score || 0} note={emp.timeAdherence?.note || ""} />
                    <ScoreCell score={emp.workQuality?.score || 0} note={emp.workQuality?.note || ""} />
                    <ScoreCell score={emp.docAndResponse?.score || 0} note={emp.docAndResponse?.note || ""} />
                    <ScoreCell score={emp.supervisorEval?.score || 0} note={emp.supervisorEval?.note || ""} />
                    
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-bold text-slate-800 w-12 text-left">{emp.totalScore}%</span>
                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                          <div 
                            className={`h-full rounded-full ${emp.totalScore >= 90 ? 'bg-emerald-600' : emp.totalScore >= 80 ? 'bg-emerald-500' : emp.totalScore >= 70 ? 'bg-orange-500' : 'bg-red-500'}`}
                            style={{ width: `${emp.totalScore}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-4 py-4 text-center">
                      {emp.isEmployeeOfWeek ? (
                        <span className="inline-flex items-center gap-1 bg-orange-500 text-white px-3 py-1.5 rounded-full text-[11px] font-bold">
                          <Star className="w-3 h-3 fill-white" />
                          موظف الأسبوع
                        </span>
                      ) : emp.totalScore >= 80 ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-full text-[11px] font-bold">
                          أداء جيد
                        </span>
                      ) : emp.totalScore >= 70 ? (
                        <span className="bg-orange-50 text-orange-700 border border-orange-100 px-3 py-1.5 rounded-full text-[11px] font-bold">
                          يحتاج متابعة
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 justify-center">
                          <span className="text-red-600 text-[11px] font-bold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            يحتاج تنبيه
                          </span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); alert('تم إرسال التنبيه'); }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                          >
                            إرسال تنبيه
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-[11px] text-slate-500 leading-relaxed text-justify">
          الإجمالي = مجموع نقاط المعايير الخمسة من 100. تُحسب الإنتاجية والوقت والجودة والتوثيق آلياً من النظام (90 نقطة). وتقييم المشرف من دفتر الملاحظات (10 نقاط). <Star className="inline-block w-3 h-3 text-orange-400 fill-orange-400 align-text-bottom mx-0.5" /> صاحب أعلى نسبة هو موظف الأسبوع، و«يحتاج تنبيه» لكل من ينزل عن 70%. اضغط على أي موظف لعرض تفاصيله.
        </p>

      </div>

      {selectedEmployee && (
        <EmployeeDetailsModal 
          employee={selectedEmployee} 
          onClose={() => setSelectedEmployee(null)} 
        />
      )}
    </div>
  );
}

function ScoreCell({ score, note }: { score: number, note: string }) {
  const isZero = score === 0;
  return (
    <td className="px-2 py-4 text-center">
      <div className="flex flex-col items-center">
        <span className={`font-bold ${isZero ? 'text-red-500' : 'text-emerald-600'}`}>{score.toFixed(1)}</span>
        <span className="text-[10px] text-slate-400 mt-1" style={{ direction: 'ltr', textAlign: 'right' }}>{note}</span>
      </div>
    </td>
  );
}
