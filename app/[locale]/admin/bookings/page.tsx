import prisma from "@/lib/prisma";
import BookingStatusSelect from "@/components/admin/BookingStatusSelect";
import { format } from "date-fns";
import { enUS, ar } from "date-fns/locale";
import BookingDetailsModal from "@/components/admin/BookingDetailsModal";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminBookingsPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  // Fetch all bookings, newest first
  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      unit: {
        include: {
          building: true,
          images: { take: 1, orderBy: { displayOrder: "asc" } }, // <-- Add this line to grab the cover image
        },
      },
    },
  });

  const dateLocale = isEn ? enUS : ar;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {isEn ? "Reservations" : "الحجوزات"}
          </h1>
          <p className="text-gray-500 mt-1">
            {isEn
              ? "Manage all incoming and confirmed stays."
              : "إدارة جميع الإقامات الواردة والمؤكدة."}
          </p>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-10 h-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {isEn ? "No bookings yet" : "لا توجد حجوزات بعد"}
            </h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              {isEn
                ? "When guests request a stay, it will appear here."
                : "عندما يطلب الضيوف إقامة، ستظهر هنا."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-4 font-semibold text-start">
                    {isEn ? "Guest & Contact" : "الضيف وجهة الاتصال"}
                  </th>
                  <th className="px-6 py-4 font-semibold text-start">
                    {isEn ? "Property" : "العقار"}
                  </th>
                  <th className="px-6 py-4 font-semibold text-start">
                    {isEn ? "Dates" : "التواريخ"}
                  </th>
                  <th className="px-6 py-4 font-semibold text-start">
                    {isEn ? "Amount" : "المبلغ"}
                  </th>
                  <th className="px-6 py-4 font-semibold text-start">
                    {isEn ? "Status" : "الحالة"}
                  </th>
                  <th className="px-6 py-4 font-semibold text-end">
                    {isEn ? "Action" : "الإجراء"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Guest Info */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">
                        {booking.guestName}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex flex-col gap-0.5">
                        <a
                          href={`mailto:${booking.guestEmail}`}
                          className="hover:text-nassayem transition-colors"
                        >
                          {booking.guestEmail}
                        </a>
                        <a
                          href={`https://wa.me/${booking.guestPhone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-green-600 hover:text-green-700 transition-colors flex items-center gap-1"
                        >
                          <svg
                            className="w-3 h-3"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                          </svg>
                          {booking.guestPhone}
                        </a>
                      </div>
                    </td>

                    {/* Property Info */}
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-900 line-clamp-1">
                        {isEn ? booking.unit.titleEn : booking.unit.titleAr}
                      </div>
                      <div className="text-xs text-gray-500 line-clamp-1">
                        {isEn
                          ? booking.unit.building.nameEn
                          : booking.unit.building.nameAr}
                      </div>
                    </td>

                    {/* Dates */}
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="font-medium whitespace-nowrap">
                        {format(new Date(booking.checkIn), "MMM dd, yyyy", {
                          locale: dateLocale,
                        })}
                      </div>
                      <div className="text-gray-400 text-xs">
                        to{" "}
                        {format(new Date(booking.checkOut), "MMM dd, yyyy", {
                          locale: dateLocale,
                        })}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="px-6 py-4">
                      <span className="font-extrabold text-gray-900">
                        {booking.totalPrice}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">
                        {isEn ? "OMR" : "ر.ع"}
                      </span>
                    </td>

                    {/* Status Dropdown */}
                    <td className="px-6 py-4">
                      <BookingStatusSelect
                        bookingId={booking.id}
                        currentStatus={booking.status}
                        locale={locale}
                      />
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-end">
                      <BookingDetailsModal booking={booking} locale={locale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
