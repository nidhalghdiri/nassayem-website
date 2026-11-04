"use client";

import React, { useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { toOmanInputValue, omanInputValueToISO, addMinutesToInputValue } from "../timeUtils";

type Props = {
  taskId: string;
  /** "rejected" = supervisor, "rejected_receptionist" = reception. */
  action: "rejected" | "rejected_receptionist";
  details: string;
  isEn: boolean;
  onClose: () => void;
  onDone: () => void;
};

/**
 * Rejecting sends the same task back to "Not started" for the worker to redo,
 * so the reviewer gives the reason and the new due date together.
 */
export default function RejectTaskModal({ taskId, action, details, isEn, onClose, onDone }: Props) {
  const [reason, setReason] = useState("");
  // Default: two hours from now (Oman time).
  const [due, setDue] = useState(() => toOmanInputValue(new Date(Date.now() + 2 * 60 * 60 * 1000)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = {
    title: isEn ? "Reject task — needs repeat" : "رفض المهمة — تحتاج إعادة",
    hint: isEn
      ? "The same task goes back to the worker as “Not started” with the new due date."
      : "ترجع نفس المهمة للموظف بحالة «لم تبدأ» مع الموعد الجديد.",
    reason: isEn ? "Rejection reason" : "سبب الرفض",
    newDue: isEn ? "New due date" : "الموعد الجديد",
    cancel: isEn ? "Cancel" : "إلغاء",
    confirm: isEn ? "Reject & reschedule" : "رفض وإعادة جدولة",
    reasonRequired: isEn ? "Please enter the rejection reason." : "يرجى كتابة سبب الرفض.",
    failed: isEn ? "Could not reject the task. Please try again." : "تعذر رفض المهمة. حاول مرة أخرى.",
  };

  const submit = async () => {
    if (!reason.trim()) {
      setError(t.reasonRequired);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, details, notes: reason.trim(), newDueDate: omanInputValueToISO(due) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || t.failed);
        setSaving(false);
        return;
      }
      onDone();
    } catch {
      setError(t.failed);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">{t.title}</h3>
            <p className="text-xs text-slate-500 mt-1">{t.hint}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">{t.reason}</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-nassayem"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">{t.newDue}</label>
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-nassayem"
            dir="ltr"
          />
          <div className="flex gap-2 mt-2">
            {[60, 120, 24 * 60].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setDue(addMinutesToInputValue(toOmanInputValue(new Date()), mins))}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                {mins < 24 * 60 ? `+${mins / 60}${isEn ? "h" : "س"}` : isEn ? "+1 day" : "+يوم"}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs font-medium text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 text-sm font-bold rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="px-4 py-2.5 text-sm font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
