"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePromotion } from "@/app/actions/promotion";

export default function DeletePromotionButton({
  id,
  locale,
}: {
  id: string;
  locale: string;
}) {
  const isEn = locale === "en";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm(isEn ? "Delete this promotion?" : "حذف هذا العرض؟")) return;
    startTransition(async () => {
      await deletePromotion(id, locale);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
      </svg>
      {isPending ? (isEn ? "..." : "...") : isEn ? "Delete" : "حذف"}
    </button>
  );
}
