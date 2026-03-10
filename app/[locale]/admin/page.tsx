import Link from "next/link";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminDashboard({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  // Mock Data - In the future, these will be Prisma queries like:
  // const totalBuildings = await prisma.building.count();
  // const recentBookings = await prisma.booking.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
  const stats = [
    {
      titleEn: "Total Buildings",
      titleAr: "إجمالي المباني",
      value: "8",
      icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    },
    {
      titleEn: "Managed Units",
      titleAr: "الوحدات المدارة",
      value: "42",
      icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    },
    {
      titleEn: "Active Bookings",
      titleAr: "الحجوزات النشطة",
      value: "15",
      icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    },
    {
      titleEn: "Monthly Revenue (OMR)",
      titleAr: "الإيرادات الشهرية (ر.ع)",
      value: "8,450",
      icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    },
  ];

  const recentBookings = [
    {
      id: "BKG-001",
      guest: "Ahmed Salim",
      unit: "Saadah Tower 1 - Apt 402",
      checkIn: "2026-03-10",
      status: "CONFIRMED",
      amount: 150,
    },
    {
      id: "BKG-002",
      guest: "Sarah Johnson",
      unit: "Dahariz Villa",
      checkIn: "2026-03-12",
      status: "PENDING",
      amount: 450,
    },
    {
      id: "BKG-003",
      guest: "Mohammed Ali",
      unit: "Awqad Studio",
      checkIn: "2026-03-15",
      status: "CONFIRMED",
      amount: 75,
    },
  ];

  return (
    <div className="space-y-8">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {isEn ? "Dashboard Overview" : "نظرة عامة على لوحة القيادة"}
          </h1>
          <p className="text-gray-500 mt-1">
            {isEn
              ? "Welcome to Nassayem Salalah Management"
              : "مرحباً بك في إدارة نسائم صلالة"}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/${locale}/admin/buildings/new`}
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all text-sm"
          >
            {isEn ? "+ Add Building" : "+ إضافة مبنى"}
          </Link>
          <Link
            href={`/${locale}/admin/units/new`}
            className="bg-nassayem text-white hover:bg-nassayem-dark px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all text-sm"
          >
            {isEn ? "+ Add Unit" : "+ إضافة وحدة"}
          </Link>
        </div>
      </div>

      {/* 2. Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5"
          >
            <div className="w-14 h-14 bg-nassayem/10 text-nassayem rounded-xl flex items-center justify-center shrink-0">
              <svg
                className="w-7 h-7"
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
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">
                {isEn ? stat.titleEn : stat.titleAr}
              </p>
              <h3 className="text-2xl font-extrabold text-gray-900">
                {stat.value}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Recent Activity & Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Bookings Table (Takes up 2/3 of the space on desktop) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900">
              {isEn ? "Recent Bookings" : "أحدث الحجوزات"}
            </h3>
            <Link
              href={`/${locale}/admin/bookings`}
              className="text-sm text-nassayem font-semibold hover:underline"
            >
              {isEn ? "View All" : "عرض الكل"}
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">
                    {isEn ? "Guest" : "الضيف"}
                  </th>
                  <th className="px-6 py-4 font-medium">
                    {isEn ? "Unit" : "الوحدة"}
                  </th>
                  <th className="px-6 py-4 font-medium">
                    {isEn ? "Check In" : "الدخول"}
                  </th>
                  <th className="px-6 py-4 font-medium">
                    {isEn ? "Status" : "الحالة"}
                  </th>
                  <th className="px-6 py-4 font-medium text-end">
                    {isEn ? "Amount" : "المبلغ"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentBookings.map((booking, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 text-sm">
                        {booking.guest}
                      </div>
                      <div className="text-xs text-gray-500">{booking.id}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {booking.unit}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {booking.checkIn}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded-full ${
                          booking.status === "CONFIRMED"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 text-end">
                      {booking.amount} {isEn ? "OMR" : "ر.ع"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions / System Status (Takes up 1/3) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            {isEn ? "Quick Actions" : "إجراءات سريعة"}
          </h3>

          <div className="space-y-3 flex-1">
            <button className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-nassayem hover:bg-nassayem/5 transition-all text-start group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <span className="font-semibold text-gray-700 group-hover:text-nassayem transition-colors">
                  {isEn ? "Calendar View" : "عرض التقويم"}
                </span>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 rtl:rotate-180"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

            <button className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-nassayem hover:bg-nassayem/5 transition-all text-start group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                </div>
                <span className="font-semibold text-gray-700 group-hover:text-nassayem transition-colors">
                  {isEn ? "Create Manual Booking" : "إنشاء حجز يدوي"}
                </span>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 rtl:rotate-180"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
