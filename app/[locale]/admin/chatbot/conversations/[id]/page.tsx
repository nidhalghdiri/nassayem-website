import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canViewChatbot } from "@/lib/chatbot/permissions";
import ConversationActions from "@/components/admin/chatbot/ConversationActions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string; id: string }> };

export default async function ConversationTranscriptPage({ params }: PageProps) {
  const { locale, id } = await params;
  const isEn = locale === "en";

  const adminUser = await getCurrentAdminUser();
  if (!adminUser) redirect(`/${locale}/admin/login`);
  if (!canViewChatbot(adminUser.role)) redirect(`/${locale}/admin`);

  const conversation = await prisma.chatbotConversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      leads: true,
      holds: { include: { unit: { select: { titleEn: true } } } },
    },
  });
  if (!conversation) notFound();

  const tokenTotal = conversation.messages.reduce(
    (s, m) => s + (m.inputTokens ?? 0) + (m.outputTokens ?? 0),
    0,
  );

  return (
    <div className="p-4 lg:p-8 max-w-4xl space-y-4">
      <Link
        href={`/${locale}/admin/chatbot/conversations`}
        className="text-sm text-nassayem hover:underline"
      >
        {isEn ? "← All conversations" : "← كل المحادثات"}
      </Link>

      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            {conversation.customerName || conversation.externalId}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {conversation.channel === "WHATSAPP" ? "WhatsApp" : "Web"} ·{" "}
            {conversation.externalId} · {conversation.language.toUpperCase()} ·{" "}
            {tokenTotal.toLocaleString()} tokens
          </p>
          {conversation.status === "ESCALATED" && conversation.escalationReason && (
            <p className="text-sm text-red-600 mt-1 font-medium">
              ⚠ {conversation.escalationReason}
            </p>
          )}
        </div>
        <ConversationActions
          locale={locale}
          conversationId={conversation.id}
          status={conversation.status}
        />
      </div>

      {/* Leads + holds context */}
      {(conversation.leads.length > 0 || conversation.holds.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm space-y-1">
          {conversation.leads.map((l) => (
            <div key={l.id}>
              📋 {isEn ? "Lead:" : "عميل محتمل:"} <strong>{l.name}</strong> · {l.phone}
              {l.unitInterest ? ` · ${l.unitInterest}` : ""} · {l.status}
            </div>
          ))}
          {conversation.holds.map((h) => (
            <div key={h.id}>
              ⏳ {isEn ? "Hold:" : "حجز مؤقت:"} {h.unit.titleEn} ·{" "}
              {h.checkIn.toISOString().slice(0, 10)} → {h.checkOut.toISOString().slice(0, 10)} ·{" "}
              {h.status}
              {h.status === "ACTIVE" && h.expiresAt > new Date()
                ? ` (${isEn ? "expires" : "ينتهي"} ${h.expiresAt.toLocaleTimeString(isEn ? "en-GB" : "ar-OM", { timeStyle: "short" })})`
                : ""}
            </div>
          ))}
        </div>
      )}

      {/* Transcript */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        {conversation.messages.map((m) => {
          if (m.role === "TOOL") {
            return (
              <details key={m.id} className="text-xs">
                <summary className="cursor-pointer inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 text-violet-700 font-medium">
                  🔧 {m.toolName}
                  <span className="text-violet-400 font-normal">
                    {m.createdAt.toLocaleTimeString("en-GB", { timeStyle: "short" })}
                  </span>
                </summary>
                <pre className="mt-2 p-3 rounded-xl bg-gray-900 text-gray-100 overflow-x-auto text-[11px] leading-relaxed">
                  {JSON.stringify(m.toolPayload, null, 2)}
                </pre>
              </details>
            );
          }
          const isUser = m.role === "USER";
          return (
            <div key={m.id} className={`flex ${isUser ? "" : "justify-end"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
                  isUser
                    ? "bg-gray-100 text-gray-800 rounded-es-md"
                    : "bg-nassayem text-white rounded-ee-md"
                }`}
              >
                {m.content}
                <div
                  className={`text-[10px] mt-1 ${isUser ? "text-gray-400" : "text-white/70"}`}
                >
                  {m.createdAt.toLocaleTimeString("en-GB", { timeStyle: "short" })}
                  {m.role === "ASSISTANT" && m.outputTokens
                    ? ` · ${(m.inputTokens ?? 0) + (m.outputTokens ?? 0)} tok`
                    : ""}
                </div>
              </div>
            </div>
          );
        })}
        {conversation.messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-6">
            {isEn ? "No messages." : "لا توجد رسائل."}
          </p>
        )}
      </div>
    </div>
  );
}
