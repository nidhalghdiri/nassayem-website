"use client";

// Floating site-wide chat widget. RTL-aware (logical positioning + dir from
// the html element), bilingual labels, Nassayem branding. Talks to
// /api/chatbot/web and renders the ND-JSON delta stream progressively.

import { useCallback, useEffect, useRef, useState } from "react";

type Props = { locale: string };

type ChatMessage = {
  role: "user" | "assistant" | "staff";
  text: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
};

const SESSION_KEY = "nsm_chat_session";

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

// Render plain text with clickable bare URLs and preserved line breaks.
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline break-all"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

export default function ChatWidget({ locale }: Props) {
  const isEn = locale === "en";
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [greeting, setGreeting] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Bootstrap: enabled flag + greeting (one cached-config request per load)
  useEffect(() => {
    fetch("/api/chatbot/web")
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (!cfg) return setEnabled(false);
        setEnabled(!!cfg.enabled);
        setGreeting(isEn ? cfg.greeting_en : cfg.greeting_ar);
      })
      .catch(() => setEnabled(false));
  }, [isEn]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  // While open, poll for human-agent (handoff) replies sent from the admin
  // panel — bot replies arrive via the send stream, staff replies via this.
  const staffCursor = useRef<string>(new Date().toISOString());
  const seenStaffIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!open || !enabled) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/chatbot/web?sessionId=${encodeURIComponent(getSessionId())}&after=${encodeURIComponent(staffCursor.current)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          messages?: { id: string; text: string; mediaUrl?: string | null; mediaType?: string | null; createdAt: string }[];
        };
        const fresh = (data.messages ?? []).filter((m) => !seenStaffIds.current.has(m.id));
        if (fresh.length === 0) return;
        for (const m of fresh) {
          seenStaffIds.current.add(m.id);
          if (m.createdAt > staffCursor.current) staffCursor.current = m.createdAt;
        }
        setMessages((prev) => [
          ...prev,
          ...fresh.map(
            (m): ChatMessage => ({
              role: "staff",
              text: m.text,
              mediaUrl: m.mediaUrl,
              mediaType: m.mediaType,
            }),
          ),
        ]);
      } catch {
        /* network hiccup — next tick retries */
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [open, enabled]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      { role: "assistant", text: "" },
    ]);

    try {
      const res = await fetch("/api/chatbot/web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: getSessionId(), message: text }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const appendDelta = (delta: string) =>
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, text: last.text + delta };
          }
          return next;
        });

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
            if (event.type === "delta" && typeof event.text === "string") {
              appendDelta(event.text);
            }
          } catch {
            // ignore malformed line
          }
        }
      }

      // No reply arrived (e.g. staff paused the AI to take over) — drop the
      // empty typing bubble instead of leaving it hanging.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.text) return prev.slice(0, -1);
        return prev;
      });
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant" && !last.text) {
          next[next.length - 1] = {
            ...last,
            text: isEn
              ? "Sorry, something went wrong. Please try again or call us at +968 99551237."
              : "عذراً، حدث خطأ. حاول مرة أخرى أو اتصل بنا على +968 99551237.",
          };
        }
        return next;
      });
    } finally {
      setSending(false);
    }
  }, [input, sending, isEn]);

  if (!enabled) return null;

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={isEn ? "Chat with us" : "تحدث معنا"}
        className="fixed bottom-5 end-5 z-50 w-14 h-14 rounded-full bg-nassayem text-white shadow-lg shadow-nassayem/30 flex items-center justify-center hover:bg-nassayem-dark transition-colors"
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 end-5 z-50 w-[92vw] max-w-sm h-[70vh] max-h-[560px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-nassayem text-white px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold">
              N
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm">
                {isEn ? "Nassayem Assistant" : "مساعد نسائم"}
              </div>
              <div className="text-xs text-white/80">
                {isEn ? "Usually replies instantly" : "يرد عادة فوراً"}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50 text-sm">
            {greeting && (
              <div className="max-w-[85%] rounded-2xl rounded-es-md bg-white border border-gray-200 px-3 py-2 text-gray-800">
                <Linkified text={greeting} />
              </div>
            )}
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-ee-md bg-nassayem text-white px-3 py-2">
                    <Linkified text={m.text} />
                  </div>
                </div>
              ) : m.role === "staff" ? (
                <div key={i} className="flex">
                  <div className="max-w-[85%] rounded-2xl rounded-es-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-gray-800">
                    <div className="text-[10px] font-semibold text-emerald-700 mb-0.5">
                      {isEn ? "Nassayem team" : "فريق نسائم"}
                    </div>
                    {m.mediaType === "image" && m.mediaUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.mediaUrl} alt="" className="rounded-lg max-w-full mb-1" />
                    )}
                    {m.mediaType === "location" && m.mediaUrl ? (
                      <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className="underline">
                        {m.text}
                      </a>
                    ) : (
                      <Linkified text={m.text} />
                    )}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex">
                  <div className="max-w-[85%] rounded-2xl rounded-es-md bg-white border border-gray-200 px-3 py-2 text-gray-800">
                    {m.text ? (
                      <Linkified text={m.text} />
                    ) : (
                      <span className="inline-flex gap-1 py-1" aria-label="typing">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                      </span>
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
            className="p-3 border-t border-gray-200 bg-white flex gap-2 shrink-0"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isEn ? "Type a message…" : "اكتب رسالة…"}
              maxLength={2000}
              className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/50"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-xl bg-nassayem text-white px-3 py-2 disabled:opacity-40 hover:bg-nassayem-dark transition-colors"
              aria-label={isEn ? "Send" : "إرسال"}
            >
              <svg className="w-5 h-5 rtl:-scale-x-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
