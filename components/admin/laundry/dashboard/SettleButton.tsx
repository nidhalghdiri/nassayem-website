"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { settleLaundryDiscrepancy } from "@/app/actions/laundry";

export default function SettleButton({ orderId, locale }: { orderId: string; locale: string }) {
  const isEn = locale === "en";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    const note = window.prompt(isEn ? "Settlement note (optional):" : "ملاحظة التسوية (اختياري):");
    if (note === null) return; // cancelled
    setError(null);
    start(async () => {
      const res = await settleLaundryDiscrepancy({ orderId, note, locale });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <span className="inline-flex flex-col items-start">
      <button
        onClick={onClick}
        disabled={pending}
        className="px-3 py-1.5 rounded-lg bg-nassayem text-white text-xs font-semibold hover:bg-nassayem/90 disabled:opacity-50"
      >
        {pending ? "…" : isEn ? "Settle" : "تسوية"}
      </button>
      {error && <span className="text-[11px] text-red-600 mt-1">{error}</span>}
    </span>
  );
}
