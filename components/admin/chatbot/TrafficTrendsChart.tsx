"use client";

import { useState } from "react";
import { BarChart3, TrendingUp, Calendar, Flame, DollarSign } from "lucide-react";
import type { CurrencyKey } from "./DashboardHeader";

export type DailyDataPoint = {
  date: string;
  conversations: number;
  messages: number;
  leads: number;
  estCostUsd: number;
  estCostOmr: number;
  isPeak?: boolean;
};

type Props = {
  isEn: boolean;
  currency: CurrencyKey;
  dailyData: DailyDataPoint[];
};

export default function TrafficTrendsChart({
  isEn,
  currency,
  dailyData,
}: Props) {
  const isOmr = currency === "OMR";
  const [activeMetric, setActiveMetric] = useState<"conversations" | "messages" | "cost">("conversations");
  const [hoveredPoint, setHoveredPoint] = useState<DailyDataPoint | null>(null);

  if (!dailyData || dailyData.length === 0) {
    return (
      <div className="bg-white border border-gray-200/90 rounded-3xl p-6 shadow-sm">
        <p className="text-sm text-gray-500 text-center py-10">
          {isEn ? "No traffic data available for this period." : "لا توجد بيانات محادثات متوفرة لهذه الفترة."}
        </p>
      </div>
    );
  }

  const maxConv = Math.max(1, ...dailyData.map((d) => d.conversations));
  const maxMsgs = Math.max(1, ...dailyData.map((d) => d.messages));
  const maxCost = Math.max(
    0.1,
    ...dailyData.map((d) => (isOmr ? d.estCostOmr : d.estCostUsd)),
  );

  const totalConv = dailyData.reduce((s, d) => s + d.conversations, 0);
  const totalMsgs = dailyData.reduce((s, d) => s + d.messages, 0);
  const totalCost = dailyData.reduce(
    (s, d) => s + (isOmr ? d.estCostOmr : d.estCostUsd),
    0,
  );

  const formatMoney = (usd: number, omr: number, precision: number = 2) => {
    if (isOmr) {
      return `${omr.toFixed(precision)} ${isEn ? "OMR" : "ر.ع"}`;
    }
    return `$${usd.toFixed(precision)}`;
  };

  const getBarHeight = (d: DailyDataPoint) => {
    if (activeMetric === "conversations") {
      return Math.max(6, (d.conversations / maxConv) * 100);
    }
    if (activeMetric === "messages") {
      return Math.max(6, (d.messages / maxMsgs) * 100);
    }
    const val = isOmr ? d.estCostOmr : d.estCostUsd;
    return Math.max(6, (val / maxCost) * 100);
  };

  const getBarColor = (d: DailyDataPoint) => {
    if (d.conversations >= 400 || d.isPeak) {
      return "bg-gradient-to-t from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 shadow-xs";
    }
    if (activeMetric === "cost") {
      return "bg-gradient-to-t from-emerald-600 to-emerald-400 hover:from-emerald-700 hover:to-emerald-500";
    }
    return "bg-gradient-to-t from-[#1B365D] to-blue-500 hover:from-[#142847] hover:to-blue-600";
  };

  return (
    <div className="bg-white border border-gray-200/90 rounded-3xl p-5 lg:p-6 shadow-sm space-y-5">
      {/* Header & Metric Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-gray-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1B365D] flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-gray-900">
              {isEn ? "Daily Traffic & Cost Trend" : "حركة المحادثات والتكلفة اليومية"}
            </h2>
          </div>
          <p className="text-xs text-gray-500">
            {isEn
              ? `Daily activity across ${dailyData.length} days (${totalConv.toLocaleString()} chats · ${totalMsgs.toLocaleString()} messages)`
              : `النشاط اليومي خلال ${dailyData.length} يوماً (${totalConv.toLocaleString()} محادثة · ${totalMsgs.toLocaleString()} رسالة)`}
          </p>
        </div>

        {/* Metric Mode Switcher */}
        <div className="inline-flex p-1 rounded-xl bg-gray-100/90 border border-gray-200 self-start sm:self-auto">
          <button
            onClick={() => setActiveMetric("conversations")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeMetric === "conversations"
                ? "bg-white text-[#1B365D] shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {isEn ? "Conversations" : "المحادثات"}
          </button>
          <button
            onClick={() => setActiveMetric("messages")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeMetric === "messages"
                ? "bg-white text-[#1B365D] shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {isEn ? "Messages" : "الرسائل"}
          </button>
          <button
            onClick={() => setActiveMetric("cost")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeMetric === "cost"
                ? "bg-white text-[#1B365D] shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {isEn ? "Daily Spend" : "التكلفة اليومية"}
          </button>
        </div>
      </div>

      {/* Interactive Tooltip Card */}
      <div className="min-h-[48px] bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
        {hoveredPoint ? (
          <>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 font-mono flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                {hoveredPoint.date}
              </span>
              {hoveredPoint.conversations >= 400 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-bold text-[10px]">
                  <Flame className="w-3 h-3 text-rose-500" />
                  {isEn ? "Peak Surge" : "ذروة الموسم"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 flex-wrap font-medium text-gray-700">
              <span>
                {isEn ? "Chats:" : "المحادثات:"}{" "}
                <strong className="text-gray-900 font-bold">{hoveredPoint.conversations}</strong>
              </span>
              <span>
                {isEn ? "Messages:" : "الرسائل:"}{" "}
                <strong className="text-gray-900 font-bold">{hoveredPoint.messages.toLocaleString()}</strong>
              </span>
              <span>
                {isEn ? "Leads:" : "العملاء المهتمين:"}{" "}
                <strong className="text-amber-800 font-bold">{hoveredPoint.leads}</strong>
              </span>
              <span>
                {isEn ? "Est. Spend:" : "التكلفة التقريبية:"}{" "}
                <strong className="text-emerald-700 font-bold">
                  {formatMoney(hoveredPoint.estCostUsd, hoveredPoint.estCostOmr)}
                </strong>
              </span>
            </div>
          </>
        ) : (
          <div className="text-gray-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>
              {isEn
                ? "Hover over any day bar below to inspect granular metrics and daily cost."
                : "مرر المؤشر فوق أي عمود يومي لعرض تفاصيل المحادثات والرسائل والتكلفة."}
            </span>
          </div>
        )}
      </div>

      {/* Chart Canvas (CSS / SVG Bar Grid) */}
      <div className="relative pt-2">
        <div className="flex items-end gap-1.5 sm:gap-2 h-52 sm:h-60 w-full">
          {dailyData.map((d, idx) => {
            const heightPct = getBarHeight(d);
            const isHovered = hoveredPoint?.date === d.date;
            const isPeak = d.conversations >= 400 || d.isPeak;

            return (
              <div
                key={d.date}
                onMouseEnter={() => setHoveredPoint(d)}
                onMouseLeave={() => setHoveredPoint(null)}
                className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer min-w-0"
              >
                {/* Value on top of bar on hover or peak */}
                <div
                  className={`text-[10px] font-bold transition-all mb-1 truncate px-0.5 ${
                    isPeak
                      ? "text-rose-600"
                      : isHovered
                        ? "text-[#1B365D] scale-110"
                        : "text-gray-400 group-hover:text-gray-700"
                  }`}
                >
                  {activeMetric === "conversations"
                    ? d.conversations > 0
                      ? d.conversations
                      : ""
                    : activeMetric === "messages"
                      ? d.messages > 0
                        ? d.messages
                        : ""
                      : (isOmr ? d.estCostOmr : d.estCostUsd) > 0.05
                        ? `${(isOmr ? d.estCostOmr : d.estCostUsd).toFixed(1)}`
                        : ""}
                </div>

                {/* The Bar */}
                <div
                  className={`w-full rounded-t-lg transition-all duration-300 ${getBarColor(d)} ${
                    isHovered ? "ring-2 ring-blue-400 brightness-110" : ""
                  }`}
                  style={{ height: `${heightPct}%` }}
                />

                {/* Day Label at bottom */}
                <div className="text-[9px] sm:text-[10px] text-gray-400 group-hover:text-gray-800 transition-colors mt-1.5 truncate max-w-full font-mono">
                  {d.date.slice(8)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend & Peak Indicators */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-gray-500 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-[#1B365D]" />
            <span>{isEn ? "Standard Traffic Days" : "أيام الحركة الاعتيادية"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-gradient-to-r from-amber-500 to-rose-500" />
            <span>{isEn ? "Peak Season Surge (400+ chats)" : "ذروة الموسم (400+ محادثة)"}</span>
          </div>
        </div>

        <div className="text-gray-400 font-medium">
          {isEn ? "Period Total:" : "إجمالي الفترة:"}{" "}
          <strong className="text-gray-900 font-bold">{totalConv.toLocaleString()} chats</strong>
          {" · "}
          <strong className="text-emerald-700 font-bold">{formatMoney(totalCost / (isOmr ? 0.385 : 1), isOmr ? totalCost : totalCost * 0.385)}</strong>
        </div>
      </div>
    </div>
  );
}
