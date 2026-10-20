"use client";

// One open conversation: header (customer + AI switch + actions), the live
// chat, and a collapsible customer-details panel (leads, escalation, usage).
// Status / AI state live here so the header, chat and panel stay in sync —
// updated optimistically by the header actions and live by the chat's polling.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Globe,
  PanelRightClose,
  PanelRightOpen,
  Wrench,
  X,
} from "lucide-react";
import type { ChatConversationStatus } from "@prisma/client";
import ConversationActions from "./ConversationActions";
import LiveTranscript, { type TranscriptMessage } from "./LiveTranscript";
import { avatarColor, initials, STATUS_STYLES } from "./inboxUtils";

type Lead = {
  id: string;
  name: string;
  phone: string;
  idNumber: string | null;
  reservationNumber: string | null;
  unitInterest: string | null;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
};

type Hold = { id: string; unitTitle: string; checkIn: string; checkOut: string; status: string };

type Props = {
  locale: string;
  canDelete: boolean;
  initialMessages: TranscriptMessage[];
  conversation: {
    id: string;
    channel: "WHATSAPP" | "WEB";
    externalId: string;
    customerName: string | null;
    language: string;
    status: ChatConversationStatus;
    aiPaused: boolean;
    escalationReason: string | null;
    escalatedAt: string | null;
    followUpStatus: string;
    createdAt: string;
  };
  leads: Lead[];
  holds: Hold[];
  usage: { inputTokens: number; outputTokens: number; costUsd: number; costOmr: number };
};

const PANEL_KEY = "nassayem.inbox.detailsOpen";
const TOOLS_KEY = "nassayem.inbox.showTools";

function readPref(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* storage unavailable — preference just isn't remembered */
  }
}

const FOLLOW_UP: Record<string, { en: string; ar: string; cls: string }> = {
  PENDING: { en: "Pending", ar: "قيد الانتظار", cls: "text-amber-700 bg-amber-50" },
  ASKED: { en: "Asked customer", ar: "تم سؤال العميل", cls: "text-sky-700 bg-sky-50" },
  CONTACTED: { en: "Contacted ✓", ar: "تم التواصل ✓", cls: "text-emerald-700 bg-emerald-50" },
  NOT_CONTACTED: { en: "Not contacted", ar: "لم يتم التواصل", cls: "text-rose-700 bg-rose-50" },
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
      className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-nassayem hover:bg-gray-100"
      title={label}
      aria-label={label}
    >
      {done ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-[13px]">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 font-medium text-end min-w-0 break-words">{children}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 py-4 border-b border-gray-100">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">{title}</h3>
      {children}
    </section>
  );
}

