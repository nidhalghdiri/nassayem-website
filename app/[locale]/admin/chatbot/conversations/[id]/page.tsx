import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canViewChatbot } from "@/lib/chatbot/permissions";
import { resolveMediaUrlForDisplay } from "@/lib/chatbot/media";
import type { TranscriptMessage } from "@/components/admin/chatbot/LiveTranscript";
import ConversationWorkspace from "@/components/admin/chatbot/ConversationWorkspace";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string; id: string }> };

export default async function ConversationTranscriptPage({ params }: PageProps) {
  const { locale, id } = await params;

  const adminUser = await getCurrentAdminUser();
  if (!adminUser) redirect(`/${locale}/admin/login`);
  if (!canViewChatbot(adminUser.role)) redirect(`/${locale}/admin`);

  const conversation = await prisma.chatbotConversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      leads: { orderBy: { createdAt: "desc" } },
      holds: { include: { unit: { select: { titleEn: true } } } },
    },
  });
  if (!conversation) notFound();

  const inputTokens = conversation.messages.reduce((s, m) => s + (m.inputTokens ?? 0), 0);
  const outputTokens = conversation.messages.reduce((s, m) => s + (m.outputTokens ?? 0), 0);

  // Prompt caching rate: $0.435/1M input, $15.00/1M output, 1 USD = 0.385 OMR
  const costUsd = (inputTokens / 1_000_000) * 0.435 + (outputTokens / 1_000_000) * 15.0;

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
    <ConversationWorkspace
      // Remount per conversation so transcript state never leaks between chats.
      key={conversation.id}
      locale={locale}
      canDelete={adminUser.role === "MANAGER"}
      initialMessages={initialMessages}
      conversation={{
        id: conversation.id,
        channel: conversation.channel,
        externalId: conversation.externalId,
        customerName: conversation.customerName,
        language: conversation.language,
        status: conversation.status,
        aiPaused: conversation.aiPaused,
        escalationReason: conversation.escalationReason,
        escalatedAt: conversation.escalatedAt?.toISOString() ?? null,
        followUpStatus: conversation.followUpStatus,
        createdAt: conversation.createdAt.toISOString(),
      }}
      leads={conversation.leads.map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        idNumber: l.idNumber,
        reservationNumber: l.reservationNumber,
        unitInterest: l.unitInterest,
        checkIn: l.checkIn?.toISOString().slice(0, 10) ?? null,
        checkOut: l.checkOut?.toISOString().slice(0, 10) ?? null,
        status: l.status,
      }))}
      holds={conversation.holds.map((h) => ({
        id: h.id,
        unitTitle: h.unit.titleEn,
        checkIn: h.checkIn.toISOString().slice(0, 10),
        checkOut: h.checkOut.toISOString().slice(0, 10),
        status: h.status,
      }))}
      usage={{ inputTokens, outputTokens, costUsd, costOmr: costUsd * 0.385 }}
    />
  );
}
