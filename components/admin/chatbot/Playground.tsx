"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Volume2 } from "lucide-react";
import { resetPlaygroundConversation } from "@/app/actions/chatbot";

type ChatMessage = { role: "user" | "assistant"; text: string; audioBase64?: string };

export default function Playground({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [isResetting, startReset] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", text }, { role: "assistant", text: "" }]);

    const appendDelta = (delta: string) =>
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          next[next.length - 1] = { ...last, text: last.text + delta };
        }
        return next;
      });

    try {
      const res = await fetch("/api/chatbot/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "delta" && typeof event.text === "string") appendDelta(event.text);
            if (event.type === "audio" && typeof event.base64 === "string") {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  next[next.length - 1] = { ...last, audioBase64: event.base64 };
                }
                return next;
              });
            }
            if (event.type === "done" && event.escalated) setEscalated(true);
          } catch {
            /* ignore malformed line */
          }
        }
      }
    } catch {
      appendDelta(isEn ? "⚠️ Request failed — check server logs." : "⚠️ فشل الطلب — راجع سجلات الخادم.");
    } finally {
      setSending(false);
    }
  }, [input, sending, isEn]);

  const reset = () =>
    startReset(async () => {
      await resetPlaygroundConversation();
      setMessages([]);
      setEscalated(false);
    });

  return (
    <div className="bg-white border border-gray-200 rounded-2xl flex flex-col h-[65vh]">
      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between shrink-0">
        <span className="text-xs text-gray-500">
          {escalated
            ? isEn
              ? "⚠ This test conversation was escalated"
              : "⚠ تم تصعيد هذه المحادثة التجريبية"
            : isEn
              ? "Live config · real data"
              : "الإعدادات الحالية · بيانات حقيقية"}
        </span>
        <button
          onClick={reset}
          disabled={isResetting}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium disabled:opacity-50"
        >
          {isResetting ? (isEn ? "Resetting…" : "جارٍ المسح…") : isEn ? "Reset conversation" : "مسح المحادثة"}
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50 text-sm">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 mt-10">
            {isEn
              ? 'Try: "3 ليالي لشخصين الأسبوع الجاي شقة غرفتين" or "Do you have a studio next weekend?"'
              : 'جرّب: "أبي استوديو نهاية الأسبوع القادم" أو "Do you have promotions?"'}
          </p>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-ee-md bg-nassayem text-white px-3 py-2 whitespace-pre-wrap break-words">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex">
              <div className="max-w-[85%] rounded-2xl rounded-es-md bg-white border border-gray-200 px-3 py-2 text-gray-800 whitespace-pre-wrap break-words">
                {m.text || (
                  <span className="inline-flex gap-1 py-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                )}
                {m.audioBase64 && (
                  <button
                    onClick={() => {
                      const audio = new Audio(`data:audio/mp3;base64,${m.audioBase64}`);
                      audio.play();
                    }}
                    className="mt-3 flex items-center gap-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors border border-blue-100 w-fit"
                    title={isEn ? "Play Voice Note" : "تشغيل المقطع الصوتي"}
                  >
                    <Volume2 className="w-4 h-4" />
                    <span className="text-xs font-medium">
                      {isEn ? "Play Audio" : "تشغيل الصوت"}
                    </span>
                  </button>
                )}
              </div>
            </div>
          ),
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="p-3 border-t border-gray-200 flex gap-2 shrink-0"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isEn ? "Message the bot as a customer…" : "راسل البوت كأنك عميل…"}
          maxLength={2000}
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/50"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="px-4 py-2 rounded-xl bg-nassayem text-white text-sm font-medium hover:bg-nassayem-dark disabled:opacity-40"
        >
          {isEn ? "Send" : "إرسال"}
        </button>
      </form>
    </div>
  );
}
