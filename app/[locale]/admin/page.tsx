import Link from "next/link";
import prisma from "@/lib/prisma";
import { format } from "date-fns";
import { enUS, ar } from "date-fns/locale";

type PageProps = {
  params: Promise<{ locale: string }>;
};

const statusStyles: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-green-100 text-green-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-red-100 text-red-700",
  REFUNDED: "bg-gray-100 text-gray-600",
};

const statusLabels: Record<string, { en: string; ar: string }> = {
  PENDING: { en: "Pending", ar: "قيد الانتظار" },
  CONFIRMED: { en: "Confirmed", ar: "مؤكد" },
  COMPLETED: { en: "Completed", ar: "مكتمل" },
  CANCELLED: { en: "Cancelled", ar: "ملغي" },
  REFUNDED: { en: "Refunded", ar: "مُسترد" },
};

export default async function AdminDashboard({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";
  const dateLocale = isEn ? enUS : ar;

  // ── Real data from database ──────────────────────────────────────────────
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalBuildings,
    totalUnits,
    activeBookings,
    monthlyRevenueResult,
    recentBookings,
  ] = await Promise.all([
    prisma.building.count(),
    prisma.unit.count(),
    prisma.booking.count({
      where: { status: { in: ["PENDING", "CONFIRMED"] } },
    }),
    prisma.booking.aggregate({
      _sum: { totalPrice: true },
      where: {
        status: { in: ["CONFIRMED", "COMPLETED"] },
        createdAt: { gte: startOfMonth },
      },
    }),
    prisma.booking.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        unit: {
          select: {
            titleEn: true,
            titleAr: true,
            building: { select: { nameEn: true, nameAr: true } },
          },
        },
      },
    }),
  ]);

  const monthlyRevenue = monthlyRevenueResult._sum.totalPrice ?? 0;

  const stats = [
    {
      titleEn: "Total Buildings",
      titleAr: "إجمالي المباني",
      value: totalBuildings,
      icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
      href: `/${locale}/admin/buildings`,
      color: "bg-blue-50 text-blue-600",
    },
    {
      titleEn: "Managed Units",
      titleAr: "الوحدات المدارة",
      value: totalUnits,
      icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
      href: `/${locale}/admin/units`,
      color: "bg-purple-50 text-purple-600",
    },
    {
      titleEn: "Active Bookings",
      titleAr: "الحجوزات النشطة",
      value: activeBookings,
      icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
      href: `/${locale}/admin/bookings`,
      color: "bg-green-50 text-green-600",
    },
    {
      titleEn: "Revenue This Month",
      titleAr: "الإيرادات هذا الشهر",
      value: `${monthlyRevenue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${isEn ? "OMR" : "ر.ع"}`,
      icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      href: `/${locale}/admin/bookings`,
      color: "bg-nassayem/10 text-nassayem",
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {isEn ? "Dashboard" : "لوحة القيادة"}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isEn
              ? `Welcome back — ${format(now, "MMMM yyyy", { locale: dateLocale })}`
              : `مرحباً بعودتك — ${format(now, "MMMM yyyy", { locale: dateLocale })}`}
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Link
            href={`/${locale}/admin/buildings/new`}
            className="flex-1 sm:flex-none text-center bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all text-sm"
          >
            {isEn ? "+ Building" : "+ مبنى"}
          </Link>
          <Link
            href={`/${locale}/admin/units/new`}
            className="flex-1 sm:flex-none text-center bg-nassayem text-white hover:bg-nassayem-dark px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all text-sm"
          >
            {isEn ? "+ Unit" : "+ وحدة"}
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, idx) => (
          <Link
            key={idx}
            href={stat.href}
            className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md hover:border-gray-200 transition-all"
          >
            <div
              className={`w-11 h-11 md:w-14 md:h-14 ${stat.color} rounded-xl flex items-center justify-center shrink-0`}
            >
              <svg
                className="w-5 h-5 md:w-7 md:h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d={stat.icon}
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 truncate">
                {isEn ? stat.titleEn : stat.titleAr}
              </p>
              <h3 className="text-xl md:text-2xl font-extrabold text-gray-900 mt-0.5 leading-none">
                {stat.value}
              </h3>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Bookings */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 md:px-6 py-4 md:py-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-base md:text-lg font-bold text-gray-900">
            {isEn ? "Recent Bookings" : "أحدث الحجوزات"}
          </h3>
          <Link
            href={`/${locale}/admin/bookings`}
            className="text-sm text-nassayem font-semibold hover:underline"
          >
            {isEn ? "View All →" : "← عرض الكل"}
          </Link>
        </div>

        {recentBookings.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            {isEn ? "No bookings yet." : "لا توجد حجوزات بعد."}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium text-start">
                      {isEn ? "Guest" : "الضيف"}
                    </th>
                    <th className="px-6 py-4 font-medium text-start">
                      {isEn ? "Unit" : "الوحدة"}
                    </th>
                    <th className="px-6 py-4 font-medium text-start">
                      {isEn ? "Check In" : "تاريخ الدخول"}
                    </th>
                    <th className="px-6 py-4 font-medium text-start">
                      {isEn ? "Status" : "الحالة"}
                    </th>
                    <th className="px-6 py-4 font-medium text-end">
                      {isEn ? "Amount" : "المبلغ"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentBookings.map((booking) => (
                    <tr
                      key={booking.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 text-sm">
                          {booking.guestName}
                        </div>
                        <div className="text-xs text-gray-400">
                          {booking.id.split("-")[0].toUpperCase()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>
                          {isEn
                            ? booking.unit.titleEn
                            : booking.unit.titleAr}
                        </div>
                        <div className="text-xs text-gray-400">
                          {isEn
                            ? booking.unit.building.nameEn
                            : booking.unit.building.nameAr}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {format(new Date(booking.checkIn), "MMM d, yyyy", {
                          locale: dateLocale,
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-bold rounded-full ${statusStyles[booking.status] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {isEn
                            ? statusLabels[booking.status]?.en
                            : statusLabels[booking.status]?.ar}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900 text-end">
                        {booking.totalPrice}{" "}
                        <span className="font-normal text-gray-400 text-xs">
                          {isEn ? "OMR" : "ر.ع"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-gray-100 md:hidden">
              {recentBookings.map((booking) => (
                <div key={booking.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
                        {booking.guestName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {isEn ? booking.unit.titleEn : booking.unit.titleAr}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 px-2.5 py-1 text-xs font-bold rounded-full ${statusStyles[booking.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {isEn
                        ? statusLabels[booking.status]?.en
                        : statusLabels[booking.status]?.ar}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {format(new Date(booking.checkIn), "MMM d, yyyy", {
                        locale: dateLocale,
                      })}
                    </span>
                    <span className="font-bold text-gray-900">
                      {booking.totalPrice}{" "}
                      <span className="font-normal text-gray-400">
                        {isEn ? "OMR" : "ر.ع"}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
