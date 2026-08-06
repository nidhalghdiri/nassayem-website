"use client";

import Link from "next/link";
import {
  Bot,
  MessageSquare,
  Users,
  Sparkles,
  Settings,
  LineChart,
  Calendar,
  Coins,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";

export type TimeframeKey = "today" | "7d" | "30d" | "khareef" | "all";
export type CurrencyKey = "OMR" | "USD";

type Props = {
  locale: string;
  isEn: boolean;
  modelName: string;
  timeframe: TimeframeKey;
  setTimeframe: (t: TimeframeKey) => void;
  currency: CurrencyKey;
  setCurrency: (c: CurrencyKey) => void;
  canManageConfig: boolean;
};

export default function DashboardHeader({
  locale,
  isEn,
  modelName,
  timeframe,
  setTimeframe,
  currency,
  setCurrency,
  canManageConfig,
}: Props) {
  const timeframes: { key: TimeframeKey; en: string; ar: string }[] = [
    { key: "today", en: "Today", ar: "اليوم" },
    { key: "7d", en: "Last 7 Days", ar: "آخر 7 أيام" },
    { key: "30d", en: "Last 30 Days", ar: "آخر 30 يوماً" },
    { key: "khareef", en: "Khareef Season", ar: "موسم الخريف" },
    { key: "all", en: "All Time", ar: "الإجمالي" },
  ];

  const navLinks = [
    {
      href: `/${locale}/admin/chatbot/conversations`,
      en: "Conversations",
      ar: "المحادثات",
      icon: MessageSquare,
    },
    {
      href: `/${locale}/admin/chatbot/leads`,
      en: "Leads",
      ar: "العملاء المحتملون",
      icon: Users,
    },
    {
      href: `/${locale}/admin/chatbot/playground`,
      en: "Playground",
      ar: "بيئة التجربة",
      icon: Sparkles,
    },
    ...(canManageConfig
      ? [
          {
            href: `/${locale}/admin/chatbot/insights`,
            en: "Insights & Audit",
            ar: "التحليلات والتقييم",
            icon: LineChart,
          },
          {
            href: `/${locale}/admin/chatbot/config`,
            en: "Configuration",
            ar: "الإعدادات",
            icon: Settings,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      {/* Top Title & System Badges */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-[#1B365D] via-[#152a48] to-[#0d1d33] text-white p-5 lg:p-6 rounded-3xl shadow-md border border-slate-700/40">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-amber-300 border border-white/15 shadow-inner">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                {isEn ? "AI Chatbot Executive Dashboard" : "لوحة تحكم المساعد الذكي"}
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isEn ? "Active 24/7" : "يعمل 24/7"}
                </span>
              </h1>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>
                  {isEn ? "Model:" : "النموذج:"}{" "}
                  <strong className="text-amber-200 font-mono">{modelName}</strong>
                </span>
                <span className="text-slate-400">•</span>
                <span className="flex items-center gap-1 text-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {isEn ? "Prompt Caching Enabled (~90% off)" : "التخزين المؤقت مفعّل (خصم 90%)"}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Quick Nav Links */}
        <div className="flex flex-wrap items-center gap-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/20 text-slate-100 transition-all border border-white/10 hover:border-white/25 active:scale-95"
              >
                <Icon className="w-3.5 h-3.5 text-amber-300" />
                <span>{isEn ? link.en : link.ar}</span>
                <ArrowUpRight className="w-3 h-3 text-slate-400" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Control Bar: Timeframe Filters & Currency Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-gray-200/80 p-2.5 lg:p-3 rounded-2xl shadow-sm">
        {/* Timeframe Selector Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1 mr-2 px-1">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            {isEn ? "Period:" : "الفترة:"}
          </span>
          {timeframes.map((tf) => (
            <button
              key={tf.key}
              onClick={() => setTimeframe(tf.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                timeframe === tf.key
                  ? "bg-[#1B365D] text-white shadow-sm font-semibold"
                  : "bg-gray-100/80 hover:bg-gray-200/70 text-gray-600"
              }`}
            >
              {isEn ? tf.en : tf.ar}
            </button>
          ))}
        </div>

        {/* Currency Switcher */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-gray-400" />
            {isEn ? "Currency:" : "العملة:"}
          </span>
          <div className="inline-flex p-0.5 rounded-xl bg-gray-100 border border-gray-200">
            <button
              onClick={() => setCurrency("OMR")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                currency === "OMR"
                  ? "bg-white text-[#1B365D] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              OMR (ر.ع)
            </button>
            <button
              onClick={() => setCurrency("USD")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                currency === "USD"
                  ? "bg-white text-[#1B365D] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              USD ($)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
