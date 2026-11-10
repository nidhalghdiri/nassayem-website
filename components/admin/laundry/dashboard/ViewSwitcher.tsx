import Link from "next/link";

export default function ViewSwitcher({ locale, active, label }: { locale: string; active: "dashboard" | "orders"; label?: { en: string; ar: string } }) {
  const isEn = locale === "en";
  const base = `/${locale}/admin/laundry`;
  const tabs = [
    { key: "dashboard", href: base, en: label?.en ?? "Dashboard", ar: label?.ar ?? "لوحة المدير" },
    { key: "orders", href: `${base}?view=orders`, en: "Orders", ar: "الطلبات" },
  ] as const;
  return (
    <div className="px-4 md:px-6 pt-4 md:pt-6">
      <div className="inline-flex rounded-lg bg-gray-100 p-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              active === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {isEn ? t.en : t.ar}
          </Link>
        ))}
      </div>
    </div>
  );
}
