"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  setConversationStatus,
  setConversationAiPaused,
} from "@/app/actions/chatbot";
import type { ChatConversationStatus } from "@prisma/client";

type Props = {
  locale: string;
  conversationId: string;
  status: ChatConversationStatus;
  aiPaused: boolean;
};

export default function ConversationActions({
  locale,
  conversationId,
  status,
  aiPaused,
}: Props) {
  const isEn = locale === "en";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setStatus = (next: ChatConversationStatus) =>
    startTransition(async () => {
      await setConversationStatus(conversationId, next);
      router.refresh();
    });

  const toggleAi = () =>
    startTransition(async () => {
      await setConversationAiPaused(conversationId, !aiPaused);
      router.refresh();
    });

  const btn =
    "px-3 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-50";

  return (
    <div className="flex flex-wrap gap-2">
      {/* Stop / Resume AI — human takeover switch */}
      <button
        disabled={isPending}
        onClick={toggleAi}
        className={`${btn} ${
          aiPaused
            ? "bg-nassayem text-white hover:bg-nassayem-dark"
            : "bg-violet-100 text-violet-700 hover:bg-violet-200"
        }`}
        title={
          aiPaused
            ? isEn
              ? "The bot will reply to this customer again"
              : "سيعود البوت للرد على هذا العميل"
            : isEn
              ? "Bot stops replying; customer messages are still saved here. No tokens are spent."
              : "يتوقف البوت عن الرد؛ رسائل العميل تُحفظ هنا. لا يتم استهلاك أي توكنز."
        }
      >
        {aiPaused
          ? isEn ? "▶ Resume AI" : "▶ تشغيل الذكاء"
          : isEn ? "⏸ Stop AI" : "⏸ إيقاف الذكاء"}
      </button>

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
          {isEn ? "Reopen" : "إعادة فتح"}
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
