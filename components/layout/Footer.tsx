import Link from "next/link";

export default function Footer({ locale }: { locale: string }) {
  const isEn = locale === "en";

  const links = [
    {
      href: `/${locale}/terms`,
      en: "Terms & Conditions",
      ar: "الشروط والأحكام",
    },
    { href: `/${locale}/privacy`, en: "Privacy Policy", ar: "سياسة الخصوصية" },
    {
      href: `/${locale}/refunds`,
      en: "Cancellation & Refunds",
      ar: "سياسة الإلغاء والاسترجاع",
    },
    { href: `/${locale}/delivery`, en: "Delivery Policy", ar: "سياسة التسليم" },
    { href: `/${locale}/faq`, en: "FAQs", ar: "الأسئلة الشائعة" },
    { href: `/${locale}/contact`, en: "Contact Us", ar: "اتصل بنا" },
  ];

  return (
    <footer className="bg-gray-900 text-gray-300 py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 border-b border-gray-800 pb-8">
          {/* Brand */}
          <div>
            <h2 className="text-2xl font-extrabold text-white mb-4">
              Nassayem Salalah
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed max-w-sm">
              {isEn
                ? "Premium property management and booking services in Salalah, Oman."
                : "خدمات إدارة العقارات والحجوزات الفاخرة في صلالة، عُمان."}
            </p>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4">
              {isEn ? "Legal & Policies" : "السياسات القانونية"}
            </h3>
            <ul className="space-y-2 text-sm">
              {links.slice(0, 4).map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-white transition-colors"
                  >
                    {isEn ? link.en : link.ar}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4">
              {isEn ? "Support" : "الدعم"}
            </h3>
            <ul className="space-y-2 text-sm">
              {links.slice(4).map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-white transition-colors"
                  >
                    {isEn ? link.en : link.ar}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
          <p>
            © {new Date().getFullYear()} Nassayem Salalah.{" "}
            {isEn ? "All rights reserved." : "جميع الحقوق محفوظة."}
          </p>
          <div className="flex gap-4 mt-4 md:mt-0">
            {/* Add payment provider logos here if you have them */}
            <span>Secure Payments by Bank Muscat SmartPay</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
