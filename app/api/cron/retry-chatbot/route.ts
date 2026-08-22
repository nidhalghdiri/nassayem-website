import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateReply } from "@/lib/chatbot/agent";
import { getChatbotSettings } from "@/lib/chatbot/config";
import { sendWhatsAppText } from "@/lib/whatsapp";

export const maxDuration = 300; // 5 minutes max on Vercel Pro
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // 1. Fetch conversations with status PENDING_RETRY
    const pendingConversations = await prisma.chatbotConversation.findMany({
      where: { status: "PENDING_RETRY" },
      include: {
        messages: {
          where: { role: "USER" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (pendingConversations.length === 0) {
      return NextResponse.json(
        { message: "No pending conversations found." },
        { status: 200 }
      );
    }

    const settings = await getChatbotSettings();
    const processed = [];

    // 2. Iterate and retry
    for (const conv of pendingConversations) {
      // Mark as active so it doesn't get picked up again if this fails
      await prisma.chatbotConversation.update({
        where: { id: conv.id },
        data: { status: "ACTIVE" },
      });

      // Call generateReply directly so we don't duplicate the USER message in DB
      const result = await generateReply({
        conversationId: conv.id,
        externalId: conv.externalId,
        language: conv.language,
        settings,
        channel: conv.channel,
      });

      // We only send proactive outbound messages to WHATSAPP.
      // WEB chat widget relies on an active session/socket which is likely disconnected by now.
      if (conv.channel === "WHATSAPP" && result.text) {
        await sendWhatsAppText(conv.externalId, result.text).catch((err) => {
          console.error(`[cron/retry-chatbot] Failed to send WhatsApp for ${conv.id}:`, err);
        });
      }

      processed.push({
        id: conv.id,
        externalId: conv.externalId,
        status: "success",
      });
    }

    return NextResponse.json(
      { message: `Processed ${processed.length} conversations`, processed },
      { status: 200 }
    );
  } catch (error) {
    console.error("[cron/retry-chatbot] Error:", error);
    return NextResponse.json(
      { error: "Failed to process retries" },
      { status: 500 }
    );
  }
}
