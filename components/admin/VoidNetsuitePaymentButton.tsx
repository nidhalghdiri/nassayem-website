"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { voidNetsuitePayment } from "@/app/actions/netsuitePayment";

type Props = {
  paymentId: string;
  isEn: boolean;
};

export default function VoidNetsuitePaymentButton({ paymentId, isEn }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const onClick = () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    startTransition(async () => {
      await voidNetsuitePayment(paymentId);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
        confirming
          ? "bg-red-600 text-white hover:bg-red-700"
          : "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600"
      } disabled:opacity-50`}
    >
      {isPending
        ? isEn
          ? "Voiding…"
          : "جارٍ الإلغاء…"
        : confirming
          ? isEn
            ? "Click to confirm"
            : "اضغط للتأكيد"
          : isEn
            ? "Void"
            : "إلغاء"}
    </button>
  );
}
