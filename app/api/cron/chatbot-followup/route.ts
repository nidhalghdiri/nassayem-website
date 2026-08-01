import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendWhatsAppText } from "@/lib/whatsapp";

// To ensure Vercel Cron securely triggers this, Vercel adds a header.
// Depending on your setup you might want to verify `request.headers.get("Authorization") === \`Bearer ${process.env.CRON_SECRET}\``.

export async function GET(request: Request) {
  // Only verify secret if CRON_SECRET is set
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const pendingFollowups = await prisma.chatbotConversation.findMany({
      where: {
        channel: "WHATSAPP",
        status: "ESCALATED",
        followUpStatus: "PENDING",
        escalatedAt: { lte: oneHourAgo },
      },
    });

    for (const conversation of pendingFollowups) {
      const isAr = conversation.language === "ar";
      const message = isAr
        ? "مرحباً! هذا تحقق آلي. هل تم التواصل معك من قبل فريقنا؟ الرجاء الرد بـ (نعم) أو (لا)."
        : "Hi! This is an automated follow-up. Did our team contact you? Please reply with (Yes) or (No).";

      // Send the follow-up message
      await sendWhatsAppText(conversation.externalId, message);

      // Add it to the message log so it shows up in the LiveTranscript
      await prisma.chatbotMessage.create({
        data: {
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: message,
        },
      });

      // Update the status to ASKED
      await prisma.chatbotConversation.update({
        where: { id: conversation.id },
        data: { followUpStatus: "ASKED" },
      });
    }

    return NextResponse.json({
      success: true,
      processedCount: pendingFollowups.length,
    });
  } catch (error) {
    console.error("[Cron] Follow-up cron failed:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
