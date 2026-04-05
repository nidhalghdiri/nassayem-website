import prisma from "@/lib/prisma";
import BookingStatusSelect from "@/components/admin/BookingStatusSelect";
import BookingDetailsModal from "@/components/admin/BookingDetailsModal";
import DeleteBookingButton from "@/components/admin/DeleteBookingButton";
import BookingSearchBar from "@/components/admin/BookingSearchBar";
import { format } from "date-fns";
import { enUS, ar } from "date-fns/locale";
import Link from "next/link";
import type { BookingStatus } from "@prisma/client";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
};

const statusStyles: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-green-100 text-green-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-red-100 text-red-700",
  REFUNDED: "bg-gray-100 text-gray-500",
};

const statusLabels: Record<string, { en: string; ar: string }> = {
  PENDING: { en: "Pending", ar: "قيد الانتظار" },
  CONFIRMED: { en: "Confirmed", ar: "مؤكد" },
  COMPLETED: { en: "Completed", ar: "مكتمل" },
  CANCELLED: { en: "Cancelled", ar: "ملغي" },
  REFUNDED: { en: "Refunded", ar: "مُسترد" },
};

const filterTabs = [
  { key: "all", en: "All", ar: "الكل" },
  { key: "PENDING", en: "Pending", ar: "انتظار" },
  { key: "CONFIRMED", en: "Confirmed", ar: "مؤكد" },
  { key: "COMPLETED", en: "Completed", ar: "مكتمل" },
  { key: "CANCELLED", en: "Cancelled", ar: "ملغي" },
];

