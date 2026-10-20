"use client";

// WhatsApp-style live conversation view for the admin panel.
// - Polls /api/chatbot/admin/messages every 4s → new messages appear without
//   reloading (customer, bot, staff and tool events alike), and reports the
//   conversation's status / AI state up so the header stays in sync.
// - Composer sends messages AS THE TEAM (text / photo / location / contact);
//   sending auto-activates "Stop AI" so the bot never talks over a human.
// - Renders media: photos, videos, voice notes, documents, stickers,
//   location pins and contact cards.

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  Clock,
  FileText,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Paperclip,
  SendHorizontal,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import type { ChatConversationStatus } from "@prisma/client";
import { sendStaffMessage } from "@/app/actions/chatbot";
import { compressImageIfNeeded, dayLabel, timeOf } from "./inboxUtils";

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
  aiPaused: boolean;
  /** Show the bot's tool calls (search, availability, reservation…) inline. */
  showTools: boolean;
  /** Live header state from polling. */
  onSync: (s: { status?: ChatConversationStatus; aiPaused?: boolean }) => void;
  /** Sending as staff pauses the AI. */
  onAiPausedChange: (paused: boolean) => void;
};

const WA_WINDOW_MS = 24 * 60 * 60 * 1000;
const URL_RE = /(https?:\/\/[^\s]+)/g;

