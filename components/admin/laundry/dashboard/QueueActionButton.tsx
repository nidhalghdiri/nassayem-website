"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceLaundryStatus } from "@/app/actions/laundry";
import type { TLaundryStatus } from "@/lib/laundry/constants";

// One-tap forward step for transitions that need no count
// (AT_LAUNDRY → PROCESSING, PROCESSING → READY).
export default function QueueActionButton({
  orderId, toStatus, label, locale, tone,
}: { orderId: string; toStatus: TLaundryStatus; label: string; locale: string; tone: "teal" | "green" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start">
      <button
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await advanceLaundryStatus({ orderId, toStatus, locale });
            if (res.error) setError(res.error);
            else router.refresh();
          });
        }}
        className={`px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-50 ${tone === "green" ? "bg-green-600 hover:bg-green-700" : "bg-nassayem hover:bg-nassayem/90"}`}
      >
        {pending ? "…" : label}
      </button>
      {error && <span className="text-[11px] text-red-600 mt-1">{error}</span>}
    </span>
  );
}
