"use client";

import { useState, useTransition } from "react";
import { startNetsuitePaymentCheckout } from "@/app/actions/netsuitePayment";

type Props = {
  token: string;
  locale: string;
  initialEmail: string | null;
  amount: number;
  currency: string;
};

export default function NetsuitePaymentForm({
  token,
  locale,
  initialEmail,
  amount,
  currency,
}: Props) {
  const isEn = locale === "en";
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [agreed, setAgreed] = useState(false);

  // Hidden auto-submitting form for the SmartPay redirect
  const [paymentData, setPaymentData] = useState<{
    url: string;
    accessCode: string;
    encRequest: string;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!agreed) {
      setError(
        isEn
          ? "Please confirm you agree to proceed with the payment."
          : "يرجى تأكيد موافقتك للمتابعة بعملية الدفع.",
      );
      return;
    }

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const result = await startNetsuitePaymentCheckout(
          token,
          formData,
          locale,
        );
        if (result.success) {
          setPaymentData({
            url: result.paymentUrl!,
            accessCode: result.accessCode!,
            encRequest: result.encRequest!,
          });
          setTimeout(() => {
            const form = document.getElementById(
              "smartpay-form",
            ) as HTMLFormElement | null;
            form?.submit();
          }, 100);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : isEn
              ? "An error occurred."
              : "حدث خطأ ما.",
        );
      }
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 font-medium text-sm">
            {error}
          </div>
        )}

        {/* Email */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            {isEn ? "Email Address" : "البريد الإلكتروني"}{" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="customerEmail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="email@example.com"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all"
            dir="ltr"
          />
          <p className="text-xs text-gray-400 mt-1">
            {isEn
              ? "We'll send your payment receipt to this email."
              : "سنرسل إيصال الدفع إلى هذا البريد."}
          </p>
        </div>

        {/* Confirmation checkbox */}
        <label className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer hover:border-nassayem transition-colors">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-5 h-5 rounded border-gray-300 text-nassayem focus:ring-nassayem accent-nassayem shrink-0"
          />
          <span className="text-sm text-gray-700 leading-relaxed">
            {isEn
              ? `I confirm that the details above are correct and authorize the payment of ${amount.toFixed(3)} ${currency}.`
              : `أؤكد أن التفاصيل أعلاه صحيحة وأوافق على دفع ${amount.toFixed(3)} ${currency}.`}
          </span>
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-nassayem text-white py-4 rounded-xl font-bold text-lg hover:bg-nassayem-dark transition-colors flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-white"
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
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {isEn ? "Redirecting to bank…" : "جارٍ التوجيه للبنك…"}
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
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
                ? `Pay ${amount.toFixed(3)} ${currency}`
                : `ادفع ${amount.toFixed(3)} ${currency}`}
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-400 leading-relaxed">
          {isEn
            ? "You will be redirected to Bank Muscat's secure SmartPay page."
            : "سيتم توجيهك إلى صفحة SmartPay الآمنة لبنك مسقط."}
        </p>
      </form>

      {/* Hidden SmartPay form */}
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
