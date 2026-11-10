"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

type Props = { locale: string; period: string; from: string; to: string };

export default function PeriodFilter({ locale, period, from, to }: Props) {
  const isEn = locale === "en";
  const router = useRouter();
  const pathname = usePathname();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  const go = (qs: string) => router.push(`${pathname}?${qs}`, { scroll: false });
  const tabs = [
    { key: "today", en: "Today", ar: "اليوم" },
    { key: "7d", en: "Last 7 days", ar: "آخر 7 أيام" },
    { key: "30d", en: "Last 30 days", ar: "آخر 30 يوم" },
    { key: "custom", en: "Custom", ar: "فترة مخصصة" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg bg-gray-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => (tab.key === "custom" ? go(`period=custom&from=${f}&to=${t}`) : go(`period=${tab.key}`))}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              period === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {isEn ? tab.en : tab.ar}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={f} max={t} onChange={(e) => setF(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5" />
          <span className="text-gray-400">→</span>
          <input type="date" value={t} min={f} onChange={(e) => setT(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5" />
          <button onClick={() => f && t && go(`period=custom&from=${f}&to=${t}`)} className="px-3 py-1.5 rounded-lg bg-nassayem text-white font-medium">
            {isEn ? "Apply" : "تطبيق"}
          </button>
        </div>
      )}
    </div>
  );
}
