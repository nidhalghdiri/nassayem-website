"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, Clock, Star, Image as ImageIcon } from "lucide-react";
import type { PendingAudit } from "@/lib/reports/supervisorAudit";
import { useRouter } from "next/navigation";

export default function AuditList({ audits, locale }: { audits: PendingAudit[]; locale: string }) {
  const isEn = locale === "en";
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const t = {
    title: isEn ? "Audit List" : "قائمة التدقيق",
    pending: isEn ? "Pending Review" : "بانتظار المراجعة",
    timeElapsed: isEn ? "Elapsed" : "استغرقت",
    withinSLA: isEn ? "Within deadline" : "ضمن الموعد",
    late: isEn ? "Late" : "متأخر",
    workQuality: isEn ? "Work Quality Rating" : "تقييم جودة العمل",
    approve: isEn ? "Direct Approval" : "اعتماد مباشر",
    reject: isEn ? "Reject with note" : "رفض مع ملاحظة",
    new: isEn ? "New" : "جديد",
    normal: isEn ? "Normal" : "عادي",
    high: isEn ? "High" : "مرتفع",
    minsAgo: isEn ? "mins ago" : "منذ د",
    noTasks: isEn ? "No tasks awaiting audit." : "لا توجد مهام بانتظار التدقيق.",
    allBuildings: isEn ? "All Buildings" : "جميع المباني",
    confirmApprove: isEn ? "Confirm Approval" : "تأكيد الاعتماد",
    cancel: isEn ? "Cancel" : "إلغاء",
    noteOptional: isEn ? "Note (Optional)" : "ملاحظة (اختياري)",
  };

  const [selectedBuilding, setSelectedBuilding] = useState<string>("ALL");
  const uniqueBuildings = Array.from(new Set(audits.map(a => a.buildingName)));
  const filteredAudits = selectedBuilding === "ALL" ? audits : audits.filter(a => a.buildingName === selectedBuilding);

  const handleApprove = async (auditId: string, rating: number, note: string) => {
    setLoadingId(auditId);
    try {
      await fetch(`/api/tasks/${auditId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approved",
          details: "Supervisor approved the completed task.",
          rating,
          notes: note || "Approved directly from dashboard."
        })
      });
      router.refresh();
    } catch (e) {
      console.error(e);
    }
    setLoadingId(null);
  };

  const handleReject = async (auditId: string, taskType: string) => {
    const note = prompt(isEn ? "Enter rejection reason:" : "أدخل سبب الرفض:");
    if (!note) return;
    
    setLoadingId(auditId);
    try {
      await fetch(`/api/tasks/${auditId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rejected",
          details: "Supervisor rejected the task.",
          notes: note,
          newStatus: taskType === "CLEANING" ? "CLEANING_STARTED" : "WORK_STARTED" // send it back to workers
        })
      });
      router.refresh();
    } catch (e) {
      console.error(e);
    }
    setLoadingId(null);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-wrap gap-4">
        <div>
          <h2 className="font-bold text-slate-800">{t.title}</h2>
          <span className="text-xs font-medium text-slate-500">{t.pending}</span>
        </div>
        
        {uniqueBuildings.length > 0 && (
          <select 
            value={selectedBuilding}
            onChange={(e) => setSelectedBuilding(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-nassayem"
          >
            <option value="ALL">{t.allBuildings}</option>
            {uniqueBuildings.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        )}
      </div>

      <div className="p-4 space-y-4">
        {filteredAudits.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            {t.noTasks}
          </div>
        ) : filteredAudits.map((audit) => (
          <AuditCard 
            key={audit.id} 
            audit={audit} 
            t={t} 
            isEn={isEn} 
            isLoading={loadingId === audit.id}
            onApprove={(rating: number, note: string) => handleApprove(audit.id, rating, note)}
            onReject={() => handleReject(audit.id, audit.taskType)}
          />
        ))}
      </div>
    </div>
  );
}

