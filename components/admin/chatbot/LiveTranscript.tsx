"use client";

// WhatsApp-style live conversation view for the admin panel.
// - Polls /api/chatbot/admin/messages every 4s → new messages appear without
//   reloading (customer, bot, staff and tool events alike).
// - Composer sends messages AS THE TEAM (text / photo / location / contact);
//   sending auto-activates "Stop AI" so the bot never talks over a human.
// - Renders media: photos, videos, voice notes, documents, stickers,
//   location pins and contact cards.

import { useCallback, useEffect, useRef, useState } from "react";
import { sendStaffMessage } from "@/app/actions/chatbot";

export type TranscriptMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "STAFF" | "TOOL";
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  toolName: string | null;
  toolPayload: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
};

type Props = {
  locale: string;
  conversationId: string;
  channel: "WHATSAPP" | "WEB";
  initialMessages: TranscriptMessage[];
  initialAiPaused: boolean;
};

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function MediaBlock({ m }: { m: TranscriptMessage }) {
  if (!m.mediaUrl && m.mediaType !== "contact") return null;
  switch (m.mediaType) {
    case "image":
    case "sticker":
      return (
        <a href={m.mediaUrl!} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.mediaUrl!}
            alt=""
            className={`rounded-lg mb-1 ${m.mediaType === "sticker" ? "w-28" : "max-w-full max-h-64"}`}
          />
        </a>
      );
    case "video":
      return <video src={m.mediaUrl!} controls className="rounded-lg mb-1 max-w-full max-h-64" />;
    case "audio":
      return <audio src={m.mediaUrl!} controls className="mb-1 w-56 max-w-full" />;
    case "document":
      return (
        <a
          href={m.mediaUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 mb-1 underline"
        >
          📄 Document
        </a>
      );
    case "location":
      return m.mediaUrl ? (
        <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className="underline">
          🗺️ Open map
        </a>
      ) : null;
    default:
      return m.mediaUrl ? (
        <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className="underline">
          📎 Attachment
        </a>
      ) : null;
  }
}

