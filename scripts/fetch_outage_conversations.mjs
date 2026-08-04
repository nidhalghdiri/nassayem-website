import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Look back 48 hours (from yesterday Aug 3 morning to now Aug 4)
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

  console.log(`Searching for conversations active since ${since.toISOString()}...`);

  // Fetch recent conversations with their messages
  const conversations = await prisma.chatbotConversation.findMany({
    where: {
      lastMessageAt: { gte: since },
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  console.log(`Total conversations found in the last 48 hours: ${conversations.length}`);

  const affected = [];

  for (const conv of conversations) {
    if (!conv.messages || conv.messages.length === 0) continue;

    // Check if the last assistant message is the error fallback
    // Or if the last message in the conversation is an error fallback
    const lastMsg = conv.messages[conv.messages.length - 1];
    const hasFallbackAtEnd =
      lastMsg.role === "ASSISTANT" &&
      (lastMsg.content.includes("خلل تقني") || lastMsg.content.includes("technical issue"));

    // Also check if any message in the last 24h was a fallback error
    const recentFallbackMessages = conv.messages.filter(
      (m) =>
        m.role === "ASSISTANT" &&
        m.createdAt >= since &&
        (m.content.includes("خلل تقني") || m.content.includes("technical issue"))
    );

    if (hasFallbackAtEnd || recentFallbackMessages.length > 0) {
      // Find the last user question before the fallback
      const userMessages = conv.messages.filter((m) => m.role === "USER");
      const lastUserMsg = userMessages[userMessages.length - 1];

      affected.push({
        id: conv.id,
        channel: conv.channel,
        externalId: conv.externalId,
        customerName: conv.customerName,
        language: conv.language,
        status: conv.status,
        lastMessageAt: conv.lastMessageAt,
        lastMessageRole: lastMsg.role,
        lastMessageContent: lastMsg.content.slice(0, 100),
        lastCustomerQuestion: lastUserMsg ? lastUserMsg.content : "N/A",
        lastCustomerQuestionAt: lastUserMsg ? lastUserMsg.createdAt : null,
        isLastMessageFallback: hasFallbackAtEnd,
        fallbackCount: recentFallbackMessages.length,
      });
    }
  }

  console.log(`Affected conversations where customers received fallback error: ${affected.length}`);
  console.log(JSON.stringify(affected, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
