import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

const USD_TO_OMR = 0.385;

// Claude Pricing Models:
// 1. Sonnet 3.5 (Primary production model):
//    - Input: $3.00 / 1M tokens (Cache write $3.75, Cache read $0.30)
//    - Output: $15.00 / 1M tokens
//    - Effective input with prompt caching (~70% cache hit rate): ~$1.20 / 1M tokens
// 2. Opus (if Opus turns were invoked):
//    - Input: $15.00 / 1M tokens, Output: $75.00 / 1M tokens
// 3. Haiku 3.5 (Audit & classification):
//    - Input: $0.80 / 1M tokens, Output: $4.00 / 1M tokens

async function main() {
  console.log("Running fast SQL aggregations for executive analytics...");

  // 1. Overview counts
  const totalConversations = await prisma.chatbotConversation.count();
  const totalMessages = await prisma.chatbotMessage.count();
  const totalLeads = await prisma.chatbotLead.count();

  // 2. Messages by role
  const messagesByRoleRaw = await prisma.$queryRaw`
    SELECT role, COUNT(*)::int as count 
    FROM "ChatbotMessage" 
    GROUP BY role
  `;
  const messagesByRole = {};
  for (const r of messagesByRoleRaw) {
    messagesByRole[r.role] = Number(r.count);
  }

  // 3. Token aggregates
  const tokenStatsRaw = await prisma.$queryRaw`
    SELECT 
      SUM("inputTokens")::bigint as total_input_tokens,
      SUM("outputTokens")::bigint as total_output_tokens,
      AVG("inputTokens")::float as avg_input_tokens_per_assistant_msg,
      AVG("outputTokens")::float as avg_output_tokens_per_assistant_msg
    FROM "ChatbotMessage"
    WHERE role = 'ASSISTANT'
  `;
  const totalInputTokens = Number(tokenStatsRaw[0]?.total_input_tokens || 0);
  const totalOutputTokens = Number(tokenStatsRaw[0]?.total_output_tokens || 0);
  const totalTokens = totalInputTokens + totalOutputTokens;

  // 4. Financial Calculations
  // Standard Sonnet 3.5 pricing with cache optimization
  const uncachedInputCostUSD = (totalInputTokens / 1_000_000) * 3.0;
  const cachedEffectiveInputCostUSD = (totalInputTokens / 1_000_000) * 1.2; // with ~70% cache reads
  const outputCostUSD = (totalOutputTokens / 1_000_000) * 15.0;
  
  // Total Estimated Spend
  const totalCostUSD = cachedEffectiveInputCostUSD + outputCostUSD;
  const totalCostOMR = totalCostUSD * USD_TO_OMR;

  // If billed strictly without prompt caching (max ceiling)
  const maxCeilingCostUSD = uncachedInputCostUSD + outputCostUSD;
  const maxCeilingCostOMR = maxCeilingCostUSD * USD_TO_OMR;

  // 5. Channel Breakdown
  const channelStatsRaw = await prisma.$queryRaw`
    SELECT channel, COUNT(*)::int as count
    FROM "ChatbotConversation"
    GROUP BY channel
  `;
  const channelBreakdown = {};
  for (const c of channelStatsRaw) {
    channelBreakdown[c.channel] = Number(c.count);
  }

  // 6. Language Breakdown
  const langStatsRaw = await prisma.$queryRaw`
    SELECT language, COUNT(*)::int as count
    FROM "ChatbotConversation"
    GROUP BY language
  `;
  const languageBreakdown = {};
  for (const l of langStatsRaw) {
    languageBreakdown[l.language] = Number(l.count);
  }

  // 7. Status & Escalations
  const statusStatsRaw = await prisma.$queryRaw`
    SELECT status, COUNT(*)::int as count
    FROM "ChatbotConversation"
    GROUP BY status
  `;
  const statusBreakdown = {};
  for (const s of statusStatsRaw) {
    statusBreakdown[s.status] = Number(s.count);
  }

  // 8. Follow-up status for escalated chats
  const followUpStatsRaw = await prisma.$queryRaw`
    SELECT "followUpStatus", COUNT(*)::int as count
    FROM "ChatbotConversation"
    WHERE status = 'ESCALATED'
    GROUP BY "followUpStatus"
  `;
  const followUpBreakdown = {};
  for (const f of followUpStatsRaw) {
    followUpBreakdown[f.followUpStatus] = Number(f.count);
  }

  // 9. Daily Volume & Trends (Last 30 Days)
  const dailyTrendsRaw = await prisma.$queryRaw`
    SELECT 
      DATE("createdAt") as date,
      COUNT(*)::int as conversations_count
    FROM "ChatbotConversation"
    GROUP BY DATE("createdAt")
    ORDER BY DATE("createdAt") DESC
    LIMIT 30
  `;

  // 10. Audit Outcomes (Quality & Conversions)
  const auditOutcomesRaw = await prisma.$queryRaw`
    SELECT outcome, COUNT(*)::int as count
    FROM "ChatbotConversationAudit"
    GROUP BY outcome
  `;
  const auditOutcomes = {};
  for (const a of auditOutcomesRaw) {
    auditOutcomes[a.outcome] = Number(a.count);
  }

  const auditSentimentsRaw = await prisma.$queryRaw`
    SELECT sentiment, COUNT(*)::int as count
    FROM "ChatbotConversationAudit"
    GROUP BY sentiment
  `;
  const auditSentiments = {};
  for (const s of auditSentimentsRaw) {
    auditSentiments[s.sentiment] = Number(s.count);
  }

  // 11. Average KPIs
  const avgMessagesPerConversation = totalConversations > 0 ? (totalMessages / totalConversations).toFixed(1) : 0;
  const userMessagesCount = messagesByRole["USER"] || 0;
  const assistantMessagesCount = messagesByRole["ASSISTANT"] || 0;
  const avgUserTurnsPerConversation = totalConversations > 0 ? (userMessagesCount / totalConversations).toFixed(1) : 0;
  
  const avgCostPerConversationUSD = totalConversations > 0 ? (totalCostUSD / totalConversations).toFixed(4) : 0;
  const avgCostPerConversationOMR = totalConversations > 0 ? (totalCostOMR / totalConversations).toFixed(4) : 0;
  
  const avgCostPerMessageUSD = totalMessages > 0 ? (totalCostUSD / totalMessages).toFixed(4) : 0;
  const avgCostPerMessageOMR = totalMessages > 0 ? (totalCostOMR / totalMessages).toFixed(4) : 0;

  const avgCostPerLeadUSD = totalLeads > 0 ? (totalCostUSD / totalLeads).toFixed(2) : 0;
  const avgCostPerLeadOMR = totalLeads > 0 ? (totalCostOMR / totalLeads).toFixed(2) : 0;

  // 12. Human Labor Equivalent Comparison (ROI Calculation)
  // Assuming a human customer service agent handles 8 chats/hour @ 3.5 OMR/hour ($9.10/hour)
  // Cost per human-handled conversation = ~$1.14 USD (0.438 OMR)
  const humanCostPerChatUSD = 1.14;
  const estimatedHumanCostTotalUSD = totalConversations * humanCostPerChatUSD;
  const estimatedHumanCostTotalOMR = estimatedHumanCostTotalUSD * USD_TO_OMR;
  const totalSavingsUSD = estimatedHumanCostTotalUSD - totalCostUSD;
  const totalSavingsOMR = totalSavingsUSD * USD_TO_OMR;
  const roiPercentage = totalCostUSD > 0 ? ((totalSavingsUSD / totalCostUSD) * 100).toFixed(0) : 0;

  const fullData = {
    generatedAt: new Date().toISOString(),
    executiveSummary: {
      totalSpendUSD: Number(totalCostUSD.toFixed(2)),
      totalSpendOMR: Number(totalCostOMR.toFixed(2)),
      maxCeilingSpendUSD: Number(maxCeilingCostUSD.toFixed(2)),
      maxCeilingSpendOMR: Number(maxCeilingCostOMR.toFixed(2)),
      totalConversations,
      totalMessages,
      totalLeads,
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      avgMessagesPerConversation: Number(avgMessagesPerConversation),
      avgUserTurnsPerConversation: Number(avgUserTurnsPerConversation),
      avgCostPerConversationUSD: Number(avgCostPerConversationUSD),
      avgCostPerConversationOMR: Number(avgCostPerConversationOMR),
      avgCostPerMessageUSD: Number(avgCostPerMessageUSD),
      avgCostPerMessageOMR: Number(avgCostPerMessageOMR),
      avgCostPerLeadUSD: Number(avgCostPerLeadUSD),
      avgCostPerLeadOMR: Number(avgCostPerLeadOMR),
    },
    businessImpactAndROI: {
      estimatedHumanLaborCostUSD: Number(estimatedHumanCostTotalUSD.toFixed(2)),
      estimatedHumanLaborCostOMR: Number(estimatedHumanCostTotalOMR.toFixed(2)),
      netSavingsUSD: Number(totalSavingsUSD.toFixed(2)),
      netSavingsOMR: Number(totalSavingsOMR.toFixed(2)),
      roiPercentage: `${roiPercentage}%`,
    },
    channelBreakdown,
    languageBreakdown,
    statusBreakdown,
    followUpBreakdown,
    messagesByRole,
    dailyTrends: dailyTrendsRaw.map((d) => ({
      date: d.date ? new Date(d.date).toISOString().slice(0, 10) : "unknown",
      count: Number(d.conversations_count),
    })),
    auditOutcomes,
    auditSentiments,
  };

  fs.writeFileSync("chatbot_executive_metrics.json", JSON.stringify(fullData, null, 2));
  console.log("SUCCESS! Summary metrics:");
  console.log(JSON.stringify(fullData.executiveSummary, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
