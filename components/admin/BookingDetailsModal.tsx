"use client";

import { useState } from "react";
import { format, differenceInDays } from "date-fns";
import { enUS, ar } from "date-fns/locale";
import Image from "next/image";

type BookingDetailsModalProps = {
  booking: any; // Passing the full booking object from Prisma (including unit and building)
  locale: string;
};

export default function BookingDetailsModal({
  booking,
  locale,
}: BookingDetailsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isEn = locale === "en";
  const dateLocale = isEn ? enUS : ar;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-200 transition-colors text-xs font-bold shadow-sm"
      >
        {isEn ? "Details" : "التفاصيل"}
      </button>
    );
  }

  // Calculate nights
  const checkInDate = new Date(booking.checkIn);
  const checkOutDate = new Date(booking.checkOut);
  const totalNights = differenceInDays(checkOutDate, checkInDate);

  // Status Colors
  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    CONFIRMED: "bg-green-100 text-green-800",
    COMPLETED: "bg-blue-100 text-blue-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  return (
    <>
      {/* Trigger Button (Active State) */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-gray-200 text-gray-800 transition-colors text-xs font-bold shadow-inner"
      >
        {isEn ? "Viewing..." : "يتم العرض..."}
      </button>

      {/* Modal Backdrop */}
      <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
        {/* Modal Content Box */}
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] text-start">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isEn ? "Booking Details" : "تفاصيل الحجز"}
              </h2>
              <p className="text-xs text-gray-500 font-mono mt-1">
                ID: {booking.id}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Body (Scrollable if too tall) */}
          <div className="p-6 md:p-8 overflow-y-auto space-y-8 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Guest & Status */}
              <div className="space-y-6">
                {/* Status Badge */}
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    {isEn ? "Current Status" : "الحالة الحالية"}
                  </h3>
                  <span
                    className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold ${statusColors[booking.status]}`}
                  >
                    {booking.status}
                  </span>
                </div>

                {/* Guest Info */}
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                    {isEn ? "Guest Information" : "معلومات الضيف"}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-nassayem/10 text-nassayem rounded-full flex items-center justify-center font-bold text-lg">
                        {booking.guestName.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-gray-900">
                        {booking.guestName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg
                        className="w-4 h-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      <a
                        href={`mailto:${booking.guestEmail}`}
                        className="hover:text-nassayem"
                      >
                        {booking.guestEmail}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg
                        className="w-4 h-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                      <a
                        href={`tel:${booking.guestPhone}`}
                        className="hover:text-nassayem"
                      >
                        {booking.guestPhone}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Dates */}
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                    {isEn ? "Reservation Timeline" : "الجدول الزمني للحجز"}
                  </h3>
                  <div className="flex justify-between items-center text-sm font-medium text-gray-900 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="text-start">
                      <p className="text-xs text-gray-500 mb-1">
                        {isEn ? "Check-in" : "الدخول"}
                      </p>
                      {format(checkInDate, "dd MMM yyyy", {
                        locale: dateLocale,
                      })}
                    </div>
                    <div className="flex flex-col items-center px-4">
                      <span className="text-xs font-bold text-nassayem bg-nassayem/10 px-2 py-1 rounded-full mb-1">
                        {totalNights} {isEn ? "Nights" : "ليالي"}
                      </span>
                      <div className="w-full h-px bg-gray-300 relative">
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-gray-400 rounded-full rtl:left-0 rtl:right-auto"></div>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="text-xs text-gray-500 mb-1">
                        {isEn ? "Check-out" : "الخروج"}
                      </p>
                      {format(checkOutDate, "dd MMM yyyy", {
                        locale: dateLocale,
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Property & Financials */}
              <div className="space-y-6">
                {/* Property Details */}
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                    {isEn ? "Property" : "العقار"}
                  </h3>
                  <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden shrink-0 relative">
                      {booking.unit.images && booking.unit.images[0] ? (
                        <Image
                          src={booking.unit.images[0].url}
                          alt="Unit"
                          width={100}
                          height={100}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <svg
                            className="w-8 h-8"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-bold mb-0.5">
                        {isEn
                          ? booking.unit.building.nameEn
                          : booking.unit.building.nameAr}
                      </p>
                      <h4 className="font-bold text-gray-900 leading-tight">
                        {isEn ? booking.unit.titleEn : booking.unit.titleAr}
                      </h4>
                    </div>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="bg-gray-900 text-white p-6 rounded-2xl shadow-inner">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-700 pb-3">
                    {isEn ? "Payment Details" : "تفاصيل الدفع"}
                  </h3>

                  <div className="space-y-3 text-sm text-gray-300">
                    <div className="flex justify-between items-center">
                      <span>
                        {isEn ? "Total Price Recorded" : "إجمالي السعر المسجل"}
                      </span>
                      <span className="font-mono">
                        {booking.totalPrice} OMR
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-end">
                    <span className="font-bold text-gray-100">
                      {isEn ? "Amount Due" : "المبلغ المستحق"}
                    </span>
                    <span className="text-3xl font-extrabold text-white">
                      {booking.totalPrice}{" "}
                      <span className="text-sm font-medium text-gray-400">
                        OMR
                      </span>
                    </span>
                  </div>
                </div>

                <div className="text-xs text-gray-400 text-center">
                  {isEn ? "Requested on: " : "تاريخ الطلب: "}
                  {format(new Date(booking.createdAt), "dd MMM yyyy, HH:mm", {
                    locale: dateLocale,
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
