import { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";
  return {
    title: isEn ? "Frequently Asked Questions | Nassayem Salalah" : "الأسئلة الشائعة | نسائم صلالة",
    description: isEn
      ? "Find answers to common questions about booking, check-in, payments, and our furnished apartments in Salalah, Oman."
      : "اعثر على إجابات للأسئلة الشائعة حول الحجز وتسجيل الوصول والمدفوعات وشققنا المفروشة في صلالة، عُمان.",
    alternates: {
      canonical: `https://www.nassayem.com/${locale}/faq`,
      languages: { en: "https://www.nassayem.com/en/faq", ar: "https://www.nassayem.com/ar/faq" },
    },
  };
}

export default async function FAQPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === "en";

  const faqs = [
    {
      q: isEn ? "How do I make a reservation?" : "كيف يمكنني إجراء حجز؟",
      a: isEn
        ? "You can browse our properties online, select your dates, and pay securely using your credit or debit card."
        : "يمكنك تصفح عقاراتنا عبر الإنترنت، واختيار تواريخك، والدفع بأمان باستخدام بطاقتك الائتمانية أو بطاقة الخصم.",
    },
    {
      q: isEn
        ? "What payment methods are accepted?"
        : "ما هي طرق الدفع المقبولة؟",
      a: isEn
        ? "We accept major Credit and Debit cards via the secure Bank Muscat SmartPay gateway."
        : "نحن نقبل بطاقات الائتمان والخصم الرئيسية عبر بوابة Bank Muscat SmartPay الآمنة.",
    },
  ];
  // Build the FAQ Schema
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  return (
    <div className="max-w-3xl mx-auto py-16 px-4 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        {isEn ? "Frequently Asked Questions" : "الأسئلة الشائعة"}
      </h1>
      <div className="space-y-6">
        {faqs.map((faq, idx) => (
          <div
            key={idx}
            className="bg-white p-6 rounded-xl border border-gray-100"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">{faq.q}</h3>
            <p className="text-gray-600">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
