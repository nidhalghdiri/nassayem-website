"use client";

import { useState } from "react";
import DashboardHeader, { TimeframeKey, CurrencyKey } from "./DashboardHeader";
import KpiCardsGrid, { KpiData } from "./KpiCardsGrid";
import FinancialRoiSection from "./FinancialRoiSection";
import TrafficTrendsChart, { DailyDataPoint } from "./TrafficTrendsChart";
import HourlyDistributionChart, { HourlyPoint } from "./HourlyDistributionChart";
import OperationalBreakdown, { OperationalData } from "./OperationalBreakdown";
import DemandAnalytics, { UnitDemand, BuildingDemand } from "./DemandAnalytics";
import RecentLeadsStream, { RecentLead } from "./RecentLeadsStream";

export type DashboardPayload = {
  modelName: string;
  canManageConfig: boolean;
  timeframeData: Record<
    TimeframeKey,
    {
      kpis: KpiData;
      dailyData: DailyDataPoint[];
      totalTokens: number;
      inputTokens: number;
      outputTokens: number;
    }
  >;
  hourlyData: HourlyPoint[];
  operationalData: OperationalData;
  unitDemands: UnitDemand[];
  buildingDemands: BuildingDemand[];
  recentLeads: RecentLead[];
};

type Props = {
  locale: string;
  data: DashboardPayload;
};

export default function ChatbotDashboard({ locale, data }: Props) {
  const isEn = locale === "en";
  const [timeframe, setTimeframe] = useState<TimeframeKey>("30d");
  const [currency, setCurrency] = useState<CurrencyKey>("OMR");

  const currentTfData = data.timeframeData[timeframe] || data.timeframeData["30d"];

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Header with System Badges, Filters & Nav Links */}
      <DashboardHeader
        locale={locale}
        isEn={isEn}
        modelName={data.modelName}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        currency={currency}
        setCurrency={setCurrency}
        canManageConfig={data.canManageConfig}
      />

      {/* 2. Executive KPI Cards (Top Stats & Efficiency) */}
      <KpiCardsGrid
        isEn={isEn}
        currency={currency}
        kpis={currentTfData.kpis}
      />

      {/* 3. Financial ROI & Prompt Caching Intelligence */}
      <FinancialRoiSection
        isEn={isEn}
        currency={currency}
        totalConversations={currentTfData.kpis.totalConversations}
        aiSpendUsd={currentTfData.kpis.spendUsd}
        aiSpendOmr={currentTfData.kpis.spendOmr}
        totalTokens={currentTfData.totalTokens}
        inputTokens={currentTfData.inputTokens}
        outputTokens={currentTfData.outputTokens}
        cachingSavingsUsd={currentTfData.kpis.cachingSavingsUsd}
        cachingSavingsOmr={currentTfData.kpis.cachingSavingsOmr}
      />

      {/* 4. Traffic & Cost Trends Chart */}
      <TrafficTrendsChart
        isEn={isEn}
        currency={currency}
        dailyData={currentTfData.dailyData}
      />

      {/* 5. 24-Hour Traffic Heatmap */}
      <HourlyDistributionChart
        isEn={isEn}
        hourlyData={data.hourlyData}
      />

      {/* 6. Operational Breakdown (Channels, Languages, Roles, Automation) */}
      <OperationalBreakdown
        isEn={isEn}
        data={data.operationalData}
      />

      {/* 7. Demand Analytics (Apartment types & Buildings) */}
      <DemandAnalytics
        isEn={isEn}
        unitDemands={data.unitDemands}
        buildingDemands={data.buildingDemands}
      />

      {/* 8. Recent Qualified Leads Stream */}
      <RecentLeadsStream
        locale={locale}
        isEn={isEn}
        leads={data.recentLeads}
      />
    </div>
  );
}
