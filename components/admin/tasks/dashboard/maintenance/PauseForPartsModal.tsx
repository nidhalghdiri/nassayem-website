"use client";

import React, { useEffect, useState } from "react";
import { PackageX, X, Loader2 } from "lucide-react";

type Props = {
  isEn: boolean;
  taskTitle: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

/** Asks the technician which part they're waiting for before pausing a task. */
export default function PauseForPartsModal({ isEn, taskTitle, busy, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const t = {
    title: isEn ? "Pause — waiting for spare parts" : "إيقاف — بانتظار قطع غيار",
    label: isEn ? "What are you waiting for?" : "ما القطعة المطلوبة؟",
    placeholder: isEn ? "e.g. Thermostat — ordered from supplier" : "مثال: ثرموستات — مطلوب من المورد",
    hint: isEn
      ? "The task will show as paused until you resume it. The waiting time is tracked separately from work time."
      : "ستظهر المهمة كمتوقفة حتى تستأنف العمل، ويُحتسب وقت الانتظار منفصلاً عن وقت العمل.",
    cancel: isEn ? "Cancel" : "إلغاء",
    confirm: isEn ? "Pause task" : "إيقاف المهمة",
  };

  const valid = reason.trim().length >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !busy && onCancel()}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (valid && !busy) onConfirm(reason.trim()); }}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-amber-50/60">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <PackageX className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-800">{t.title}</h2>
              <p className="text-xs text-slate-500 truncate">{taskTitle}</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-2">
          <label htmlFor="hold-reason" className="block text-sm font-semibold text-slate-700">{t.label}</label>
          <textarea
            id="hold-reason"
            autoFocus
            rows={3}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.placeholder}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 resize-none"
          />
          <p className="text-xs text-slate-400">{t.hint}</p>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
          <button type="button" onClick={onCancel} disabled={busy} className="px-5 py-2.5 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50">
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={!valid || busy}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t.confirm}
          </button>
        </div>
      </form>
    </div>
  );
}
