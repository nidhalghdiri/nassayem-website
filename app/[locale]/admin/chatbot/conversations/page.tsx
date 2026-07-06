import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import type { Prisma, ChatConversationStatus } from "@prisma/client";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canViewChatbot } from "@/lib/chatbot/permissions";

export const dynamic = "force-dynamic";

const STATUS_TABS = [
  { key: "ALL", en: "All", ar: "الكل" },
  { key: "ACTIVE", en: "Active", ar: "نشطة" },
  { key: "ESCALATED", en: "Escalated", ar: "مصعّدة" },
  { key: "CLOSED", en: "Closed", ar: "مغلقة" },
] as const;

const STATUS_PILL: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  ESCALATED: "bg-red-100 text-red-700",
  CLOSED: "bg-gray-100 text-gray-600",
};

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
};

export default async function ConversationsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { status = "ALL", q = "" } = await searchParams;
  const isEn = locale === "en";

  const adminUser = await getCurrentAdminUser();
  if (!adminUser) redirect(`/${locale}/admin/login`);
  if (!canViewChatbot(adminUser.role)) redirect(`/${locale}/admin`);

  const where: Prisma.ChatbotConversationWhereInput = {
    NOT: { externalId: { startsWith: "playground-" } },
    ...(status !== "ALL" ? { status: status as ChatConversationStatus } : {}),
    ...(q
      ? {
          OR: [
            { externalId: { contains: q, mode: "insensitive" } },
            { customerName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [conversations, counts] = await Promise.all([
    prisma.chatbotConversation.findMany({
      where,
      include: { _count: { select: { messages: true, leads: true } } },
      orderBy: { lastMessageAt: "desc" },
      take: 200,
    }),
    prisma.chatbotConversation.groupBy({
      by: ["status"],
      where: { NOT: { externalId: { startsWith: "playground-" } } },
      _count: { _all: true },
    }),
  ]);

  const countFor = (key: string) =>
    key === "ALL"
      ? counts.reduce((s, c) => s + c._count._all, 0)
      : counts.find((c) => c.status === key)?._count._all ?? 0;

  return (
    <div className="p-4 lg:p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEn ? "Chatbot Conversations" : "محادثات المساعد"}
        </h1>
        <Link
          href={`/${locale}/admin/chatbot`}
          className="text-sm text-nassayem hover:underline"
        >
          {isEn ? "← Chatbot overview" : "← نظرة عامة"}
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/${locale}/admin/chatbot/conversations?status=${tab.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              status === tab.key
                ? "bg-nassayem text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {isEn ? tab.en : tab.ar} ({countFor(tab.key)})
          </Link>
        ))}
      </div>

      {/* Search */}
      <form className="flex gap-2 max-w-md">
        <input type="hidden" name="status" value={status} />
        <input
          name="q"
          defaultValue={q}
          placeholder={isEn ? "Search phone / session / name…" : "بحث برقم الهاتف / الاسم…"}
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/50"
        />
        <button className="px-4 py-2 rounded-xl bg-nassayem text-white text-sm font-medium hover:bg-nassayem-dark">
          {isEn ? "Search" : "بحث"}
        </button>
      </form>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-start">{isEn ? "Customer" : "العميل"}</th>
                <th className="px-4 py-3 text-start">{isEn ? "Channel" : "القناة"}</th>
                <th className="px-4 py-3 text-start">{isEn ? "Status" : "الحالة"}</th>
                <th className="px-4 py-3 text-start">{isEn ? "Messages" : "الرسائل"}</th>
                <th className="px-4 py-3 text-start">{isEn ? "Leads" : "عملاء"}</th>
                <th className="px-4 py-3 text-start">{isEn ? "Last message" : "آخر رسالة"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {conversations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    {isEn ? "No conversations yet." : "لا توجد محادثات بعد."}
                  </td>
                </tr>
              )}
              {conversations.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/${locale}/admin/chatbot/conversations/${c.id}`}
                      className="font-medium text-nassayem hover:underline"
                    >
                      {c.customerName || c.externalId}
                    </Link>
                    {c.customerName && (
                      <div className="text-xs text-gray-400">{c.externalId}</div>
                    )}
                    {c.status === "ESCALATED" && c.escalationReason && (
                      <div className="text-xs text-red-500 mt-0.5">{c.escalationReason}</div>
                    )}
                    {c.aiPaused && (
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                        ⏸ {isEn ? "AI stopped" : "الذكاء متوقف"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.channel === "WHATSAPP"
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {c.channel === "WHATSAPP" ? "WhatsApp" : isEn ? "Web" : "الموقع"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL[c.status]}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c._count.messages}</td>
                  <td className="px-4 py-3 text-gray-600">{c._count.leads}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {c.lastMessageAt.toLocaleString(isEn ? "en-GB" : "ar-OM", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
