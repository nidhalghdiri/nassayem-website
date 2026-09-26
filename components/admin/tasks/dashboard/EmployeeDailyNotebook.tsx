"use client";

import React, { useState, useTransition } from "react";
import { createEmployeeNote } from "@/app/actions/employeeNotes";
import { formatTimeAgo } from "../timeUtils";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export type EmployeeNoteProps = {
  id: string;
  isPositive: boolean;
  criteria: string;
  text: string;
  createdAt: Date | string;
  employee: { name: string | null };
  author: { name: string | null; role: string };
};

type Props = {
  locale: string;
  todaysNotes: EmployeeNoteProps[];
  assignableStaff: { id: string; name: string | null }[];
};

export default function EmployeeDailyNotebook({ locale, todaysNotes, assignableStaff }: Props) {
  const isEn = locale === "en";
  const [isPending, startTransition] = useTransition();

  const [employeeId, setEmployeeId] = useState("");
  const [criteria, setCriteria] = useState("timeAdherence");
  const [noteType, setNoteType] = useState("positive");
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !text.trim()) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("employeeId", employeeId);
      formData.append("criteria", criteria);
      formData.append("noteType", noteType);
      formData.append("text", text);

      const res = await createEmployeeNote(formData);
      if (res.success) {
        setEmployeeId("");
        setText("");
      } else {
        alert(res.error || "An error occurred");
      }
    });
  };

  const t = {
    titleList: isEn ? "Today's Notes" : "ملاحظات اليوم",
    titleForm: isEn ? "Daily Notebook" : "دفتر ملاحظات يومي",
    subtitleForm: isEn ? "Independent from audit" : "مستقل عن التدقيق",
    employeeLabel: isEn ? "Employee" : "الموظف",
    selectEmployee: isEn ? "Select employee..." : "اختر الموظف...",
    criteriaLabel: isEn ? "Criteria" : "المعيار",
    noteTypeLabel: isEn ? "Note Type" : "نوع الملاحظة",
    positive: isEn ? "Positive" : "إيجابية",
    negative: isEn ? "Negative" : "سلبية",
    textLabel: isEn ? "Note Text" : "نص الملاحظة",
    textPlaceholder: isEn ? "Example: Reported a leak immediately..." : "مثال: بلّغ فوراً عن تسرب مياه...",
    saveBtn: isEn ? "Save Note" : "حفظ الملاحظة",
    noNotes: isEn ? "No notes added today yet." : "لم تتم إضافة أي ملاحظات اليوم بعد.",
    saving: isEn ? "Saving..." : "جاري الحفظ...",
  };

  const criteriaMap: Record<string, string> = {
    timeAdherence: isEn ? "Time Adherence" : "الالتزام بالوقت",
    workQuality: isEn ? "Work Quality" : "جودة العمل",
    docAndResponse: isEn ? "Documentation & Response" : "التوثيق والاستجابة",
    productivity: isEn ? "Productivity" : "حجم الإنتاجية",
    general: isEn ? "General" : "عام",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6" dir={isEn ? "ltr" : "rtl"}>
      {/* Left side: Notes List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col max-h-[500px]">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <span className="text-sm text-slate-500 font-medium">
            {todaysNotes.length} {isEn ? "notes" : "ملاحظة"}
          </span>
          <h2 className="text-lg font-bold text-slate-800">{t.titleList}</h2>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 space-y-3 hide-scrollbar">
          {todaysNotes.length === 0 ? (
            <p className="text-center text-slate-400 py-8 text-sm">{t.noNotes}</p>
          ) : (
            todaysNotes.map((note) => {
              const diffMins = Math.round((new Date().getTime() - new Date(note.createdAt).getTime()) / 60000);
              return (
                <div 
                  key={note.id} 
                  className={`p-4 rounded-xl border ${note.isPositive ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'} flex gap-3 items-start relative overflow-hidden group`}
                >
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className="font-bold text-slate-800 text-sm">
                        {note.employee.name} — <span className="font-medium text-slate-700">{note.text}</span>
                      </p>
                    </div>
                    <div className="flex gap-2 items-center mt-2 text-xs text-slate-500">
                      <span>{criteriaMap[note.criteria] || note.criteria}</span>
                      <span>·</span>
                      <span>{formatTimeAgo(diffMins, isEn)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 mt-0.5">
                    {note.isPositive ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right side: Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
        <form onSubmit={handleSubmit} className="flex flex-col h-full space-y-6">
          <div className="flex justify-between items-end border-b border-slate-100 pb-4">
            <span className="text-xs text-slate-400 font-medium">{t.subtitleForm}</span>
            <h2 className="text-lg font-bold text-slate-800">{t.titleForm}</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">{t.employeeLabel}</label>
              <select 
                value={employeeId} 
                onChange={e => setEmployeeId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-nassayem focus:border-nassayem outline-none bg-white"
                required
              >
                <option value="">{t.selectEmployee}</option>
                {assignableStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">{t.criteriaLabel}</label>
              <select 
                value={criteria} 
                onChange={e => setCriteria(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-nassayem focus:border-nassayem outline-none bg-white"
              >
                {Object.entries(criteriaMap).map(([key, val]) => (
                  <option key={key} value={key}>{val}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500">{t.noteTypeLabel}</label>
            <select 
              value={noteType} 
              onChange={e => setNoteType(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-nassayem focus:border-nassayem outline-none bg-white"
            >
              <option value="positive">{t.positive}</option>
              <option value="negative">{t.negative}</option>
            </select>
          </div>

          <div className="space-y-1.5 flex-1 flex flex-col">
            <label className="text-xs font-bold text-slate-500">{t.textLabel}</label>
            <textarea 
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={t.textPlaceholder}
              className="w-full flex-1 min-h-[100px] border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-nassayem focus:border-nassayem outline-none resize-none"
              required
            />
          </div>

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isPending}
              className="bg-nassayem hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 w-fit disabled:opacity-50"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? t.saving : t.saveBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
