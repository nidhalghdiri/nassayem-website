"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateLeadReservationNumber } from "@/app/actions/chatbot";

// Inline editor for the NetSuite reservation number a staff member records
// after they create the reservation by hand. Saves on blur / Enter; only
// writes when the value actually changed.
export default function LeadReservationNumber({
  leadId,
  reservationNumber,
  isEn,
}: {
  leadId: string;
  reservationNumber: string | null;
  isEn: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(reservationNumber ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const initial = reservationNumber ?? "";

  const commit = () => {
    if (value.trim() === initial) return;
    startTransition(async () => {
      await updateLeadReservationNumber(leadId, value);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1500);
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        disabled={isPending}
        dir="ltr"
        placeholder={isEn ? "Res. #" : "رقم الحجز"}
        className="w-28 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-nassayem/50 disabled:opacity-50"
      />
      {saved && <span className="text-emerald-600 text-xs">✓</span>}
    </div>
  );
}
