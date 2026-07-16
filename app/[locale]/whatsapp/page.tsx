import Link from "next/link";
import { Metadata } from "next";
import {
  CONTACT_ADDRESS_AR,
  CONTACT_ADDRESS_EN,
  CONTACT_EMAIL,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_E164,
  whatsappLink,
} from "@/lib/contact";

/**
 * Google Ads landing page for WhatsApp campaigns.
 *
 * Deliberately a plain Server Component with no client JS: Google Ads rejected
 * a wa.me final URL because it is not a crawlable page. This page is the final
 * URL instead. The WhatsApp hand-off MUST stay a manual click — no redirect on
 * load, no router.push, no meta refresh, no onLoad handler — or the rejection
 * comes straight back.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";
  return {
    title: isEn
      ? "Contact Nassayem Salalah on WhatsApp"
      : "تواصل مع نسائم صلالة عبر واتساب",
    description: isEn
      ? "Message the Nassayem Salalah team on WhatsApp about furnished apartments and villas in Salalah — availability, prices, and booking. Or call +968 99551237."
      : "راسل فريق نسائم صلالة عبر واتساب للاستفسار عن الشقق والفلل المفروشة في صلالة — التوفر والأسعار والحجز. أو اتصل على +968 99551237.",
    alternates: {
      canonical: `https://www.nassayem.com/${locale}/whatsapp`,
      languages: {
        en: "https://www.nassayem.com/en/whatsapp",
        ar: "https://www.nassayem.com/ar/whatsapp",
      },
    },
    robots: { index: true, follow: true },
  };
}

export default async function WhatsAppLandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === "en";

  const message = isEn
    ? "Hello Nassayem! I would like to inquire about furnished apartments in Salalah."
    : "مرحباً نسائم! أود الاستفسار عن الشقق المفروشة في صلالة.";

  const bullets = isEn
    ? [
        "Check live availability for your dates",
        "Get prices for nightly, weekly, and monthly stays",
        "Ask about family villas, apartments, and single rooms",
        "Arrange your booking and payment",
      ]
    : [
        "الاستعلام عن التوفر في التواريخ التي تناسبك",
        "معرفة الأسعار للإقامة اليومية والأسبوعية والشهرية",
        "الاستفسار عن الفلل العائلية والشقق والغرف المفردة",
        "إتمام الحجز وترتيب الدفع",
      ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: isEn
      ? "Contact Nassayem Salalah on WhatsApp"
      : "تواصل مع نسائم صلالة عبر واتساب",
    url: `https://www.nassayem.com/${locale}/whatsapp`,
    mainEntity: {
      "@type": "LocalBusiness",
      name: "Nassayem Salalah",
      telephone: CONTACT_PHONE_E164,
      email: CONTACT_EMAIL,
      address: {
        "@type": "PostalAddress",
        streetAddress: "Al Luban Street",
        addressLocality: "Salalah",
        addressRegion: "Dhofar",
        addressCountry: "OM",
      },
    },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* The locale layout already provides <main>; this is a plain wrapper. */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {isEn
              ? "Talk to Nassayem Salalah on WhatsApp"
              : "تحدث مع نسائم صلالة عبر واتساب"}
          </h1>

          <p className="text-lg text-gray-600 mb-8">
            {isEn
              ? "Nassayem Salalah rents furnished apartments, family villas, and rooms across Salalah in the Dhofar Governorate of Oman. Our team answers in Arabic and English, and can help you with:"
              : "تؤجر نسائم صلالة شققاً مفروشة وفللاً عائلية وغرفاً في مختلف مناطق صلالة بمحافظة ظفار في سلطنة عمان. فريقنا يرد بالعربية والإنجليزية، ويمكنه مساعدتك في:"}
          </p>

          <ul className="space-y-3 mb-10">
            {bullets.map((item) => (
              <li key={item} className="flex items-start gap-3 text-gray-700">
                <svg
                  className="w-6 h-6 text-[#25D366] shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {/* Manual hand-off. Must remain a user-initiated click. */}
          <a
            href={whatsappLink(message)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-lg py-4 px-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
          >
            <svg
              className="w-6 h-6"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            {isEn ? "Open WhatsApp chat" : "افتح محادثة واتساب"}
          </a>

          <p className="text-sm text-gray-500 text-center mt-3">
            {isEn
              ? "Opens WhatsApp in a new tab. You choose when to send the message."
              : "يفتح واتساب في نافذة جديدة. أنت من يقرر متى ترسل الرسالة."}
          </p>

          {/* Alternatives, so the page stands on its own without WhatsApp. */}
          <div className="mt-10 pt-8 border-t border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {isEn ? "Prefer another way?" : "تفضل وسيلة أخرى؟"}
            </h2>
            <div className="space-y-3 text-gray-700">
              <p>
                <span className="font-medium">{isEn ? "Call: " : "الهاتف: "}</span>
                <a
                  href={`tel:${CONTACT_PHONE_E164}`}
                  dir="ltr"
                  className="text-nassayem underline underline-offset-4"
                >
                  {CONTACT_PHONE_DISPLAY}
                </a>
              </p>
              <p>
                <span className="font-medium">{isEn ? "Email: " : "البريد: "}</span>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  dir="ltr"
                  className="text-nassayem underline underline-offset-4"
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
              <p>
                <span className="font-medium">
                  {isEn ? "Office: " : "المكتب: "}
                </span>
                {isEn ? CONTACT_ADDRESS_EN : CONTACT_ADDRESS_AR}
              </p>
            </div>

            <Link
              href={`/${locale}/properties`}
              className="inline-block mt-6 text-nassayem font-medium underline underline-offset-4"
            >
              {isEn
                ? "Browse all available properties →"
                : "تصفح جميع العقارات المتاحة ←"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
