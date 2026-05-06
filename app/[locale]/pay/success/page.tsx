import Link from "next/link";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { format } from "date-fns";
import { enUS, ar } from "date-fns/locale";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ id?: string }>;
};

export default async function NetsuitePaySuccessPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const { id } = await searchParams;
  const isEn = locale === "en";
  const dateLocale = isEn ? enUS : ar;

  if (!id) return notFound();

  const payment = await prisma.netsuitePayment.findUnique({ where: { id } });
  if (!payment) return notFound();

  const fmtDate = (d: Date | null) =>
    d ? format(d, "EEE, d MMM yyyy", { locale: dateLocale }) : "—";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-lg border border-gray-100 text-center">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
          {isEn ? "Payment Successful!" : "تمت عملية الدفع!"}
        </h1>

        <p className="text-gray-500 mb-8 leading-relaxed">
          {isEn
            ? `Thank you, ${payment.customerName}. Your payment of ${payment.amount.toFixed(3)} ${payment.currency} has been received. A receipt has been sent to your email.`
            : `شكراً لك، ${payment.customerName}. تم استلام دفعتك بقيمة ${payment.amount.toFixed(3)} ${payment.currency}. تم إرسال إيصال إلى بريدك الإلكتروني.`}
        </p>

        <div className="bg-gray-50 rounded-xl p-4 text-start mb-6 text-sm border border-gray-100 space-y-3">
          {payment.netsuiteReservationRef && (
            <div className="flex justify-between items-center">
              <p className="text-gray-500">
                {isEn ? "Reservation" : "الحجز"}
              </p>
              <p className="font-mono font-bold text-nassayem">
                {payment.netsuiteReservationRef}
              </p>
            </div>
          )}
          <div className="flex justify-between items-center">
            <p className="text-gray-500">
              {isEn ? "Amount Paid" : "المبلغ المدفوع"}
            </p>
            <p className="font-bold text-nassayem">
              {payment.amount.toFixed(3)} {payment.currency}
            </p>
          </div>
          {payment.paidAt && (
            <div className="flex justify-between items-center">
              <p className="text-gray-500">
                {isEn ? "Paid on" : "تاريخ الدفع"}
              </p>
              <p className="font-semibold text-gray-700">
                {fmtDate(payment.paidAt)}
              </p>
            </div>
          )}
          {payment.smartpayBankRefNo && (
            <div className="flex justify-between items-center pt-3 border-t border-gray-100">
              <p className="text-gray-500">
                {isEn ? "Bank Ref" : "مرجع البنك"}
              </p>
              <p className="font-mono text-xs text-gray-700">
                {payment.smartpayBankRefNo}
              </p>
            </div>
          )}
        </div>

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
