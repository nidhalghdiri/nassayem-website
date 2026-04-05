"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";

type Props = {
  isEn: boolean;
  currentQ: string;
  currentStatus: string;
};

export default function BookingSearchBar({ isEn, currentQ, currentStatus }: Props) {
  const [q, setQ] = useState(currentQ);
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const submit = (value: string) => {
    const params = new URLSearchParams();
    if (currentStatus && currentStatus !== "ALL") params.set("status", currentStatus);
    if (value.trim()) params.set("q", value.trim());
    startTransition(() => {
      router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
    });
  };

  return (
    <div className="relative">
      <div className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        type="text"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          // Auto-submit when cleared
          if (e.target.value === "") submit("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit(q);
        }}
        placeholder={isEn ? "Search by name, phone, or booking #..." : "بحث بالاسم أو الهاتف أو رقم الحجز..."}
        className="w-full bg-white border border-gray-200 rounded-xl ps-10 pe-10 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-nassayem/50 focus:border-nassayem transition-all"
      />
      {q && (
        <button
          onClick={() => { setQ(""); submit(""); }}
          className="absolute inset-y-0 end-0 flex items-center pe-3.5 text-gray-400 hover:text-gray-600"
          aria-label="Clear search"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
