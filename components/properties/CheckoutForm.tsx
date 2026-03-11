"use client";

import { useTransition, useState, useRef } from "react";
import { createBooking } from "@/app/actions/booking";

type CheckoutFormProps = {
  unitId: string;
  checkIn: string;
  checkOut: string;
  locale: string;
};

export default function CheckoutForm({
  unitId,
  checkIn,
  checkOut,
  locale,
}: CheckoutFormProps) {
  const isEn = locale === "en";
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [paymentData, setPaymentData] = useState<{
    url: string;
    accessCode: string;
    encRequest: string;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);

    startTransition(async () => {
      try {
        const result = await createBooking(
          formData,
          unitId,
          checkIn,
          checkOut,
          locale,
        );
        if (result.success) {
          // Set the payment data which will render the hidden form and auto-submit
          setPaymentData({
            url: result.paymentUrl!,
            accessCode: result.accessCode!,
            encRequest: result.encRequest!,
          });

          // Use a tiny timeout to ensure the hidden form renders before submitting
          setTimeout(() => {
            const form = document.getElementById(
              "smartpay-form",
            ) as HTMLFormElement | null;
            form?.submit();
          }, 100);
        }
      } catch (err: any) {
        setError(err.message || "An error occurred.");
      }
    });
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 mt-8"
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {isEn ? "Guest Details" : "تفاصيل الضيف"}
        </h2>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 font-medium">
            {error}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {isEn ? "Full Name" : "الاسم الكامل"}
            </label>
            <input
              type="text"
              name="guestName"
              required
              placeholder={isEn ? "e.g. Ahmed Salim" : "مثال: أحمد سالم"}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {isEn ? "Email Address" : "البريد الإلكتروني"}
              </label>
              <input
                type="email"
                name="guestEmail"
                required
                placeholder="email@example.com"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all dir-ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {isEn ? "Phone Number" : "رقم الهاتف"}
              </label>
              <input
                type="tel"
                name="guestPhone"
                required
                placeholder="+968 1234 5678"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all dir-ltr"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-nassayem text-white py-4 rounded-xl font-bold text-lg hover:bg-nassayem-dark transition-colors flex justify-center items-center disabled:opacity-50"
          >
            {isPending ? (
              <svg
                className="animate-spin h-6 w-6 text-white"
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
            ) : isEn ? (
              "Confirm & Request Booking"
            ) : (
              "تأكيد وطلب الحجز"
            )}
          </button>
          <p className="text-center text-gray-500 text-sm mt-4">
            {isEn
              ? "Your reservation will be held as Pending until confirmed by our team."
              : "سيتم تعليق حجزك كـ 'قيد الانتظار' حتى يتم تأكيده من قبل فريقنا."}
          </p>
        </div>
      </form>
      {/* Hidden form to POST to Bank Muscat [cite: 67, 103] */}
      {paymentData && (
        <form
          id="smartpay-form"
          method="POST"
          action={paymentData.url}
          className="hidden"
        >
          <input
            type="hidden"
            name="access_code"
            value={paymentData.accessCode}
          />
          <input
            type="hidden"
            name="encRequest"
            value={paymentData.encRequest}
          />
        </form>
      )}
    </>
  );
}
