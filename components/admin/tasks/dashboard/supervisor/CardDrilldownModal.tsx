"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import TaskListModal from "../receptionist/TaskListModal";
import type { DrilldownResult } from "@/lib/reports/maintenanceDrilldown";
import type { SummaryRange } from "@/lib/reports/maintenanceSummary";

type Props = {
  isEn: boolean;
  title: string;
  accentClass: string;
  range: SummaryRange;
  /** Loads the card's tasks (an action bound to the card key). */
  load: (range: SummaryRange) => Promise<{ ok: true; data: DrilldownResult } | { ok: false; error: string }>;
  onClose: () => void;
  onOpenTask: (id: string) => void;
  /** Completion-based cards show when the work finished instead of created. */
  showCompletedAt?: boolean;
};

/**
 * Opens one summary card's task list. The rows are fetched when the card is
 * clicked (the summary itself only carries counts) and capped server-side —
 * the footer says so and points at the tab's Export for the full set.
 */
export default function CardDrilldownModal({
  isEn, title, accentClass, range, load, onClose, onOpenTask, showCompletedAt = false,
}: Props) {
  const [result, setResult] = useState<DrilldownResult | null>(null);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);

  const run = useCallback(async () => {
    const id = ++requestId.current;
    setFailed(false);
    const res = await load(range);
    if (id !== requestId.current) return;
    if (res.ok) setResult(res.data);
    else setFailed(true);
  }, [load, range]);

  useEffect(() => { run(); }, [run]);

  // Close on Escape while still loading (TaskListModal handles it once open)
  useEffect(() => {
    if (result) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, onClose]);

  if (failed && !result) {
    return (
      <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-sm w-full flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-slate-600">{isEn ? "Could not load the list." : "تعذّر تحميل القائمة."}</p>
          <div className="flex gap-2">
            <button type="button" onClick={run} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <RefreshCw className="w-4 h-4" />
              {isEn ? "Try again" : "إعادة المحاولة"}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50">
              {isEn ? "Close" : "إغلاق"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl px-8 py-10 flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-nassayem" />
          <p className="text-sm text-slate-500">{isEn ? "Loading…" : "جارٍ التحميل…"}</p>
        </div>
      </div>
    );
  }

  const capped = result.total > result.tasks.length;
  const heading = capped
    ? `${title} — ${isEn ? `${result.tasks.length} of ${result.total}` : `${result.tasks.length} من ${result.total}`}`
    : title;

  return (
    <TaskListModal
      isEn={isEn}
      title={heading}
      accentClass={accentClass}
      tasks={result.tasks}
      showCompletedAt={showCompletedAt}
      onClose={onClose}
      onOpenTask={onOpenTask}
    />
  );
}
