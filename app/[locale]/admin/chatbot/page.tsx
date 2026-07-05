import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canViewChatbot, canManageChatbotConfig } from "@/lib/chatbot/permissions";
import { getChatModel } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

// Playground chats are internal tests — keep them out of every metric.
const REAL_CUSTOMERS = { NOT: { externalId: { startsWith: "playground-" } } };

type PageProps = { params: Promise<{ locale: string }> };

export default async function ChatbotOverviewPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const adminUser = await getCurrentAdminUser();
  if (!adminUser) redirect(`/${locale}/admin/login`);
  if (!canViewChatbot(adminUser.role)) redirect(`/${locale}/admin`);

  const now = Date.now();
  const days30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const days14 = new Date(now - 14 * 24 * 60 * 60 * 1000);

  const [
    totalConversations,
    activeConversations,
    escalated30,
    conversations30,
    leadCounts,
    tokenAgg,
    recentMessages,
    leadUnits,
  ] = await Promise.all([
    prisma.chatbotConversation.count({ where: REAL_CUSTOMERS }),
    prisma.chatbotConversation.count({
      where: { ...REAL_CUSTOMERS, status: "ACTIVE" },
    }),
    prisma.chatbotConversation.count({
      where: { ...REAL_CUSTOMERS, status: "ESCALATED", updatedAt: { gte: days30 } },
    }),
    prisma.chatbotConversation.count({
      where: { ...REAL_CUSTOMERS, createdAt: { gte: days30 } },
    }),
    prisma.chatbotLead.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.chatbotMessage.aggregate({
      where: { createdAt: { gte: days30 }, conversation: REAL_CUSTOMERS },
      _sum: { inputTokens: true, outputTokens: true },
    }),
    prisma.chatbotMessage.findMany({
      where: {
        role: "USER",
        createdAt: { gte: days14 },
        conversation: REAL_CUSTOMERS,
      },
      select: { createdAt: true },
    }),
    prisma.chatbotLead.findMany({
      where: { unitId: { not: null } },
      select: { unit: { select: { unitType: true } } },
    }),
  ]);

  const escalationRate =
    conversations30 > 0 ? Math.round((escalated30 / conversations30) * 100) : 0;

  const inputTokens = tokenAgg._sum.inputTokens ?? 0;
  const outputTokens = tokenAgg._sum.outputTokens ?? 0;
  // Opus 4.8 list rates ($5 in / $25 out per M tokens) — indicative only.
  const estCostUsd = (inputTokens / 1e6) * 5 + (outputTokens / 1e6) * 25;

  // Messages per day, last 14 days (pure CSS bars — no chart library needed)
  const perDay = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    perDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const m of recentMessages) {
    const key = m.createdAt.toISOString().slice(0, 10);
    if (perDay.has(key)) perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  const maxPerDay = Math.max(1, ...perDay.values());

  // Most-asked unit types (from captured leads)
  const typeCounts = new Map<string, number>();
  for (const l of leadUnits) {
    const t = l.unit?.unitType;
    if (t) typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }
  const topTypes = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const leadCount = (status: string) =>
    leadCounts.find((l) => l.status === status)?._count._all ?? 0;

  const nav = [
    { href: `/${locale}/admin/chatbot/conversations`, en: "Conversations", ar: "المحادثات" },
    { href: `/${locale}/admin/chatbot/leads`, en: "Leads", ar: "العملاء المحتملون" },
    { href: `/${locale}/admin/chatbot/playground`, en: "Playground", ar: "بيئة التجربة" },
    ...(canManageChatbotConfig(adminUser.role)
      ? [{ href: `/${locale}/admin/chatbot/config`, en: "Configuration", ar: "الإعدادات" }]
      : []),
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEn ? "AI Chatbot" : "المساعد الذكي"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isEn
              ? `Model: ${getChatModel()} · Last 30 days unless noted`
              : `النموذج: ${getChatModel()} · آخر 30 يوماً ما لم يُذكر غير ذلك`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-4 py-2 rounded-xl bg-nassayem text-white text-sm font-medium hover:bg-nassayem-dark transition-colors"
            >
              {isEn ? n.en : n.ar}
            </Link>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: isEn ? "Conversations (all time)" : "المحادثات (الإجمالي)",
            value: totalConversations,
            sub: isEn ? `${activeConversations} active` : `${activeConversations} نشطة`,
          },
          {
            label: isEn ? "Escalation rate (30d)" : "نسبة التصعيد (30 يوم)",
            value: `${escalationRate}%`,
            sub: isEn
              ? `${escalated30} of ${conversations30} conversations`
              : `${escalated30} من ${conversations30} محادثة`,
          },
          {
            label: isEn ? "Leads captured" : "العملاء المحتملون",
            value: leadCounts.reduce((s, l) => s + l._count._all, 0),
            sub: `${leadCount("NEW")} ${isEn ? "new" : "جديد"} · ${leadCount("CONVERTED")} ${isEn ? "converted" : "محوّل"}`,
          },
          {
            label: isEn ? "Token spend (30d)" : "استهلاك التوكنز (30 يوم)",
            value: `$${estCostUsd.toFixed(2)}`,
            sub: `${((inputTokens + outputTokens) / 1000).toFixed(0)}k tokens`,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white border border-gray-200 rounded-2xl p-4"
          >
            <div className="text-xs text-gray-500">{card.label}</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{card.value}</div>
            <div className="text-xs text-gray-400 mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Message volume chart */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            {isEn ? "Customer messages — last 14 days" : "رسائل العملاء — آخر 14 يوماً"}
          </h2>
          <div className="flex items-end gap-1 h-36">
            {[...perDay.entries()].map(([day, count]) => (
              <div key={day} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div className="text-[10px] text-gray-500">{count > 0 ? count : ""}</div>
                <div
                  className="w-full rounded-t-md bg-nassayem/80"
                  style={{ height: `${Math.max(3, (count / maxPerDay) * 100)}%` }}
                  title={`${day}: ${count}`}
                />
                <div className="text-[9px] text-gray-400">{day.slice(8)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top asked unit types */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            {isEn ? "Most requested unit types (from leads)" : "أكثر أنواع الوحدات طلباً (من العملاء المحتملين)"}
          </h2>
          {topTypes.length === 0 ? (
            <p className="text-sm text-gray-400">
              {isEn ? "No unit-linked leads yet." : "لا يوجد عملاء محتملون مرتبطون بوحدات بعد."}
            </p>
          ) : (
            <div className="space-y-3">
              {topTypes.map(([type, count]) => (
                <div key={type} className="flex items-center gap-3">
                  <div className="w-32 text-xs text-gray-600 shrink-0">
                    {type.replaceAll("_", " ")}
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-nassayem rounded-full"
                      style={{ width: `${(count / topTypes[0][1]) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 w-6 text-end">{count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
