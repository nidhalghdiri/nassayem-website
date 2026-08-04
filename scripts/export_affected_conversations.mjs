import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function main() {
  // Start from August 3, 2026 12:00:00 UTC (yesterday afternoon/night Oman time)
  const since = new Date("2026-08-03T12:00:00.000Z");

  console.log(`Fetching conversations active since ${since.toISOString()}...`);

  const conversations = await prisma.chatbotConversation.findMany({
    where: {
      lastMessageAt: { gte: since },
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
      audit: true,
      leads: true,
    },
    orderBy: { lastMessageAt: "desc" },
  });

  const affected = [];

  for (const conv of conversations) {
    if (!conv.messages || conv.messages.length === 0) continue;

    const messages = conv.messages;
    const lastMsg = messages[messages.length - 1];

    // Check if the last assistant message is the error fallback
    const isLastFallback =
      lastMsg.role === "ASSISTANT" &&
      (lastMsg.content.includes("خلل تقني") || lastMsg.content.includes("technical issue"));

    // Find any fallback message that happened during the outage window
    const outageFallbacks = messages.filter(
      (m) =>
        m.role === "ASSISTANT" &&
        m.createdAt >= since &&
        (m.content.includes("خلل تقني") || m.content.includes("technical issue"))
    );

    if (isLastFallback || outageFallbacks.length > 0) {
      // Find the last user message before or at the time of failure
      const userMessages = messages.filter((m) => m.role === "USER");
      const lastUserMsg = userMessages[userMessages.length - 1];

      // Get customer inquiries context (last 3 user messages if available)
      const recentUserQueries = userMessages.slice(-3).map((m) => ({
        text: m.content,
        time: m.createdAt.toISOString(),
      }));

      affected.push({
        conversationId: conv.id,
        channel: conv.channel,
        phoneNumber: conv.channel === "WHATSAPP" ? conv.externalId : null,
        externalId: conv.externalId,
        customerName: conv.customerName || "Customer",
        language: conv.language,
        status: conv.status,
        lastMessageAt: conv.lastMessageAt.toISOString(),
        isLastMessageFallback: isLastFallback,
        totalOutageFallbacks: outageFallbacks.length,
        lastCustomerQuestion: lastUserMsg ? lastUserMsg.content : "",
        lastCustomerQuestionTime: lastUserMsg ? lastUserMsg.createdAt.toISOString() : null,
        recentUserQueries,
        totalMessagesInConversation: messages.length,
      });
    }
  }

  console.log(`Found ${affected.length} affected conversations during the outage window.`);

  // 1. Save JSON data
  fs.writeFileSync(
    "affected_outage_conversations.json",
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        outageWindowStart: since.toISOString(),
        totalAffected: affected.length,
        conversations: affected,
      },
      null,
      2
    )
  );

  // 2. Save Markdown report for easy reading and follow-up
  let md = `# Claude API Outage — Affected Customer Conversations Report\n\n`;
  md += `**Export Date:** ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Muscat" })} (Oman Time)\n`;
  md += `**Outage Period Analyzed:** From ${since.toLocaleString("en-GB", { timeZone: "Asia/Muscat" })} to Now\n`;
  md += `**Total Affected Conversations:** ${affected.length}\n\n`;
  md += `| # | Customer Name | Phone / External ID | Channel | Last Message Date (Oman) | Is Last Msg Failed? | Last Question / Request | Conversation ID |\n`;
  md += `|---|---|---|---|---|---|---|---|\n`;

  affected.forEach((c, idx) => {
    const timeOman = new Date(c.lastMessageAt).toLocaleString("en-GB", { timeZone: "Asia/Muscat" });
    const cleanQuestion = (c.lastCustomerQuestion || "").replace(/[\r\n]+/g, " ").slice(0, 70);
    const phone = c.phoneNumber ? `[+${c.phoneNumber}](https://wa.me/${c.phoneNumber})` : c.externalId.slice(0, 10);
    const statusIcon = c.isLastMessageFallback ? "🔴 Pending / Failed" : "🟡 Received Error in Chat";

    md += `| ${idx + 1} | **${c.customerName}** | ${phone} | ${c.channel} | ${timeOman} | ${statusIcon} | ${cleanQuestion} | \`${c.conversationId}\` |\n`;
  });

  md += `\n\n## Detailed Breakdown & Recovery Context\n\n`;

  affected.forEach((c, idx) => {
    const timeOman = new Date(c.lastMessageAt).toLocaleString("en-GB", { timeZone: "Asia/Muscat" });
    md += `### ${idx + 1}. ${c.customerName} (${c.phoneNumber ? "+" + c.phoneNumber : c.channel})\n`;
    md += `- **Conversation ID:** \`${c.conversationId}\`\n`;
    md += `- **Channel:** ${c.channel}\n`;
    md += `- **Language:** ${c.language}\n`;
    md += `- **Last Activity (Oman Time):** ${timeOman}\n`;
    md += `- **Status:** ${c.isLastMessageFallback ? "❌ Last message was the fallback error" : "⚠️ Hit fallback error during chat"}\n`;
    md += `- **Last Customer Message:**\n> ${c.lastCustomerQuestion.replace(/\n/g, "\n> ")}\n\n`;
  });

  fs.writeFileSync("affected_outage_conversations.md", md);

  console.log("Successfully saved affected_outage_conversations.json and affected_outage_conversations.md");
}

main().catch(console.error).finally(() => prisma.$disconnect());
