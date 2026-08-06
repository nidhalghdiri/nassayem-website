import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canViewChatbot } from "@/lib/chatbot/permissions";
import ConversationActions from "@/components/admin/chatbot/ConversationActions";
import { resolveMediaUrlForDisplay } from "@/lib/chatbot/media";
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

  const inputTokensTotal = conversation.messages.reduce(
    (s, m) => s + (m.inputTokens ?? 0),
    0,
  );
  const outputTokensTotal = conversation.messages.reduce(
    (s, m) => s + (m.outputTokens ?? 0),
    0,
  );
  const tokenTotal = inputTokensTotal + outputTokensTotal;

  // Prompt caching rate: $0.435/1M input, $15.00/1M output, 1 USD = 0.385 OMR
  const costUsd =
    (inputTokensTotal / 1_000_000) * 0.435 + (outputTokensTotal / 1_000_000) * 15.0;
  const costOmr = costUsd * 0.385;

  const costUsdFormatted =
    costUsd < 0.0001 && costUsd > 0 ? "<$0.0001" : `$${costUsd.toFixed(4)}`;
  const costOmrFormatted =
    costOmr < 0.0001 && costOmr > 0 ? "<0.0001 ر.ع." : `${costOmr.toFixed(4)} ر.ع.`;

  const initialMessages: TranscriptMessage[] = await Promise.all(
    conversation.messages.map(async (m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      // Private customer media resolves to a signed URL; public URLs pass through.
      mediaUrl: await resolveMediaUrlForDisplay(m.mediaUrl),
      mediaType: m.mediaType,
      toolName: m.toolName,
      toolPayload: m.toolPayload,
      inputTokens: m.inputTokens,
      outputTokens: m.outputTokens,
      createdAt: m.createdAt.toISOString(),
    })),
  );

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
            <p className="text-[11px] text-gray-500 truncate flex items-center gap-1.5 flex-wrap" dir="ltr">
              <span>{conversation.channel === "WHATSAPP" ? "WhatsApp" : "Web"}</span>
              <span>·</span>
              <span>{conversation.externalId}</span>
              <span>·</span>
              <span>{conversation.language.toUpperCase()}</span>
              <span>·</span>
              <span>{tokenTotal.toLocaleString()} tok</span>
              {tokenTotal > 0 && (
                <>
                  <span>·</span>
                  <span className="text-emerald-700 font-semibold">{costUsdFormatted}</span>
                  <span>·</span>
                  <span className="text-emerald-700 font-semibold">{costOmrFormatted}</span>
                </>
              )}
            </p>
            {conversation.status === "ESCALATED" && conversation.escalationReason && (
              <p className="text-xs text-red-600 font-medium truncate">
                ⚠ {conversation.escalationReason}
              </p>
            )}
            {conversation.status === "ESCALATED" && conversation.followUpStatus !== "NONE" && (
              <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold">
                <span className="text-gray-500">{isEn ? "Follow-up:" : "المتابعة:"}</span>
                {conversation.followUpStatus === "PENDING" && (
                  <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{isEn ? "Pending" : "قيد الانتظار"}</span>
                )}
                {conversation.followUpStatus === "ASKED" && (
                  <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{isEn ? "Asked Customer" : "تم سؤال العميل"}</span>
                )}
                {conversation.followUpStatus === "CONTACTED" && (
                  <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">✓ {isEn ? "Contacted" : "تم التواصل"}</span>
                )}
                {conversation.followUpStatus === "NOT_CONTACTED" && (
                  <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">✕ {isEn ? "Not Contacted" : "لم يتم التواصل"}</span>
                )}
              </div>
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
