"use client";

import { Building2, UserCheck, Clock, UserX, CheckCircle, Percent } from "lucide-react";
import { BuildingCustomerStatus } from "@/lib/chatbot/dailyReportData";

type Props = {
  buildings: BuildingCustomerStatus[];
  locale: string;
};

export default function CustomerBuildingBreakdown({ buildings, locale }: Props) {
  const isEn = locale === "en";

  const totalInquiries = buildings.reduce((acc, b) => acc + b.totalCustomers, 0);
  const totalContacted = buildings.reduce((acc, b) => acc + b.contacted, 0);
  const totalPending = buildings.reduce((acc, b) => acc + b.pending, 0);
  const totalNotContacted = buildings.reduce((acc, b) => acc + b.notContacted, 0);
  const totalConverted = buildings.reduce((acc, b) => acc + b.converted, 0);

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 lg:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              {isEn ? "Customers Follow-up Status by Building" : "حالة متابعة العملاء حسب المبنى"}
            </h3>
          </div>
          <p className="text-xs text-gray-500">
            {isEn
              ? "Breakdown of customer inquiries, reception follow-up progress, and conversions per property."
              : "توزيع استفسارات العملاء، ومستوى المتابعة المكتملة، والحجوزات المؤكدة لكل مبنى."}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 self-start sm:self-auto">
          <span>{isEn ? "Total Inquiries:" : "إجمالي العملاء:"}</span>
          <span className="text-nassayem font-bold">{totalInquiries}</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left rtl:text-right border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50/75 border-b border-gray-100 text-gray-500 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">{isEn ? "Building / Property" : "المبنى / العقار"}</th>
              <th className="py-3 px-4 text-center">{isEn ? "Total Inquiries" : "إجمالي الاستفسارات"}</th>
              <th className="py-3 px-4 text-center">{isEn ? "Contacted" : "تواصل معه (Contacted)"}</th>
              <th className="py-3 px-4 text-center">{isEn ? "Pending" : "قيد الانتظار (Pending)"}</th>
              <th className="py-3 px-4 text-center">{isEn ? "Not Contacted" : "لم يتم التواصل (Lost)"}</th>
              <th className="py-3 px-4 text-center">{isEn ? "Converted" : "تم الحجز (Converted)"}</th>
              <th className="py-3 px-4">{isEn ? "Follow-up Rate" : "نسبة الإنجاز"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {buildings.map((b) => {
              const name = isEn ? b.buildingNameEn : b.buildingNameAr;

              return (
                <tr key={b.buildingId} className="hover:bg-slate-50/80 transition-colors">
                  {/* Building Name */}
                  <td className="py-3.5 px-4 font-bold text-gray-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{name}</span>
                  </td>

                  {/* Total */}
                  <td className="py-3.5 px-4 text-center font-extrabold text-gray-900 bg-gray-50/50">
                    {b.totalCustomers}
                  </td>

                  {/* Contacted */}
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
                      <UserCheck className="w-3 h-3" />
                      {b.contacted}
                    </span>
                  </td>

                  {/* Pending */}
                  <td className="py-3.5 px-4 text-center">
                    <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-lg ${
                      b.pending > 0 ? "text-amber-700 bg-amber-50" : "text-gray-400"
                    }`}>
                      <Clock className="w-3 h-3" />
                      {b.pending}
                    </span>
                  </td>

                  {/* Not Contacted */}
                  <td className="py-3.5 px-4 text-center">
                    <span className={`inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-lg ${
                      b.notContacted > 0 ? "text-red-700 bg-red-50" : "text-gray-400"
                    }`}>
                      <UserX className="w-3 h-3" />
                      {b.notContacted}
                    </span>
                  </td>

                  {/* Converted */}
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg">
                      <CheckCircle className="w-3 h-3" />
                      {b.converted}
                    </span>
                  </td>

                  {/* Follow-up Rate Progress Bar */}
                  <td className="py-3.5 px-4 min-w-[140px]">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-gray-600">{b.contactedPct}%</span>
                        <span className="text-gray-400 text-[10px]">
                          {b.contacted + b.converted}/{b.totalCustomers || 1}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            b.contactedPct >= 80
                              ? "bg-emerald-500"
                              : b.contactedPct >= 50
                              ? "bg-blue-500"
                              : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.max(b.totalCustomers > 0 ? 5 : 0, b.contactedPct)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Totals Row */}
            <tr className="bg-slate-50 font-bold border-t-2 border-gray-200 text-gray-900">
              <td className="py-3.5 px-4">{isEn ? "Total Across Properties" : "الإجمالي الكلي"}</td>
              <td className="py-3.5 px-4 text-center font-extrabold">{totalInquiries}</td>
              <td className="py-3.5 px-4 text-center text-emerald-800">{totalContacted}</td>
              <td className="py-3.5 px-4 text-center text-amber-800">{totalPending}</td>
              <td className="py-3.5 px-4 text-center text-red-800">{totalNotContacted}</td>
              <td className="py-3.5 px-4 text-center text-blue-800">{totalConverted}</td>
              <td className="py-3.5 px-4">
                <span className="font-extrabold text-nassayem">
                  {totalInquiries > 0 ? Math.round(((totalContacted + totalConverted) / totalInquiries) * 100) : 0}%
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
