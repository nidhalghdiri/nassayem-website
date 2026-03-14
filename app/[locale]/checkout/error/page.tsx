import Link from "next/link";

type PageProps = {
  params: Promise<{ locale: string }>;
};
// Done

export default async function CheckoutErrorPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-lg border border-gray-100 text-center">
        {/* Red X Icon */}
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-extrabold text-gray-900 mb-4">
          {isEn ? "Payment Failed" : "فشلت عملية الدفع"}
        </h1>

        <p className="text-gray-500 mb-8 leading-relaxed">
          {isEn
            ? "Unfortunately, we couldn't process your payment. This might be due to a declined card or a connection issue. Your reservation has not been confirmed."
            : "عذراً، لم نتمكن من معالجة عملية الدفع الخاصة بك. قد يكون هذا بسبب رفض البطاقة أو مشكلة في الاتصال. لم يتم تأكيد حجزك."}
        </p>

        <div className="space-y-3">
          <Link
            href={`/${locale}`}
            className="block w-full bg-nassayem text-white py-3.5 rounded-xl font-bold hover:bg-nassayem-dark transition-colors"
          >
            {isEn ? "Return to Home" : "العودة للرئيسية"}
          </Link>
          <p className="text-xs text-gray-400 mt-4">
            {isEn
              ? "Need help? Contact our support team."
              : "بحاجة للمساعدة؟ تواصل مع فريق الدعم."}
          </p>
        </div>
      </div>
    </div>
  );
}
