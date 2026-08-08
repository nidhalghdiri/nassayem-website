"use client";

import { useState } from "react";
import {
  Mail,
  Copy,
  Check,
  Printer,
  Sparkles,
  Bot,
  Send,
  Coins,
  ShieldAlert,
  CalendarCheck,
  CreditCard,
  Building2,
} from "lucide-react";
import { DailyReportPayload } from "@/lib/chatbot/dailyReportData";

type Props = {
  data: DailyReportPayload;
  locale: string;
  currency: "OMR" | "USD";
};

export default function EmailReportPreview({ data, locale, currency }: Props) {
  const isEn = locale === "en";
  const isOmr = currency === "OMR";
  const [copiedType, setCopiedType] = useState<"HTML" | "TEXT" | null>(null);

  const generatePlainTextSummary = () => {
    return `📊 *${isEn ? "Nassayem Chatbot Daily Executive Report" : "التقرير التنفيذي اليومي لمساعد نسائم الذكي"}*
📅 ${isEn ? data.formattedDateEn : data.formattedDateAr}

🔹 *1. ${isEn ? "Conversations & Messages" : "المحادثات والرسائل"}:*
• ${isEn ? "Total Conversations:" : "إجمالي المحادثات:"} ${data.totalConversations} (${data.automationRatePct}% ${isEn ? "Automated" : "مؤتمتة بالكامل"})
• ${isEn ? "Total Messages:" : "إجمالي الرسائل:"} ${data.totalMessages}
  - ${isEn ? "Received (Customer):" : "واردة (من العميل):"} ${data.receivedMessages}
  - ${isEn ? "Sent (AI + Staff):" : "صادرة (المساعد والموظف):"} ${data.sentMessages}
• ${isEn ? "Channels:" : "القنوات:"} 🟢 ${data.channelWhatsapp} WhatsApp · 🌐 ${data.channelWeb} Web

🔹 *2. ${isEn ? "Cost & Financials" : "التكلفة والعائد المالي"}:*
• ${isEn ? "Total Chatbot Spend:" : "التكلفة الإجمالية اليوم:"} ${data.spendOmr.toFixed(3)} OMR ($${data.spendUsd.toFixed(2)} USD)
• ${isEn ? "Average Cost / Conversation:" : "متوسط تكلفة المحادثة:"} ${data.costPerConvBaizas} Baizas ($${data.costPerConvUsd.toFixed(3)})
• ${isEn ? "Average Cost / Message:" : "متوسط تكلفة الرسالة:"} ${data.costPerMsgBaizas} Baizas
• ${isEn ? "Prompt Caching Savings:" : "توفير التخزين المؤقت:"} +${data.cachingSavingsOmr.toFixed(3)} OMR
• ${isEn ? "Est. Human Labor Saved:" : "صافي التوفير البشري التقديري:"} +${data.estimatedLaborSavingsOmr.toFixed(2)} OMR (ROI +${data.estimatedRoiPct}%)

🔹 *3. ${isEn ? "Escalations & Live WhatsApp Delivery" : "التصعيد وحالة إشعارات واتساب"}:*
• ${isEn ? "Total Escalations:" : "إجمالي المحادثات المصعدة:"} ${data.escalatedConversations} (${data.escalationRatePct}%)
• ${isEn ? "WhatsApp Notifications Sent:" : "إشعارات واتساب المرسلة:"} ${data.escalationDeliverySummary.total}
• ${isEn ? "Delivery Status:" : "حالة التسليم:"} ✓✓ ${data.escalationDeliverySummary.read} Read · ${data.escalationDeliverySummary.delivered} Delivered · ${data.escalationDeliverySummary.sent} Sent
• ${isEn ? "Pending Follow-up:" : "بانتظار تواصل موظف الاستقبال:"} ${data.followUpSummary.pending}

🔹 *4. ${isEn ? "Reservations & Payment Links" : "الحجوزات وروابط الدفع"}:*
• ${isEn ? "Chatbot Reservations / Leads:" : "الحجوزات والطلبات المنشأة:"} ${data.totalReservationsCreated} (${data.totalReservationsValueOmr.toFixed(3)} OMR)
• ${isEn ? "Payment Links Created:" : "روابط الدفع المنشأة:"} ${data.paymentLinksSummary.totalCount}
• ${isEn ? "Paid:" : "تم الدفع:"} ${data.paymentLinksSummary.paidCount} (${data.paymentLinksSummary.paidAmountOmr.toFixed(3)} OMR)
• ${isEn ? "Pending Payment:" : "قيد الدفع:"} ${data.paymentLinksSummary.pendingCount} (${data.paymentLinksSummary.pendingAmountOmr.toFixed(3)} OMR)

🔹 *5. ${isEn ? "Top Demand" : "أعلى فئات الطلب"}:*
• ${isEn ? "Apartment Type:" : "نوع الشقة الأكثر طلباً:"} ${data.demandByApartmentType[0]?.label || "—"} (${data.demandByApartmentType[0]?.percentage || 0}%)
• ${isEn ? "Building / Location:" : "الفرع الأكثر طلباً:"} ${data.demandByBuilding[0]?.label || "—"} (${data.demandByBuilding[0]?.percentage || 0}%)

🔗 *${isEn ? "View Live Admin Dashboard:" : "رابط لوحة التحكم المباشرة:"}*
https://nassayemsalalah.com/ar/admin/chatbot/report?date=${data.dateIso}
`;
  };

  const copyText = () => {
    navigator.clipboard.writeText(generatePlainTextSummary());
    setCopiedType("TEXT");
    setTimeout(() => setCopiedType(null), 2500);
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">
              {isEn ? "Manager Daily Email Template Preview" : "معاينة تقرير البريد الإلكتروني اليومي للإدارة"}
            </h4>
            <p className="text-xs text-gray-500">
              {isEn
                ? "This is the exact email format scheduled to be dispatched daily."
                : "هذا هو التنسيق المعتمد للتقرير اليومي الذي سيتم إرساله آلياً لبريد المدير العام والإدارة."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyText}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all shadow-xs"
          >
            {copiedType === "TEXT" ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span>{isEn ? "Summary Copied!" : "تم نسخ الملخص!"}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{isEn ? "Copy WhatsApp Summary" : "نسخ ملخص واتساب"}</span>
              </>
            )}
          </button>

          <button
            onClick={printReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isEn ? "Print / Save PDF" : "طباعة / حفظ PDF"}</span>
          </button>
        </div>
      </div>

      {/* Styled Email Layout Card */}
      <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-gray-300 shadow-md overflow-hidden print:shadow-none print:border-none">
        {/* Email Header */}
        <div className="bg-[#1B365D] text-white p-6 sm:p-8 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
                NASSAYEM SALALAH · AI EXECUTIVE REPORT
              </span>
              <h2 className="text-2xl font-black tracking-tight text-white">
                {isEn ? "Chatbot Daily Performance Report" : "التقرير اليومي لأداء المساعد الذكي"}
              </h2>
              <p className="text-sm text-blue-100 font-medium">
                {isEn ? data.formattedDateEn : data.formattedDateAr}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 text-center shrink-0">
              <span className="text-[11px] text-blue-200 block uppercase font-bold">
                {isEn ? "Automation Rate" : "نسبة الأتمتة"}
              </span>
              <span className="text-2xl font-black text-emerald-400">
                {data.automationRatePct}%
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Section 1: Executive Key Numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-center">
              <span className="text-xs text-gray-500 font-medium block">
                {isEn ? "Conversations" : "المحادثات"}
              </span>
              <span className="text-2xl font-extrabold text-gray-900 mt-1 block">
                {data.totalConversations}
              </span>
              <span className="text-[11px] text-gray-400">
                🟢 {data.channelWhatsapp} WA · 🌐 {data.channelWeb} Web
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-center">
              <span className="text-xs text-gray-500 font-medium block">
                {isEn ? "Messages (In/Out)" : "الرسائل (وارد/صادر)"}
              </span>
              <span className="text-2xl font-extrabold text-gray-900 mt-1 block">
                {data.totalMessages}
              </span>
              <span className="text-[11px] text-gray-500">
                {data.receivedMessages} In · {data.sentMessages} Out
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-center">
              <span className="text-xs text-gray-500 font-medium block">
                {isEn ? "Daily AI Spend" : "التكلفة اليومية"}
              </span>
              <span className="text-2xl font-extrabold text-nassayem mt-1 block">
                {data.spendOmr.toFixed(3)} <span className="text-xs font-bold">OMR</span>
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold">
                ~{data.costPerConvBaizas} {isEn ? "Baizas/chat" : "بيسة/محادثة"}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-center">
              <span className="text-xs text-gray-500 font-medium block">
                {isEn ? "Labor Saved (ROI)" : "صافي التوفير المالي"}
              </span>
              <span className="text-2xl font-extrabold text-emerald-600 mt-1 block">
                +{data.estimatedLaborSavingsOmr.toFixed(2)} <span className="text-xs font-bold">OMR</span>
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold">
                ROI +{data.estimatedRoiPct}%
              </span>
            </div>
          </div>

          {/* Section 2: Escalations & Delivery */}
          <div className="bg-amber-50/50 rounded-2xl p-5 border border-amber-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                {isEn ? "Escalations & Live WhatsApp Delivery Status" : "التصعيد وحالة إشعارات الواتساب للموظفين"}
              </h4>
              <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                {data.escalatedConversations} {isEn ? "Escalated" : "مصعدة"} ({data.escalationRatePct}%)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-amber-100">
                <span className="text-gray-500 block text-[11px]">
                  {isEn ? "WhatsApp Sent:" : "مرسلة بالواتساب:"}
                </span>
                <span className="font-bold text-gray-900 text-sm">
                  {data.escalationDeliverySummary.total}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-amber-100">
                <span className="text-gray-500 block text-[11px]">
                  {isEn ? "Delivered / Read:" : "مستلمة ومقروءة:"}
                </span>
                <span className="font-bold text-emerald-700 text-sm">
                  ✓✓ {data.escalationDeliverySummary.delivered + data.escalationDeliverySummary.read}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-amber-100">
                <span className="text-gray-500 block text-[11px]">
                  {isEn ? "Reception Contacted:" : "تم التواصل مع العميل:"}
                </span>
                <span className="font-bold text-blue-700 text-sm">
                  {data.followUpSummary.contacted}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-amber-100">
                <span className="text-gray-500 block text-[11px]">
                  {isEn ? "Pending Follow-up:" : "بانتظار المتابعة:"}
                </span>
                <span className="font-bold text-amber-700 text-sm">
                  {data.followUpSummary.pending}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Customer Status by Building */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-600" />
              {isEn ? "Customer Inquiries & Follow-up Status by Building" : "توزيع العملاء ومستوى المتابعة حسب المبنى"}
            </h4>

            <div className="border border-gray-200 rounded-2xl overflow-hidden">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">{isEn ? "Building" : "المبنى"}</th>
                    <th className="py-2.5 px-3 text-center">{isEn ? "Inquiries" : "العملاء"}</th>
                    <th className="py-2.5 px-3 text-center">{isEn ? "Contacted" : "تواصل معه"}</th>
                    <th className="py-2.5 px-3 text-center">{isEn ? "Pending" : "قيد الانتظار"}</th>
                    <th className="py-2.5 px-3 text-center">{isEn ? "Converted" : "تم الحجز"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.buildingBreakdown.slice(0, 5).map((b) => (
                    <tr key={b.buildingId}>
                      <td className="py-2.5 px-3 font-semibold text-gray-900">
                        {isEn ? b.buildingNameEn : b.buildingNameAr}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">{b.totalCustomers}</td>
                      <td className="py-2.5 px-3 text-center text-emerald-700 font-semibold">{b.contacted}</td>
                      <td className="py-2.5 px-3 text-center text-amber-700 font-semibold">{b.pending}</td>
                      <td className="py-2.5 px-3 text-center text-blue-700 font-bold">{b.converted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Reservations & Payment Links Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Reservations */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <CalendarCheck className="w-3.5 h-3.5 text-amber-600" />
                  {isEn ? "Reservations Created" : "الحجوزات والطلبات"}
                </span>
                <span className="text-sm font-extrabold text-gray-900">
                  {data.totalReservationsCreated}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {isEn ? "Total estimated booking value:" : "القيمة التقديرية للحجوزات:"}{" "}
                <span className="font-bold text-nassayem">
                  {data.totalReservationsValueOmr.toFixed(3)} OMR
                </span>
              </p>
            </div>

            {/* Payment Links */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-teal-600" />
                  {isEn ? "Payment Links" : "روابط الدفع الإلكتروني"}
                </span>
                <span className="text-sm font-extrabold text-gray-900">
                  {data.paymentLinksSummary.totalCount}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-700 font-semibold">
                  ✓ {isEn ? "Paid:" : "مدفوعة:"} {data.paymentLinksSummary.paidCount} ({data.paymentLinksSummary.paidAmountOmr.toFixed(3)} OMR)
                </span>
                <span className="text-amber-700 font-semibold">
                  ⏳ {isEn ? "Pending:" : "قيد الدفع:"} {data.paymentLinksSummary.pendingCount}
                </span>
              </div>
            </div>
          </div>

          {/* Section 5: Demands */}
          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-gray-500 block">
                {isEn ? "Top Apartment Type in Demand:" : "نوع الشقة الأكثر طلباً:"}
              </span>
              <span className="font-bold text-blue-900 text-sm">
                {data.demandByApartmentType[0]?.label || "—"} ({data.demandByApartmentType[0]?.percentage || 0}%)
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">
                {isEn ? "Top Property in Demand:" : "الفرع الأكثر طلباً:"}
              </span>
              <span className="font-bold text-blue-900 text-sm">
                {data.demandByBuilding[0]?.label || "—"} ({data.demandByBuilding[0]?.percentage || 0}%)
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-gray-100 text-center text-xs text-gray-400 space-y-1">
            <p>
              {isEn
                ? "Nassayem Salalah AI Chatbot Assistant · Generated automatically for Management."
                : "المساعد الذكي لمجموعة نسائم صلالة · تم توليد هذا التقرير آلياً للإدارة العامة."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
