"use client";

// WhatsApp-style inbox list: searchable, filterable, LIVE conversation list
// (polls every 6s so new customer messages float chats to the top).
// Sits on the start side — right in the Arabic admin, left in English,
// exactly like WhatsApp Web follows the UI direction.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bot,
  Download,
  Globe,
  Image as ImageIcon,
  Mic,
  Paperclip,
  PauseCircle,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { avatarColor, initials, listTimeLabel, STATUS_STYLES } from "./inboxUtils";

type ConversationItem = {
  id: string;
  channel: "WHATSAPP" | "WEB";
  customerName: string | null;
  externalId: string;
  status: "ACTIVE" | "ESCALATED" | "CLOSED" | "PENDING_RETRY";
  aiPaused: boolean;
  language: string;
  lastMessageAt: string;
  preview: string;
  lastRole: "USER" | "ASSISTANT" | "STAFF" | null;
  lastMediaType: string | null;
};

type Counts = { ALL: number; ACTIVE: number; ESCALATED: number; CLOSED: number; PENDING_RETRY: number };

// NEEDS_REPLY is a client-side view over ALL: the customer spoke last and the
// chat isn't closed — i.e. somebody (bot or human) still owes them an answer.
const TABS = [
  { key: "ALL", en: "All", ar: "الكل" },
  { key: "NEEDS_REPLY", en: "Awaiting reply", ar: "بانتظار الرد" },
  { key: "ESCALATED", en: "Escalated", ar: "مصعّدة" },
  { key: "ACTIVE", en: "Active", ar: "نشطة" },
  { key: "PENDING_RETRY", en: "Retry", ar: "إعادة محاولة" },
  { key: "CLOSED", en: "Closed", ar: "مغلقة" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const needsReply = (c: ConversationItem) => c.lastRole === "USER" && c.status !== "CLOSED";

function PreviewIcon({ c }: { c: ConversationItem }) {
  const cls = "w-3.5 h-3.5 shrink-0";
  if (c.lastMediaType?.startsWith("image")) return <ImageIcon className={`${cls} text-gray-400`} />;
  if (c.lastMediaType === "audio") return <Mic className={`${cls} text-gray-400`} />;
  if (c.lastMediaType && c.lastMediaType !== "location") return <Paperclip className={`${cls} text-gray-400`} />;
  if (c.lastRole === "ASSISTANT") return <Bot className={`${cls} text-nassayem`} />;
  if (c.lastRole === "STAFF") return <UserRound className={`${cls} text-emerald-600`} />;
  return null;
}

export default function ConversationsSidebar({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const params = useParams<{ id?: string }>();
  const activeId = params?.id;

  const [items, setItems] = useState<ConversationItem[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [tab, setTab] = useState<TabKey>("ALL");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [loading, setLoading] = useState(true);
  const queryRef = useRef({ tab: "ALL" as string, q: "" });
  queryRef.current = { tab: tab === "NEEDS_REPLY" ? "ALL" : tab, q: debouncedQ };

  // Debounce typing so every keystroke doesn't hit the API.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      try {
        const { tab, q } = queryRef.current;
        const res = await fetch(
          `/api/chatbot/admin/conversations?status=${tab}&q=${encodeURIComponent(q)}`,
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setItems(data.conversations ?? []);
        setCounts(data.counts ?? null);
        setLoading(false);
      } catch {
        /* transient — next poll retries */
      }
    };
    load();
    const interval = setInterval(load, 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tab, debouncedQ]);

  const visible = useMemo(
    () => (tab === "NEEDS_REPLY" ? items.filter(needsReply) : items),
    [items, tab],
  );

  const tabCount = (key: TabKey): number | null => {
    if (key === "NEEDS_REPLY") return tab === "NEEDS_REPLY" || tab === "ALL" ? items.filter(needsReply).length : null;
    return counts ? counts[key] : null;
  };

  return (
    <div className="flex flex-col h-full bg-white border-e border-gray-200">
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between gap-2 border-b border-gray-100 shrink-0">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900 leading-tight">
            {isEn ? "Messaging" : "المراسلات"}
          </h2>
          <p className="text-[11px] text-gray-500">
            {counts
              ? isEn
                ? `${counts.ALL} conversations`
                : `${counts.ALL} محادثة`
              : " "}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={`/api/chatbot/admin/export?format=md&redact=1&status=${tab === "NEEDS_REPLY" ? "ALL" : tab}`}
            download
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-nassayem transition-colors"
            title={
              isEn
                ? "Export this tab as Markdown for analysis (phones masked)"
                : "تصدير هذا التبويب للتحليل (الأرقام مخفية)"
            }
          >
            <Download className="w-[18px] h-[18px]" />
          </a>
          <Link
            href={`/${locale}/admin/chatbot/report`}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-nassayem transition-colors"
            title={isEn ? "Daily executive report" : "التقرير التنفيذي اليومي"}
          >
            <BarChart3 className="w-[18px] h-[18px]" />
          </Link>
        </div>
      </div>

      {/* Search + filters */}
      <div className="px-3 pt-3 pb-2 shrink-0 space-y-2.5 border-b border-gray-100">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQ("")}
            placeholder={
              isEn ? "Search name, phone, ID or reservation #" : "ابحث بالاسم أو الهاتف أو الهوية أو رقم الحجز"
            }
            className="w-full rounded-xl bg-gray-100 ps-9 pe-9 py-2 text-sm placeholder:text-gray-400 border border-transparent focus:bg-white focus:border-nassayem/40 focus:outline-none focus:ring-2 focus:ring-nassayem/20 transition"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute top-1/2 -translate-y-1/2 end-2 w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              aria-label={isEn ? "Clear search" : "مسح البحث"}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const n = tabCount(t.key);
            const selected = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  selected
                    ? "bg-nassayem text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {isEn ? t.en : t.ar}
                {n !== null && n > 0 && (
                  <span
                    className={`min-w-[18px] px-1 rounded-full text-[10px] leading-[18px] text-center ${
                      selected
                        ? "bg-white/25"
                        : t.key === "NEEDS_REPLY" || t.key === "ESCALATED"
                          ? "bg-nassayem text-white"
                          : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && items.length === 0 && (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/2 rounded bg-gray-100" />
                  <div className="h-2.5 w-4/5 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16 text-gray-400">
            <Search className="w-8 h-8 mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">
              {debouncedQ
                ? isEn
                  ? "No conversations match your search"
                  : "لا توجد محادثات مطابقة للبحث"
                : isEn
                  ? "Nothing here — all caught up"
                  : "لا يوجد شيء هنا"}
            </p>
          </div>
        )}

        {visible.map((c) => {
          const isActive = c.id === activeId;
          const name = c.customerName || `+${c.externalId}`;
          const waiting = needsReply(c);
          const status = STATUS_STYLES[c.status];
          return (
            <Link
              key={c.id}
              href={`/${locale}/admin/chatbot/conversations/${c.id}`}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex items-center gap-3 px-4 py-3 transition-colors ${
                isActive ? "bg-nassayem/[0.08]" : "hover:bg-gray-50"
              }`}
            >
              {isActive && <span className="absolute inset-y-2 start-0 w-1 rounded-e-full bg-nassayem" />}

              {/* Avatar + channel badge */}
              <div className="relative shrink-0">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-white text-sm ${avatarColor(c.externalId)}`}
                >
                  {initials(name)}
                </div>
                <span
                  className={`absolute -bottom-0.5 -end-0.5 w-5 h-5 rounded-full ring-2 ring-white flex items-center justify-center ${
                    c.channel === "WHATSAPP" ? "bg-[#25D366]" : "bg-sky-500"
                  }`}
                  title={c.channel === "WHATSAPP" ? "WhatsApp" : isEn ? "Website" : "الموقع"}
                >
                  {c.channel === "WHATSAPP" ? (
                    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white" aria-hidden>
                      <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.5.1.3.6 1 1.3 1.6.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.7-.9c.2-.2.3-.2.6-.1l1.9.9c.3.1.4.2.5.3.1.2.1.7-.1 1.3z" />
                    </svg>
                  ) : (
                    <Globe className="w-3 h-3 text-white" />
                  )}
                </span>
              </div>

              {/* Name + preview */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`truncate text-[15px] ${
                      waiting || isActive ? "font-semibold text-gray-900" : "font-medium text-gray-800"
                    }`}
                    dir="auto"
                  >
                    {name}
                  </span>
                  <span
                    className={`text-[11px] shrink-0 ${waiting ? "text-nassayem font-semibold" : "text-gray-400"}`}
                    dir="ltr"
                  >
                    {listTimeLabel(c.lastMessageAt, locale)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <PreviewIcon c={c} />
                  <span
                    className={`truncate text-[13px] flex-1 ${waiting ? "text-gray-700" : "text-gray-500"}`}
                    dir="auto"
                  >
                    {c.preview || (isEn ? "Attachment" : "مرفق")}
                  </span>
                  {c.aiPaused && (
                    <PauseCircle
                      className="w-4 h-4 text-violet-500 shrink-0"
                      aria-label={isEn ? "AI stopped — human handling" : "الذكاء متوقف — يتولاها موظف"}
                    />
                  )}
                  {(c.status === "ESCALATED" || c.status === "PENDING_RETRY") && (
                    <span
                      className={`shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold ring-1 ${status.pill}`}
                    >
                      {isEn ? status.en : status.ar}
                    </span>
                  )}
                  {waiting && <span className="w-2.5 h-2.5 rounded-full bg-nassayem shrink-0" />}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