export default async function AdminBookingsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { status: rawStatus, q: searchQuery } = await searchParams;
  const isEn = locale === "en";
  const dateLocale = isEn ? enUS : ar;

  const activeFilter = rawStatus?.toUpperCase() ?? "ALL";

  // Build Prisma where clause combining status filter + text search
  const whereClause: Record<string, unknown> = {};
  if (activeFilter !== "ALL") whereClause.status = activeFilter as BookingStatus;
  if (searchQuery?.trim()) {
    whereClause.OR = [
      { guestName: { contains: searchQuery.trim(), mode: "insensitive" } },
      { guestPhone: { contains: searchQuery.trim() } },
      { bookingCode: { contains: searchQuery.trim(), mode: "insensitive" } },
    ];
  }

  const bookings = await prisma.booking.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      unit: {
        include: {
          building: true,
          images: { take: 1, orderBy: { displayOrder: "asc" } },
        },
      },
    },
  });

  // Count per status for badge numbers (unfiltered)
  const counts = await prisma.booking.groupBy({
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
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {isEn ? "Bookings" : "الحجوزات"}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          {isEn
            ? `${countMap["ALL"] ?? 0} total reservations`
            : `${countMap["ALL"] ?? 0} حجز إجمالاً`}
        </p>
      </div>

      {/* Filter tabs + Search bar */}
      <div className="flex flex-col gap-3">
        {/* Status tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {filterTabs.map((tab) => {
            const isActive = tab.key === "all" ? activeFilter === "ALL" : activeFilter === tab.key;
            const count = countMap[tab.key === "all" ? "ALL" : tab.key] ?? 0;
            // Preserve search query when switching tabs
            const href = `/${locale}/admin/bookings${
              tab.key === "all" ? "" : `?status=${tab.key}`
            }${searchQuery ? `${tab.key === "all" ? "?" : "&"}q=${encodeURIComponent(searchQuery)}` : ""}`;
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
                  <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                  }`}>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Search bar */}
        <BookingSearchBar
          isEn={isEn}
          currentQ={searchQuery ?? ""}
          currentStatus={activeFilter}
        />
      </div>

      {/* Bookings list */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {isEn ? "No bookings found" : "لا توجد حجوزات"}
            </h3>
            <p className="text-gray-500 text-sm max-w-xs">
              {searchQuery
                ? isEn
                  ? `No results for "${searchQuery}".`
                  : `لا توجد نتائج لـ "${searchQuery}".`
                : activeFilter !== "ALL"
                  ? isEn ? "No bookings with this status." : "لا توجد حجوزات بهذه الحالة."
                  : isEn ? "When guests make a reservation, it will appear here." : "عندما يقوم الضيوف بحجز، ستظهر هنا."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                    <th className="px-4 py-4 font-semibold text-start">{isEn ? "Booking #" : "رقم الحجز"}</th>
                    <th className="px-4 py-4 font-semibold text-start">{isEn ? "Guest" : "الضيف"}</th>
                    <th className="px-4 py-4 font-semibold text-start">{isEn ? "Property" : "العقار"}</th>
                    <th className="px-4 py-4 font-semibold text-start">{isEn ? "Dates" : "التواريخ"}</th>
                    <th className="px-4 py-4 font-semibold text-start">{isEn ? "Amount" : "المبلغ"}</th>
                    <th className="px-4 py-4 font-semibold text-start">{isEn ? "Status" : "الحالة"}</th>
                    <th className="px-4 py-4 font-semibold text-end">{isEn ? "Actions" : "إجراءات"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* Booking code */}
                      <td className="px-4 py-4">
                        <span className="font-mono text-xs font-bold text-nassayem bg-nassayem/5 px-2 py-1 rounded-lg whitespace-nowrap">
                          {booking.bookingCode ?? booking.id.slice(0, 8).toUpperCase()}
                        </span>
                        <div className="text-xs text-gray-400 mt-1">
                          {booking.paymentMethod === "CASH"
                            ? isEn ? "Cash" : "نقدي"
                            : isEn ? "Card" : "بطاقة"}
                        </div>
                      </td>

                      {/* Guest */}
                      <td className="px-4 py-4">
                        <div className="font-bold text-gray-900 text-sm">{booking.guestName}</div>
                        <div className="text-xs text-gray-400 mt-1 flex flex-col gap-0.5">
                          <a href={`mailto:${booking.guestEmail}`} className="hover:text-nassayem transition-colors">
                            {booking.guestEmail}
                          </a>
                          <a
                            href={`https://wa.me/${booking.guestPhone.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-green-600 hover:text-green-700 flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                            {booking.guestPhone}
                          </a>
                        </div>
                      </td>

                      {/* Property */}
                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-gray-900 line-clamp-1">
                          {isEn ? booking.unit.titleEn : booking.unit.titleAr}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {isEn ? booking.unit.building.nameEn : booking.unit.building.nameAr}
                        </div>
                      </td>

                      {/* Dates */}
                      <td className="px-4 py-4 text-sm">
                        <div className="font-medium text-gray-800 whitespace-nowrap">
                          {format(new Date(booking.checkIn), "MMM d, yyyy", { locale: dateLocale })}
                        </div>
                        <div className="text-xs text-gray-400">
                          → {format(new Date(booking.checkOut), "MMM d, yyyy", { locale: dateLocale })}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-4">
                        <span className="font-extrabold text-gray-900">{booking.totalPrice}</span>
                        <span className="text-xs text-gray-400 ms-1">{isEn ? "OMR" : "ر.ع"}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <BookingStatusSelect bookingId={booking.id} currentStatus={booking.status} locale={locale} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <BookingDetailsModal booking={booking} locale={locale} />
                          <DeleteBookingButton
                            bookingId={booking.id}
                            guestName={booking.guestName}
                            locale={locale}
                            isEn={isEn}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile + tablet cards */}
            <div className="divide-y divide-gray-100 lg:hidden">
              {bookings.map((booking) => (
                <div key={booking.id} className="p-4 space-y-3">
                  {/* Booking code + status */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-mono text-xs font-bold text-nassayem bg-nassayem/5 px-2 py-1 rounded-lg">
                        {booking.bookingCode ?? booking.id.slice(0, 8).toUpperCase()}
                      </span>
                      <p className="font-bold text-gray-900 text-sm mt-1.5">{booking.guestName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {isEn ? booking.unit.titleEn : booking.unit.titleAr}
                      </p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 text-xs font-bold rounded-full ${statusStyles[booking.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {isEn ? statusLabels[booking.status]?.en : statusLabels[booking.status]?.ar}
                    </span>
                  </div>

                  {/* Contact */}
                  <div className="flex items-center gap-3 text-xs">
                    <a href={`mailto:${booking.guestEmail}`} className="text-gray-500 hover:text-nassayem transition-colors truncate">
                      {booking.guestEmail}
                    </a>
                    <a
                      href={`https://wa.me/${booking.guestPhone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-green-600 hover:text-green-700 flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                      </svg>
                      {booking.guestPhone}
                    </a>
                  </div>

                  {/* Dates + amount */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {format(new Date(booking.checkIn), "MMM d", { locale: dateLocale })}
                      {" → "}
                      {format(new Date(booking.checkOut), "MMM d, yyyy", { locale: dateLocale })}
                    </span>
                    <span className="font-bold text-gray-900">
                      {booking.totalPrice}{" "}
                      <span className="font-normal text-gray-400">{isEn ? "OMR" : "ر.ع"}</span>
                    </span>
                  </div>

                  {/* Status + Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <BookingStatusSelect bookingId={booking.id} currentStatus={booking.status} locale={locale} />
                    <div className="flex items-center gap-1">
                      <BookingDetailsModal booking={booking} locale={locale} />
                      <DeleteBookingButton
                        bookingId={booking.id}
                        guestName={booking.guestName}
                        locale={locale}
                        isEn={isEn}
                      />
                    </div>
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
