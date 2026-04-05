import { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";
  return {
    title: isEn ? "Cancellation & Refund Policy | Nassayem Salalah" : "سياسة الإلغاء والاسترداد | نسائم صلالة",
    description: isEn
      ? "Understand our cancellation and refund policy for bookings at Nassayem Salalah furnished apartments."
      : "تعرف على سياسة الإلغاء واسترداد الأموال للحجوزات في شقق نسائم صلالة المفروشة.",
    alternates: {
      canonical: `https://www.nassayem.com/${locale}/refunds`,
      languages: { en: "https://www.nassayem.com/en/refunds", ar: "https://www.nassayem.com/ar/refunds" },
    },
  };
}

export default async function RefundsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === "en";

  return (
    <div className="max-w-3xl mx-auto py-16 px-4 sm:px-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        {isEn
          ? "Cancellation, Refund & Return Policy"
          : "سياسة الإلغاء والاسترجاع"}
      </h1>
      <div className="prose prose-gray max-w-none text-gray-600 space-y-6">
        <h2 className="text-xl font-bold text-gray-900">
          {isEn ? "Cancellations" : "الإلغاء"}
        </h2>
        <p>
          {isEn
            ? "Guests may cancel their booking up to 48 hours before check-in for a full refund. Cancellations made within 48 hours of check-in may be subject to a one-night cancellation fee."
            : "يمكن للضيوف إلغاء حجزهم حتى 48 ساعة قبل موعد تسجيل الدخول لاسترداد المبلغ بالكامل. الإلغاءات التي تتم خلال 48 ساعة من تسجيل الدخول قد تخضع لرسوم إلغاء ليلة واحدة."}
        </p>
        <h2 className="text-xl font-bold text-gray-900 mt-6">
          {isEn ? "Refunds" : "الاسترجاع"}
        </h2>
        <p>
          {isEn
            ? "Approved refunds will be processed back to the original credit/debit card used for the transaction via the SmartPay gateway. Please allow 7-14 business days for the funds to appear in your account."
            : "سيتم معالجة المبالغ المستردة المعتمدة وإعادتها إلى بطاقة الائتمان/الخصم الأصلية المستخدمة في المعاملة عبر بوابة SmartPay. يرجى السماح بمرور 7-14 يوم عمل لظهور الأموال في حسابك."}
        </p>
      </div>
    </div>
  );
}
