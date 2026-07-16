import { Metadata } from "next";
import {
  CONTACT_ADDRESS_AR,
  CONTACT_ADDRESS_EN,
  CONTACT_EMAIL,
  CONTACT_MAPS_URL,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_E164,
} from "@/lib/contact";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";
  return {
    title: isEn ? "Contact Us | Nassayem Salalah" : "اتصل بنا | نسائم صلالة",
    description: isEn
      ? "Get in touch with Nassayem Salalah. Call or WhatsApp us at +968 99551237. Located in Al Luban Street, Salalah, Dhofar, Oman."
      : "تواصل مع نسائم صلالة. اتصل بنا أو راسلنا عبر واتساب على +968 99551237. نقع في شارع اللبان، صلالة، ظفار، عُمان.",
    alternates: {
      canonical: `https://www.nassayem.com/${locale}/contact`,
      languages: { en: "https://www.nassayem.com/en/contact", ar: "https://www.nassayem.com/ar/contact" },
    },
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === "en";

  return (
    <div className="max-w-3xl mx-auto py-16 px-4 sm:px-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        {isEn ? "Contact Us" : "اتصل بنا"}
      </h1>
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {isEn ? "Merchant Information" : "معلومات التاجر"}
        </h2>
        <div className="space-y-4 text-gray-600">
          <p>
            <strong>{isEn ? "Company Name:" : "اسم الشركة:"}</strong> Nassayem
            Salalah
          </p>
          <p>
            <strong>{isEn ? "Email Address:" : "البريد الإلكتروني:"}</strong>{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              dir="ltr"
              className="text-nassayem underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
          <p>
            <strong>{isEn ? "Phone Number:" : "رقم الهاتف:"}</strong>{" "}
            <a
              href={`tel:${CONTACT_PHONE_E164}`}
              dir="ltr"
              className="text-nassayem underline underline-offset-4"
            >
              {CONTACT_PHONE_DISPLAY}
            </a>
          </p>
          <p>
            <strong>{isEn ? "WhatsApp:" : "واتساب:"}</strong>{" "}
            <a
              href={`/${locale}/whatsapp`}
              className="text-nassayem underline underline-offset-4"
            >
              {isEn ? "Message us on WhatsApp" : "راسلنا عبر واتساب"}
            </a>
          </p>
          <p>
            <strong>{isEn ? "Address:" : "العنوان:"}</strong>{" "}
            <a
              href={CONTACT_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-nassayem underline underline-offset-4"
            >
              {isEn ? CONTACT_ADDRESS_EN : CONTACT_ADDRESS_AR}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
