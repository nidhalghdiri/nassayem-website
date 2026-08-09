"use client";

import {
  MessageSquare,
  Send,
  Coins,
  ShieldAlert,
  CalendarCheck2,
  CreditCard,
  Sparkles,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
  ArrowDownRight,
  Bot,
  UserCheck,
} from "lucide-react";
import { DailyReportPayload } from "@/lib/chatbot/dailyReportData";

type Props = {
  data: DailyReportPayload;
  locale: string;
  currency: "OMR" | "USD";
};

export default function DailySummaryCards({ data, locale, currency }: Props) {
  const isEn = locale === "en";
  const isOmr = currency === "OMR";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {/* 1. Conversations & Automation Rate */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {isEn ? "Total Conversations" : "إجمالي المحادثات"}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900 tracking-tight">
                {data.totalConversations.toLocaleString()}
              </span>
              <span className="text-xs text-gray-500">
                {isEn ? "chats" : "محادثة"}
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 flex items-center gap-1">
              <Bot className="w-3.5 h-3.5 text-emerald-600" />
              {isEn ? "Automation Rate:" : "نسبة الأتمتة:"}
            </span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              {data.automationRatePct}%
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{isEn ? "Channels:" : "القنوات:"}</span>
            <span className="font-medium text-gray-700">
              🟢 {data.channelWhatsapp} WA · 🌐 {data.channelWeb} Web
            </span>
          </div>
        </div>
      </div>

      {/* 2. Messages Volume & Breakdown (Receive / Sent) */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {isEn ? "Messages Processed" : "إجمالي الرسائل المتبادلة"}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900 tracking-tight">
                {data.totalMessages.toLocaleString()}
              </span>
              <span className="text-xs text-gray-500">
                {isEn ? "msgs" : "رسالة"}
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-gray-600">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {isEn ? "Received (Customer):" : "واردة (من العميل):"}
            </span>
            <span className="font-bold text-gray-900">{data.receivedMessages}</span>
          </div>
          <div className="flex items-center justify-between text-gray-600">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {isEn ? "Sent (AI + Staff):" : "صادرة (المساعد والموظف):"}
            </span>
            <span className="font-bold text-gray-900">{data.sentMessages}</span>
          </div>
          <div className="flex items-center justify-between text-gray-500 text-[11px]">
            <span>{isEn ? "PMS Tool Ops:" : "عمليات النظام (PMS):"}</span>
            <span className="font-medium text-amber-700">{data.toolOperations}</span>
          </div>
        </div>
      </div>

      {/* 3. Cost Consumed & Average Cost */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {isEn ? "Daily Chatbot Cost" : "تكلفة المحادثات اليومية"}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-nassayem tracking-tight">
                {isOmr ? `${data.spendOmr.toFixed(3)}` : `$${data.spendUsd.toFixed(2)}`}
              </span>
              <span className="text-xs font-semibold text-gray-500">
                {isOmr ? "OMR" : "USD"}
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-gray-700">
            <span className="font-medium">
              {isEn ? "Avg / Conversation:" : "متوسط تكلفة المحادثة:"}
            </span>
            <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
              {isOmr
                ? `${data.costPerConvBaizas} بيسة`
                : `$${data.costPerConvUsd.toFixed(3)}`}
            </span>
          </div>
          <div className="flex items-center justify-between text-gray-500 text-[11px]">
            <span>{isEn ? "Avg / Message:" : "متوسط تكلفة الرسالة:"}</span>
            <span>
              {isOmr ? `${data.costPerMsgBaizas} بيسة` : `$${data.costPerMsgUsd.toFixed(4)}`}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-emerald-600">
            <span>{isEn ? "Prompt Caching Savings:" : "توفير التخزين المؤقت:"}</span>
            <span className="font-semibold">
              +{isOmr ? `${data.cachingSavingsOmr.toFixed(3)} OMR` : `$${data.cachingSavingsUsd.toFixed(2)}`}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Reservations & Leads Created */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {isEn ? "Reservations & Leads" : "الحجوزات والعملاء المحتملون"}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900 tracking-tight">
                {data.totalReservationsCreated}
              </span>
              <span className="text-xs text-gray-500">
                {isEn ? "reservations" : "حجز وطلب"}
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <CalendarCheck2 className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-gray-700">
            <span>{isEn ? "Total Leads Captured:" : "العملاء المهتمون بالحجز:"}</span>
            <span className="font-bold text-gray-900">{data.totalLeads}</span>
          </div>
          <div className="flex items-center justify-between text-gray-600">
            <span>{isEn ? "Est. Booking Value:" : "قيمة الحجوزات التقديرية:"}</span>
            <span className="font-bold text-nassayem">
              {data.totalReservationsValueOmr.toLocaleString()} OMR
            </span>
          </div>
          <div className="flex items-center justify-between text-gray-500 text-[11px]">
            <span>{isEn ? "Cost / Lead:" : "تكلفة الاستحواذ للطلب:"}</span>
            <span>
              {isOmr ? `${data.costPerLeadOmr.toFixed(3)} OMR` : `$${data.costPerLeadUsd.toFixed(2)}`}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Payment Links Created */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {isEn ? "Payment Links" : "روابط الدفع المنشأة"}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900 tracking-tight">
                {data.paymentLinksSummary.totalCount}
              </span>
              <span className="text-xs text-gray-500">
                {isEn ? "links" : "رابط دفع"}
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-emerald-700 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isEn ? "Paid Links:" : "تم الدفع (Paid):"}
            </span>
            <span className="font-bold text-emerald-800">
              {data.paymentLinksSummary.paidCount} ({data.paymentLinksSummary.paidAmountOmr.toFixed(3)} OMR)
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-amber-700 flex items-center gap-1 font-medium">
              <Clock className="w-3.5 h-3.5" />
              {isEn ? "Pending Links:" : "قيد الدفع (Pending):"}
            </span>
            <span className="font-bold text-amber-800">
              {data.paymentLinksSummary.pendingCount} ({data.paymentLinksSummary.pendingAmountOmr.toFixed(3)} OMR)
            </span>
          </div>
        </div>
      </div>

      {/* 6. Escalations Sent & WhatsApp Delivery */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {isEn ? "Escalation Messages" : "رسائل التصعيد والإشعارات"}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-600 tracking-tight">
                {data.escalatedConversations}
              </span>
              <span className="text-xs font-medium text-gray-500">
                ({data.escalationRatePct}%)
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-gray-700">
            <span>{isEn ? "WhatsApp Notifications:" : "إشعارات واتساب المرسلة:"}</span>
            <span className="font-bold text-gray-900">{data.escalationDeliverySummary.total}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-emerald-700 font-medium">
              ✓✓ {isEn ? "Delivered/Read:" : "وصلت/قُرئت:"}
            </span>
            <span className="font-bold text-emerald-800">
              {data.escalationDeliverySummary.delivered + data.escalationDeliverySummary.read}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-amber-700">
            <span>{isEn ? "Pending Follow-up:" : "بانتظار تواصل الموظف:"}</span>
            <span className="font-bold">{data.followUpSummary.pending}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-blue-700">
            <span>{isEn ? "Asked Customer:" : "تم سؤال العميل:"}</span>
            <span className="font-bold">{data.followUpSummary.asked}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-red-700">
            <span>{isEn ? "✕ Not Contacted:" : "✕ لم يتم التواصل:"}</span>
            <span className="font-bold">{data.followUpSummary.notContacted}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-emerald-700">
            <span>{isEn ? "✓ Contacted:" : "✓ تم التواصل:"}</span>
            <span className="font-bold">{data.followUpSummary.contacted}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
