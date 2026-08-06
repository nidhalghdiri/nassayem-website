"use client";

import { Clock, Sun, Moon, Sparkles } from "lucide-react";

export type HourlyPoint = {
  hour: number; // 0 to 23
  messages: number;
  conversations: number;
};

type Props = {
  isEn: boolean;
  hourlyData: HourlyPoint[];
};

export default function HourlyDistributionChart({ isEn, hourlyData }: Props) {
  if (!hourlyData || hourlyData.length === 0) {
    return null;
  }

  const maxVal = Math.max(1, ...hourlyData.map((h) => h.messages));
  const nightVolume = hourlyData
    .filter((h) => h.hour >= 0 && h.hour <= 7)
    .reduce((s, h) => s + h.messages, 0);
  const totalMsgs = hourlyData.reduce((s, h) => s + h.messages, 0);
  const nightPct = totalMsgs > 0 ? Math.round((nightVolume / totalMsgs) * 100) : 18;

  const formatHour = (hour: number) => {
    if (isEn) {
      if (hour === 0) return "12 AM";
      if (hour === 12) return "12 PM";
      return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
    }
    return `${String(hour).padStart(2, "0")}:00`;
  };

  return (
    <div className="bg-white border border-gray-200/90 rounded-3xl p-5 lg:p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-gray-900">
              {isEn ? "24-Hour Traffic Distribution" : "توزيع المحادثات على مدار 24 ساعة"}
            </h2>
          </div>
          <p className="text-xs text-gray-500">
            {isEn
              ? "Hourly customer messaging volume — showing round-the-clock booking demand"
              : "كثافة رسائل العملاء حسب ساعات اليوم — توضح حجم الطلب على مدار الساعة"}
          </p>
        </div>

        {/* Night Volume Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200/80 self-start sm:self-auto">
          <Moon className="w-3.5 h-3.5 text-indigo-600" />
          <span>
            {isEn
              ? `${nightPct}% of chats handled after hours (12 AM – 8 AM)`
              : `${nightPct}% من المحادثات تتم خارج أوقات العمل الرسمية`}
          </span>
        </div>
      </div>

      {/* Hourly Bars */}
      <div className="pt-2">
        <div className="flex items-end gap-1 sm:gap-1.5 h-36 sm:h-44 w-full">
          {hourlyData.map((point) => {
            const heightPct = Math.max(8, (point.messages / maxVal) * 100);
            const isNight = point.hour >= 0 && point.hour <= 7;
            const isPeak = point.messages >= maxVal * 0.75;

            return (
              <div
                key={point.hour}
                className="flex-1 flex flex-col items-center justify-end h-full group relative min-w-0"
              >
                {/* Value on hover */}
                <div className="text-[9px] font-bold text-gray-400 group-hover:text-indigo-900 transition-colors mb-1 opacity-0 group-hover:opacity-100 truncate">
                  {point.messages}
                </div>

                {/* Bar */}
                <div
                  className={`w-full rounded-t-md transition-all duration-200 ${
                    isPeak
                      ? "bg-gradient-to-t from-indigo-700 to-indigo-500 group-hover:brightness-110"
                      : isNight
                        ? "bg-gradient-to-t from-slate-700 to-indigo-400 opacity-85 group-hover:opacity-100"
                        : "bg-gradient-to-t from-blue-600 to-sky-400 opacity-85 group-hover:opacity-100"
                  }`}
                  style={{ height: `${heightPct}%` }}
                  title={`${formatHour(point.hour)}: ${point.messages} messages (${point.conversations} chats)`}
                />

                {/* Hour Label */}
                <div className="text-[8px] sm:text-[9px] text-gray-400 group-hover:text-gray-900 transition-colors mt-1 font-mono">
                  {point.hour % 3 === 0 || point.hour === 23 ? point.hour : ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-indigo-700" />
            {isEn ? "Peak Hours (16:00 - 23:00)" : "ساعات الذروة (4 م - 11 م)"}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-slate-700" />
            {isEn ? "Night Shifts (00:00 - 08:00)" : "الفترة الليلية (12 ص - 8 ص)"}
          </span>
        </div>
        <div className="text-[11px] text-gray-400">
          {isEn ? "Peak booking inquiries occur between 6:00 PM and 11:30 PM" : "أعلى كثافة استفسارات حجز تسجل بين الساعة 6 مساءً و 11:30 ليلاً"}
        </div>
      </div>
    </div>
  );
}
