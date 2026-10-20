"use client";

// Conversation header controls: the AI on/off switch (human takeover) and a
// "more" menu with status changes and delete.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Loader2, MoreVertical, RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import {
  setConversationStatus,
  setConversationAiPaused,
  deleteChatbotConversation,
} from "@/app/actions/chatbot";
import type { ChatConversationStatus } from "@prisma/client";

type Props = {
  locale: string;
  conversationId: string;
  status: ChatConversationStatus;
  aiPaused: boolean;
  canDelete?: boolean;
  /** Optimistic local updates so the header reacts instantly. */
  onAiPausedChange: (paused: boolean) => void;
  onStatusChange: (status: ChatConversationStatus) => void;
};

export default function ConversationActions({
  locale,
  conversationId,
  status,
  aiPaused,
  canDelete = false,
  onAiPausedChange,
  onStatusChange,
}: Props) {
  const isEn = locale === "en";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  const setStatus = (next: ChatConversationStatus) => {
    setMenuOpen(false);
    const prev = status;
    onStatusChange(next);
    startTransition(async () => {
      try {
        await setConversationStatus(conversationId, next);
        router.refresh();
      } catch {
        onStatusChange(prev);
      }
    });
  };

  const toggleAi = () => {
    const next = !aiPaused;
    onAiPausedChange(next);
    startTransition(async () => {
      try {
        await setConversationAiPaused(conversationId, next);
        router.refresh();
      } catch {
        onAiPausedChange(!next);
      }
    });
  };

  const remove = () => {
    setMenuOpen(false);
    const sure = window.confirm(
      isEn
        ? "Permanently delete this conversation, its transcript, tool traces, leads and holds? This cannot be undone."
        : "حذف هذه المحادثة نهائياً مع كل الرسائل والعملاء المحتملين المرتبطين بها؟ لا يمكن التراجع.",
    );
    if (!sure) return;
    startTransition(async () => {
      await deleteChatbotConversation(conversationId);
      router.push(`/${locale}/admin/chatbot/conversations`);
      router.refresh();
    });
  };

  const aiOn = !aiPaused;
  const item =
    "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-start rounded-lg hover:bg-gray-100 disabled:opacity-50";

  return (
    <div className="flex items-center gap-1.5">
      {/* AI on/off — human takeover switch */}
      <button
        type="button"
        role="switch"
        aria-checked={aiOn}
        disabled={isPending}
        onClick={toggleAi}
        title={
          aiOn
            ? isEn
              ? "Turn off to take over: the bot stops replying, customer messages are still saved. No tokens are spent."
              : "أوقفه لتتولى المحادثة: يتوقف البوت عن الرد وتُحفظ رسائل العميل. لا يتم استهلاك توكنز."
            : isEn
              ? "Turn on to let the bot reply to this customer again"
              : "شغّله ليعود البوت للرد على هذا العميل"
        }
        className={`inline-flex items-center gap-2 ps-2.5 pe-1.5 py-1.5 rounded-full text-xs font-semibold ring-1 transition-colors disabled:opacity-60 ${
          aiOn
            ? "bg-nassayem/10 text-nassayem-dark ring-nassayem/30 hover:bg-nassayem/15"
            : "bg-violet-50 text-violet-700 ring-violet-200 hover:bg-violet-100"
        }`}
      >
        <span className="hidden sm:inline">
          {aiOn ? (isEn ? "AI replying" : "البوت يرد") : isEn ? "You're handling" : "أنت تتولى"}
        </span>
        <span
          className={`relative w-8 h-[18px] rounded-full transition-colors ${aiOn ? "bg-nassayem" : "bg-gray-300"}`}
        >
          <span
            className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-all ${
              aiOn ? "start-[16px]" : "start-[2px]"
            }`}
          />
        </span>
      </button>

      {/* More menu */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100"
          title={isEn ? "More actions" : "إجراءات أخرى"}
        >
          {isPending ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <MoreVertical className="w-[18px] h-[18px]" />}
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute end-0 top-11 z-30 w-52 p-1.5 bg-white rounded-xl shadow-xl ring-1 ring-black/5"
          >
            {status !== "ESCALATED" && (
              <button role="menuitem" className={`${item} text-rose-700`} onClick={() => setStatus("ESCALATED")}>
                <ShieldAlert className="w-4 h-4" />
                {isEn ? "Mark as escalated" : "تصعيد المحادثة"}
              </button>
            )}
            {status !== "ACTIVE" && (
              <button role="menuitem" className={`${item} text-emerald-700`} onClick={() => setStatus("ACTIVE")}>
                <RotateCcw className="w-4 h-4" />
                {isEn ? "Reopen" : "إعادة فتح"}
              </button>
            )}
            {status !== "CLOSED" && (
              <button role="menuitem" className={`${item} text-gray-700`} onClick={() => setStatus("CLOSED")}>
                <CheckCircle2 className="w-4 h-4" />
                {isEn ? "Close conversation" : "إغلاق المحادثة"}
              </button>
            )}
            {canDelete && (
              <>
                <div className="my-1 h-px bg-gray-100" />
                <button role="menuitem" className={`${item} text-red-600 hover:bg-red-50`} onClick={remove}>
                  <Trash2 className="w-4 h-4" />
                  {isEn ? "Delete permanently" : "حذف نهائي"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
