const fs = require('fs');
const file = '/Users/marketing/Desktop/nassayem-website/nassayem-website/components/admin/tasks/reports/NominationCriteriaReport.tsx';
let code = fs.readFileSync(file, 'utf8');

const newComponent = `"use client";

import React from "react";
import type { LeaderboardEmployee } from "@/lib/reports/employeeRanking";
import { Target, Clock, Star, Zap, UserCheck } from "lucide-react";

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
      description: "عدد المهام مقارنة بالفريق",
      bestName: bestProductivity.name,
      bestScore: (bestProductivity.productivity as any).score,
      max: 30,
      icon: Target,
      color: "text-blue-600",
      bg: "bg-blue-50",
      barColor: "bg-blue-500",
    },
    {
      id: 2,
      title: "الالتزام بالوقت",
      description: "المهام المنجزة في الموعد",
      bestName: bestTime.name,
      bestScore: (bestTime.timeAdherence as any).score,
      max: 30,
      icon: Clock,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      barColor: "bg-emerald-500",
    },
    {
      id: 3,
      title: "جودة العمل",
      description: "المهام بدون ملاحظات",
      bestName: bestQuality.name,
      bestScore: (bestQuality.workQuality as any).score,
      max: 20,
      icon: Star,
      color: "text-amber-600",
      bg: "bg-amber-50",
      barColor: "bg-amber-500",
    },
    {
      id: 4,
      title: "التوثيق والاستجابة",
      description: "رفع الصور وسرعة التفاعل",
      bestName: bestDoc.name,
      bestScore: (bestDoc.docAndResponse as any).score,
      max: 10,
      icon: Zap,
      color: "text-purple-600",
      bg: "bg-purple-50",
      barColor: "bg-purple-500",
    },
    {
      id: 5,
      title: "تقييم المشرف",
      description: "الملاحظات اليومية",
      bestName: bestSupervisor.name,
      bestScore: (bestSupervisor.supervisorEval as any).score,
      max: 10,
      icon: UserCheck,
      color: "text-teal-600",
      bg: "bg-teal-50",
      barColor: "bg-teal-500",
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800">معايير ترشيح موظف الأسبوع</h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">أفضل الموظفين في كل معيار (من إجمالي 100 نقطة)</p>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col gap-4">
        {criteria.map((c) => {
          const percentage = (c.bestScore / c.max) * 100;
          return (
            <div key={c.id} className="relative bg-slate-50 rounded-xl p-4 border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group">
              <div className="absolute top-0 bottom-0 left-0 right-0 opacity-0 group-hover:opacity-5 bg-gradient-to-l from-transparent to-slate-900 transition-opacity pointer-events-none"></div>
              <div className="flex justify-between items-center z-10 relative">
                <div className="flex items-center gap-4">
                  <div className={\`w-10 h-10 rounded-full flex items-center justify-center shrink-0 \${c.bg} \${c.color}\`}>
                    <c.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{c.title}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">{c.description}</p>
                  </div>
                </div>
                
                <div className="text-left min-w-[100px]">
                  <p className="text-xs text-slate-500 mb-1">{c.max} / <span className="font-bold text-slate-800">{c.bestScore.toFixed(1)}</span></p>
                  <p className={\`font-bold text-sm truncate \${c.color}\`}>{c.bestName}</p>
                </div>
              </div>
              
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden z-10 relative">
                <div 
                  className={\`h-full rounded-full \${c.barColor} transition-all duration-1000\`} 
                  style={{ width: \`\${percentage}%\` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
`;

fs.writeFileSync(file, newComponent);
