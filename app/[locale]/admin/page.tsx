import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { format } from "date-fns";
import { enUS, ar } from "date-fns/locale";
import type { TaskStatus } from "@prisma/client";

type PageProps = {
  params: Promise<{ locale: string }>;
};

const TASK_TERMINAL: TaskStatus[] = [
  "CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED", "CANCELLED",
];

// ── Booking status helpers (Manager dashboard only) ───────────────────────────
const bookingStatusStyles: Record<string, string> = {
  PENDING:   "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-green-100 text-green-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-red-100 text-red-700",
  REFUNDED:  "bg-gray-100 text-gray-600",
};
const bookingStatusLabels: Record<string, { en: string; ar: string }> = {
  PENDING:   { en: "Pending",   ar: "قيد الانتظار" },
  CONFIRMED: { en: "Confirmed", ar: "مؤكد" },
  COMPLETED: { en: "Completed", ar: "مكتمل" },
  CANCELLED: { en: "Cancelled", ar: "ملغي" },
  REFUNDED:  { en: "Refunded",  ar: "مُسترد" },
};

// ── Task status label helpers ─────────────────────────────────────────────────
const taskStatusStyles: Record<string, string> = {
  ASSIGNED:           "bg-blue-100 text-blue-700",
  CLEANING_STARTED:   "bg-cyan-100 text-cyan-700",
  CLEANING_COMPLETED: "bg-green-100 text-green-700",
  INSPECTING:         "bg-purple-100 text-purple-700",
  ISSUES_FOUND:       "bg-orange-100 text-orange-700",
  NO_ISSUES:          "bg-green-100 text-green-700",
  WORK_STARTED:       "bg-yellow-100 text-yellow-700",
  WORK_COMPLETED:     "bg-green-100 text-green-700",
  IN_PROGRESS:        "bg-blue-100 text-blue-700",
  COMPLETED:          "bg-green-100 text-green-700",
  ON_HOLD:            "bg-gray-100 text-gray-600",
  CANCELLED:          "bg-red-100 text-red-700",
  PENDING_APPROVAL:   "bg-amber-100 text-amber-700",
};

function taskStatusLabel(status: string, isEn: boolean): string {
  const map: Record<string, { en: string; ar: string }> = {
    ASSIGNED:           { en: "Assigned",          ar: "مُعين" },
    CLEANING_STARTED:   { en: "Cleaning Started",   ar: "بدأ التنظيف" },
    CLEANING_COMPLETED: { en: "Cleaning Completed", ar: "اكتمل التنظيف" },
    INSPECTING:         { en: "Inspecting",         ar: "جارٍ الفحص" },
    ISSUES_FOUND:       { en: "Issues Found",       ar: "تم العثور على مشاكل" },
    NO_ISSUES:          { en: "No Issues",          ar: "لا مشاكل" },
    WORK_STARTED:       { en: "Work Started",       ar: "بدأ العمل" },
    WORK_COMPLETED:     { en: "Work Completed",     ar: "اكتمل العمل" },
    IN_PROGRESS:        { en: "In Progress",        ar: "قيد التنفيذ" },
    COMPLETED:          { en: "Completed",          ar: "مكتمل" },
    ON_HOLD:            { en: "On Hold",            ar: "معلق" },
    CANCELLED:          { en: "Cancelled",          ar: "ملغي" },
    PENDING_APPROVAL:   { en: "Pending Approval",   ar: "قيد الموافقة" },
  };
  return isEn ? (map[status]?.en ?? status) : (map[status]?.ar ?? status);
}

