"use client";

import { Home, Building2, Clock, BarChart3, TrendingUp, Sparkles } from "lucide-react";
import { DemandItem, HourlyTrafficItem } from "@/lib/chatbot/dailyReportData";

type Props = {
  demandByApartmentType: DemandItem[];
  demandByBuilding: DemandItem[];
  hourlyDistribution: HourlyTrafficItem[];
  locale: string;
};

export default function DemandAndHourlyAnalytics({
  demandByApartmentType,
  demandByBuilding,
  hourlyDistribution,
  locale,
}: Props) {
  const isEn = locale === "en";

  const maxMessages = Math.max(1, ...hourlyDistribution.map((h) => h.messages));
  const peakHour = [...hourlyDistribution].sort((a, b) => b.messages - a.messages)[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. Demand by Apartment Type */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 lg:p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Home className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-gray-900">
              {isEn ? "Demand by Apartment Type" : "توزيع الطلب حسب نوع الشقة"}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            {isEn
              ? "Guest inquiries and searches segmented by unit category."
              : "استفسارات وبحث النزلاء موزعة حسب فئة ونوع الشقة."}
          </p>

          <div className="space-y-3.5">
            {demandByApartmentType.map((item) => {
              const label = isEn ? item.label : item.labelAr;
              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-gray-700">{label}</span>
                    <span className="text-gray-900">
                      {item.count} {isEn ? "inquiries" : "استفسار"} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-500"
                      style={{ width: `${Math.max(item.count > 0 ? 6 : 0, item.percentage)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500 flex items-center justify-between">
          <span>{isEn ? "Highest Demand:" : "الفئة الأكثر طلباً:"}</span>
          <span className="font-bold text-blue-700">
            {demandByApartmentType[0]
              ? isEn
                ? demandByApartmentType[0].label
                : demandByApartmentType[0].labelAr
              : "—"}
          </span>
        </div>
      </div>

      {/* 2. Demand by Building / Location */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 lg:p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-gray-900">
              {isEn ? "Demand by Building / Location" : "توزيع الطلب حسب المبنى / الموقع"}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            {isEn
              ? "Property popularity based on customer booking requests."
              : "مدى إقبال النزلاء على كل فرع وعقار من مباني نسائم."}
          </p>

          <div className="space-y-3.5">
            {demandByBuilding.map((item) => {
              const label = isEn ? item.label : item.labelAr;
              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-gray-700">{label}</span>
                    <span className="text-gray-900">
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all duration-500"
                      style={{ width: `${Math.max(item.count > 0 ? 6 : 0, item.percentage)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500 flex items-center justify-between">
          <span>{isEn ? "Top Location:" : "الفرع الأكثر طلباً:"}</span>
          <span className="font-bold text-amber-800">
            {demandByBuilding[0]
              ? isEn
                ? demandByBuilding[0].label
                : demandByBuilding[0].labelAr
              : "—"}
          </span>
        </div>
      </div>

      {/* 3. 24-Hour Traffic Curve */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 lg:p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-gray-900">
                {isEn ? "24-Hour Activity Distribution" : "توزيع النشاط على مدار 24 ساعة"}
              </h3>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            {isEn
              ? "Hourly customer load throughout the day."
              : "حجم استفسارات ورسائل النزلاء على مدار اليوم لتحديد أوقات الذروة."}
          </p>

          {/* Bar chart */}
          <div className="h-36 flex items-end gap-1 pt-4 pb-1">
            {hourlyDistribution.map((h) => {
              const heightPct = Math.max(8, Math.round((h.messages / maxMessages) * 100));
              const isPeak = h.hour === peakHour?.hour && h.messages > 0;

              return (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center bg-gray-900 text-white text-[10px] py-1 px-2 rounded shadow-lg whitespace-nowrap z-20 pointer-events-none">
                    <span className="font-bold">{h.label}</span>
                    <span>{h.messages} msgs · {h.conversations} chats</span>
                  </div>

                  <div className="w-full bg-gray-100 rounded-t-sm flex items-end overflow-hidden h-28">
                    <div
                      className={`w-full transition-all duration-300 ${
                        isPeak ? "bg-emerald-500" : h.messages > 0 ? "bg-nassayem" : "bg-gray-200"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-gray-400 font-mono">
                    {h.hour % 4 === 0 ? `${h.hour}h` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-600 flex items-center justify-between">
          <span>{isEn ? "Peak Activity Hour:" : "ساعة الذروة اليوم:"}</span>
          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
            {peakHour?.label || "14:00"} ({peakHour?.messages || 0} {isEn ? "msgs" : "رسالة"})
          </span>
        </div>
      </div>
    </div>
  );
}
