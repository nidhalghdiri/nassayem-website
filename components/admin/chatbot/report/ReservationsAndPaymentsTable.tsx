"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarCheck2,
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  Building,
  User,
  Phone,
} from "lucide-react";
import {
  ChatbotReservationItem,
  PaymentLinkItem,
} from "@/lib/chatbot/dailyReportData";

type Props = {
  reservations: ChatbotReservationItem[];
  paymentLinks: PaymentLinkItem[];
  locale: string;
};

export default function ReservationsAndPaymentsTable({
  reservations,
  paymentLinks,
  locale,
}: Props) {
  const isEn = locale === "en";
  const [activeTab, setActiveTab] = useState<"RESERVATIONS" | "PAYMENTS">("RESERVATIONS");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const copyToClipboard = (token: string) => {
    const url = `${window.location.origin}/${locale}/pay/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const renderPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            {isEn ? "PAID" : "تم الدفع"}
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            {isEn ? "PENDING" : "قيد الدفع"}
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
            {isEn ? "EXPIRED" : "منتهي"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Tab Navigation Header */}
      <div className="p-5 lg:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            {activeTab === "RESERVATIONS" ? (
              <>
                <CalendarCheck2 className="w-5 h-5 text-amber-600" />
                {isEn ? "Chatbot Reservations & Booking Requests" : "الحجوزات والطلبات المنشأة عبر المساعد الذكي"}
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 text-teal-600" />
                {isEn ? "SmartPay / NetSuite Payment Links" : "روابط الدفع الإلكتروني (SmartPay / NetSuite)"}
              </>
            )}
          </h3>
          <p className="text-xs text-gray-500">
            {activeTab === "RESERVATIONS"
              ? isEn
                ? "Bookings and qualified guest requests processed directly by the AI chatbot."
                : "الحجوزات والطلبات المؤكدة التي استقبلها وأنشأها المساعد الذكي خلال اليوم."
              : isEn
              ? "Payment links generated for reservation confirmation and card collection."
              : "روابط الدفع الآلي التي تم إنشاؤها لتأكيد الحجوزات والدفع بالبطاقة."}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 p-1 rounded-2xl text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("RESERVATIONS")}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === "RESERVATIONS"
                ? "bg-white text-gray-900 shadow-sm font-bold"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <CalendarCheck2 className="w-4 h-4 text-amber-600" />
            <span>{isEn ? `Reservations (${reservations.length})` : `الحجوزات (${reservations.length})`}</span>
          </button>

          <button
            onClick={() => setActiveTab("PAYMENTS")}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === "PAYMENTS"
                ? "bg-white text-gray-900 shadow-sm font-bold"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <CreditCard className="w-4 h-4 text-teal-600" />
            <span>{isEn ? `Payment Links (${paymentLinks.length})` : `روابط الدفع (${paymentLinks.length})`}</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Reservations Table */}
      {activeTab === "RESERVATIONS" && (
        <div className="overflow-x-auto">
          {reservations.length === 0 ? (
            <div className="text-center py-12 text-gray-400 space-y-2">
              <CalendarCheck2 className="w-8 h-8 mx-auto text-gray-300" />
              <p className="text-sm">
                {isEn ? "No reservations or booking requests recorded for this day." : "لا توجد حجوزات مسجلة في هذا اليوم."}
              </p>
            </div>
          ) : (
            <table className="w-full text-left rtl:text-right border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-100 text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">{isEn ? "Guest Info" : "بيانات النزيل"}</th>
                  <th className="py-3 px-4">{isEn ? "Unit & Building" : "الوحدة والمبنى"}</th>
                  <th className="py-3 px-4">{isEn ? "Stay Dates" : "فترة الإقامة"}</th>
                  <th className="py-3 px-4 text-right rtl:text-left">{isEn ? "Total (OMR)" : "الإجمالي (ر.ع)"}</th>
                  <th className="py-3 px-4 text-center">{isEn ? "Status" : "الحالة"}</th>
                  <th className="py-3 px-4 text-center">{isEn ? "Action" : "المحادثة"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {reservations.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Guest */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <span className="font-bold text-gray-900 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          {res.guestName}
                        </span>
                        <span className="text-[11px] text-gray-500 font-mono flex items-center gap-1">
                          <Phone className="w-3 h-3 text-gray-400" />
                          {res.guestPhone}
                        </span>
                      </div>
                    </td>

                    {/* Unit & Building */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-gray-800">{res.unitTitle}</span>
                        <span className="text-[11px] text-nassayem flex items-center gap-1">
                          <Building className="w-3 h-3 text-gray-400" />
                          {res.buildingName}
                        </span>
                      </div>
                    </td>

                    {/* Dates */}
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      {res.checkIn && res.checkOut ? (
                        <div className="space-y-0.5">
                          <span className="text-gray-900 block font-medium">
                            {res.checkIn} → {res.checkOut}
                          </span>
                          <span className="text-gray-500 text-[10px]">
                            {res.nights} {isEn ? "night(s)" : "ليالي"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">{isEn ? "Dates pending" : "تاريخ غير محدد"}</span>
                      )}
                    </td>

                    {/* Total Price */}
                    <td className="py-3.5 px-4 text-right rtl:text-left">
                      <span className="font-extrabold text-gray-900 text-sm">
                        {res.totalPriceOmr.toFixed(3)}
                      </span>
                      <span className="text-[10px] text-gray-500 block">OMR</span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {res.status}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-center">
                      {res.conversationId ? (
                        <Link
                          href={`/${locale}/admin/chatbot/conversations/${res.conversationId}`}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold bg-nassayem/10 text-nassayem hover:bg-nassayem hover:text-white transition-all"
                        >
                          <span>{isEn ? "View Chat" : "عرض المحادثة"}</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 2: Payment Links Table */}
      {activeTab === "PAYMENTS" && (
        <div className="overflow-x-auto">
          {paymentLinks.length === 0 ? (
            <div className="text-center py-12 text-gray-400 space-y-2">
              <CreditCard className="w-8 h-8 mx-auto text-gray-300" />
              <p className="text-sm">
                {isEn ? "No payment links created for this day." : "لا توجد روابط دفع تم إنشاؤها في هذا اليوم."}
              </p>
            </div>
          ) : (
            <table className="w-full text-left rtl:text-right border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-100 text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">{isEn ? "Customer" : "العميل"}</th>
                  <th className="py-3 px-4">{isEn ? "Building & Unit" : "المبنى والوحدة"}</th>
                  <th className="py-3 px-4">{isEn ? "Reservation Ref" : "رقم الحجز"}</th>
                  <th className="py-3 px-4 text-right rtl:text-left">{isEn ? "Amount (OMR)" : "المبلغ (ر.ع)"}</th>
                  <th className="py-3 px-4 text-center">{isEn ? "Status" : "الحالة"}</th>
                  <th className="py-3 px-4 text-center">{isEn ? "Payment Link" : "رابط الدفع"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {paymentLinks.map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Customer */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <span className="font-bold text-gray-900">{pay.customerName}</span>
                        {pay.customerPhone && (
                          <span className="text-[11px] text-gray-500 font-mono block">
                            {pay.customerPhone}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Building & Unit */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <span className="font-medium text-gray-800">{pay.buildingName}</span>
                        {pay.unitCode && (
                          <span className="text-[11px] text-gray-500 block font-mono">
                            Unit: {pay.unitCode}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Ref */}
                    <td className="py-3.5 px-4 font-mono font-semibold text-gray-700">
                      {pay.reservationRef || "—"}
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 text-right rtl:text-left">
                      <span className="font-extrabold text-gray-900 text-sm">
                        {pay.amountOmr.toFixed(3)}
                      </span>
                      <span className="text-[10px] text-gray-500 block">OMR</span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">{renderPaymentStatusBadge(pay.status)}</td>

                    {/* Actions / Copy Link */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => copyToClipboard(pay.token)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                          title={isEn ? "Copy payment URL" : "نسخ رابط الدفع"}
                        >
                          {copiedToken === pay.token ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">{isEn ? "Copied" : "تم النسخ"}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-gray-500" />
                              <span>{isEn ? "Copy" : "نسخ"}</span>
                            </>
                          )}
                        </button>
                        <Link
                          href={`/${locale}/pay/${pay.token}`}
                          target="_blank"
                          className="p-1 rounded-xl text-gray-400 hover:text-nassayem hover:bg-blue-50 transition-all"
                          title={isEn ? "Open payment page" : "فتح صفحة الدفع"}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
