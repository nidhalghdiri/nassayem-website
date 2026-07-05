"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setConversationStatus } from "@/app/actions/chatbot";
import type { ChatConversationStatus } from "@prisma/client";

type Props = {
  locale: string;
  conversationId: string;
  status: ChatConversationStatus;
};

export default function ConversationActions({ locale, conversationId, status }: Props) {
  const isEn = locale === "en";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setStatus = (next: ChatConversationStatus) =>
    startTransition(async () => {
      await setConversationStatus(conversationId, next);
      router.refresh();
    });

  const btn =
    "px-3 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-50";

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "ESCALATED" && (
        <button
          disabled={isPending}
          onClick={() => setStatus("ESCALATED")}
          className={`${btn} bg-red-100 text-red-700 hover:bg-red-200`}
        >
          {isEn ? "Mark escalated" : "تصعيد"}
        </button>
      )}
      {status !== "ACTIVE" && (
        <button
          disabled={isPending}
          onClick={() => setStatus("ACTIVE")}
          className={`${btn} bg-emerald-100 text-emerald-700 hover:bg-emerald-200`}
        >
          {isEn ? "Reopen / take over" : "إعادة فتح"}
        </button>
      )}
      {status !== "CLOSED" && (
        <button
          disabled={isPending}
          onClick={() => setStatus("CLOSED")}
          className={`${btn} bg-gray-100 text-gray-600 hover:bg-gray-200`}
        >
          {isEn ? "Close" : "إغلاق"}
        </button>
      )}
    </div>
  );
}
