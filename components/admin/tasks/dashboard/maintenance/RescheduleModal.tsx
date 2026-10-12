"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CalendarClock, X, Loader2 } from "lucide-react";
import {
  addMinutesToInputValue,
  formatDateTimeOman,
  omanInputValueToISO,
  toOmanInputValue,
} from "../../timeUtils";

type Props = {
  isEn: boolean;
  taskTitle: string;
  currentDue: Date | string;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  /** New due date as an ISO instant. */
  onConfirm: (isoDate: string) => void;
};

/** Lets a technician move a task's due time (e.g. to visit the nearest location first). */
export default function RescheduleModal({ isEn, taskTitle, currentDue, busy, error, onCancel, onConfirm }: Props) {
  const nowValue = useMemo(() => toOmanInputValue(new Date()), []);
  const baseValue = useMemo(() => {
    // Postpone relative to the later of "current due" and "now" (an overdue task moves from now)
    const due = toOmanInputValue(currentDue);
    return due > nowValue ? due : nowValue;
  }, [currentDue, nowValue]);

  const [value, setValue] = useState(() => {
    const due = toOmanInputValue(currentDue);
    return due > nowValue ? due : addMinutesToInputValue(nowValue, 60);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const t = {
    title: isEn ? "Reschedule task" : "إعادة جدولة المهمة",
    current: isEn ? "Current due time" : "الموعد الحالي",
    newDue: isEn ? "New due time" : "الموعد الجديد",
    quick: isEn ? "Quick options" : "خيارات سريعة",
    plus1: isEn ? "+1 hour" : "+ ساعة",
    plus3: isEn ? "+3 hours" : "+ 3 ساعات",
    tomorrow: isEn ? "Tomorrow 09:00" : "غداً 09:00",
    future: isEn ? "Choose a time in the future." : "اختر وقتاً في المستقبل.",
    note: isEn ? "Times are in Oman time. The change is recorded in the task's activity log." : "الأوقات بتوقيت عُمان. يُسجَّل التغيير في سجل نشاط المهمة.",
    cancel: isEn ? "Cancel" : "إلغاء",
    save: isEn ? "Save new time" : "حفظ الموعد الجديد",
  };

  const isFuture = !!value && value > nowValue;
  const unchanged = value === toOmanInputValue(currentDue);

  const tomorrow9 = () => {
    const d = new Date(`${nowValue.slice(0, 10)}T09:00:00+04:00`);
    return toOmanInputValue(new Date(d.getTime() + 24 * 60 * 60 * 1000));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !busy && onCancel()}>
      <form
        dir={isEn ? "ltr" : "rtl"}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (isFuture && !unchanged && !busy) onConfirm(omanInputValueToISO(value)); }}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-sky-50/60">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5" />
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

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-500">
            {t.current}: <span className="font-bold text-slate-800">{formatDateTimeOman(currentDue, isEn)}</span>
          </p>

          <div>
            <label htmlFor="resched-due" className="block text-sm font-semibold text-slate-700 mb-1.5">{t.newDue}</label>
            <input
              id="resched-due"
              type="datetime-local"
              value={value}
              min={nowValue}
              onChange={(e) => setValue(e.target.value)}
              required
              dir="ltr"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400"
            />
            {!isFuture && <p className="text-xs text-red-600 mt-1.5">{t.future}</p>}
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500 mb-2">{t.quick}</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: t.plus1, next: () => addMinutesToInputValue(baseValue, 60) },
                { label: t.plus3, next: () => addMinutesToInputValue(baseValue, 180) },
                { label: t.tomorrow, next: tomorrow9 },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setValue(chip.next())}
                  className="px-3.5 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-sky-300 hover:bg-sky-50 transition-colors"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-400">{t.note}</p>
          {error && <p role="alert" className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
          <button type="button" onClick={onCancel} disabled={busy} className="px-5 py-2.5 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50">
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={!isFuture || unchanged || busy}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t.save}
          </button>
        </div>
      </form>
    </div>
  );
}