export default function LiveTranscript({
  locale,
  conversationId,
  channel,
  initialMessages,
  initialAiPaused,
}: Props) {
  const isEn = locale === "en";
  const [messages, setMessages] = useState<TranscriptMessage[]>(initialMessages);
  const [aiPaused, setAiPaused] = useState(initialAiPaused);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachMode, setAttachMode] = useState<null | "location" | "contact">(null);
  const [locationInput, setLocationInput] = useState({ latitude: "", longitude: "", label: "" });
  const [contactInput, setContactInput] = useState({ name: "", phone: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)));
  const cursor = useRef<string>(
    initialMessages.length > 0
      ? initialMessages[initialMessages.length - 1].createdAt
      : new Date(0).toISOString(),
  );
  const stickToBottom = useRef(true);

  const appendMessages = useCallback((fresh: TranscriptMessage[]) => {
    const unseen = fresh.filter((m) => !seenIds.current.has(m.id));
    if (unseen.length === 0) return;
    for (const m of unseen) {
      seenIds.current.add(m.id);
      if (m.createdAt > cursor.current) cursor.current = m.createdAt;
    }
    setMessages((prev) => [...prev, ...unseen]);
  }, []);

  // ── Live polling ────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/chatbot/admin/messages?conversationId=${conversationId}&after=${encodeURIComponent(cursor.current)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          conversation?: { aiPaused: boolean };
          messages?: TranscriptMessage[];
        };
        if (data.conversation) setAiPaused(data.conversation.aiPaused);
        if (data.messages?.length) appendMessages(data.messages);
      } catch {
        /* transient network error — next tick retries */
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [conversationId, appendMessages]);

  // Auto-scroll only when the user is already near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTo({ top: el.scrollHeight });
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  // ── Sending as staff ────────────────────────────────────────────────────
  const submit = async (formData: FormData) => {
    setSending(true);
    setError(null);
    try {
      const result = await sendStaffMessage(conversationId, formData);
      if (!result.ok) {
        setError(result.error);
      } else {
        setAiPaused(true);
        appendMessages([
          {
            ...result.message,
            toolName: null,
            toolPayload: null,
            inputTokens: null,
            outputTokens: null,
          },
        ]);
        setText("");
        setAttachMode(null);
        setLocationInput({ latitude: "", longitude: "", label: "" });
        setContactInput({ name: "", phone: "" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const sendText = () => {
    if (!text.trim() || sending) return;
    const fd = new FormData();
    fd.set("kind", "text");
    fd.set("text", text.trim());
    submit(fd);
  };

  const sendPhoto = (file: File) => {
    const fd = new FormData();
    fd.set("kind", "photo");
    fd.set("photo", file);
    if (text.trim()) fd.set("text", text.trim());
    submit(fd);
  };

  const sendLocation = () => {
    const fd = new FormData();
    fd.set("kind", "location");
    fd.set("latitude", locationInput.latitude);
    fd.set("longitude", locationInput.longitude);
    fd.set("label", locationInput.label);
    submit(fd);
  };

  const sendContact = () => {
    const fd = new FormData();
    fd.set("kind", "contact");
    fd.set("contactName", contactInput.name);
    fd.set("contactPhone", contactInput.phone);
    submit(fd);
  };

  const attachBtn =
    "w-9 h-9 rounded-full flex items-center justify-center text-lg hover:bg-gray-200 transition-colors";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl flex flex-col h-[72vh] overflow-hidden">
      {/* Status strip */}
      <div
        className={`px-4 py-2 text-xs font-medium shrink-0 ${
          aiPaused ? "bg-violet-50 text-violet-700" : "bg-emerald-50 text-emerald-700"
        }`}
      >
        {aiPaused
          ? isEn
            ? "⏸ AI stopped — you are handling this chat. Messages you send below go straight to the customer."
            : "⏸ الذكاء متوقف — أنت تتولى المحادثة. الرسائل أدناه تصل للعميل مباشرة."
          : isEn
            ? "🤖 AI is replying automatically. Sending a message below stops the AI and hands the chat to you."
            : "🤖 البوت يرد تلقائياً. إرسال رسالة أدناه يوقف الذكاء ويسلمك المحادثة."}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-stone-100"
      >
        {messages.map((m) => {
          if (m.role === "TOOL") {
            return (
              <div key={m.id} className="flex justify-center">
                <details className="text-xs max-w-[90%]">
                  <summary className="cursor-pointer inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-700 font-medium">
                    🔧 {m.toolName} <span className="text-violet-400 font-normal">{timeOf(m.createdAt)}</span>
                  </summary>
                  <pre className="mt-2 p-3 rounded-xl bg-gray-900 text-gray-100 overflow-x-auto text-[11px] leading-relaxed max-w-full">
                    {JSON.stringify(m.toolPayload, null, 2)}
                  </pre>
                </details>
              </div>
            );
          }

          const isCustomer = m.role === "USER";
          const isStaff = m.role === "STAFF";
          const sentBy =
            isStaff && m.toolPayload && typeof m.toolPayload === "object"
              ? (m.toolPayload as { sentBy?: string }).sentBy
              : undefined;

          return (
            <div key={m.id} className={`flex ${isCustomer ? "" : "justify-end"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm whitespace-pre-wrap break-words ${
                  isCustomer
                    ? "bg-white text-gray-800 rounded-es-md"
                    : isStaff
                      ? "bg-emerald-600 text-white rounded-ee-md"
                      : "bg-nassayem text-white rounded-ee-md"
                }`}
              >
                {isStaff && (
                  <div className="text-[10px] font-semibold text-emerald-100 mb-0.5">
                    👤 {sentBy || (isEn ? "Staff" : "الموظف")}
                  </div>
                )}
                <MediaBlock m={m} />
                {m.content}
                <div
                  className={`text-[10px] mt-1 flex gap-2 justify-end ${
                    isCustomer ? "text-gray-400" : "text-white/70"
                  }`}
                >
                  {m.role === "ASSISTANT" && (m.inputTokens || m.outputTokens) ? (
                    <span>🤖 {(m.inputTokens ?? 0) + (m.outputTokens ?? 0)} tok</span>
                  ) : null}
                  <span>{timeOf(m.createdAt)}</span>
                </div>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">
            {isEn ? "No messages yet." : "لا توجد رسائل بعد."}
          </p>
        )}
      </div>

      {/* Error strip */}
      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-700 text-xs shrink-0 flex justify-between items-center">
          <span className="truncate">⚠ {error}</span>
          <button onClick={() => setError(null)} className="font-bold px-2">✕</button>
        </div>
      )}

      {/* Attach panels */}
      {attachMode === "location" && (
        <div className="px-4 py-2 border-t border-gray-200 flex flex-wrap gap-2 items-center shrink-0 bg-gray-50">
          <input
            placeholder={isEn ? "Latitude (e.g. 17.019)" : "خط العرض"}
            value={locationInput.latitude}
            onChange={(e) => setLocationInput((s) => ({ ...s, latitude: e.target.value }))}
            className="w-36 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
          />
          <input
            placeholder={isEn ? "Longitude (e.g. 54.089)" : "خط الطول"}
            value={locationInput.longitude}
            onChange={(e) => setLocationInput((s) => ({ ...s, longitude: e.target.value }))}
            className="w-36 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
          />
          <input
            placeholder={isEn ? "Label (optional)" : "الاسم (اختياري)"}
            value={locationInput.label}
            onChange={(e) => setLocationInput((s) => ({ ...s, label: e.target.value }))}
            className="flex-1 min-w-32 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
          />
          <button
            onClick={sendLocation}
            disabled={sending || !locationInput.latitude || !locationInput.longitude}
            className="px-3 py-1.5 rounded-lg bg-nassayem text-white text-xs font-medium disabled:opacity-40"
          >
            {isEn ? "Send pin" : "إرسال الموقع"} 📍
          </button>
        </div>
      )}
      {attachMode === "contact" && (
        <div className="px-4 py-2 border-t border-gray-200 flex flex-wrap gap-2 items-center shrink-0 bg-gray-50">
          <input
            placeholder={isEn ? "Contact name" : "اسم جهة الاتصال"}
            value={contactInput.name}
            onChange={(e) => setContactInput((s) => ({ ...s, name: e.target.value }))}
            className="flex-1 min-w-32 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
          />
          <input
            placeholder={isEn ? "Phone (+968...)" : "الهاتف"}
            dir="ltr"
            value={contactInput.phone}
            onChange={(e) => setContactInput((s) => ({ ...s, phone: e.target.value }))}
            className="w-40 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
          />
          <button
            onClick={sendContact}
            disabled={sending || !contactInput.name || !contactInput.phone}
            className="px-3 py-1.5 rounded-lg bg-nassayem text-white text-xs font-medium disabled:opacity-40"
          >
            {isEn ? "Send contact" : "إرسال جهة الاتصال"} 👤
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="px-3 py-2.5 border-t border-gray-200 flex items-end gap-1.5 shrink-0 bg-white">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) sendPhoto(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className={attachBtn}
          title={isEn ? "Send photo (caption = message box)" : "إرسال صورة"}
        >
          📷
        </button>
        <button
          onClick={() => setAttachMode(attachMode === "location" ? null : "location")}
          className={`${attachBtn} ${attachMode === "location" ? "bg-gray-200" : ""}`}
          title={isEn ? "Send location pin" : "إرسال موقع"}
        >
          📍
        </button>
        {channel === "WHATSAPP" && (
          <button
            onClick={() => setAttachMode(attachMode === "contact" ? null : "contact")}
            className={`${attachBtn} ${attachMode === "contact" ? "bg-gray-200" : ""}`}
            title={isEn ? "Send contact card" : "إرسال جهة اتصال"}
          >
            👤
          </button>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendText();
            }
          }}
          rows={1}
          placeholder={
            isEn ? "Reply as the team… (Enter to send)" : "رد باسم الفريق… (Enter للإرسال)"
          }
          className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/50 max-h-28"
        />
        <button
          onClick={sendText}
          disabled={sending || !text.trim()}
          className="px-4 py-2 rounded-xl bg-nassayem text-white text-sm font-medium hover:bg-nassayem-dark disabled:opacity-40"
        >
          {sending ? "…" : isEn ? "Send" : "إرسال"}
        </button>
      </div>
    </div>
  );
}
