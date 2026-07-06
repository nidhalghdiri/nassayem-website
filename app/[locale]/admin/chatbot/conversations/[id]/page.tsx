import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canViewChatbot } from "@/lib/chatbot/permissions";
import ConversationActions from "@/components/admin/chatbot/ConversationActions";
import LiveTranscript, {
  type TranscriptMessage,
} from "@/components/admin/chatbot/LiveTranscript";

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

  const initialMessages: TranscriptMessage[] = conversation.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    mediaUrl: m.mediaUrl,
    mediaType: m.mediaType,
    toolName: m.toolName,
    toolPayload: m.toolPayload,
    inputTokens: m.inputTokens,
    outputTokens: m.outputTokens,
    createdAt: m.createdAt.toISOString(),
  }));

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
          aiPaused={conversation.aiPaused}
          canDelete={adminUser.role === "MANAGER"}
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
            </div>
          ))}
        </div>
      )}

      {/* Live chat (polls for new messages, WhatsApp-style, staff composer) */}
      <LiveTranscript
        locale={locale}
        conversationId={conversation.id}
        channel={conversation.channel}
        initialMessages={initialMessages}
        initialAiPaused={conversation.aiPaused}
      />
    </div>
  );
}
