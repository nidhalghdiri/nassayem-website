"use client";

import React from "react";
import type { CriterionKey, LeaderboardEmployee } from "@/lib/reports/employeeRanking";
import { Target, Clock, Star, Zap, UserCheck, Camera, ListChecks } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  employees: LeaderboardEmployee[];
  locale?: string;
}

/** Colour + icon per criterion; the labels and weights come from the engine. */
const CRITERION_STYLE: Record<CriterionKey, { icon: LucideIcon; color: string; bg: string; bar: string; hintEn: string; hintAr: string }> = {
  workHours: {
    icon: Clock, color: "text-blue-600", bg: "bg-blue-50", bar: "bg-blue-500",
    hintEn: "Expected hours vs the department's highest", hintAr: "ساعاتك ÷ أعلى ساعات في القسم",
  },
  onTime: {
    icon: Target, color: "text-emerald-600", bg: "bg-emerald-50", bar: "bg-emerald-500",
    hintEn: "Finished before the due date", hintAr: "المهام التي خلصت قبل تاريخ الاستحقاق",
  },
  speed: {
    icon: Zap, color: "text-amber-600", bg: "bg-amber-50", bar: "bg-amber-500",
    hintEn: "Finished within the expected duration", hintAr: "خلصت في وقت أقل من المدة المتوقعة أو يساويها",
  },
  supervisorNotes: {
    icon: UserCheck, color: "text-teal-600", bg: "bg-teal-50", bar: "bg-teal-500",
    hintEn: "Starts at 10; +1 positive, −2 negative", hintAr: "يبدأ من 10؛ الإيجابية +1 والسلبية −2",
  },
  taskCount: {
    icon: ListChecks, color: "text-purple-600", bg: "bg-purple-50", bar: "bg-purple-500",
    hintEn: "Your tasks vs the department's highest", hintAr: "عدد مهامك ÷ أعلى عدد في القسم",
  },
  photos: {
    icon: Camera, color: "text-rose-600", bg: "bg-rose-50", bar: "bg-rose-500",
    hintEn: "Tasks with a photo at completion", hintAr: "المهام التي فيها صورة عند الإنجاز",
  },
};

export default function NominationCriteriaReport({ employees, locale = "ar" }: Props) {
  const isEn = locale === "en";
  if (!employees || employees.length === 0) return null;

  // Best performer in each criterion, read straight off the engine's output so
  // the labels, weights and order can never drift from the scoring.
  const criteria = employees[0].criteria.map((template) => {
    let best = employees[0];
    let bestScore = -1;
    for (const emp of employees) {
      const c = emp.criteria.find((x) => x.key === template.key);
      if (c && c.score > bestScore) {
        bestScore = c.score;
        best = emp;
      }
    }
    const style = CRITERION_STYLE[template.key];
    return {
      key: template.key,
      title: isEn ? template.labelEn : template.labelAr,
      description: isEn ? style.hintEn : style.hintAr,
      bestName: best.name,
      bestScore: Math.max(0, bestScore),
      max: template.max,
      ...style,
    };
  });

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{isEn ? "Employee of the Week Nomination Criteria" : "معايير ترشيح موظف الأسبوع"}</h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">{isEn ? "Best employees in each criterion (out of 100 points)" : "أفضل الموظفين في كل معيار (من إجمالي 100 نقطة)"}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        {criteria.map((c) => {
          const percentage = c.max > 0 ? (c.bestScore / c.max) * 100 : 0;
          const Icon = c.icon;
          return (
            <div key={c.key} className="relative bg-slate-50 rounded-xl p-4 border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group">
              <div className="absolute top-0 bottom-0 left-0 right-0 opacity-0 group-hover:opacity-5 bg-gradient-to-l from-transparent to-slate-900 transition-opacity pointer-events-none"></div>
              <div className="flex justify-between items-center z-10 relative">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${c.bg} ${c.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{c.title}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">{c.description}</p>
                  </div>
                </div>

                <div className="text-left min-w-[100px]">
                  <p className="text-xs text-slate-500 mb-1">{c.max} / <span className="font-bold text-slate-800">{c.bestScore.toFixed(1)}</span></p>
                  <p className={`font-bold text-sm truncate ${c.color}`}>{c.bestName}</p>
                </div>
              </div>

              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden z-10 relative">
                <div
                  className={`h-full rounded-full ${c.bar} transition-all duration-1000`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
