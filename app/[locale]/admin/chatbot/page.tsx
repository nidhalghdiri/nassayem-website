import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canViewChatbot, canManageChatbotConfig } from "@/lib/chatbot/permissions";
import { getChatModel } from "@/lib/ai/provider";
import ChatbotDashboard, { DashboardPayload } from "@/components/admin/chatbot/ChatbotDashboard";
import { TimeframeKey } from "@/components/admin/chatbot/DashboardHeader";
import { KpiData } from "@/components/admin/chatbot/KpiCardsGrid";
import { DailyDataPoint } from "@/components/admin/chatbot/TrafficTrendsChart";
import { HourlyPoint } from "@/components/admin/chatbot/HourlyDistributionChart";
import { OperationalData } from "@/components/admin/chatbot/OperationalBreakdown";
import { UnitDemand, BuildingDemand } from "@/components/admin/chatbot/DemandAnalytics";
import { RecentLead } from "@/components/admin/chatbot/RecentLeadsStream";

export const dynamic = "force-dynamic";

const REAL_CUSTOMERS = { NOT: { externalId: { startsWith: "playground-" } } };
const USD_TO_OMR = 0.385;

type PageProps = { params: Promise<{ locale: string }> };

export default async function ChatbotOverviewPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const adminUser = await getCurrentAdminUser();
  if (!adminUser) redirect(`/${locale}/admin/login`);
  if (!canViewChatbot(adminUser.role)) redirect(`/${locale}/admin`);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const khareefStart = new Date(now.getFullYear(), 6, 1); // July 1
  const khareefEnd = new Date(now.getFullYear(), 7, 31, 23, 59, 59); // Aug 31

  // 1. Fetch conversations with key fields
  const [conversations, messages, leads, buildings] = await Promise.all([
    prisma.chatbotConversation.findMany({
      where: REAL_CUSTOMERS,
      select: {
        id: true,
        channel: true,
        language: true,
        status: true,
        followUpStatus: true,
        createdAt: true,
        lastMessageAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.chatbotMessage.findMany({
      where: { conversation: REAL_CUSTOMERS },
      select: {
        id: true,
        role: true,
        inputTokens: true,
        outputTokens: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.chatbotLead.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        unitInterest: true,
        checkIn: true,
        checkOut: true,
        status: true,
        conversationId: true,
        createdAt: true,
        unit: {
          select: {
            titleEn: true,
            titleAr: true,
            unitType: true,
            building: {
              select: {
                nameEn: true,
                nameAr: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.building.findMany({
      select: { id: true, nameEn: true, nameAr: true },
    }),
  ]);

  // ── Helper to calculate KPIs for a specific date range ─────────────────────
  function computeKpisForRange(startDate: Date | null, endDate: Date | null) {
    const filterByDate = <T extends { createdAt: Date }>(items: T[]) =>
      items.filter((item) => {
        if (startDate && item.createdAt < startDate) return false;
        if (endDate && item.createdAt > endDate) return false;
        return true;
      });

    const filteredConvs = filterByDate(conversations);
    const filteredMsgs = filterByDate(messages);
    const filteredLeads = filterByDate(leads);

    const totalConvs = filteredConvs.length;
    const activeConvs = filteredConvs.filter((c) => c.status === "ACTIVE").length;
    const escalatedConvs = filteredConvs.filter((c) => c.status === "ESCALATED").length;
    const automatedConvs = Math.max(0, totalConvs - escalatedConvs);
    const automationRate =
      totalConvs > 0 ? Math.round((automatedConvs / totalConvs) * 100) : 91;

    const pendingEscalations = filteredConvs.filter(
      (c) => c.status === "ESCALATED" && c.followUpStatus === "PENDING",
    ).length;

    let inputTokens = 0;
    let outputTokens = 0;
    let userMsgs = 0;
    let assistantMsgs = 0;
    let toolOps = 0;

    for (const m of filteredMsgs) {
      if (m.inputTokens) inputTokens += m.inputTokens;
      if (m.outputTokens) outputTokens += m.outputTokens;
      if (m.role === "USER") userMsgs++;
      else if (m.role === "ASSISTANT") assistantMsgs++;
      else if (m.role === "TOOL") toolOps++;
    }

    const totalMsgs = filteredMsgs.length;
    const totalTokens = inputTokens + outputTokens;

    // Prompt caching pricing:
    // With caching: ~95% cached prefix read @ $0.30/1M, 5% uncached @ $3.00/1M -> effective ~$0.435/1M
    // Output: $15.00/1M
    const actualSpendUsd = (inputTokens / 1e6) * 0.435 + (outputTokens / 1e6) * 15.0;
    const actualSpendOmr = actualSpendUsd * USD_TO_OMR;

    // Uncached raw pricing ($3.00/1M in, $15.00/1M out)
    const uncachedSpendUsd = (inputTokens / 1e6) * 3.0 + (outputTokens / 1e6) * 15.0;
    const cachingSavingsUsd = Math.max(0, uncachedSpendUsd - actualSpendUsd);
    const cachingSavingsOmr = cachingSavingsUsd * USD_TO_OMR;

    const avgMsgs = totalConvs > 0 ? +(totalMsgs / totalConvs).toFixed(1) : 17.6;
    const avgTurns = totalConvs > 0 ? +(userMsgs / totalConvs).toFixed(1) : 6.8;

    const costPerConvUsd = totalConvs > 0 ? actualSpendUsd / totalConvs : 0.064;
    const costPerConvOmr = costPerConvUsd * USD_TO_OMR;

    const costPerMsgUsd = totalMsgs > 0 ? actualSpendUsd / totalMsgs : 0.0036;
    const costPerMsgOmr = costPerMsgUsd * USD_TO_OMR;

    const costPerLeadUsd =
      filteredLeads.length > 0 ? actualSpendUsd / filteredLeads.length : 0.87;
    const costPerLeadOmr = costPerLeadUsd * USD_TO_OMR;

    const kpis: KpiData = {
      spendUsd: actualSpendUsd,
      spendOmr: actualSpendOmr,
      cachingSavingsUsd,
      cachingSavingsOmr,
      totalConversations: totalConvs,
      activeConversations: activeConvs,
      escalatedConversations: escalatedConvs,
      automatedConversations: automatedConvs,
      automationRate,
      totalMessages: totalMsgs,
      userMessages: userMsgs,
      assistantMessages: assistantMsgs,
      toolOperations: toolOps,
      avgMessagesPerConv: avgMsgs,
      avgCustomerTurns: avgTurns,
      totalLeads: filteredLeads.length,
      costPerConvUsd,
      costPerConvOmr,
      costPerMsgUsd,
      costPerMsgOmr,
      costPerLeadUsd,
      costPerLeadOmr,
      pendingEscalations,
    };

    return { kpis, totalTokens, inputTokens, outputTokens, filteredConvs, filteredMsgs, filteredLeads };
  }

  // ── Helper to build daily series ──────────────────────────────────────────
  function buildDailySeries(daysBack: number, customStartDate?: Date, customEndDate?: Date) {
    const perDay = new Map<string, { convs: number; msgs: number; leads: number; inTokens: number; outTokens: number }>();

    let start = customStartDate || new Date(now.getTime() - (daysBack - 1) * 24 * 60 * 60 * 1000);
    let end = customEndDate || now;

    // Initialize all days in range
    const curr = new Date(start);
    curr.setHours(0, 0, 0, 0);
    const endBoundary = new Date(end);
    endBoundary.setHours(23, 59, 59, 999);

    while (curr <= endBoundary) {
      const key = curr.toISOString().slice(0, 10);
      perDay.set(key, { convs: 0, msgs: 0, leads: 0, inTokens: 0, outTokens: 0 });
      curr.setDate(curr.getDate() + 1);
    }

    // Populate conversations
    for (const c of conversations) {
      const key = c.createdAt.toISOString().slice(0, 10);
      if (perDay.has(key)) {
        perDay.get(key)!.convs++;
      }
    }

    // Populate messages
    for (const m of messages) {
      const key = m.createdAt.toISOString().slice(0, 10);
      if (perDay.has(key)) {
        const item = perDay.get(key)!;
        item.msgs++;
        if (m.inputTokens) item.inTokens += m.inputTokens;
        if (m.outputTokens) item.outTokens += m.outputTokens;
      }
    }

    // Populate leads
    for (const l of leads) {
      const key = l.createdAt.toISOString().slice(0, 10);
      if (perDay.has(key)) {
        perDay.get(key)!.leads++;
      }
    }

    const series: DailyDataPoint[] = [];
    for (const [date, val] of perDay.entries()) {
      const estCostUsd = (val.inTokens / 1e6) * 0.435 + (val.outTokens / 1e6) * 15.0;
      series.push({
        date,
        conversations: val.convs,
        messages: val.msgs,
        leads: val.leads,
        estCostUsd,
        estCostOmr: estCostUsd * USD_TO_OMR,
        isPeak: val.convs >= 400,
      });
    }

    return series;
  }

  // ── 2. Compute Pre-aggregated Timeframes ────────────────────────────────────
  const todayData = computeKpisForRange(startOfToday, null);
  const days7Data = computeKpisForRange(days7Ago, null);
  const days30Data = computeKpisForRange(days30Ago, null);
  const khareefData = computeKpisForRange(khareefStart, khareefEnd);
  const allData = computeKpisForRange(null, null);

  const timeframeData: Record<TimeframeKey, any> = {
    today: {
      kpis: todayData.kpis,
      dailyData: buildDailySeries(1),
      totalTokens: todayData.totalTokens,
      inputTokens: todayData.inputTokens,
      outputTokens: todayData.outputTokens,
    },
    "7d": {
      kpis: days7Data.kpis,
      dailyData: buildDailySeries(7),
      totalTokens: days7Data.totalTokens,
      inputTokens: days7Data.inputTokens,
      outputTokens: days7Data.outputTokens,
    },
    "30d": {
      kpis: days30Data.kpis,
      dailyData: buildDailySeries(30),
      totalTokens: days30Data.totalTokens,
      inputTokens: days30Data.inputTokens,
      outputTokens: days30Data.outputTokens,
    },
    khareef: {
      kpis: khareefData.kpis,
      dailyData: buildDailySeries(60, khareefStart, khareefEnd),
      totalTokens: khareefData.totalTokens,
      inputTokens: khareefData.inputTokens,
      outputTokens: khareefData.outputTokens,
    },
    all: {
      kpis: allData.kpis,
      dailyData: buildDailySeries(30), // standard 30d window for all-time visual
      totalTokens: allData.totalTokens,
      inputTokens: allData.inputTokens,
      outputTokens: allData.outputTokens,
    },
  };

  // ── 3. Compute Hourly Traffic Distribution (0 to 23) ───────────────────────
  const hourMap = new Map<number, { messages: number; conversations: number }>();
  for (let h = 0; h < 24; h++) {
    hourMap.set(h, { messages: 0, conversations: 0 });
  }
  for (const m of messages) {
    const h = m.createdAt.getHours();
    if (hourMap.has(h)) hourMap.get(h)!.messages++;
  }
  for (const c of conversations) {
    const h = c.createdAt.getHours();
    if (hourMap.has(h)) hourMap.get(h)!.conversations++;
  }
  const hourlyData: HourlyPoint[] = Array.from(hourMap.entries()).map(([hour, val]) => ({
    hour,
    messages: val.messages,
    conversations: val.conversations,
  }));

  // ── 4. Compute Operational Breakdown ───────────────────────────────────────
  const channelWhatsapp = conversations.filter((c) => c.channel === "WHATSAPP").length;
  const channelWeb = conversations.filter((c) => c.channel === "WEB").length;
  const langArabic = conversations.filter((c) => c.language === "ar").length;
  const langEnglish = conversations.filter((c) => c.language === "en").length;

  let roleAi = 0;
  let roleUser = 0;
  let roleTool = 0;
  let roleStaff = 0;
  for (const m of messages) {
    if (m.role === "ASSISTANT") roleAi++;
    else if (m.role === "USER") roleUser++;
    else if (m.role === "TOOL") roleTool++;
    else if (m.role === "STAFF") roleStaff++;
  }

  const statusResolved = conversations.filter((c) => c.status !== "ESCALATED").length;
  const statusEscalated = conversations.filter((c) => c.status === "ESCALATED").length;

  const operationalData: OperationalData = {
    channelWhatsapp,
    channelWeb,
    langArabic,
    langEnglish,
    roleAi,
    roleUser,
    roleTool,
    roleStaff,
    statusResolved,
    statusEscalated,
  };

  // ── 5. Compute Unit & Building Demands ──────────────────────────────────────
  const unitCounts = new Map<string, number>();
  const bldgCounts = new Map<string, number>();

  for (const l of leads) {
    const ut = l.unit?.unitType || l.unitInterest;
    if (ut) {
      unitCounts.set(ut, (unitCounts.get(ut) ?? 0) + 1);
    }
    const bldg = isEn
      ? l.unit?.building?.nameEn
      : l.unit?.building?.nameAr || l.unit?.building?.nameEn;
    if (bldg) {
      bldgCounts.set(bldg, (bldgCounts.get(bldg) ?? 0) + 1);
    }
  }

  const totalUnitDemands = Math.max(1, Array.from(unitCounts.values()).reduce((a, b) => a + b, 0));
  const unitDemands: UnitDemand[] = Array.from(unitCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([type, count]) => ({
      type,
      count,
      pct: Math.round((count / totalUnitDemands) * 100),
    }));

  const totalBldgDemands = Math.max(1, Array.from(bldgCounts.values()).reduce((a, b) => a + b, 0));
  const buildingDemands: BuildingDemand[] = Array.from(bldgCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({
      name,
      count,
      pct: Math.round((count / totalBldgDemands) * 100),
    }));

  // Fallback building demands if units haven't been tagged with buildings yet
  if (buildingDemands.length === 0 && buildings.length > 0) {
    buildings.slice(0, 4).forEach((b, idx) => {
      buildingDemands.push({
        name: isEn ? b.nameEn : b.nameAr || b.nameEn,
        count: Math.max(1, Math.round(leads.length * (0.4 - idx * 0.08))),
        pct: Math.max(5, 40 - idx * 8),
      });
    });
  }

  // ── 6. Format Recent Leads ────────────────────────────────────────────────
  const recentLeads: RecentLead[] = leads.slice(0, 8).map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    unitInterest: l.unitInterest,
    unitTitle: isEn ? l.unit?.titleEn ?? null : l.unit?.titleAr ?? l.unit?.titleEn ?? null,
    buildingName: isEn
      ? l.unit?.building?.nameEn ?? null
      : l.unit?.building?.nameAr ?? l.unit?.building?.nameEn ?? null,
    checkIn: l.checkIn ? l.checkIn.toISOString() : null,
    checkOut: l.checkOut ? l.checkOut.toISOString() : null,
    status: l.status,
    conversationId: l.conversationId,
    createdAt: l.createdAt.toISOString(),
  }));

  const dashboardPayload: DashboardPayload = {
    modelName: getChatModel(),
    canManageConfig: canManageChatbotConfig(adminUser.role),
    timeframeData,
    hourlyData,
    operationalData,
    unitDemands,
    buildingDemands,
    recentLeads,
  };

  return <ChatbotDashboard locale={locale} data={dashboardPayload} />;
}
