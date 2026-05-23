"use client";

import { useTransition } from "react";
import { updateBookingStatus } from "@/app/actions/booking";
import { BookingStatus } from "@prisma/client";

type Props = {
  bookingId: string;
  currentStatus: BookingStatus;
  locale: string;
  paymentMethod: string;
};

const colorMap: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  CONFIRMED: "bg-green-100 text-green-800 border-green-200",
  COMPLETED: "bg-blue-100 text-blue-800 border-blue-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
  REFUNDED: "bg-purple-100 text-purple-800 border-purple-200",
};

const labelMap: Record<string, { en: string; ar: string }> = {
  PENDING: { en: "Pending", ar: "قيد الانتظار" },
  CONFIRMED: { en: "Confirmed", ar: "مؤكد" },
  COMPLETED: { en: "Completed", ar: "مكتمل" },
  CANCELLED: { en: "Cancelled", ar: "ملغي" },
  REFUNDED: { en: "Refunded", ar: "مُسترد" },
};

export default function BookingStatusSelect({
  bookingId,
  currentStatus,
  locale,
  paymentMethod,
}: Props) {
  const isEn = locale === "en";
  const [isPending, startTransition] = useTransition();

  // Online (CARD) bookings are owned by the SmartPay webhook — admins
  // cannot flip the status manually. Render a read-only badge instead.
  if (paymentMethod === "CARD") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${colorMap[currentStatus]}`}
        title={
          isEn
            ? "Online-paid booking — status is set automatically by SmartPay"
            : "حجز مدفوع إلكترونياً — يتم تعيين الحالة تلقائياً من SmartPay"
        }
      >
        <svg className="w-3 h-3 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <span>{isEn ? labelMap[currentStatus]?.en : labelMap[currentStatus]?.ar}</span>
      </div>
    );
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as BookingStatus;
    startTransition(async () => {
      try {
        await updateBookingStatus(bookingId, newStatus, locale);
      } catch (err: any) {
        alert(err?.message || (isEn ? "Failed to update status" : "فشل تحديث الحالة"));
      }
    });
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

      {isPending && (
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
          <svg
            className="animate-spin h-3 w-3 text-current opacity-70"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
