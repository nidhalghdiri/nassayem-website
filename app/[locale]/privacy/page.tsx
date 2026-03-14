export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === "en";

  return (
    <div className="max-w-3xl mx-auto py-16 px-4 sm:px-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        {isEn ? "Privacy Policy" : "سياسة الخصوصية"}
      </h1>
      <div className="prose prose-gray max-w-none text-gray-600 space-y-6">
        <p>
          {isEn
            ? "Nassayem Salalah respects your privacy and is committed to protecting your personal data."
            : "تحترم نسائم صلالة خصوصيتك وتلتزم بحماية بياناتك الشخصية."}
        </p>
        <h2 className="text-xl font-bold text-gray-900 mt-6">
          {isEn ? "Data Collection" : "جمع البيانات"}
        </h2>
        <p>
          {isEn
            ? "We collect your name, email, and phone number solely for the purpose of managing your booking. We do not store credit card details on our servers; all payment data is encrypted and handled directly by Bank Muscat."
            : "نقوم بجمع اسمك وبريدك الإلكتروني ورقم هاتفك فقط لغرض إدارة حجزك. نحن لا نقوم بتخزين تفاصيل بطاقة الائتمان على خوادمنا؛ يتم تشفير جميع بيانات الدفع ومعالجتها مباشرة بواسطة بنك مسقط."}
        </p>
      </div>
    </div>
  );
}
