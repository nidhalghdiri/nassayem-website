import Link from "next/link";
import prisma from "@/lib/prisma";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ id?: string }>;
};

export default async function NetsuitePayErrorPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const { id } = await searchParams;
  const isEn = locale === "en";

  // If we have an id, fetch the original token so the customer can retry
  const payment = id
    ? await prisma.netsuitePayment.findUnique({ where: { id } })
    : null;

  // Only allow retry if the link is still valid (PENDING or FAILED, not expired/voided/paid)
  const canRetry =
    payment &&
    (payment.status === "PENDING" || payment.status === "FAILED") &&
    payment.expiresAt.getTime() > Date.now();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-lg border border-gray-100 text-center">
        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
          {isEn ? "Payment Failed" : "فشل الدفع"}
        </h1>

        <p className="text-gray-500 mb-8 leading-relaxed">
          {isEn
            ? "Your payment could not be completed. No money has been charged. You can try again or contact our reception."
            : "تعذر إتمام عملية الدفع. لم يتم خصم أي مبلغ. يمكنك إعادة المحاولة أو التواصل مع الاستقبال."}
        </p>

        <div className="space-y-3">
          {canRetry && payment && (
            <Link
              href={`/${locale}/pay/${payment.token}`}
              className="block w-full bg-nassayem text-white py-3.5 rounded-xl font-bold hover:bg-nassayem-dark transition-colors"
            >
              {isEn ? "Try Again" : "إعادة المحاولة"}
            </Link>
          )}
          <Link
            href="https://wa.me/96899551237"
            className="block w-full bg-green-600 text-white py-3.5 rounded-xl font-bold hover:bg-green-700 transition-colors"
          >
            {isEn ? "Contact Us on WhatsApp" : "تواصل معنا على واتساب"}
          </Link>
          <Link
            href={`/${locale}`}
            className="block w-full bg-gray-100 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition-colors"
          >
            {isEn ? "Return to Home" : "العودة للرئيسية"}
          </Link>
        </div>
      </div>
    </div>
  );
}