function AuditCard({ audit, t, isEn, isLoading, onApprove, onReject }: any) {
  const [isApproving, setIsApproving] = useState(false);
  const [rating, setRating] = useState(5);
  const [note, setNote] = useState("");

  const completedTime = new Date(audit.completedAt);
  const now = new Date();
  const diffMins = Math.round((now.getTime() - completedTime.getTime()) / 60000);
  
  // Calculate elapsed time from started to completed
  let taskDurationMins = 0;
  if (audit.startedAt) {
    const startedTime = new Date(audit.startedAt);
    taskDurationMins = Math.max(0, Math.round((completedTime.getTime() - startedTime.getTime()) / 60000));
  }
  
  const isLate = audit.dueDate < completedTime;
  const isNew = diffMins < 60; // marked as new if completed within the last hour

  return (
    <div className="border border-slate-100 rounded-2xl p-4 hover:border-nassayem/30 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-slate-800">
            {audit.buildingName} {audit.unitName ? `— ${audit.unitName}` : ""}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {audit.assignedUserName} · {audit.taskType === "CLEANING" ? (isEn ? "Cleaning" : "تنظيف") : (isEn ? "Maintenance" : "صيانة")}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded-lg">
          <Clock className="w-3 h-3" />
          {isEn ? `${diffMins} ${t.minsAgo}` : `${t.minsAgo} ${diffMins}`}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {isNew && <span className="bg-purple-100 text-purple-700 text-[11px] font-bold px-2 py-1 rounded-md">{t.new}</span>}
        <span className={`text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1 ${isLate ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
          <Clock className="w-3 h-3" />
          {taskDurationMins > 0 ? `${t.timeElapsed} ${taskDurationMins} ${isEn ? 'm' : 'د'} — ` : ""}
          {isLate ? t.late : t.withinSLA}
        </span>
        {audit.priority === "HIGH" || audit.priority === "URGENT" ? (
          <span className="bg-orange-50 text-orange-600 text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            {t.high}
          </span>
        ) : (
          <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            {t.normal}
          </span>
        )}
      </div>

      {/* Photos */}
      <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar pb-2">
        {audit.photos.length > 0 ? (
          audit.photos.map((photo: any) => (
            <div key={photo.id} className="w-20 h-20 shrink-0 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200 overflow-hidden">
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
            </div>
          ))
        ) : (
          <div className="w-20 h-20 shrink-0 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 border-dashed">
            <ImageIcon className="w-6 h-6 text-slate-300" />
          </div>
        )}
      </div>

      {/* Action Area */}
      {isApproving ? (
        <div className="flex flex-col gap-4 pt-4 border-t border-slate-50 bg-emerald-50/30 p-4 rounded-xl mt-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-700">{t.workQuality}</span>
              <div className="flex gap-1" dir="ltr">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setRating(star)} className="focus:outline-none transition-transform hover:scale-110">
                    <Star className={`w-6 h-6 ${star <= rating ? 'fill-orange-400 text-orange-400' : 'text-slate-300'}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <textarea 
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.noteOptional}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 resize-none"
          />
          <div className="flex w-full gap-2 justify-end">
            <button 
              disabled={isLoading}
              onClick={() => setIsApproving(false)}
              className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
            >
              {t.cancel}
            </button>
            <button 
              disabled={isLoading}
              onClick={() => onApprove(rating, note)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-50"
            >
              {t.confirmApprove}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row items-center justify-end gap-2 pt-4 border-t border-slate-50">
          <button 
            disabled={isLoading}
            onClick={onReject}
            className="flex-1 md:flex-none border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
          >
            {t.reject}
          </button>
          <button 
            disabled={isLoading}
            onClick={() => setIsApproving(true)}
            className="flex-1 md:flex-none bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            {t.approve}
          </button>
        </div>
      )}
    </div>
  );
}