/** Plain text with bare URLs turned into links (no HTML injection — React escapes the rest). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 break-all text-sky-700"
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function MediaBlock({ m, isEn }: { m: TranscriptMessage; isEn: boolean }) {
  if (!m.mediaUrl && m.mediaType !== "contact") return null;
  const card =
    "flex items-center gap-2.5 mb-1.5 px-3 py-2 rounded-lg bg-black/[0.04] hover:bg-black/[0.07] transition-colors no-underline";
  switch (m.mediaType) {
    case "image":
    case "sticker":
      return (
        <a href={m.mediaUrl!} target="_blank" rel="noopener noreferrer" className="block -mx-1 -mt-0.5 mb-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.mediaUrl!}
            alt=""
            loading="lazy"
            className={`rounded-lg ${m.mediaType === "sticker" ? "w-28" : "w-full max-w-[320px] max-h-80 object-cover"}`}
          />
        </a>
      );
    case "video":
      return <video src={m.mediaUrl!} controls className="rounded-lg mb-1.5 w-full max-w-[320px] max-h-80" />;
    case "audio":
      return <audio src={m.mediaUrl!} controls className="mb-1.5 w-64 max-w-full" />;
    case "document":
      return (
        <a href={m.mediaUrl!} target="_blank" rel="noopener noreferrer" className={card}>
          <FileText className="w-5 h-5 text-rose-500 shrink-0" />
          <span className="text-sm font-medium">{isEn ? "Document" : "مستند"}</span>
        </a>
      );
    case "location":
      return m.mediaUrl ? (
        <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className={card}>
          <MapPin className="w-5 h-5 text-rose-500 shrink-0" />
          <span className="text-sm font-medium">{isEn ? "Open in Maps" : "فتح الخريطة"}</span>
        </a>
      ) : null;
    default:
      return m.mediaUrl ? (
        <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className={card}>
          <Paperclip className="w-5 h-5 text-gray-500 shrink-0" />
          <span className="text-sm font-medium">{isEn ? "Attachment" : "مرفق"}</span>
        </a>
      ) : null;
  }
}

function ToolChip({ m }: { m: TranscriptMessage }) {
  const failed = m.content.endsWith("→ error");
  return (
    <div className="flex justify-center my-1">
      <details className="group text-xs max-w-[92%]">
        <summary
          className={`list-none cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ring-1 select-none ${
            failed
              ? "bg-rose-50 text-rose-700 ring-rose-200"
              : "bg-white/80 text-gray-500 ring-gray-200 hover:text-gray-700"
          }`}
        >
          {failed ? <AlertTriangle className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
          <span className="font-mono">{m.toolName}</span>
          <span className="text-gray-400 font-normal">{timeOf(m.createdAt)}</span>
          <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
        </summary>
        <pre
          dir="ltr"
          className="mt-2 p-3 rounded-xl bg-gray-900 text-gray-100 overflow-auto max-h-80 text-[11px] leading-relaxed text-left"
        >
          {JSON.stringify(m.toolPayload, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export default function LiveTranscript({
  locale,
  conversationId,
  channel,
  initialMessages,
  aiPaused,
  showTools,
  onSync,
  onAiPausedChange,
}: Props) {
  const isEn = locale === "en";
  const [messages, setMessages] = useState<TranscriptMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [attachMode, setAttachMode] = useState<null | "location" | "contact">(null);
  const [locationInput, setLocationInput] = useState({ latitude: "", longitude: "", label: "" });
  const [contactInput, setContactInput] = useState({ name: "", phone: "" });
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)));
  const cursor = useRef<string>(
    initialMessages.length > 0
      ? initialMessages[initialMessages.length - 1].createdAt
      : new Date(0).toISOString(),
  );
  const stickToBottom = useRef(true);

  const appendMessages = useCallback((fresh: TranscriptMessage[]) => {
    const news = fresh.filter((m) => !seenIds.current.has(m.id));
    if (news.length === 0) return;
    for (const m of news) {
      seenIds.current.add(m.id);
      if (m.createdAt > cursor.current) cursor.current = m.createdAt;
    }
    if (!stickToBottom.current) {
      setUnseen((n) => n + news.filter((m) => m.role !== "TOOL").length);
    }
    setMessages((prev) => [...prev, ...news]);
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
          conversation?: { aiPaused: boolean; status: ChatConversationStatus };
          messages?: TranscriptMessage[];
        };
        if (data.conversation) onSync(data.conversation);
        if (data.messages?.length) appendMessages(data.messages);
      } catch {
        /* transient network error — next tick retries */
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [conversationId, appendMessages, onSync]);

  // Open at the latest message; afterwards follow new messages only when the
  // reader is already at the bottom (never yank them away from history).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, showTools]);

  // Images and media load after the first paint and grow the content — keep
  // the view pinned to the latest message while the reader is at the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stickToBottom.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickToBottom.current = bottom;
    setAtBottom(bottom);
    if (bottom) setUnseen(0);
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    stickToBottom.current = true;
    setUnseen(0);
  };

  // Auto-grow the composer up to ~6 lines.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [text]);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.preview);
  }, [photo]);

  // ── Derived view ────────────────────────────────────────────────────────
  const visible = useMemo(
    () => (showTools ? messages : messages.filter((m) => m.role !== "TOOL")),
    [messages, showTools],
  );

  // WhatsApp only allows free-form business messages within 24h of the
  // customer's last message — warn before staff hit a delivery error.
  const lastCustomerAt = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "USER") return new Date(messages[i].createdAt).getTime();
    }
    return null;
  }, [messages]);
  const windowClosed =
    channel === "WHATSAPP" && lastCustomerAt !== null && Date.now() - lastCustomerAt > WA_WINDOW_MS;

  // ── Sending as staff ────────────────────────────────────────────────────
  const submit = async (formData: FormData) => {
    setSending(true);
    setError(null);
    stickToBottom.current = true;
    try {
      const result = await sendStaffMessage(conversationId, formData);
      if (!result.ok) {
        setError(result.error);
      } else {
        onAiPausedChange(true);
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
        setPhoto(null);
        setAttachMode(null);
        setLocationInput({ latitude: "", longitude: "", label: "" });
        setContactInput({ name: "", phone: "" });
        textareaRef.current?.focus();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const send = () => {
    if (sending) return;
    const fd = new FormData();
    if (photo) {
      fd.set("kind", "photo");
      fd.set("photo", photo.file);
      if (text.trim()) fd.set("text", text.trim());
    } else {
      if (!text.trim()) return;
      fd.set("kind", "text");
      fd.set("text", text.trim());
    }
    submit(fd);
  };

  const pickPhoto = async (picked: File) => {
    if (!picked.type.startsWith("image/")) return;
    setMenuOpen(false);
    setAttachMode(null);
    setError(null);
    setCompressing(true);
    try {
      // Server Actions reject bodies over 1 MB — shrink big photos first.
      const file = await compressImageIfNeeded(picked);
      setPhoto({ file, preview: URL.createObjectURL(file) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCompressing(false);
      textareaRef.current?.focus();
    }
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

  const canSend = !sending && !compressing && (!!photo || !!text.trim());
  const field =
    "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem/40";

  return (
    <div className="relative flex flex-col h-full">
      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-6 lg:px-10 py-4"
        style={{
          backgroundImage: "radial-gradient(rgba(42,116,117,0.07) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      >
        <div ref={contentRef} className="max-w-4xl mx-auto">
          {visible.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-12">
              {isEn ? "No messages yet." : "لا توجد رسائل بعد."}
            </p>
          )}

          {visible.map((m, i) => {
            const prev = visible[i - 1];
            const newDay =
              !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
            const separator = newDay ? (
              <div className="flex justify-center my-4 sticky top-1 z-10">
                <span className="px-3 py-1 rounded-lg bg-white/95 shadow-sm text-[11px] font-medium text-gray-500">
                  {dayLabel(m.createdAt, locale)}
                </span>
              </div>
            ) : null;

            if (m.role === "TOOL") {
              return (
                <Fragment key={m.id}>
                  {separator}
                  <ToolChip m={m} />
                </Fragment>
              );
            }

            const isCustomer = m.role === "USER";
            const isStaff = m.role === "STAFF";
            // Group consecutive bubbles from the same sender (tool rows don't break a run).
            let p = i - 1;
            while (p >= 0 && visible[p].role === "TOOL") p--;
            const groupedWithPrev = !newDay && p >= 0 && visible[p].role === m.role;
            const sentBy =
              isStaff && m.toolPayload && typeof m.toolPayload === "object"
                ? (m.toolPayload as { sentBy?: string }).sentBy
                : undefined;

            return (
              <Fragment key={m.id}>
                {separator}
                <div className={`flex ${isCustomer ? "justify-start" : "justify-end"} ${groupedWithPrev ? "mt-0.5" : "mt-3"}`}>
                  <div
                    className={`relative max-w-[85%] sm:max-w-[70%] px-3 pt-2 pb-1.5 text-[14.5px] leading-relaxed shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] whitespace-pre-wrap break-words ${
                      isCustomer
                        ? "bg-white text-gray-900"
                        : isStaff
                          ? "bg-[#d9fdd3] text-gray-900"
                          : "bg-[#e3f1f0] text-gray-900"
                    } ${
                      groupedWithPrev
                        ? "rounded-2xl"
                        : isCustomer
                          ? "rounded-2xl rounded-ss-md"
                          : "rounded-2xl rounded-se-md"
                    }`}
                  >
                    {!groupedWithPrev && !isCustomer && (
                      <div
                        className={`flex items-center gap-1 text-[11px] font-semibold mb-0.5 ${
                          isStaff ? "text-emerald-700" : "text-nassayem"
                        }`}
                      >
                        {isStaff ? <UserRound className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                        {isStaff ? sentBy || (isEn ? "Team" : "الفريق") : isEn ? "AI assistant" : "المساعد الذكي"}
                      </div>
                    )}
                    <MediaBlock m={m} isEn={isEn} />
                    <span dir="auto" className="block">
                      <Linkified text={m.content} />
                    </span>
                    <div className="flex items-center justify-end gap-2 mt-0.5 text-[10.5px] text-gray-400 select-none" dir="ltr">
                      {showTools && m.role === "ASSISTANT" && (m.inputTokens || m.outputTokens) ? (
                        <span title={isEn ? "Tokens used for this reply" : "التوكنز المستخدمة"}>
                          {((m.inputTokens ?? 0) + (m.outputTokens ?? 0)).toLocaleString()} tok
                        </span>
                      ) : null}
                      <span>{timeOf(m.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* Jump to latest */}
      {!atBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute end-5 bottom-24 z-20 w-10 h-10 rounded-full bg-white shadow-lg ring-1 ring-black/5 flex items-center justify-center text-gray-600 hover:text-nassayem"
          aria-label={isEn ? "Jump to latest message" : "الانتقال لآخر رسالة"}
        >
          <ChevronDown className="w-5 h-5" />
          {unseen > 0 && (
            <span className="absolute -top-1.5 -end-1.5 min-w-[20px] h-5 px-1 rounded-full bg-nassayem text-white text-[11px] font-bold flex items-center justify-center">
              {unseen}
            </span>
          )}
        </button>
      )}

      {/* Composer area */}
      <div className="shrink-0 bg-[#f0f2f5] border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-2 pb-3 space-y-2">
          {/* Context notices */}
          {windowClosed && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-800 text-xs ring-1 ring-amber-200">
              <Clock className="w-4 h-4 shrink-0 mt-px" />
              <span>
                {isEn
                  ? "The customer's last message was over 24h ago — WhatsApp may reject free-form replies until they write again."
                  : "آخر رسالة من العميل قبل أكثر من 24 ساعة — قد يرفض واتساب الرسائل الحرة حتى يراسلنا العميل مجدداً."}
              </span>
            </div>
          )}
          {!aiPaused && (
            <div className="flex items-center gap-2 text-[11.5px] text-gray-500 px-1">
              <Bot className="w-3.5 h-3.5 text-nassayem shrink-0" />
              {isEn
                ? "The AI is replying to this customer. Sending a message will pause it and hand the chat to you."
                : "البوت يرد على هذا العميل. إرسال رسالة سيوقفه ويسلمك المحادثة."}
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs ring-1 ring-red-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              <span className="flex-1 break-words">{error}</span>
              <button onClick={() => setError(null)} aria-label="Dismiss">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Attach panels */}
          {attachMode === "location" && (
            <div className="p-3 rounded-xl bg-white ring-1 ring-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-500" /> {isEn ? "Send a location pin" : "إرسال موقع"}
                </span>
                <button onClick={() => setAttachMode(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input dir="ltr" placeholder={isEn ? "Latitude (17.019)" : "خط العرض"} value={locationInput.latitude}
                  onChange={(e) => setLocationInput((s) => ({ ...s, latitude: e.target.value }))} className={field} />
                <input dir="ltr" placeholder={isEn ? "Longitude (54.089)" : "خط الطول"} value={locationInput.longitude}
                  onChange={(e) => setLocationInput((s) => ({ ...s, longitude: e.target.value }))} className={field} />
              </div>
              <div className="flex gap-2">
                <input placeholder={isEn ? "Label (optional)" : "الاسم (اختياري)"} value={locationInput.label}
                  onChange={(e) => setLocationInput((s) => ({ ...s, label: e.target.value }))} className={`${field} flex-1`} />
                <button onClick={sendLocation} disabled={sending || !locationInput.latitude || !locationInput.longitude}
                  className="px-4 rounded-lg bg-nassayem text-white text-sm font-medium hover:bg-nassayem-dark disabled:opacity-40">
                  {isEn ? "Send" : "إرسال"}
                </button>
              </div>
            </div>
          )}
          {attachMode === "contact" && (
            <div className="p-3 rounded-xl bg-white ring-1 ring-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                  <UserRound className="w-4 h-4 text-sky-600" /> {isEn ? "Send a contact card" : "إرسال جهة اتصال"}
                </span>
                <button onClick={() => setAttachMode(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex flex-wrap gap-2">
                <input placeholder={isEn ? "Contact name" : "اسم جهة الاتصال"} value={contactInput.name}
                  onChange={(e) => setContactInput((s) => ({ ...s, name: e.target.value }))} className={`${field} flex-1 min-w-36`} />
                <input dir="ltr" placeholder="+968…" value={contactInput.phone}
                  onChange={(e) => setContactInput((s) => ({ ...s, phone: e.target.value }))} className={`${field} w-40`} />
                <button onClick={sendContact} disabled={sending || !contactInput.name || !contactInput.phone}
                  className="px-4 py-2 rounded-lg bg-nassayem text-white text-sm font-medium hover:bg-nassayem-dark disabled:opacity-40">
                  {isEn ? "Send" : "إرسال"}
                </button>
              </div>
            </div>
          )}

          {compressing && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white ring-1 ring-gray-200 text-xs text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin text-nassayem" />
              {isEn ? "Optimizing photo for sending…" : "جارٍ تجهيز الصورة للإرسال…"}
            </div>
          )}

          {/* Photo preview — the message box becomes its caption */}
          {photo && (
            <div className="flex items-center gap-3 p-2 rounded-xl bg-white ring-1 ring-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.preview} alt="" className="w-14 h-14 rounded-lg object-cover" />
              <div className="flex-1 min-w-0 text-xs">
                <p className="font-medium text-gray-800 truncate">{photo.file.name}</p>
                <p className="text-gray-500">
                  {isEn ? "Type a caption below (optional), then send." : "اكتب تعليقاً أدناه (اختياري) ثم أرسل."}
                </p>
              </div>
              <button onClick={() => setPhoto(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label={isEn ? "Remove photo" : "إزالة الصورة"}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Composer */}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) pickPhoto(file);
                e.target.value = "";
              }}
            />
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                disabled={sending}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                  menuOpen ? "bg-gray-200 text-gray-800" : "text-gray-500 hover:bg-gray-200"
                }`}
                title={isEn ? "Attach" : "إرفاق"}
              >
                <Paperclip className="w-5 h-5" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                  <div role="menu" className="absolute bottom-12 start-0 z-30 w-48 p-1.5 bg-white rounded-xl shadow-xl ring-1 ring-black/5">
                    <button role="menuitem" onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-gray-100">
                      <ImageIcon className="w-4 h-4 text-violet-600" /> {isEn ? "Photo" : "صورة"}
                    </button>
                    <button role="menuitem" onClick={() => { setAttachMode("location"); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-gray-100">
                      <MapPin className="w-4 h-4 text-rose-500" /> {isEn ? "Location" : "موقع"}
                    </button>
                    {channel === "WHATSAPP" && (
                      <button role="menuitem" onClick={() => { setAttachMode("contact"); setMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-gray-100">
                        <UserRound className="w-4 h-4 text-sky-600" /> {isEn ? "Contact" : "جهة اتصال"}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <textarea
              ref={textareaRef}
              value={text}
              dir="auto"
              onChange={(e) => setText(e.target.value)}
              onPaste={(e) => {
                const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
                if (file) {
                  e.preventDefault();
                  pickPhoto(file);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={
                photo
                  ? isEn ? "Add a caption…" : "أضف تعليقاً…"
                  : isEn ? "Type a message" : "اكتب رسالة"
              }
              className="flex-1 resize-none rounded-2xl bg-white px-4 py-[11px] text-[14.5px] leading-snug ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-nassayem/40 placeholder:text-gray-400"
            />

            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              className="w-11 h-11 rounded-full bg-nassayem text-white flex items-center justify-center shadow-sm hover:bg-nassayem-dark disabled:bg-gray-300 disabled:shadow-none transition-colors"
              title={isEn ? "Send (Enter) · New line (Shift+Enter)" : "إرسال (Enter) · سطر جديد (Shift+Enter)"}
              aria-label={isEn ? "Send" : "إرسال"}
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <SendHorizontal className="w-5 h-5 rtl:-scale-x-100" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
