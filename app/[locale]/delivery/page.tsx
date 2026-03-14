export default async function DeliveryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === "en";

  return (
    <div className="max-w-3xl mx-auto py-16 px-4 sm:px-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        {isEn ? "Delivery Policy" : "سياسة التسليم"}
      </h1>
      <div className="prose prose-gray max-w-none text-gray-600 space-y-6">
        <p>
          {isEn
            ? "As a property management and booking platform, Nassayem Salalah does not deliver physical goods."
            : "بصفتها منصة لإدارة العقارات والحجوزات، لا تقوم نسائم صلالة بتسليم سلع مادية."}
        </p>
        <h2 className="text-xl font-bold text-gray-900 mt-6">
          {isEn ? "Booking Delivery" : "تسليم الحجز"}
        </h2>
        <p>
          {isEn
            ? "Upon successful payment, your booking confirmation and digital receipt will be 'delivered' instantly to the email address provided during checkout. This email contains your check-in instructions and reservation details."
            : "عند الدفع بنجاح، سيتم 'تسليم' تأكيد الحجز والإيصال الرقمي الخاص بك فوراً إلى عنوان البريد الإلكتروني المقدم أثناء الدفع. يحتوي هذا البريد الإلكتروني على تعليمات تسجيل الدخول وتفاصيل الحجز."}
        </p>
      </div>
    </div>
  );
}
