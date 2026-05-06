import prisma from "@/lib/prisma";
import { format } from "date-fns";
import { enUS, ar } from "date-fns/locale";
import Link from "next/link";
import VoidNetsuitePaymentButton from "@/components/admin/VoidNetsuitePaymentButton";
import CopyLinkButton from "@/components/admin/CopyLinkButton";
import type { NetsuitePaymentStatus } from "@prisma/client";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

const statusStyles: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-500",
  VOIDED: "bg-gray-100 text-gray-500",
};

const statusLabels: Record<string, { en: string; ar: string }> = {
  PENDING: { en: "Pending", ar: "قيد الانتظار" },
  PAID: { en: "Paid", ar: "مدفوع" },
  FAILED: { en: "Failed", ar: "فشل" },
  EXPIRED: { en: "Expired", ar: "منتهٍ" },
  VOIDED: { en: "Voided", ar: "ملغى" },
};

const filterTabs = [
  { key: "all", en: "All", ar: "الكل" },
  { key: "PENDING", en: "Pending", ar: "انتظار" },
  { key: "PAID", en: "Paid", ar: "مدفوع" },
  { key: "FAILED", en: "Failed", ar: "فشل" },
  { key: "EXPIRED", en: "Expired", ar: "منتهٍ" },
  { key: "VOIDED", en: "Voided", ar: "ملغى" },
];

export default async function NetsuitePaymentsAdminPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const { status: rawStatus } = await searchParams;
  const isEn = locale === "en";
  const dateLocale = isEn ? enUS : ar;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";

  const activeFilter = rawStatus?.toUpperCase() ?? "ALL";

  const whereClause: Record<string, unknown> = {};
  if (activeFilter !== "ALL")
    whereClause.status = activeFilter as NetsuitePaymentStatus;

  const payments = await prisma.netsuitePayment.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const counts = await prisma.netsuitePayment.groupBy({
    by: ["status"],
    _count: { status: true },
  });
  const countMap: Record<string, number> = { ALL: 0 };
  counts.forEach((c) => {
    countMap[c.status] = c._count.status;
    countMap["ALL"] = (countMap["ALL"] ?? 0) + c._count.status;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {isEn ? "NetSuite Payments" : "مدفوعات NetSuite"}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          {isEn
            ? `${countMap["ALL"] ?? 0} total payment links from NetSuite reservations`
            : `${countMap["ALL"] ?? 0} روابط دفع إجمالاً من حجوزات NetSuite`}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {filterTabs.map((tab) => {
          const isActive =
            tab.key === "all"
              ? activeFilter === "ALL"
              : activeFilter === tab.key;
          const count = countMap[tab.key === "all" ? "ALL" : tab.key] ?? 0;
          const href = `/${locale}/admin/netsuite-payments${
            tab.key === "all" ? "" : `?status=${tab.key}`
          }`;
          return (
            <Link
              key={tab.key}
              href={href}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? "bg-nassayem text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-nassayem hover:text-nassayem"
              }`}
            >
              {isEn ? tab.en : tab.ar}
              {count > 0 && (
                <span
                  className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {isEn ? "No payment links yet" : "لا توجد روابط دفع بعد"}
            </h3>
            <p className="text-gray-500 text-sm max-w-xs">
              {isEn
                ? "When the receptionist creates a payment link from NetSuite, it will appear here."
                : "ستظهر روابط الدفع هنا عندما ينشئها موظف الاستقبال من NetSuite."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                    <th className="px-4 py-4 font-semibold text-start">
                      {isEn ? "Reservation" : "الحجز"}
                    </th>
                    <th className="px-4 py-4 font-semibold text-start">
                      {isEn ? "Customer" : "العميل"}
                    </th>
                    <th className="px-4 py-4 font-semibold text-start">
                      {isEn ? "Amount" : "المبلغ"}
                    </th>
                    <th className="px-4 py-4 font-semibold text-start">
                      {isEn ? "Created" : "تاريخ الإنشاء"}
                    </th>
                    <th className="px-4 py-4 font-semibold text-start">
                      {isEn ? "Status" : "الحالة"}
                    </th>
                    <th className="px-4 py-4 font-semibold text-end">
                      {isEn ? "Actions" : "إجراءات"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map((p) => {
                    const url = `${baseUrl}/${locale}/pay/${p.token}`;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-4">
                          <div className="font-mono text-xs font-bold text-nassayem bg-nassayem/5 px-2 py-1 rounded-lg inline-block">
                            {p.netsuiteReservationRef ??
                              p.netsuiteReservationId.slice(0, 10)}
                          </div>
                          {p.unitCode && (
                            <div className="text-xs text-gray-400 mt-1">
                              {p.unitCode}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-gray-900 text-sm">
                            {p.customerName}
                          </div>
                          {p.customerEmail && (
                            <div className="text-xs text-gray-400 mt-0.5">
                              {p.customerEmail}
                            </div>
                          )}
                          {p.customerPhone && (
                            <div className="text-xs text-gray-400">
                              {p.customerPhone}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-extrabold text-gray-900">
                            {p.amount.toFixed(3)}
                          </span>
                          <span className="text-xs text-gray-400 ms-1">
                            {p.currency}
                          </span>
                          {p.smartpayBankRefNo && (
                            <div className="text-xs text-gray-400 font-mono mt-1">
                              {p.smartpayBankRefNo}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <div className="text-gray-700 whitespace-nowrap">
                            {format(p.createdAt, "d MMM yyyy", {
                              locale: dateLocale,
                            })}
                          </div>
                          <div className="text-xs text-gray-400">
                            {format(p.createdAt, "HH:mm", {
                              locale: dateLocale,
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`px-2.5 py-1 text-xs font-bold rounded-full ${statusStyles[p.status]}`}
                          >
                            {isEn
                              ? statusLabels[p.status]?.en
                              : statusLabels[p.status]?.ar}
                          </span>
                          {p.status === "PAID" && p.netsuiteSyncError && (
                            <div
                              className="text-xs text-red-600 mt-1"
                              title={p.netsuiteSyncError}
                            >
                              {isEn
                                ? "NetSuite sync failed"
                                : "فشل التزامن مع NetSuite"}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {p.status === "PENDING" && (
                              <>
                                <CopyLinkButton url={url} isEn={isEn} />
                                <VoidNetsuitePaymentButton
                                  paymentId={p.id}
                                  isEn={isEn}
                                />
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-gray-100 lg:hidden">
              {payments.map((p) => {
                const url = `${baseUrl}/${locale}/pay/${p.token}`;
                return (
                  <div key={p.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-mono text-xs font-bold text-nassayem bg-nassayem/5 px-2 py-1 rounded-lg">
                          {p.netsuiteReservationRef ??
                            p.netsuiteReservationId.slice(0, 10)}
                        </span>
                        <p className="font-bold text-gray-900 text-sm mt-1.5">
                          {p.customerName}
                        </p>
                        {p.unitCode && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {p.unitCode}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 px-2.5 py-1 text-xs font-bold rounded-full ${statusStyles[p.status]}`}
                      >
                        {isEn
                          ? statusLabels[p.status]?.en
                          : statusLabels[p.status]?.ar}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {format(p.createdAt, "d MMM yyyy, HH:mm", {
                          locale: dateLocale,
                        })}
                      </span>
                      <span className="font-bold text-gray-900">
                        {p.amount.toFixed(3)}{" "}
                        <span className="font-normal text-gray-400">
                          {p.currency}
                        </span>
                      </span>
                    </div>

                    {p.status === "PENDING" && (
                      <div className="flex items-center gap-2 pt-1">
                        <CopyLinkButton url={url} isEn={isEn} />
                        <VoidNetsuitePaymentButton
                          paymentId={p.id}
                          isEn={isEn}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