function taskTypeLabel(type: string, isEn: boolean): string {
  const map: Record<string, { en: string; ar: string }> = {
    CLEANING:    { en: "Cleaning",    ar: "تنظيف" },
    INSPECTION:  { en: "Inspection",  ar: "فحص" },
    MAINTENANCE: { en: "Maintenance", ar: "صيانة" },
    WORK_ORDER:  { en: "Work Order",  ar: "أمر عمل" },
  };
  return isEn ? (map[type]?.en ?? type) : (map[type]?.ar ?? type);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════════

export default async function AdminDashboard({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";
  const dateLocale = isEn ? enUS : ar;
  const now = new Date();

  const adminUser = await getCurrentAdminUser();
  const role = adminUser?.role ?? "MANAGER";
  const isManager = role === "MANAGER";
  const isSupervisor = role === "SUPERVISOR";

  // ── Route non-managers to a task dashboard ───────────────────────────────────
  if (!isManager) {
    return (
      <TaskDashboard
        locale={locale}
        isEn={isEn}
        dateLocale={dateLocale}
        now={now}
        adminUser={adminUser}
        isSupervisor={isSupervisor}
      />
    );
  }

  // ── Manager dashboard ────────────────────────────────────────────────────────
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalBuildings,
    totalUnits,
    activeBookings,
    monthlyRevenueResult,
    recentBookings,
    taskStats,
  ] = await Promise.all([
    prisma.building.count(),
    prisma.unit.count(),
    prisma.booking.count({ where: { status: { in: ["PENDING", "CONFIRMED"] } } }),
    prisma.booking.aggregate({
      _sum: { totalPrice: true },
      where: { status: { in: ["CONFIRMED", "COMPLETED"] }, createdAt: { gte: startOfMonth } },
    }),
    prisma.booking.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        unit: {
          select: {
            titleEn: true, titleAr: true,
            building: { select: { nameEn: true, nameAr: true } },
          },
        },
      },
    }),
    (async () => {
      const [activeTasks, pendingApproval, overdueTasks] = await Promise.all([
        prisma.task.count({ where: { status: { notIn: TASK_TERMINAL } } }),
        prisma.task.count({ where: { status: "PENDING_APPROVAL" } }),
        prisma.task.count({ where: { dueDate: { lt: now }, status: { notIn: TASK_TERMINAL } } }),
      ]);
      return { activeTasks, pendingApproval, overdueTasks };
    })(),
  ]);

  const monthlyRevenue = monthlyRevenueResult._sum.totalPrice ?? 0;

  const stats = [
    {
      titleEn: "Total Buildings", titleAr: "إجمالي المباني",
      value: totalBuildings,
      icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
      href: `/${locale}/admin/buildings`, color: "bg-blue-50 text-blue-600",
    },
    {
      titleEn: "Managed Units", titleAr: "الوحدات المدارة",
      value: totalUnits,
      icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
      href: `/${locale}/admin/units`, color: "bg-purple-50 text-purple-600",
    },
    {
      titleEn: "Active Bookings", titleAr: "الحجوزات النشطة",
      value: activeBookings,
      icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
      href: `/${locale}/admin/bookings`, color: "bg-green-50 text-green-600",
    },
    {
      titleEn: "Revenue This Month", titleAr: "الإيرادات هذا الشهر",
      value: `${monthlyRevenue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${isEn ? "OMR" : "ر.ع"}`,
      icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      href: `/${locale}/admin/bookings`, color: "bg-nassayem/10 text-nassayem",
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
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
          <Link href={`/${locale}/admin/buildings/new`} className="flex-1 sm:flex-none text-center bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all text-sm">
            {isEn ? "+ Building" : "+ مبنى"}
          </Link>
          <Link href={`/${locale}/admin/units/new`} className="flex-1 sm:flex-none text-center bg-nassayem text-white hover:bg-nassayem-dark px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all text-sm">
            {isEn ? "+ Unit" : "+ وحدة"}
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, idx) => (
          <Link key={idx} href={stat.href} className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md hover:border-gray-200 transition-all">
            <div className={`w-11 h-11 md:w-14 md:h-14 ${stat.color} rounded-xl flex items-center justify-center shrink-0`}>
              <svg className="w-5 h-5 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 truncate">{isEn ? stat.titleEn : stat.titleAr}</p>
              <h3 className="text-xl md:text-2xl font-extrabold text-gray-900 mt-0.5 leading-none">{stat.value}</h3>
            </div>
          </Link>
        ))}
      </div>

      {/* Task stats */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 md:px-6 py-4 md:py-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-base md:text-lg font-bold text-gray-900">{isEn ? "Tasks Overview" : "نظرة عامة على المهام"}</h3>
          <Link href={`/${locale}/admin/tasks`} className="text-sm text-nassayem font-semibold hover:underline">
            {isEn ? "View Board →" : "← عرض اللوحة"}
          </Link>
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          {[
            { labelEn: "Active Tasks", labelAr: "مهام نشطة", value: taskStats.activeTasks, href: `/${locale}/admin/tasks`, color: "text-blue-600" },
            { labelEn: "Pending Approval", labelAr: "قيد الموافقة", value: taskStats.pendingApproval, href: `/${locale}/admin/tasks/approvals`, color: taskStats.pendingApproval > 0 ? "text-yellow-600" : "text-gray-400" },
            { labelEn: "Overdue", labelAr: "متأخرة", value: taskStats.overdueTasks, href: `/${locale}/admin/tasks`, color: taskStats.overdueTasks > 0 ? "text-red-600" : "text-gray-400" },
          ].map((s) => (
            <Link key={s.labelEn} href={s.href} className="flex flex-col items-center justify-center py-5 px-4 hover:bg-gray-50 transition-colors text-center">
              <span className={`text-2xl md:text-3xl font-extrabold leading-none ${s.color}`}>{s.value}</span>
              <span className="text-xs text-gray-500 mt-1">{isEn ? s.labelEn : s.labelAr}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent bookings */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 md:px-6 py-4 md:py-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-base md:text-lg font-bold text-gray-900">{isEn ? "Recent Bookings" : "أحدث الحجوزات"}</h3>
          <Link href={`/${locale}/admin/bookings`} className="text-sm text-nassayem font-semibold hover:underline">
            {isEn ? "View All →" : "← عرض الكل"}
          </Link>
        </div>
        {recentBookings.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">{isEn ? "No bookings yet." : "لا توجد حجوزات بعد."}</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium text-start">{isEn ? "Guest" : "الضيف"}</th>
                    <th className="px-6 py-4 font-medium text-start">{isEn ? "Unit" : "الوحدة"}</th>
                    <th className="px-6 py-4 font-medium text-start">{isEn ? "Check In" : "تاريخ الدخول"}</th>
                    <th className="px-6 py-4 font-medium text-start">{isEn ? "Status" : "الحالة"}</th>
                    <th className="px-6 py-4 font-medium text-end">{isEn ? "Amount" : "المبلغ"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 text-sm">{booking.guestName}</div>
                        <div className="text-xs text-gray-400">{booking.id.split("-")[0].toUpperCase()}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>{isEn ? booking.unit.titleEn : booking.unit.titleAr}</div>
                        <div className="text-xs text-gray-400">{isEn ? booking.unit.building.nameEn : booking.unit.building.nameAr}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {format(new Date(booking.checkIn), "MMM d, yyyy", { locale: dateLocale })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${bookingStatusStyles[booking.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {isEn ? bookingStatusLabels[booking.status]?.en : bookingStatusLabels[booking.status]?.ar}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900 text-end">
                        {booking.totalPrice} <span className="font-normal text-gray-400 text-xs">{isEn ? "OMR" : "ر.ع"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-gray-100 md:hidden">
              {recentBookings.map((booking) => (
                <div key={booking.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{booking.guestName}</p>
                      <p className="text-xs text-gray-400">{isEn ? booking.unit.titleEn : booking.unit.titleAr}</p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 text-xs font-bold rounded-full ${bookingStatusStyles[booking.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {isEn ? bookingStatusLabels[booking.status]?.en : bookingStatusLabels[booking.status]?.ar}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{format(new Date(booking.checkIn), "MMM d, yyyy", { locale: dateLocale })}</span>
                    <span className="font-bold text-gray-900">{booking.totalPrice} <span className="font-normal text-gray-400">{isEn ? "OMR" : "ر.ع"}</span></span>
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

// ═══════════════════════════════════════════════════════════════════════════════
// Task-focused dashboard (Supervisor + field staff)
// ═══════════════════════════════════════════════════════════════════════════════

async function TaskDashboard({
  locale,
  isEn,
  dateLocale,
  now,
  adminUser,
  isSupervisor,
}: {
  locale: string;
  isEn: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dateLocale: any;
  now: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminUser: any;
  isSupervisor: boolean;
}) {
  // Supervisor sees all tasks; others see only their own
  const visibilityFilter = isSupervisor
    ? {}
    : adminUser
    ? { OR: [{ assignedToId: adminUser.id }, { createdById: adminUser.id }] }
    : {};

  const [activeTasks, pendingApproval, overdueTasks, recentTasks] = await Promise.all([
    prisma.task.count({
      where: { ...visibilityFilter, status: { notIn: TASK_TERMINAL } },
    }),
    isSupervisor
      ? prisma.task.count({ where: { status: "PENDING_APPROVAL" } })
      : Promise.resolve(0),
    prisma.task.count({
      where: { ...visibilityFilter, dueDate: { lt: now }, status: { notIn: TASK_TERMINAL } },
    }),
    prisma.task.findMany({
      where: { ...visibilityFilter, status: { notIn: TASK_TERMINAL } },
      take: 8,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        type: true,
        title: true,
        status: true,
        dueDate: true,
        priority: true,
        unitNumber: true,
        building: { select: { nameEn: true, nameAr: true } },
        assignedTo: { select: { name: true, email: true } },
      },
    }),
  ]);

  const priorityColor: Record<string, string> = {
    LOW: "bg-gray-100 text-gray-500",
    MEDIUM: "bg-blue-100 text-blue-600",
    HIGH: "bg-orange-100 text-orange-600",
    URGENT: "bg-red-100 text-red-600",
  };
  const priorityLabel: Record<string, { en: string; ar: string }> = {
    LOW: { en: "Low", ar: "منخفضة" },
    MEDIUM: { en: "Medium", ar: "متوسطة" },
    HIGH: { en: "High", ar: "عالية" },
    URGENT: { en: "Urgent", ar: "عاجلة" },
  };

  const statCards = [
    {
      labelEn: "Active Tasks", labelAr: "مهام نشطة",
      value: activeTasks, color: "text-blue-600",
      bg: "bg-blue-50", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
      href: `/${locale}/admin/tasks`,
    },
    ...(isSupervisor ? [{
      labelEn: "Pending Approval", labelAr: "قيد الموافقة",
      value: pendingApproval, color: pendingApproval > 0 ? "text-yellow-600" : "text-gray-400",
      bg: "bg-yellow-50", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
      href: `/${locale}/admin/tasks/approvals`,
    }] : []),
    {
      labelEn: "Overdue", labelAr: "متأخرة",
      value: overdueTasks, color: overdueTasks > 0 ? "text-red-600" : "text-gray-400",
      bg: "bg-red-50", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
      href: `/${locale}/admin/tasks`,
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {isEn ? "Dashboard" : "لوحة القيادة"}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isEn
              ? `${format(now, "EEEE, MMMM d yyyy", { locale: dateLocale })}`
              : `${format(now, "EEEE، d MMMM yyyy", { locale: dateLocale })}`}
          </p>
        </div>
        <Link
          href={`/${locale}/admin/tasks`}
          className="flex items-center gap-2 bg-nassayem text-white px-4 py-2.5 rounded-xl font-medium shadow-sm hover:bg-nassayem/90 transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          {isEn ? "All Tasks" : "جميع المهام"}
        </Link>
      </div>

      {/* Stat cards */}
      <div className={`grid gap-4 ${statCards.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {statCards.map((s) => (
          <Link key={s.labelEn} href={s.href} className={`${s.bg} rounded-2xl p-5 flex items-center gap-4 hover:opacity-90 transition-opacity border border-white`}>
            <div className={`w-12 h-12 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm`}>
              <svg className={`w-6 h-6 ${s.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={s.icon} />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">{isEn ? s.labelEn : s.labelAr}</p>
              <p className={`text-3xl font-extrabold leading-none mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Active tasks list */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-base font-bold text-gray-900">
            {isEn ? "Active Tasks" : "المهام النشطة"}
          </h3>
          <Link href={`/${locale}/admin/tasks`} className="text-sm text-nassayem font-semibold hover:underline">
            {isEn ? "View All →" : "← عرض الكل"}
          </Link>
        </div>

        {recentTasks.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            <svg className="w-10 h-10 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            {isEn ? "No active tasks." : "لا توجد مهام نشطة."}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentTasks.map((task) => {
              const isOverdue = new Date(task.dueDate) < now;
              return (
                <li key={task.id}>
                  <Link
                    href={`/${locale}/admin/tasks?taskId=${task.id}`}
                    className="flex items-start gap-3 px-4 md:px-6 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    {/* Priority dot */}
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                      task.priority === "URGENT" ? "bg-red-500" :
                      task.priority === "HIGH"   ? "bg-orange-400" :
                      task.priority === "MEDIUM" ? "bg-blue-400" : "bg-gray-300"
                    }`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${taskStatusStyles[task.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {taskStatusLabel(task.status, isEn)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-400">{taskTypeLabel(task.type, isEn)}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-400">
                          {isEn ? task.building?.nameEn : task.building?.nameAr}
                          {task.unitNumber && ` — ${task.unitNumber}`}
                        </span>
                        {isSupervisor && task.assignedTo && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="text-xs text-gray-400">
                              {task.assignedTo.name ?? task.assignedTo.email.split("@")[0]}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Due date */}
                    <div className={`shrink-0 text-xs font-medium ${isOverdue ? "text-red-500" : "text-gray-400"}`}>
                      {format(new Date(task.dueDate), "MMM d", { locale: dateLocale })}
                      {isOverdue && (
                        <span className="ms-1 text-red-400">{isEn ? "(overdue)" : "(متأخرة)"}</span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Quick links */}
      {isSupervisor && (
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/${locale}/admin/tasks/new`}
            className="flex items-center gap-2 justify-center bg-white border border-gray-200 hover:border-nassayem/40 hover:bg-nassayem/5 text-gray-700 hover:text-nassayem px-4 py-3 rounded-xl font-medium text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            {isEn ? "New Task" : "مهمة جديدة"}
          </Link>
          <Link
            href={`/${locale}/admin/tasks/approvals`}
            className="flex items-center gap-2 justify-center bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 text-yellow-800 px-4 py-3 rounded-xl font-medium text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {isEn ? "Approvals" : "الموافقات"}
          </Link>
        </div>
      )}
    </div>
  );
}
