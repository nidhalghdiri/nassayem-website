"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { approveTaskSize, getSizeReviewList, type SizeReviewRow } from "@/app/actions/taskSizeApproval";
import { VARIANCE_FLAG_PCT } from "@/lib/maintenance/taskSize";

type Props = {
  isEn: boolean;
  onOpenTask: (id: string) => void;
  /** Bump to reload (e.g. after a task changed in the details panel). */
  refreshKey: number;
};

/**
 * "تحتاج مراجعة" — large sizes awaiting a manager's approval, and tasks whose
 * actual duration diverged far from the estimate. Keeps the expected duration
 * honest, since it carries 35 of the 100 ranking points.
 */
export default function SizeReviewSection({ isEn, onOpenTask, refreshKey }: Props) {
  const [rows, setRows] = useState<SizeReviewRow[] | null>(null);
  const [canApprove, setCanApprove] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setFailed(false);
    const res = await getSizeReviewList();
    if (id !== requestId.current) return;
    if (res.ok) { setRows(res.data); setCanApprove(res.canApprove); }
    else setFailed(true);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const approve = async (taskId: string) => {
    setBusyId(taskId);
    const res = await approveTaskSize(taskId);
    setBusyId(null);
    if (res.ok) load();
  };

  const t = {
    title: isEn ? "Needs review" : "تحتاج مراجعة",
    subtitle: isEn
      ? `Large sizes awaiting approval, and tasks more than ${VARIANCE_FLAG_PCT}% off their estimate`
      : `أحجام كبيرة بانتظار الاعتماد، ومهام اختلفت عن المتوقع بأكثر من ${VARIANCE_FLAG_PCT}%`,
    none: isEn ? "Nothing needs review." : "لا توجد مهام تحتاج مراجعة.",
    pendingSize: isEn ? "Awaiting size approval" : "بانتظار اعتماد الحجم",
    variance: isEn ? "Large difference" : "فرق كبير",
    approve: isEn ? "Approve size" : "اعتماد الحجم",
    expected: isEn ? "Expected" : "المتوقعة",
    actual: isEn ? "Actual" : "الفعلية",
    failed: isEn ? "Could not load the list." : "تعذّر تحميل القائمة.",
    retry: isEn ? "Try again" : "إعادة المحاولة",
    hours: isEn ? "h" : "س",
  };

  if (failed && !rows) {
    return (
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="w-7 h-7 text-red-400" />
        <p className="text-sm text-slate-600">{t.failed}</p>
        <button type="button" onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" />{t.retry}
        </button>
      </section>
    );
  }

  if (!rows) {
    return (
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm py-10 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-nassayem" />
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" aria-label={t.title}>
      <header className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-nassayem shrink-0" />
            {t.title}
            {rows.length > 0 && (
              <span className="text-[11px] font-bold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">{rows.length}</span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-1">{t.subtitle}</p>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
          <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          {t.none}
        </p>
      ) : (
        <ul className="divide-y divide-slate-50">
          {rows.map((r) => {
            const over = (r.variancePct ?? 0) > 0;
            return (
              <li key={r.id} className="p-4 hover:bg-slate-50/60 transition-colors">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenTask(r.id)}
                    className="min-w-0 text-start flex-1"
                  >
                    <p className="text-sm font-bold text-slate-800 truncate">
                      <span className="text-slate-400 font-mono text-xs me-1.5" dir="ltr">#{r.requestNumber}</span>
                      {r.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {r.assignedToName} · {r.buildingName}
                      {r.unitName ? ` — ${r.unitName}` : ""}
                    </p>
                  </button>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {r.reasons.includes("PENDING_SIZE") && (
                      <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-red-50 text-red-700 border border-red-200">
                        {t.pendingSize}
                      </span>
                    )}
                    {r.reasons.includes("VARIANCE") && (
                      <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        {over ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {t.variance} {r.variancePct! > 0 ? "+" : ""}{r.variancePct}%
                      </span>
                    )}
                    {canApprove && r.reasons.includes("PENDING_SIZE") && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => approve(r.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors disabled:opacity-50"
                      >
                        {busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        {t.approve}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>{t.expected}: <span className="font-bold text-slate-700">{r.expectedHours ?? "—"}{t.hours}</span></span>
                  <span>{t.actual}: <span className="font-bold text-slate-700">{r.actualHours ?? "—"}{t.hours}</span></span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
