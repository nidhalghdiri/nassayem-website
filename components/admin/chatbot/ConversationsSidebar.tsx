"use client";

// WhatsApp-style inbox sidebar: searchable, filterable, LIVE conversation
// list (polls every 6s so new customer messages float chats to the top).
// Sits on the start side — right in the Arabic admin, left in English,
// exactly like WhatsApp Web follows the UI direction.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type ConversationItem = {
  id: string;
  channel: "WHATSAPP" | "WEB";
  customerName: string | null;
  externalId: string;
  status: "ACTIVE" | "ESCALATED" | "CLOSED";
  aiPaused: boolean;
  language: string;
  lastMessageAt: string;
  preview: string;
};

type Counts = { ALL: number; ACTIVE: number; ESCALATED: number; CLOSED: number };

const TABS = [
  { key: "ALL", en: "All", ar: "الكل" },
  { key: "ACTIVE", en: "Active", ar: "نشطة" },
  { key: "ESCALATED", en: "Escalated", ar: "مصعّدة" },
  { key: "CLOSED", en: "Closed", ar: "مغلقة" },
] as const;

function timeLabel(iso: string, locale: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(locale === "ar" ? "ar-OM" : "en-GB", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(locale === "ar" ? "ar-OM" : "en-GB", { day: "2-digit", month: "2-digit" });
}

export default function ConversationsSidebar({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const params = useParams<{ id?: string }>();
  const activeId = params?.id;

  const [items, setItems] = useState<ConversationItem[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("ALL");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const queryRef = useRef({ tab: "ALL" as string, q: "" });
  queryRef.current = { tab, q };

  useEffect(() => {
    let cancelled = false;
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
  }, [tab, q]);

  return (
    <div className="flex flex-col h-full bg-white border-e border-gray-200">
      {/* Search */}
      <div className="p-3 shrink-0 space-y-2 border-b border-gray-100">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            isEn
              ? "Search name, phone, ID or reservation #…"
              : "بحث بالاسم أو الهاتف أو الهوية أو رقم الحجز…"
          }
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/50"
        />
        <div className="flex gap-1.5 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                tab === t.key
                  ? "bg-nassayem text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {isEn ? t.en : t.ar}
              {counts ? ` ${counts[t.key]}` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="text-center text-gray-400 text-sm py-8">
            {isEn ? "Loading…" : "جارٍ التحميل…"}
          </p>
        )}
        {!loading && items.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">
            {isEn ? "No conversations." : "لا توجد محادثات."}
          </p>
        )}
        {items.map((c) => {
          const isActive = c.id === activeId;
          const name = c.customerName || c.externalId;
          return (
            <Link
              key={c.id}
              href={`/${locale}/admin/chatbot/conversations/${c.id}`}
              className={`flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 transition-colors ${
                isActive ? "bg-nassayem/10" : "hover:bg-gray-50"
              }`}
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-white ${
                    c.channel === "WHATSAPP" ? "bg-emerald-500" : "bg-blue-500"
                  }`}
                >
                  {name.charAt(0).toUpperCase()}
                </div>
                <span
                  className="absolute -bottom-0.5 -end-0.5 text-[10px]"
                  title={c.channel === "WHATSAPP" ? "WhatsApp" : "Web"}
                >
                  {c.channel === "WHATSAPP" ? "🟢" : "🌐"}
                </span>
              </div>

              {/* Name + preview */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`truncate text-sm ${isActive ? "font-bold text-nassayem-dark" : "font-semibold text-gray-900"}`}
                  >
                    {name}
                  </span>
                  <span className="text-[10px] text-gray-400 shrink-0" dir="ltr">
                    {timeLabel(c.lastMessageAt, locale)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {c.aiPaused && <span title={isEn ? "AI stopped" : "الذكاء متوقف"}>⏸</span>}
                  {c.status === "ESCALATED" && <span title={isEn ? "Escalated" : "مصعّدة"}>🔴</span>}
                  {c.status === "CLOSED" && <span className="text-gray-300">✓</span>}
                  <span className="truncate text-xs text-gray-500">{c.preview}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
