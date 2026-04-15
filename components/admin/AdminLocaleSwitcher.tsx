"use client";

import { usePathname, useRouter } from "next/navigation";

export default function AdminLocaleSwitcher({ locale }: { locale: string }) {
  const pathname = usePathname();
  const router = useRouter();

  function toggle() {
    const next = locale === "en" ? "ar" : "en";
    // Swap the first path segment (/en/ or /ar/)
    const newPath = pathname.replace(/^\/(en|ar)/, `/${next}`);
    router.push(newPath);
  }

  const isEn = locale === "en";

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300 rounded-lg transition-colors bg-white"
      title={isEn ? "Switch to Arabic" : "التبديل إلى الإنجليزية"}
    >
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
      {isEn ? "عربي" : "EN"}
    </button>
  );
}
