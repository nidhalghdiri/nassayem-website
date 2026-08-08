"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Mail,
  LayoutDashboard,
  Coins,
  MessageSquare,
  ArrowLeft,
  Bot,
  Sparkles,
} from "lucide-react";
import { DailyReportPayload } from "@/lib/chatbot/dailyReportData";
import DailySummaryCards from "./DailySummaryCards";
import EscalationsDeliveryTable from "./EscalationsDeliveryTable";
import CustomerBuildingBreakdown from "./CustomerBuildingBreakdown";
import ReservationsAndPaymentsTable from "./ReservationsAndPaymentsTable";
import DemandAndHourlyAnalytics from "./DemandAndHourlyAnalytics";
import EmailReportPreview from "./EmailReportPreview";

type Props = {
  data: DailyReportPayload;
  locale: string;
  currentDateParam: string;
};

export default function DailyReportView({ data, locale, currentDateParam }: Props) {
  const router = useRouter();
  const isEn = locale === "en";
  const [viewMode, setViewMode] = useState<"DASHBOARD" | "EMAIL_PREVIEW">("DASHBOARD");
  const [currency, setCurrency] = useState<"OMR" | "USD">("OMR");
  const [selectedDate, setSelectedDate] = useState(data.dateIso);

  const navigateToDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    router.push(`/${locale}/admin/chatbot/report?date=${dateStr}`);
  };

  const handlePreviousDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    navigateToDate(d.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    navigateToDate(d.toISOString().slice(0, 10));
  };

  const setToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    navigateToDate(today);
  };

  const setYesterday = () => {
    const y = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    navigateToDate(y);
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ── Top Header & Navigation ────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-[#1B365D] via-[#152a48] to-[#0d1d33] text-white p-5 lg:p-6 rounded-3xl shadow-md border border-slate-700/40">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-amber-300 border border-white/15 shadow-inner">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-white">
                  {isEn ? "Chatbot Daily Performance Report" : "التقرير اليومي لأداء المساعد الذكي"}
                </h1>
                {data.isToday && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {isEn ? "Today (Live)" : "اليوم (مباشر)"}
                  </span>
                )}
                {data.isYesterday && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-500/30">
                    {isEn ? "Yesterday" : "أمس"}
                  </span>
                )}
              </div>
              <p className="text-xs lg:text-sm text-slate-300 mt-0.5">
                {isEn ? data.formattedDateEn : data.formattedDateAr}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Links back to Inbox & Overview */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
          <Link
            href={`/${locale}/admin/chatbot/conversations`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all backdrop-blur-xs"
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-300" />
            <span>{isEn ? "Live Inbox" : "صندوق المحادثات"}</span>
          </Link>

          <Link
            href={`/${locale}/admin/chatbot`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all backdrop-blur-xs"
          >
            <span>{isEn ? "Overview" : "لوحة المساعد"}</span>
          </Link>
        </div>
      </div>

      {/* ── Toolbar: Date Controls & View Switcher ─────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        {/* Date Selector & Quick Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Previous Day */}
          <button
            onClick={handlePreviousDay}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
            title={isEn ? "Previous Day" : "اليوم السابق"}
          >
            {isEn ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {/* Date Input */}
          <div className="relative flex items-center">
            <Calendar className="w-4 h-4 text-gray-400 absolute left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => navigateToDate(e.target.value)}
              className="text-xs font-semibold text-gray-900 pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-2 rounded-xl border border-gray-200 bg-gray-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-nassayem/40"
            />
          </div>

          {/* Next Day */}
          <button
            onClick={handleNextDay}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
            title={isEn ? "Next Day" : "اليوم التالي"}
          >
            {isEn ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Quick Buttons */}
          <button
            onClick={setToday}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              data.isToday
                ? "bg-nassayem text-white shadow-xs"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {isEn ? "Today" : "اليوم"}
          </button>

          <button
            onClick={setYesterday}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              data.isYesterday
                ? "bg-nassayem text-white shadow-xs"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {isEn ? "Yesterday" : "أمس"}
          </button>

          <button
            onClick={() => router.refresh()}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
            title={isEn ? "Refresh Data" : "تحديث البيانات"}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* View Switcher & Currency */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Currency Toggle */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setCurrency("OMR")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                currency === "OMR"
                  ? "bg-white text-nassayem shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              OMR
            </button>
            <button
              onClick={() => setCurrency("USD")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                currency === "USD"
                  ? "bg-white text-nassayem shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              USD ($)
            </button>
          </div>

          {/* View Mode */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setViewMode("DASHBOARD")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === "DASHBOARD"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-blue-600" />
              <span>{isEn ? "Interactive Dashboard" : "لوحة التحكم التفاعلية"}</span>
            </button>

            <button
              onClick={() => setViewMode("EMAIL_PREVIEW")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === "EMAIL_PREVIEW"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Mail className="w-3.5 h-3.5 text-amber-600" />
              <span>{isEn ? "Manager Email View" : "معاينة تقرير الإيميل"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content Switcher ──────────────────────────────────────────── */}
      {viewMode === "EMAIL_PREVIEW" ? (
        <EmailReportPreview data={data} locale={locale} currency={currency} />
      ) : (
        <div className="space-y-6">
          {/* 1. Summary KPI Cards */}
          <DailySummaryCards data={data} locale={locale} currency={currency} />

          {/* 2. Demands & 24-Hour Traffic */}
          <DemandAndHourlyAnalytics
            demandByApartmentType={data.demandByApartmentType}
            demandByBuilding={data.demandByBuilding}
            hourlyDistribution={data.hourlyDistribution}
            locale={locale}
          />

          {/* 3. Customer Follow-up by Building */}
          <CustomerBuildingBreakdown
            buildings={data.buildingBreakdown}
            locale={locale}
          />

          {/* 4. Reservations & Payment Links */}
          <ReservationsAndPaymentsTable
            reservations={data.reservations}
            paymentLinks={data.paymentLinks}
            locale={locale}
          />

          {/* 5. Escalations & Live WhatsApp Delivery Status */}
          <EscalationsDeliveryTable
            logs={data.escalationLogs}
            locale={locale}
          />
        </div>
      )}
    </div>
  );
}
