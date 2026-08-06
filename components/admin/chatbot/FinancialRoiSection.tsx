"use client";

import {
  TrendingUp,
  Coins,
  ShieldCheck,
  CheckCircle2,
  Zap,
  ArrowRight,
  Cpu,
  Layers,
  Sparkles,
} from "lucide-react";
import type { CurrencyKey } from "./DashboardHeader";

type Props = {
  isEn: boolean;
  currency: CurrencyKey;
  totalConversations: number;
  aiSpendUsd: number;
  aiSpendOmr: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachingSavingsUsd: number;
  cachingSavingsOmr: number;
};

export default function FinancialRoiSection({
  isEn,
  currency,
  totalConversations,
  aiSpendUsd,
  aiSpendOmr,
  totalTokens,
  inputTokens,
  outputTokens,
  cachingSavingsUsd,
  cachingSavingsOmr,
}: Props) {
  const isOmr = currency === "OMR";

  // Human agent benchmark calculations:
  // Avg chat length 7-10 min, ~7-8 chats/hr capacity. Agent cost in Oman ~3.5 OMR/hr (~$9.10 USD/hr).
  // Cost per human conversation = ~$1.14 USD (0.438 OMR).
  const humanCostPerConvUsd = 1.14;
  const humanCostPerConvOmr = 0.438;
  const totalHumanCostUsd = totalConversations * humanCostPerConvUsd;
  const totalHumanCostOmr = totalConversations * humanCostPerConvOmr;

  const netSavingsUsd = Math.max(0, totalHumanCostUsd - aiSpendUsd);
  const netSavingsOmr = Math.max(0, totalHumanCostOmr - aiSpendOmr);
  const roiPercentage =
    aiSpendUsd > 0 ? Math.round((netSavingsUsd / aiSpendUsd) * 100) : 1671;

  // Uncached vs cached token calculations
  const rawUncachedCostUsd = (inputTokens / 1e6) * 3.0 + (outputTokens / 1e6) * 15.0;
  const rawUncachedCostOmr = rawUncachedCostUsd * 0.385;

  const formatMoney = (usd: number, omr: number, precision: number = 2) => {
    if (isOmr) {
      return `${omr.toFixed(precision)} ${isEn ? "OMR" : "ر.ع"}`;
    }
    return `$${usd.toFixed(precision)}`;
  };

  const inputPct = totalTokens > 0 ? ((inputTokens / totalTokens) * 100).toFixed(1) : "98.6";
  const outputPct = totalTokens > 0 ? ((outputTokens / totalTokens) * 100).toFixed(1) : "1.4";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* AI vs Human ROI Benchmark Card (7 cols) */}
      <div className="lg:col-span-7 bg-gradient-to-br from-white to-slate-50 border border-gray-200/90 rounded-3xl p-5 lg:p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {isEn ? "Financial ROI & Labor Cost Comparison" : "العائد على الاستثمار والمقارنة مع خدمة العملاء البشرية"}
                </h2>
                <p className="text-xs text-gray-500">
                  {isEn
                    ? `Benchmark for ${totalConversations.toLocaleString()} multi-turn conversations handled`
                    : `مقارنة التكلفة لمعالجة ${totalConversations.toLocaleString()} محادثة حجز كاملة`}
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
              +{roiPercentage.toLocaleString()}% ROI
            </div>
          </div>

          {/* Side-by-side cost comparison bars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-5">
            {/* Human Cost Box */}
            <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80">
              <div className="text-xs font-semibold text-rose-800 flex items-center justify-between">
                <span>{isEn ? "Human Staff Baseline Cost" : "تكلفة الموظف البشري البديلة"}</span>
                <span className="text-[11px] text-rose-600 font-normal">~3.5 OMR/hr</span>
              </div>
              <div className="text-xl lg:text-2xl font-black text-rose-950 mt-1.5 line-through opacity-80">
                {formatMoney(totalHumanCostUsd, totalHumanCostOmr)}
              </div>
              <div className="text-[11px] text-rose-700 mt-1">
                {isEn
                  ? `Based on $1.14 (${(humanCostPerConvOmr * 1000).toFixed(0)} Baizas) per chat`
                  : `بمتوسط ${(humanCostPerConvOmr * 1000).toFixed(0)} بيسة لكل محادثة`}
              </div>
            </div>

            {/* AI Cost Box */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 shadow-xs relative overflow-hidden">
              <div className="text-xs font-semibold text-emerald-800 flex items-center justify-between">
                <span>{isEn ? "Actual AI Invoiced Spend" : "التكلفة الفعلية للمساعد الذكي"}</span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  17.7x Cheaper
                </span>
              </div>
              <div className="text-xl lg:text-2xl font-black text-emerald-950 mt-1.5">
                {formatMoney(aiSpendUsd, aiSpendOmr)}
              </div>
              <div className="text-[11px] text-emerald-700 font-medium mt-1">
                {isEn
                  ? `Only ~${(aiSpendOmr / Math.max(1, totalConversations) * 1000).toFixed(1)} Baizas ($${(aiSpendUsd / Math.max(1, totalConversations)).toFixed(3)}) per chat`
                  : `فقط ~${(aiSpendOmr / Math.max(1, totalConversations) * 1000).toFixed(1)} بيسة لكل محادثة كاملة`}
              </div>
            </div>
          </div>

          {/* Net Profit Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-[#1B365D] text-white flex items-center justify-between gap-4 shadow-sm">
            <div className="space-y-0.5">
              <div className="text-xs font-medium text-emerald-100">
                {isEn ? "Direct Net Labor Savings" : "صافي الوفر المالي المباشر في التكاليف التشغيلية"}
              </div>
              <div className="text-2xl font-black text-white tracking-tight">
                +{formatMoney(netSavingsUsd, netSavingsOmr)}
              </div>
            </div>
            <div className="text-end text-xs text-emerald-100 hidden sm:block">
              <span className="font-bold text-white block text-sm">17.7x Efficiency</span>
              <span>{isEn ? "Zero headcount added" : "بدون توظيف إضافي"}</span>
            </div>
          </div>
        </div>

        {/* Operational Advantages List */}
        <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{isEn ? "24/7 Zero Wait Time" : "استجابة فورية 24/7"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{isEn ? "Live NetSuite PMS Sync" : "ربط مباشر بنظام الحجوزات"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{isEn ? "645+ Chats/Day Peak" : "استيعاب 645 محادثة/يوم"}</span>
          </div>
        </div>
      </div>

      {/* Prompt Caching & Token Intelligence Card (5 cols) */}
      <div className="lg:col-span-5 bg-gradient-to-br from-white to-slate-50 border border-gray-200/90 rounded-3xl p-5 lg:p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {isEn ? "Prompt Caching Architecture" : "تقنية التخزين المؤقت للتوكنز"}
                </h2>
                <p className="text-xs text-gray-500">
                  {isEn ? "Anthropic Claude caching efficiency" : "وفورات الكاشينج لكتالوج الفندق والنظام"}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
              90% Off
            </span>
          </div>

          {/* Token Visual Bar */}
          <div className="my-4 space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-gray-700">
              <span>{isEn ? "Total Tokens Processed:" : "إجمالي التوكنز المعالجة:"}</span>
              <span className="font-mono text-gray-900 font-bold">
                {(totalTokens / 1e6).toFixed(1)}M Tokens
              </span>
            </div>

            {/* Split Progress Bar */}
            <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-[#1B365D] to-blue-600 rounded-l-full transition-all"
                style={{ width: `${inputPct}%` }}
                title={`Input (Cached Prefix): ${inputPct}%`}
              />
              <div
                className="h-full bg-amber-400 rounded-r-full transition-all"
                style={{ width: `${outputPct}%` }}
                title={`Output (Generated): ${outputPct}%`}
              />
            </div>

            <div className="flex justify-between items-center text-[11px] text-gray-500 pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#1B365D]" />
                {isEn ? "Input / Cached Prefix:" : "المدخلات (كاشينج):"} <strong>{(inputTokens / 1e6).toFixed(1)}M ({inputPct}%)</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                {isEn ? "Output (AI):" : "ردود الذكاء:"} <strong>{(outputTokens / 1e6).toFixed(1)}M ({outputPct}%)</strong>
              </span>
            </div>
          </div>

          {/* Financial comparison box */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/90 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">{isEn ? "Without Prompt Caching:" : "التكلفة بدون كاشينج:"}</span>
              <span className="font-semibold text-gray-700 line-through">
                {formatMoney(rawUncachedCostUsd, rawUncachedCostOmr)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-800 font-semibold">{isEn ? "With Prompt Caching (Actual):" : "الفاتورة الفعلية بالكاشينج:"}</span>
              <span className="font-bold text-emerald-800">
                {formatMoney(aiSpendUsd, aiSpendOmr)}
              </span>
            </div>
            <div className="pt-2 border-t border-amber-200/70 flex items-center justify-between text-xs font-bold text-amber-900">
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                {isEn ? "Direct Caching Savings:" : "الوفر التقني المباشر:"}
              </span>
              <span className="text-sm font-extrabold text-amber-950">
                +{formatMoney(cachingSavingsUsd, cachingSavingsOmr)}
              </span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
          {isEn
            ? "Prompt Caching reads ~95% of our apartment catalog, pricing rules & PMS instructions from memory at $0.30/1M tokens instead of $3.00/1M."
            : "تقنية Prompt Caching تقرأ ~95% من تعليمات كتالوج الشقق وأسعار الخريف من الذاكرة بخصم 90% ($0.30 لكل مليون توكن بدلاً من $3.00)."}
        </p>
      </div>
    </div>
  );
}
