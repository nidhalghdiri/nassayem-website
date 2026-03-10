"use client";

import { useTransition } from "react";
import { updateBookingStatus } from "@/app/actions/booking";
import { BookingStatus } from "@prisma/client";

type Props = {
  bookingId: string;
  currentStatus: BookingStatus;
  locale: string;
};

export default function BookingStatusSelect({
  bookingId,
  currentStatus,
  locale,
}: Props) {
  const isEn = locale === "en";
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as BookingStatus;
    startTransition(() => {
      updateBookingStatus(bookingId, newStatus, locale);
    });
  };

  // Color mapping based on status
  const colorMap = {
    PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
    CONFIRMED: "bg-green-100 text-green-800 border-green-200",
    COMPLETED: "bg-blue-100 text-blue-800 border-blue-200",
    CANCELLED: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <div className="relative inline-block w-full min-w-[130px]">
      <select
        value={currentStatus}
        onChange={handleStatusChange}
        disabled={isPending}
        className={`w-full appearance-none px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors ${colorMap[currentStatus]} ${isPending ? "opacity-50" : "opacity-100"}`}
      >
        <option value="PENDING">{isEn ? "Pending" : "قيد الانتظار"}</option>
        <option value="CONFIRMED">{isEn ? "Confirmed" : "مؤكد"}</option>
        <option value="COMPLETED">{isEn ? "Completed" : "مكتمل"}</option>
        <option value="CANCELLED">{isEn ? "Cancelled" : "ملغي"}</option>
      </select>

      {/* Loading Spinner overlay */}
      {isPending && (
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
          <svg
            className="animate-spin h-3 w-3 text-current opacity-70"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      )}
    </div>
  );
}
