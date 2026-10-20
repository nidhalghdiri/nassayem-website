"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CalendarDays, RefreshCw } from "lucide-react";
import type { SummaryPeriod } from "@/lib/reports/maintenanceSummary";

// Shared pieces of the Equipment / Other maintenance summary cards.

type SummaryResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Loads a summary for the chosen period; the newest request wins when the period changes quickly. */
export function useMaintenanceSummary<T>(
  fetcher: (period: SummaryPeriod) => Promise<SummaryResult<T>>,
  refreshKey: number,
) {
  const [period, setPeriod] = useState<SummaryPeriod>("7D");
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setFailed(false);
    const res = await fetcher(period);
    if (id !== requestId.current) return;
    if (res.ok) setData(res.data);
    else setFailed(true);
    setLoading(false);
  }, [fetcher, period]);

  useEffect(() => { load(); }, [load, refreshKey]);

  return { period, setPeriod, data, loading, failed, reload: load };
}

function periodOptions(isEn: boolean): { key: SummaryPeriod; label: string }[] {
  return [
    { key: "TODAY", label: isEn ? "Today" : "اليوم" },
    { key: "7D", label: isEn ? "Last 7 days" : "آخر 7 أيام" },
    { key: "30D", label: isEn ? "Last 30 days" : "آخر 30 يوم" },
  ];
}

/** Average duration as one number + unit: "18 د", "3.4 س", "2.5 يوم". */
export function splitDuration(mins: number, isEn: boolean): { value: string; unit: string } {
  if (mins < 60) return { value: String(Math.round(mins)), unit: isEn ? "m" : "د" };
  const hours = mins / 60;
  if (hours < 48) return { value: String(Math.round(hours * 10) / 10), unit: isEn ? "h" : "س" };
  return { value: String(Math.round((hours / 24) * 10) / 10), unit: isEn ? "d" : "يوم" };
}

export function SummaryPeriodBar({
  isEn,
  period,
  onChange,
  note,
}: {
  isEn: boolean;
  period: SummaryPeriod;
  onChange: (period: SummaryPeriod) => void;
  note: string;
}) {
  const label = isEn ? "Performance period" : "فترة الأداء";
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
          <CalendarDays className="w-4 h-4 text-nassayem" aria-hidden />
          {label}
        </span>
        <div role="radiogroup" aria-label={label} className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {periodOptions(isEn).map((p) => (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={period === p.key}
              onClick={() => onChange(p.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                period === p.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-400">{note}</p>
    </div>
  );
}

export function SummaryLoadError({ isEn, onRetry }: { isEn: boolean; onRetry: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-10 flex flex-col items-center gap-3 text-center">
      <AlertTriangle className="w-7 h-7 text-red-400" />
      <p className="text-sm text-slate-600">{isEn ? "Could not load the summary." : "تعذّر تحميل الملخص."}</p>
      <button type="button" onClick={onRetry} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">
        <RefreshCw className="w-4 h-4" />
        {isEn ? "Try again" : "إعادة المحاولة"}
      </button>
    </div>
  );
}

export function SummarySkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-pulse">
      <div className="h-8 w-16 bg-slate-100 rounded-lg" />
      <div className="mt-3 h-4 w-28 bg-slate-100 rounded" />
    </div>
  );
}
