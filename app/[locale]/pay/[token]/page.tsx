import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { enUS, ar } from "date-fns/locale";
import NetsuitePaymentForm from "@/components/properties/NetsuitePaymentForm";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ locale: string; token: string }>;
};

export default async function NetsuitePayPage({ params }: PageProps) {
  const { locale, token } = await params;
  const isEn = locale === "en";
  const dateLocale = isEn ? enUS : ar;

  const payment = await prisma.netsuitePayment.findUnique({
    where: { token },
  });

  if (!payment) return notFound();

  // Auto-expire if past expiry but still PENDING
  const isExpiredNow =
    payment.status === "PENDING" && payment.expiresAt.getTime() < Date.now();

  // Render an "unavailable" view for any non-payable state
  const isUnavailable =
    payment.status !== "PENDING" || isExpiredNow;

  if (isUnavailable) {
    const reason = (() => {
      if (payment.status === "PAID") {
        return {
          title: isEn ? "Payment already completed" : "تم الدفع بالفعل",
          message: isEn
            ? "This payment has already been processed. If you have any questions, please contact our reception."
            : "تمت معالجة هذه الدفعة بالفعل. إذا كانت لديك أي استفسارات، يرجى التواصل مع الاستقبال.",
          icon: "check",
          tone: "success",
        };
      }
      if (payment.status === "VOIDED") {
        return {
          title: isEn ? "Payment link cancelled" : "تم إلغاء رابط الدفع",
          message: isEn
            ? "This payment link has been cancelled. Please contact our reception for a new one."
            : "تم إلغاء رابط الدفع. يرجى التواصل مع الاستقبال للحصول على رابط جديد.",
          icon: "x",
          tone: "neutral",
        };
      }
      // EXPIRED or "PENDING but past expiry"
      return {
        title: isEn ? "Payment link expired" : "انتهت صلاحية الرابط",
        message: isEn
          ? "This payment link has expired. Please contact our reception to receive a new one."
          : "انتهت صلاحية رابط الدفع. يرجى التواصل مع الاستقبال للحصول على رابط جديد.",
        icon: "clock",
        tone: "warning",
      };
    })();

    const toneClasses =
      reason.tone === "success"
        ? "bg-green-100 text-green-600"
        : reason.tone === "warning"
          ? "bg-amber-100 text-amber-600"
          : "bg-gray-100 text-gray-500";

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-lg border border-gray-100 text-center">
          <div
            className={`w-20 h-20 ${toneClasses} rounded-full flex items-center justify-center mx-auto mb-6`}
          >
            <svg
              className="w-10 h-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {reason.icon === "check" && (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="M5 13l4 4L19 7"
                />
              )}
              {reason.icon === "x" && (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M6 18L18 6M6 6l12 12"
                />
              )}
              {reason.icon === "clock" && (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              )}
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">
            {reason.title}
          </h1>
          <p className="text-gray-500 mb-8 leading-relaxed">{reason.message}</p>
          <Link
            href={`/${locale}`}
            className="block w-full bg-nassayem text-white py-3.5 rounded-xl font-bold hover:bg-nassayem-dark transition-colors"
          >
            {isEn ? "Visit Nassayem" : "زيارة نسائم"}
          </Link>
        </div>
      </div>
    );
  }

  // Payable: render the confirmation + form ──────────────────────────────────
  const fmtDate = (d: Date | null) =>
    d ? format(d, "EEE, d MMM yyyy", { locale: dateLocale }) : "—";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Brand header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {isEn ? "Nassayem Salalah" : "نسائم صلالة"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isEn ? "Secure payment" : "دفع آمن"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Amount banner */}
          <div className="bg-nassayem text-white p-8 text-center">
            <p className="text-xs font-semibold tracking-widest uppercase text-white/70 mb-2">
              {isEn ? "Amount Due" : "المبلغ المستحق"}
            </p>
            <p className="text-4xl md:text-5xl font-extrabold tracking-tight">
              {payment.amount.toFixed(3)}{" "}
              <span className="text-2xl font-bold text-white/80">
                {payment.currency}
              </span>
            </p>
            {payment.netsuiteReservationRef && (
              <p className="mt-3 text-sm text-white/80">
                {isEn ? "Reservation" : "الحجز"}:{" "}
                <span className="font-mono font-bold">
                  {payment.netsuiteReservationRef}
                </span>
              </p>
            )}
          </div>

          {/* Reservation details */}
          <div className="p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                {isEn ? "Reservation details" : "تفاصيل الحجز"}
              </h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">
                    {isEn ? "Customer" : "العميل"}
                  </dt>
                  <dd className="font-semibold text-gray-900 text-end">
                    {payment.customerName}
                  </dd>
                </div>
                {payment.customerPhone && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">
                      {isEn ? "Phone" : "الهاتف"}
                    </dt>
                    <dd className="font-semibold text-gray-900" dir="ltr">
                      {payment.customerPhone}
                    </dd>
                  </div>
                )}
                {payment.unitCode && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">
                      {isEn ? "Unit" : "الوحدة"}
                    </dt>
                    <dd className="font-mono font-semibold text-gray-900">
                      {payment.unitCode}
                    </dd>
                  </div>
                )}
                {payment.checkIn && payment.checkOut && (
                  <>
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-500">
                        {isEn ? "Check-in" : "تسجيل الدخول"}
                      </dt>
                      <dd className="font-semibold text-gray-900 text-end">
                        {fmtDate(payment.checkIn)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-500">
                        {isEn ? "Check-out" : "تسجيل الخروج"}
                      </dt>
                      <dd className="font-semibold text-gray-900 text-end">
                        {fmtDate(payment.checkOut)}
                      </dd>
                    </div>
                  </>
                )}
                {payment.description && (
                  <div className="pt-3 border-t border-gray-100">
                    <dt className="text-gray-500 mb-1">
                      {isEn ? "Description" : "الوصف"}
                    </dt>
                    <dd className="text-gray-700 leading-relaxed">
                      {payment.description}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Form */}
            <div className="border-t border-gray-100 pt-6">
              <NetsuitePaymentForm
                token={payment.token}
                locale={locale}
                initialEmail={payment.customerEmail}
                amount={payment.amount}
                currency={payment.currency}
              />
            </div>
          </div>
        </div>

        {/* Footer / trust */}
        <div className="mt-6 flex flex-col items-center gap-2 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            {isEn
              ? "Secured by Bank Muscat SmartPay"
              : "محمي عبر SmartPay بنك مسقط"}
          </div>
          <p className="text-center max-w-md leading-relaxed">
            {isEn
              ? "If anything looks incorrect, please contact our reception before paying."
              : "إذا كان هناك أي خطأ في التفاصيل، يرجى التواصل مع الاستقبال قبل الدفع."}
          </p>
        </div>
      </div>
    </div>
  );
}
