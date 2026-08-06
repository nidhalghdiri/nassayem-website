"use client";

import Link from "next/link";
import { Users, Phone, Calendar, ArrowRight, ExternalLink, Sparkles } from "lucide-react";

export type RecentLead = {
  id: string;
  name: string;
  phone: string;
  unitInterest: string | null;
  unitTitle: string | null;
  buildingName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  conversationId: string;
  createdAt: string;
};

type Props = {
  locale: string;
  isEn: boolean;
  leads: RecentLead[];
};

export default function RecentLeadsStream({ locale, isEn, leads }: Props) {
  const getStatusBadge = (status: string) => {
    const map: Record<string, { labelEn: string; labelAr: string; cls: string }> = {
      NEW: {
        labelEn: "New",
        labelAr: "جديد",
        cls: "bg-blue-50 text-blue-700 border-blue-200",
      },
      CONTACTED: {
        labelEn: "Contacted",
        labelAr: "تم التواصل",
        cls: "bg-amber-50 text-amber-800 border-amber-200",
      },
      CONVERTED: {
        labelEn: "Converted",
        labelAr: "تم الحجز",
        cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      },
      LOST: {
        labelEn: "Lost",
        labelAr: "ملغي",
        cls: "bg-gray-100 text-gray-600 border-gray-200",
      },
    };
    const s = map[status] || { labelEn: status, labelAr: status, cls: "bg-gray-100 text-gray-700" };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.cls}`}>
        {isEn ? s.labelEn : s.labelAr}
      </span>
    );
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(isEn ? "en-GB" : "ar-OM", {
        day: "numeric",
        month: "short",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="bg-white border border-gray-200/90 rounded-3xl p-5 lg:p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {isEn ? "Recent Qualified Booking Leads" : "أحدث طلبات الحجز والعملاء المهتمين"}
            </h2>
            <p className="text-xs text-gray-500">
              {isEn ? "Directly captured by the AI Assistant" : "تم تسجيل بياناتهم ورغبات حجزهم آلياً"}
            </p>
          </div>
        </div>

        <Link
          href={`/${locale}/admin/chatbot/leads`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#1B365D] hover:text-blue-800 transition-colors"
        >
          <span>{isEn ? "View All Leads" : "عرض كل العملاء"}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {leads.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">
          {isEn ? "No leads captured yet." : "لم يتم تسجيل عملاء محتملين بعد."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100 font-semibold">
                <th className="py-2.5 px-3">{isEn ? "Customer" : "العميل"}</th>
                <th className="py-2.5 px-3">{isEn ? "Phone" : "الهاتف"}</th>
                <th className="py-2.5 px-3">{isEn ? "Unit / Building" : "الوحدة / المبنى"}</th>
                <th className="py-2.5 px-3">{isEn ? "Dates" : "التواريخ"}</th>
                <th className="py-2.5 px-3">{isEn ? "Status" : "الحالة"}</th>
                <th className="py-2.5 px-3 text-end">{isEn ? "Action" : "الإجراء"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3 font-bold text-gray-900">
                    {lead.name || (isEn ? "Guest" : "نزيل")}
                  </td>
                  <td className="py-3 px-3 font-mono text-gray-600 dir-ltr">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-gray-400" />
                      {lead.phone}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-gray-700">
                    <div className="font-medium text-gray-900">
                      {lead.buildingName || lead.unitTitle || lead.unitInterest || (isEn ? "Apartment inquiry" : "استفسار عن شقة")}
                    </div>
                    {lead.unitInterest && lead.buildingName && (
                      <div className="text-[10px] text-gray-400 truncate max-w-xs">
                        {lead.unitInterest}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-gray-600 whitespace-nowrap">
                    {lead.checkIn ? (
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {formatDate(lead.checkIn)} → {formatDate(lead.checkOut)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {getStatusBadge(lead.status)}
                  </td>
                  <td className="py-3 px-3 text-end">
                    <Link
                      href={`/${locale}/admin/chatbot/conversations?convo=${lead.conversationId}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#1B365D]/10 hover:bg-[#1B365D]/20 text-[#1B365D] transition-colors"
                    >
                      <span>{isEn ? "Chat" : "المحادثة"}</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