export default function ConversationWorkspace({
  locale,
  canDelete,
  initialMessages,
  conversation,
  leads,
  holds,
  usage,
}: Props) {
  const isEn = locale === "en";
  const [status, setStatus] = useState<ChatConversationStatus>(conversation.status);
  const [aiPaused, setAiPaused] = useState(conversation.aiPaused);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showTools, setShowTools] = useState(true);

  // Server refreshes (router.refresh after an action) are the source of truth.
  useEffect(() => setStatus(conversation.status), [conversation.status]);
  useEffect(() => setAiPaused(conversation.aiPaused), [conversation.aiPaused]);

  // Restore per-viewer layout preferences. The panel defaults open only on
  // very wide screens, where it doesn't squeeze the chat.
  useEffect(() => {
    setPanelOpen(readPref(PANEL_KEY, window.matchMedia("(min-width: 1536px)").matches));
    setShowTools(readPref(TOOLS_KEY, true));
  }, []);

  const togglePanel = () =>
    setPanelOpen((o) => {
      writePref(PANEL_KEY, !o);
      return !o;
    });
  const toggleTools = () =>
    setShowTools((s) => {
      writePref(TOOLS_KEY, !s);
      return !s;
    });

  const onSync = useCallback((s: { status?: ChatConversationStatus; aiPaused?: boolean }) => {
    if (s.status) setStatus(s.status);
    if (typeof s.aiPaused === "boolean") setAiPaused(s.aiPaused);
  }, []);

  const name = conversation.customerName || `+${conversation.externalId}`;
  const phone = conversation.channel === "WHATSAPP" ? `+${conversation.externalId}` : null;
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.ACTIVE;
  const followUp = status === "ESCALATED" ? FOLLOW_UP[conversation.followUpStatus] : undefined;
  const Back = isEn ? ArrowLeft : ArrowRight;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(isEn ? "en-GB" : "ar-OM", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const details = (
    <div className="h-full overflow-y-auto bg-white">
      {/* Identity */}
      <div className="px-5 pt-6 pb-5 flex flex-col items-center text-center border-b border-gray-100">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-semibold text-white ${avatarColor(conversation.externalId)}`}
        >
          {initials(name)}
        </div>
        <p className="mt-3 text-base font-semibold text-gray-900" dir="auto">
          {name}
        </p>
        {phone && (
          <div className="mt-0.5 flex items-center gap-0.5 text-sm text-gray-500" dir="ltr">
            {phone}
            <CopyButton value={phone} label={isEn ? "Copy phone" : "نسخ الرقم"} />
            <a
              href={`https://wa.me/${conversation.externalId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-nassayem hover:bg-gray-100"
              title={isEn ? "Open in WhatsApp" : "فتح في واتساب"}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
        <span className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${statusStyle.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
          {isEn ? statusStyle.en : statusStyle.ar}
        </span>
      </div>

      <Section title={isEn ? "Conversation" : "المحادثة"}>
        <Row label={isEn ? "Channel" : "القناة"}>
          {conversation.channel === "WHATSAPP" ? "WhatsApp" : isEn ? "Website chat" : "دردشة الموقع"}
        </Row>
        {!phone && (
          <Row label={isEn ? "Session" : "الجلسة"}>
            <span className="font-mono text-xs" dir="ltr">{conversation.externalId.slice(0, 13)}…</span>
          </Row>
        )}
        <Row label={isEn ? "Language" : "اللغة"}>{conversation.language === "ar" ? "العربية" : "English"}</Row>
        <Row label={isEn ? "Started" : "البداية"}>
          <span dir="ltr">{fmtDate(conversation.createdAt)}</span>
        </Row>
        <Row label={isEn ? "Replies by" : "الرد بواسطة"}>
          {aiPaused ? (isEn ? "Team (AI stopped)" : "الفريق (الذكاء متوقف)") : isEn ? "AI assistant" : "المساعد الذكي"}
        </Row>
      </Section>

      {status === "ESCALATED" && (conversation.escalationReason || followUp) && (
        <Section title={isEn ? "Escalation" : "التصعيد"}>
          {conversation.escalationReason && (
            <p className="text-[13px] text-rose-800 bg-rose-50 rounded-lg px-3 py-2 leading-relaxed" dir="auto">
              {conversation.escalationReason}
            </p>
          )}
          {conversation.escalatedAt && (
            <Row label={isEn ? "Escalated" : "وقت التصعيد"}>
              <span dir="ltr">{fmtDate(conversation.escalatedAt)}</span>
            </Row>
          )}
          {followUp && (
            <Row label={isEn ? "Follow-up" : "المتابعة"}>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${followUp.cls}`}>
                {isEn ? followUp.en : followUp.ar}
              </span>
            </Row>
          )}
        </Section>
      )}

      {leads.length > 0 && (
        <Section title={isEn ? `Leads & reservations (${leads.length})` : `العملاء المحتملون والحجوزات (${leads.length})`}>
          <div className="space-y-2.5">
            {leads.map((l) => (
              <div key={l.id} className="rounded-xl ring-1 ring-gray-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900 truncate" dir="auto">{l.name}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{l.status}</span>
                </div>
                <div className="mt-1.5 space-y-0.5 text-xs text-gray-600">
                  <p dir="ltr" className="text-start">{l.phone}</p>
                  {l.reservationNumber && (
                    <p className="flex items-center gap-1">
                      <span className="text-gray-400">{isEn ? "Res #" : "رقم الحجز"}</span>
                      <span className="font-mono font-semibold text-nassayem-dark" dir="ltr">{l.reservationNumber}</span>
                      <CopyButton value={l.reservationNumber} label={isEn ? "Copy" : "نسخ"} />
                    </p>
                  )}
                  {l.idNumber && (
                    <p>
                      <span className="text-gray-400">{isEn ? "ID / Passport " : "الهوية/الجواز "}</span>
                      <span className="font-mono" dir="ltr">{l.idNumber}</span>
                    </p>
                  )}
                  {l.checkIn && l.checkOut && (
                    <p dir="ltr" className="text-start">{l.checkIn} → {l.checkOut}</p>
                  )}
                  {l.unitInterest && <p className="text-gray-500" dir="auto">{l.unitInterest}</p>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {holds.length > 0 && (
        <Section title={isEn ? "Holds" : "الحجوزات المؤقتة"}>
          {holds.map((h) => (
            <p key={h.id} className="text-xs text-gray-600 py-0.5">
              {h.unitTitle} · <span dir="ltr">{h.checkIn} → {h.checkOut}</span> · {h.status}
            </p>
          ))}
        </Section>
      )}

      <Section title={isEn ? "AI usage" : "استهلاك الذكاء"}>
        <Row label={isEn ? "Input tokens" : "توكنز الإدخال"}>{usage.inputTokens.toLocaleString()}</Row>
        <Row label={isEn ? "Output tokens" : "توكنز الإخراج"}>{usage.outputTokens.toLocaleString()}</Row>
        <Row label={isEn ? "Est. cost" : "التكلفة التقديرية"}>
          <span dir="ltr">
            ${usage.costUsd.toFixed(4)} · {usage.costOmr.toFixed(4)} {isEn ? "OMR" : "ر.ع."}
          </span>
        </Row>
      </Section>
    </div>
  );

  const iconBtn =
    "w-9 h-9 rounded-full flex items-center justify-center transition-colors";

  return (
    <div className="h-full flex">
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <header className="h-16 px-2 sm:px-4 bg-white border-b border-gray-200 flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            href={`/${locale}/admin/chatbot/conversations`}
            className={`lg:hidden ${iconBtn} text-gray-600 hover:bg-gray-100`}
            aria-label={isEn ? "Back to conversations" : "رجوع للمحادثات"}
          >
            <Back className="w-5 h-5" />
          </Link>

          <button
            type="button"
            onClick={togglePanel}
            className="flex items-center gap-3 min-w-0 flex-1 text-start rounded-xl -mx-1 px-1 py-1 hover:bg-gray-50"
            title={isEn ? "Customer details" : "تفاصيل العميل"}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0 ${avatarColor(conversation.externalId)}`}
            >
              {initials(name)}
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-gray-900 truncate leading-tight" dir="auto">
                {name}
              </p>
              <p className="text-xs text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                {conversation.channel === "WHATSAPP" ? (
                  <span className="w-2 h-2 rounded-full bg-[#25D366]" />
                ) : (
                  <Globe className="w-3 h-3 text-sky-500" />
                )}
                <span dir="ltr">{phone ?? (isEn ? "Website visitor" : "زائر الموقع")}</span>
                {status !== "ACTIVE" && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className={`font-semibold ${status === "ESCALATED" ? "text-rose-600" : status === "PENDING_RETRY" ? "text-amber-600" : "text-gray-500"}`}>
                      {isEn ? statusStyle.en : statusStyle.ar}
                    </span>
                  </>
                )}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <ConversationActions
              locale={locale}
              conversationId={conversation.id}
              status={status}
              aiPaused={aiPaused}
              canDelete={canDelete}
              onAiPausedChange={setAiPaused}
              onStatusChange={setStatus}
            />
            <button
              type="button"
              onClick={toggleTools}
              aria-pressed={showTools}
              className={`hidden sm:flex ${iconBtn} ${showTools ? "text-nassayem bg-nassayem/10" : "text-gray-500 hover:bg-gray-100"}`}
              title={isEn ? "Show AI tool activity" : "إظهار عمليات المساعد الذكي"}
            >
              <Wrench className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button"
              onClick={togglePanel}
              aria-pressed={panelOpen}
              className={`${iconBtn} ${panelOpen ? "text-nassayem bg-nassayem/10" : "text-gray-500 hover:bg-gray-100"}`}
              title={isEn ? "Customer details" : "تفاصيل العميل"}
            >
              {panelOpen ? (
                <PanelRightClose className="w-[18px] h-[18px] rtl:-scale-x-100" />
              ) : (
                <PanelRightOpen className="w-[18px] h-[18px] rtl:-scale-x-100" />
              )}
            </button>
          </div>
        </header>

        {/* Escalation banner — the one thing staff must not miss */}
        {status === "ESCALATED" && conversation.escalationReason && (
          <div className="px-4 py-2 bg-rose-50 border-b border-rose-100 text-[13px] text-rose-800 flex items-center gap-2 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            <span className="truncate" dir="auto">{conversation.escalationReason}</span>
          </div>
        )}

        <div className="flex-1 min-h-0">
          <LiveTranscript
            locale={locale}
            conversationId={conversation.id}
            channel={conversation.channel}
            initialMessages={initialMessages}
            aiPaused={aiPaused}
            showTools={showTools}
            onSync={onSync}
            onAiPausedChange={setAiPaused}
          />
        </div>
      </div>

      {/* Details panel: inline column on wide screens, slide-over below xl */}
      {panelOpen && (
        <>
          <aside className="hidden xl:block w-[320px] shrink-0 border-s border-gray-200">{details}</aside>
          <div className="xl:hidden fixed inset-0 z-40 flex justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={togglePanel} />
            <div className="relative w-[min(340px,90vw)] h-full shadow-2xl">
              <button
                onClick={togglePanel}
                className="absolute top-3 end-3 z-10 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-gray-500 hover:bg-gray-100"
                aria-label={isEn ? "Close details" : "إغلاق التفاصيل"}
              >
                <X className="w-4 h-4" />
              </button>
              {details}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
