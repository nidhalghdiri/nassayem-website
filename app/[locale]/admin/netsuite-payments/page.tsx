import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import NetsuitePaymentsList from "@/components/admin/NetsuitePaymentsList";
import ListFilterBar from "@/components/admin/ListFilterBar";
import { getCurrentAdminUser, getBuildingScopeFilter } from "@/lib/adminAuth";
import { buildNetsuiteWhere } from "@/lib/adminPaymentFilters";

// Roles allowed to view the NetSuite Payments module (mirrors the sidebar nav).
const ALLOWED_ROLES = ["MANAGER", "RECEPTIONIST"] as const;

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    status?: string;
    q?: string;
    from?: string;
    to?: string;
    buildingId?: string;
    createdBy?: string;
  }>;
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
  const {
    status: rawStatus,
    q: searchQuery,
    from,
    to,
    buildingId: buildingFilter,
    createdBy,
  } = await searchParams;
  const isEn = locale === "en";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";

  const adminUser = await getCurrentAdminUser();
  // Server-side role guard: the sidebar only hides the link, so enforce here
  // too in case the URL is hit directly.
  if (!adminUser || !ALLOWED_ROLES.includes(adminUser.role as never)) {
    redirect(`/${locale}/admin`);
  }
  const isManager = adminUser.role === "MANAGER";

  // Receptionists are scoped to their assigned buildings; managers see all.
  const scope = await getBuildingScopeFilter(adminUser);

  const activeFilter = rawStatus?.toUpperCase() ?? "ALL";

  // Combine status + text search + payment-date range + building + created-by.
  // Use AND so a building filter intersects with (rather than is overwritten
  // by) the receptionist building scope. The "Inactive" tab is the only way to
  // see soft-deleted records.
  const whereClause = {
    AND: [
      buildNetsuiteWhere({
        status: rawStatus,
        q: searchQuery,
        from,
        to,
        buildingId: buildingFilter,
        createdBy,
      }),
      ...(scope ? [scope] : []),
    ],
  };

  // Filter dropdown options, scoped to what this user can see.
  const [buildingRows, createdByRows] = await Promise.all([
    prisma.building.findMany({
      where: scope ? { id: { in: scope.buildingId.in } } : {},
      select: { id: true, nameEn: true, nameAr: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.netsuitePayment.findMany({
      where: { ...(scope ?? {}), receptionistEmail: { not: null } },
      distinct: ["receptionistEmail"],
      select: { receptionistEmail: true, receptionistName: true },
      orderBy: { receptionistEmail: "asc" },
    }),
  ]);
  const buildingOptions = buildingRows.map((b) => ({
    value: b.id,
    label: isEn ? b.nameEn : b.nameAr,
  }));
  const createdByOptions = createdByRows
    .filter((r) => r.receptionistEmail)
    .map((r) => ({
      value: r.receptionistEmail as string,
      label: r.receptionistName
        ? `${r.receptionistName} (${r.receptionistEmail})`
        : (r.receptionistEmail as string),
    }));

  const payments = await prisma.netsuitePayment.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      building: { select: { id: true, nameEn: true, nameAr: true } },
    },
  });

  // Counts: status counts are over active rows; INACTIVE is its own count.
  // Both respect the building scope so receptionist tab badges stay accurate.
  const [statusCounts, inactiveCount] = await Promise.all([
    prisma.netsuitePayment.groupBy({
      by: ["status"],
      where: { isActive: true, ...(scope ?? {}) },
      _count: { status: true },
    }),
    prisma.netsuitePayment.count({ where: { isActive: false, ...(scope ?? {}) } }),
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
          // Preserve search + date filters when switching tabs
          const tabParams = new URLSearchParams();
          if (tab.key !== "all") tabParams.set("status", tab.key);
          if (searchQuery?.trim()) tabParams.set("q", searchQuery.trim());
          if (from) tabParams.set("from", from);
          if (to) tabParams.set("to", to);
          if (buildingFilter) tabParams.set("buildingId", buildingFilter);
          if (createdBy) tabParams.set("createdBy", createdBy);
          const href = `/${locale}/admin/netsuite-payments${
            tabParams.toString() ? `?${tabParams}` : ""
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

      {/* Search + payment-date range + Excel export */}
      <ListFilterBar
        isEn={isEn}
        placeholder={
          isEn
            ? "Search by name, email, reservation, unit, order #..."
            : "بحث بالاسم أو البريد أو الحجز أو الوحدة أو رقم الطلب..."
        }
        current={{
          q: searchQuery ?? "",
          from: from ?? "",
          to: to ?? "",
          status: activeFilter,
          building: buildingFilter ?? "",
          createdBy: createdBy ?? "",
        }}
        buildingOptions={buildingOptions}
        createdByOptions={createdByOptions}
        exportPath="/api/admin/netsuite-payments/export"
      />

      <NetsuitePaymentsList
        payments={payments}
        baseUrl={baseUrl}
        isEn={isEn}
        isManager={isManager}
        adminEmail={adminUser.email}
      />
    </div>
  );
}
