"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  deleteRecommendation,
  toggleRecommendationPublished,
} from "@/app/actions/recommendation";

type Props = {
  id: string;
  locale: string;
  isPublished: boolean;
  isEn: boolean;
};

export default function RecommendationRowActions({
  id,
  locale,
  isPublished,
  isEn,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const onToggle = () => {
    startTransition(async () => {
      try {
        await toggleRecommendationPublished(id, locale);
        router.refresh();
      } catch (err: any) {
        alert(err?.message || "Failed");
      }
    });
  };

  const onDelete = () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    startTransition(async () => {
      try {
        await deleteRecommendation(id, locale);
        router.refresh();
      } catch (err: any) {
        alert(err?.message || "Failed");
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onToggle}
        disabled={isPending}
        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
          isPublished
            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
        }`}
        title={isEn ? "Toggle published" : "تبديل النشر"}
      >
        {isPublished
          ? isEn ? "Published" : "منشور"
          : isEn ? "Hidden" : "مخفي"}
      </button>
      <Link
        href={`/${locale}/admin/recommendations/${id}/edit`}
        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-nassayem/10 text-nassayem hover:bg-nassayem hover:text-white transition-colors"
      >
        {isEn ? "Edit" : "تعديل"}
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={isPending}
        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
          confirming
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600"
        }`}
      >
        {isPending
          ? isEn ? "..." : "..."
          : confirming
            ? isEn ? "Confirm?" : "تأكيد؟"
            : isEn ? "Delete" : "حذف"}
      </button>
    </div>
  );
}
