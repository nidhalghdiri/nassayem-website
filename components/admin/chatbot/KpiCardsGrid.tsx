"use client";

import {
  DollarSign,
  MessageSquare,
  Zap,
  Target,
  ArrowDownRight,
  Sparkles,
  Bot,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import type { CurrencyKey } from "./DashboardHeader";

export type KpiData = {
  spendUsd: number;
  spendOmr: number;
  cachingSavingsUsd: number;
  cachingSavingsOmr: number;
  totalConversations: number;
  activeConversations: number;
  escalatedConversations: number;
  automatedConversations: number;
  automationRate: number;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  toolOperations: number;
  avgMessagesPerConv: number;
  avgCustomerTurns: number;
  totalLeads: number;
  costPerConvUsd: number;
  costPerConvOmr: number;
  costPerMsgUsd: number;
  costPerMsgOmr: number;
  costPerLeadUsd: number;
  costPerLeadOmr: number;
  pendingEscalations: number;
};

type Props = {
  isEn: boolean;
  currency: CurrencyKey;
  kpis: KpiData;
};

export default function KpiCardsGrid({ isEn, currency, kpis }: Props) {
  const isOmr = currency === "OMR";

  const formatMoney = (usd: number, omr: number, precision: number = 2) => {
    if (isOmr) {
      return `${omr.toFixed(precision)} ${isEn ? "OMR" : "ر.ع"}`;
    }
    return `$${usd.toFixed(precision)}`;
  };

  const primaryCards = [
    {
      title: isEn ? "Total Spend (Anthropic Platform)" : "المبلغ الإجمالي المصروف (المنصة)",
      value: formatMoney(kpis.spendUsd, kpis.spendOmr, isOmr ? 3 : 2),
      subtext: isEn
        ? `Saved ${formatMoney(kpis.cachingSavingsUsd, kpis.cachingSavingsOmr)} via Prompt Caching`
        : `توفير ${formatMoney(kpis.cachingSavingsUsd, kpis.cachingSavingsOmr)} عبر التخزين المؤقت`,
      badge: isEn ? "⚡ 90% Caching Discount" : "⚡ خصم 90% كاشينج",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: DollarSign,
      iconBg: "bg-emerald-100 text-emerald-700",
      accentBorder: "hover:border-emerald-300",
    },
    {
      title: isEn ? "Total Conversations Handled" : "إجمالي المحادثات المنجزة",
      value: kpis.totalConversations.toLocaleString(),
      subtext: isEn
        ? `${kpis.automatedConversations.toLocaleString()} automated (${kpis.automationRate}%) · ${kpis.escalatedConversations} escalated`
        : `${kpis.automatedConversations.toLocaleString()} آلي (${kpis.automationRate}%) · ${kpis.escalatedConversations} مصعّد`,
      badge: isEn ? "🤖 24/7 Zero Wait Time" : "🤖 رد فوري 24/7",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      icon: MessageSquare,
      iconBg: "bg-blue-100 text-blue-700",
      accentBorder: "hover:border-blue-300",
    },
    {
      title: isEn ? "Total Messages & PMS Operations" : "إجمالي الرسائل والعمليات",
      value: kpis.totalMessages.toLocaleString(),
      subtext: isEn
        ? `Avg ${kpis.avgMessagesPerConv} msgs/chat · ${kpis.avgCustomerTurns} customer turns`
        : `متوسط ${kpis.avgMessagesPerConv} رسالة/محادثة · ${kpis.avgCustomerTurns} ردود للعميل`,
      badge: isEn
        ? `${kpis.toolOperations.toLocaleString()} PMS lookups`
        : `${kpis.toolOperations.toLocaleString()} عملية بالنظام`,
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
      icon: Zap,
      iconBg: "bg-purple-100 text-purple-700",
      accentBorder: "hover:border-purple-300",
    },
    {
      title: isEn ? "Qualified Leads Captured" : "العملاء المهتمين بالحجز",
      value: `${kpis.totalLeads.toLocaleString()} ${isEn ? "Leads" : "عميل"}`,
      subtext: isEn
        ? `Cost per lead: ${formatMoney(kpis.costPerLeadUsd, kpis.costPerLeadOmr, 3)}`
        : `تكلفة اكتساب العميل: ${formatMoney(kpis.costPerLeadUsd, kpis.costPerLeadOmr, 3)}`,
      badge: isEn ? "🎯 High Intent Booking" : "🎯 نية حجز عالية",
      badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
      icon: Target,
      iconBg: "bg-amber-100 text-amber-700",
      accentBorder: "hover:border-amber-300",
    },
  ];

  const secondaryCards = [
    {
      label: isEn ? "Avg Cost per Conversation" : "متوسط تكلفة المحادثة الواحدة",
      value: isOmr
        ? `${kpis.costPerConvOmr.toFixed(4)} OMR (~${Math.round(kpis.costPerConvOmr * 1000)} ${isEn ? "Baizas" : "بيسة"})`
        : `$${kpis.costPerConvUsd.toFixed(3)}`,
      detail: isEn ? "Full multi-turn booking consultation" : "محادثة كاملة واستشارة حجز",
      icon: Sparkles,
      color: "text-emerald-600",
    },
    {
      label: isEn ? "Avg Cost per Message" : "متوسط تكلفة الرسالة الواحدة",
      value: isOmr
        ? `${kpis.costPerMsgOmr.toFixed(4)} OMR (~${(kpis.costPerMsgOmr * 1000).toFixed(1)} ${isEn ? "Baizas" : "بيسة"})`
        : `$${kpis.costPerMsgUsd.toFixed(4)}`,
      detail: isEn ? "Per inbound & outbound message" : "لكل رسالة متبادلة",
      icon: TrendingUp,
      color: "text-blue-600",
    },
    {
      label: isEn ? "Automated Resolution Rate" : "نسبة المعالجة الآلية بدون تدخل",
      value: `${kpis.automationRate}%`,
      detail: isEn ? `${kpis.automatedConversations} self-resolved chats` : `${kpis.automatedConversations} محادثة أتممت آلياً`,
      icon: Bot,
      color: "text-indigo-600",
    },
    {
      label: isEn ? "Escalations Pending Follow-up" : "حالات التصعيد بانتظار المتابعة",
      value: `${kpis.pendingEscalations}`,
      detail: isEn ? "Awaiting staff contact" : "بانتظار تواصل موظف الاستقبال",
      icon: AlertCircle,
      color: kpis.pendingEscalations > 0 ? "text-amber-600" : "text-gray-500",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {primaryCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`bg-white border border-gray-200/90 rounded-2xl p-5 shadow-sm transition-all duration-200 hover:shadow-md ${card.accentBorder} flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-500 tracking-wide">
                    {card.title}
                  </span>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <div className="text-2xl lg:text-3xl font-extrabold text-gray-900 mt-3 tracking-tight">
                  {card.value}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col gap-2">
                <div className="text-xs text-gray-500 font-medium">
                  {card.subtext}
                </div>
                <div className="self-start">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${card.badgeColor}`}>
                    {card.badge}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Secondary Efficiency Micro-cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {secondaryCards.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 flex items-center gap-3 transition-colors hover:bg-slate-100/80"
            >
              <div className={`p-2 rounded-lg bg-white shadow-xs border border-slate-200/60 ${item.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-gray-500 truncate">
                  {item.label}
                </div>
                <div className="text-sm lg:text-base font-bold text-gray-900 truncate">
                  {item.value}
                </div>
                <div className="text-[10px] text-gray-400 truncate">
                  {item.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
