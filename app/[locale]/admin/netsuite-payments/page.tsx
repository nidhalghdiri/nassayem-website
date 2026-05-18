import prisma from "@/lib/prisma";
import Link from "next/link";
import NetsuitePaymentsList from "@/components/admin/NetsuitePaymentsList";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import type { NetsuitePaymentStatus, Prisma } from "@prisma/client";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

const filterTabs = [
  { key: "all", en: "All", ar: "الكل" },
  { key: "PENDING", en: "Pending", ar: "انتظار" },
  { key: "PAID", en: "Paid", ar: "مدفوع" },
  { key: "FAILED", en: "Failed", ar: "فشل" },
  { key: "EXPIRED", en: "Expired", ar: "منتهٍ" },
  { key: "VOIDED", en: "Voided", ar: "ملغى" },
  { key: "INACTIVE", en: "Inactive", ar: "غير نشط" },
];

export default async function NetsuitePaymentsAdminPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const { status: rawStatus } = await searchParams;
  const isEn = locale === "en";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";

  const adminUser = await getCurrentAdminUser();
  const isManager = adminUser?.role === "MANAGER";

  const activeFilter = rawStatus?.toUpperCase() ?? "ALL";

  // Default view hides soft-deleted records. The dedicated "Inactive" tab is
  // the only way to see them.
  const whereClause: Prisma.NetsuitePaymentWhereInput =
    activeFilter === "INACTIVE"
      ? { isActive: false }
      : activeFilter === "ALL"
        ? { isActive: true }
        : { isActive: true, status: activeFilter as NetsuitePaymentStatus };

  const payments = await prisma.netsuitePayment.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Counts: status counts are over active rows; INACTIVE is its own count.
  const [statusCounts, inactiveCount] = await Promise.all([
    prisma.netsuitePayment.groupBy({
      by: ["status"],
      where: { isActive: true },
      _count: { status: true },
    }),
    prisma.netsuitePayment.count({ where: { isActive: false } }),
  ]);
  const countMap: Record<string, number> = { ALL: 0, INACTIVE: inactiveCount };
  statusCounts.forEach((c) => {
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
            ? `${countMap["ALL"] ?? 0} active payment links from NetSuite reservations`
            : `${countMap["ALL"] ?? 0} روابط دفع نشطة من حجوزات NetSuite`}
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
          const isInactiveTab = tab.key === "INACTIVE";
          return (
            <Link
              key={tab.key}
              href={href}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? isInactiveTab
                    ? "bg-gray-700 text-white shadow-sm"
                    : "bg-nassayem text-white shadow-sm"
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

      <NetsuitePaymentsList
        payments={payments}
        baseUrl={baseUrl}
        isEn={isEn}
        isManager={isManager}
      />
    </div>
  );
}
