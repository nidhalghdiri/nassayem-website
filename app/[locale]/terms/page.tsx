import { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";
  return {
    title: isEn ? "Terms & Conditions | Nassayem Salalah" : "الشروط والأحكام | نسائم صلالة",
    description: isEn
      ? "Review the terms and conditions for booking and staying at Nassayem Salalah furnished apartments."
      : "اطلع على شروط وأحكام الحجز والإقامة في شقق نسائم صلالة المفروشة.",
    alternates: {
      canonical: `https://www.nassayem.com/${locale}/terms`,
      languages: { en: "https://www.nassayem.com/en/terms", ar: "https://www.nassayem.com/ar/terms" },
    },
  };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === "en";

  return (
    <div className="max-w-3xl mx-auto py-16 px-4 sm:px-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        {isEn ? "Terms & Conditions" : "الشروط والأحكام"}
      </h1>
      <div className="prose prose-gray max-w-none text-gray-600 space-y-6">
        <p>
          {isEn
            ? "Welcome to Nassayem Salalah. By accessing our website and booking our properties, you agree to comply with and be bound by the following terms."
            : "مرحباً بكم في نسائم صلالة. بدخولك إلى موقعنا وحجز عقاراتنا، فإنك توافق على الالتزام بالشروط التالية."}
        </p>
        <h2 className="text-xl font-bold text-gray-900 mt-6">
          {isEn ? "Booking & Payments" : "الحجز والدفع"}
        </h2>
        <p>
          {isEn
            ? "All bookings are subject to availability. Payments are securely processed via Bank Muscat SmartPay. The total amount must be paid in full to confirm the reservation."
            : "جميع الحجوزات تخضع لمدى التوفر. تتم معالجة المدفوعات بشكل آمن عبر Bank Muscat SmartPay. يجب دفع المبلغ الإجمالي بالكامل لتأكيد الحجز."}
        </p>
        <h2 className="text-xl font-bold text-gray-900 mt-6">
          {isEn ? "User Responsibilities" : "مسؤوليات المستخدم"}
        </h2>
        <p>
          {isEn
            ? "Guests agree to maintain the property in good condition and adhere to all building rules during their stay."
            : "يوافق الضيوف على الحفاظ على العقار في حالة جيدة والالتزام بجميع قواعد المبنى أثناء إقامتهم."}
        </p>
      </div>
    </div>
  );
}
