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
    <div className="h-full flex flex-col p-3 gap-3">
      {/* Header bar */}
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile: back to the list (sidebar is hidden while a chat is open) */}
          <Link
            href={`/${locale}/admin/chatbot/conversations`}
            className="lg:hidden text-nassayem text-xl leading-none px-1"
            aria-label={isEn ? "Back to conversations" : "رجوع للمحادثات"}
          >
            {isEn ? "←" : "→"}
          </Link>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0 ${
              conversation.channel === "WHATSAPP" ? "bg-emerald-500" : "bg-blue-500"
            }`}
          >
            {(conversation.customerName || conversation.externalId).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-gray-900 truncate">
              {conversation.customerName || conversation.externalId}
            </h1>
            <p className="text-[11px] text-gray-500 truncate" dir="ltr">
              {conversation.channel === "WHATSAPP" ? "WhatsApp" : "Web"} ·{" "}
              {conversation.externalId} · {conversation.language.toUpperCase()} ·{" "}
              {tokenTotal.toLocaleString()} tok
            </p>
            {conversation.status === "ESCALATED" && conversation.escalationReason && (
              <p className="text-xs text-red-600 font-medium truncate">
                ⚠ {conversation.escalationReason}
              </p>
            )}
          </div>
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
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2 text-xs space-y-0.5 shrink-0 max-h-24 overflow-y-auto">
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

      {/* Live chat fills the remaining height */}
      <div className="flex-1 min-h-0">
        <LiveTranscript
          locale={locale}
          conversationId={conversation.id}
          channel={conversation.channel}
          initialMessages={initialMessages}
          initialAiPaused={conversation.aiPaused}
        />
      </div>
    </div>
  );
}
