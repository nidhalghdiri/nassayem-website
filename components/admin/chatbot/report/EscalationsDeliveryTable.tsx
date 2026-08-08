"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  CheckCheck,
  Check,
  AlertTriangle,
  XCircle,
  ExternalLink,
  User,
  Phone,
  Building,
  Calendar,
  Filter,
} from "lucide-react";
import { EscalationLogItem } from "@/lib/chatbot/dailyReportData";

type Props = {
  logs: EscalationLogItem[];
  locale: string;
};

export default function EscalationsDeliveryTable({ logs, locale }: Props) {
  const isEn = locale === "en";
  const [filter, setFilter] = useState<"ALL" | "DELIVERED_READ" | "PENDING" | "FAILED">("ALL");
  const [search, setSearch] = useState("");

  const filteredLogs = logs.filter((log) => {
    if (filter === "DELIVERED_READ" && log.status !== "DELIVERED" && log.status !== "READ") {
      return false;
    }
    if (filter === "FAILED" && log.status !== "FAILED") {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = log.recipientName.toLowerCase().includes(q);
      const matchCust = (log.customerName || "").toLowerCase().includes(q);
      const matchPhone = (log.customerPhone || "").includes(q) || log.to.includes(q);
      const matchReason = (log.reason || "").toLowerCase().includes(q);
      if (!matchName && !matchCust && !matchPhone && !matchReason) return false;
    }
    return true;
  });

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "READ":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
            {isEn ? "Read" : "مقروءة"}
          </span>
        );
      case "DELIVERED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
            {isEn ? "Delivered" : "مستلمة"}
          </span>
        );
      case "SENT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            <Check className="w-3.5 h-3.5 text-gray-500" />
            {isEn ? "Sent" : "مرسلة"}
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            {isEn ? "Failed" : "فشل الإرسال"}
          </span>
        );
      case "SKIPPED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
            {isEn ? "Skipped" : "تم التجاوز"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header & Filter Controls */}
      <div className="p-5 lg:p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              {isEn ? "Escalation Messages & WhatsApp Delivery Log" : "سجل رسائل التصعيد وحالة التسليم بالواتساب"}
            </h3>
          </div>
          <p className="text-xs text-gray-500">
            {isEn
              ? "All staff notifications sent when customers required human assistance, with live Meta delivery receipts."
              : "جميع إشعارات الموظفين المرسلة عند طلب العميل للمساعدة البشرية، مع تأكيدات الاستلام والقراءة المباشرة من ميتا."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder={isEn ? "Search recipient, customer, reason..." : "بحث بالموظف أو العميل أو السبب..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-nassayem/40"
          />

          <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1 rounded-lg transition-all ${
                filter === "ALL" ? "bg-white text-gray-900 shadow-sm font-bold" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {isEn ? `All (${logs.length})` : `الكل (${logs.length})`}
            </button>
            <button
              onClick={() => setFilter("DELIVERED_READ")}
              className={`px-3 py-1 rounded-lg transition-all ${
                filter === "DELIVERED_READ"
                  ? "bg-white text-emerald-700 shadow-sm font-bold"
                  : "text-gray-600 hover:text-emerald-700"
              }`}
            >
              {isEn ? "Delivered / Read" : "وصلت / قُرئت"}
            </button>
            <button
              onClick={() => setFilter("FAILED")}
              className={`px-3 py-1 rounded-lg transition-all ${
                filter === "FAILED"
                  ? "bg-white text-red-700 shadow-sm font-bold"
                  : "text-gray-600 hover:text-red-700"
              }`}
            >
              {isEn ? "Failed" : "فشلت"}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-12 text-gray-400 space-y-2">
          <ShieldAlert className="w-8 h-8 mx-auto text-gray-300" />
          <p className="text-sm">
            {isEn ? "No escalation messages recorded for this day." : "لا توجد رسائل تصعيد مسجلة في هذا اليوم."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-100 text-gray-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">{isEn ? "Recipient (To)" : "المستلم (إلى من)"}</th>
                <th className="py-3 px-4">{isEn ? "WhatsApp Status" : "حالة الرسالة بالواتساب"}</th>
                <th className="py-3 px-4">{isEn ? "Customer Details" : "بيانات العميل"}</th>
                <th className="py-3 px-4">{isEn ? "Escalation Reason & Summary" : "سبب التصعيد والتفاصيل"}</th>
                <th className="py-3 px-4">{isEn ? "Time" : "الوقت"}</th>
                <th className="py-3 px-4 text-center">{isEn ? "Action" : "المحادثة"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filteredLogs.map((log) => {
                const timeStr = new Date(log.createdAt).toLocaleTimeString(
                  locale === "ar" ? "ar-OM" : "en-GB",
                  { hour: "2-digit", minute: "2-digit" },
                );

                return (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Recipient */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <span className="font-bold text-gray-900 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          {log.recipientName}
                        </span>
                        <span className="text-[11px] text-gray-500 block font-mono">
                          +{log.to} · <span className="text-gray-400">{log.recipientRole}</span>
                        </span>
                      </div>
                    </td>

                    {/* WhatsApp Status */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        {renderStatusBadge(log.status)}
                        {log.error && (
                          <span className="block text-[10px] text-red-600 max-w-xs truncate" title={log.error}>
                            {log.error}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <span className="font-medium text-gray-900 block">
                          {log.customerName || (isEn ? "Guest (Unspecified)" : "عميل")}
                        </span>
                        {log.customerPhone && (
                          <span className="text-[11px] text-gray-500 font-mono flex items-center gap-1">
                            <Phone className="w-3 h-3 text-gray-400" />
                            {log.customerPhone}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Reason */}
                    <td className="py-3.5 px-4 max-w-md">
                      <div className="space-y-1">
                        <p className="font-medium text-gray-800 line-clamp-2">{log.reason}</p>
                        {log.buildingName && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-nassayem font-medium bg-blue-50/80 px-2 py-0.5 rounded">
                            <Building className="w-3 h-3" />
                            {log.buildingName}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Timestamp */}
                    <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap font-mono">{timeStr}</td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {log.conversationId ? (
                        <Link
                          href={`/${locale}/admin/chatbot/conversations/${log.conversationId}`}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold bg-nassayem/10 text-nassayem hover:bg-nassayem hover:text-white transition-all shadow-xs"
                        >
                          <span>{isEn ? "Open Chat" : "فتح المحادثة"}</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
