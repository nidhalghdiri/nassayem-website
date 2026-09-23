"use client";

import React from "react";
import type { LeaderboardEmployee } from "@/lib/reports/employeeRanking";

interface Props {
  employees: LeaderboardEmployee[];
}

export default function NominationCriteriaReport({ employees }: Props) {
  if (!employees || employees.length === 0) return null;

  const getBest = (metric: keyof LeaderboardEmployee) => {
    let best = employees[0];
    for (const emp of employees) {
      const bestScore = (best[metric] as any).score || 0;
      const empScore = (emp[metric] as any).score || 0;
      if (empScore > bestScore) {
        best = emp;
      }
    }
    return best;
  };

  const bestProductivity = getBest("productivity");
  const bestTime = getBest("timeAdherence");
  const bestQuality = getBest("workQuality");
  const bestDoc = getBest("docAndResponse");
  const bestSupervisor = getBest("supervisorEval");

  const criteria = [
    {
      id: 1,
      title: "حجم الإنتاجية",
      description: "آلي: عدد المهام المنجزة مقارنة بمتوسط الفريق",
      bestName: bestProductivity.name,
      bestScore: (bestProductivity.productivity as any).score,
      max: 30,
    },
    {
      id: 2,
      title: "الالتزام بالوقت",
      description: "آلي: نسبة المهام المنجزة ضمن الموعد",
      bestName: bestTime.name,
      bestScore: (bestTime.timeAdherence as any).score,
      max: 30,
    },
    {
      id: 3,
      title: "جودة العمل",
      description: "آلي: المهام المنجزة بدون ملاحظات أو مشاكل",
      bestName: bestQuality.name,
      bestScore: (bestQuality.workQuality as any).score,
      max: 20,
    },
    {
      id: 4,
      title: "التوثيق وسرعة الاستجابة",
      description: "آلي: رفع الصور وسرعة التفاعل مع المهمة",
      bestName: bestDoc.name,
      bestScore: (bestDoc.docAndResponse as any).score,
      max: 10,
    },
    {
      id: 5,
      title: "تقييم المشرف",
      description: "من دفتر الملاحظات اليومي",
      bestName: bestSupervisor.name,
      bestScore: (bestSupervisor.supervisorEval as any).score,
      max: 10,
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-slate-800">معايير ترشيح موظف الأسبوع</h2>
        <span className="text-xs text-slate-500 font-medium">5 معايير — 100 نقطة إجمالية</span>
      </div>
      
      <div className="flex-1 flex flex-col justify-between space-y-4">
        {criteria.map((c) => (
          <div key={c.id} className="flex flex-row-reverse items-center justify-between border-b border-slate-50 pb-4 last:border-0 last:pb-0">
            <div className="flex flex-row-reverse items-center gap-4 text-right">
              <span className="text-slate-400 font-bold text-sm w-4 text-center">{c.id}</span>
              <div>
                <p className="font-bold text-slate-800 text-[15px]">{c.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>
              </div>
            </div>
            <div className="flex flex-row-reverse items-center gap-2 text-left">
              <p className="font-bold text-teal-700 text-[15px]">{c.bestName}</p>
              <p className="font-bold text-teal-800 text-sm dir-ltr text-right w-12">
                {c.bestScore.toFixed(1)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
