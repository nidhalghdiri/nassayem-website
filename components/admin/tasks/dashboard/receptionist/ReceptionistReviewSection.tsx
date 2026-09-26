"use client";

import React, { useState } from "react";
import { Image as ImageIcon, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import type { DashboardTask, ReceptionistStats } from "@/lib/reports/receptionistDashboard";
import { formatTimeAgo } from "../../timeUtils";

export default function ReceptionistReviewSection({ 
  isEn,
  stats,
  pendingTasks,
  approvedTasks
}: { 
  isEn: boolean;
  stats: ReceptionistStats;
  pendingTasks: DashboardTask[];
  approvedTasks: DashboardTask[];
}) {
  const t = {
    howItWorks: isEn ? "How does approval work?" : "كيف يعمل الاعتماد؟",
    instruction1: isEn 
      ? "① Initial approval: Review photos and approve. The task remains pending with the supervisor until final approval." 
      : "① اعتماد مبدئي: تراجع الصور وتعتمد، وتبقى المهمة معلقة بيد المشرف حتى اعتماده النهائي.",
    instruction2: isEn
      ? "② The supervisor can approve directly even if it passes you, or they may settle for your approval and photos without site visit."
      : "② المشرف يقدر يعتمد مباشرة حتى لو ما مرّت عليك، أو يكتفي باعتمادك وصورك بدون نزول للموقع.",
    pendingYourReview: isEn ? "Pending your review" : "بانتظار مراجعتك",
    approvedPendingSupervisor: isEn ? "You approved — pending supervisor" : "اعتمدتها — بانتظار المشرف",
    finalApproved: isEn ? "Final approved by supervisor" : "اعتمدها المشرف نهائياً",
    taskDetails: isEn ? "Fouad Abdullah Yahya · Normal cleaning" : "فؤاد عبدالله يحيى · تنظيف عادي",
    timeAgo: isEn ? "278 mins ago" : "منذ 278 د",
    onTime: isEn ? "On time" : "ضمن الموعد",
    elapsed: isEn ? "Elapsed 1h 58m — " : "استغرقت 1 س 58 د — ",
    new: isEn ? "New" : "جديد",
    normal: isEn ? "Normal" : "عادي",
    approveBtn: isEn ? "Receptionist Approve" : "اعتماد الاستقبال",
    pendingSupervisorTitle: isEn ? "Approved by you — Pending supervisor" : "اعتمدتها — معلقة بيد المشرف",
    pendingTime: isEn ? "Approved" : "اعتمدتها",
    taskCount: isEn ? "task" : "مهمة",
    noTasks: isEn ? "No tasks awaiting your review." : "لا توجد مهام بانتظار مراجعتك.",
    noApprovedTasks: isEn ? "No tasks pending supervisor approval." : "لا توجد مهام معلقة بيد المشرف.",
  };

  const router = useRouter();

  return (
    <div className="space-y-4">
      {/* Instructions Banner */}
      <div className="bg-white rounded-2xl border border-nassayem/30 p-5 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1 h-full bg-nassayem"></div>
        <h3 className="font-bold text-slate-800 mb-2">{t.howItWorks}</h3>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>{t.instruction1}</li>
          <li>{t.instruction2}</li>
        </ul>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500 mb-2">{t.finalApproved}</div>
          <div className="text-3xl font-black text-slate-800">{stats.finalApprovedCount}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500 mb-2">{t.approvedPendingSupervisor}</div>
          <div className="text-3xl font-black text-emerald-600">{stats.approvedPendingSupervisorCount}</div>
        </div>
        <div className="bg-white rounded-2xl border border-orange-200 bg-orange-50/30 p-5 shadow-sm relative">
          <div className="text-xs font-bold text-orange-700 mb-2">{t.pendingYourReview}</div>
          <div className="text-3xl font-black text-orange-600">{stats.pendingReviewCount}</div>
        </div>
      </div>

      {/* Pending Your Review Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800 text-sm">{t.pendingYourReview}</h3>
          <span className="text-xs text-slate-500 font-medium">{pendingTasks.length} {t.taskCount}</span>
        </div>
        <div className="p-5 space-y-4">
          {pendingTasks.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              {t.noTasks}
            </div>
          ) : (
            pendingTasks.map((task) => (
              <ReviewCard key={task.id} task={task} isEn={isEn} router={router} />
            ))
          )}
        </div>
      </div>

      {/* Pending Supervisor */}
      <div>
        <h3 className="font-bold text-slate-500 text-xs mb-3">{t.pendingSupervisorTitle}</h3>
        {approvedTasks.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm bg-white rounded-2xl border border-slate-100 border-dashed">
            {t.noApprovedTasks}
          </div>
        ) : (
          <div className="space-y-3">
            {approvedTasks.map(task => (
              <div key={task.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-sm gap-4">
                <div>
                  <h4 className="font-bold text-slate-800">
                    {task.buildingName} {task.unitName ? `— ${task.unitName}` : ""}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">{task.assignedUserName}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2 items-center">
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 
                    {t.pendingTime} {task.actionTime ? task.actionTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : ""}
                  </span>
                  <span className="bg-orange-50 text-orange-600 text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    {isEn ? "Pending Supervisor" : "معلقة بيد المشرف"}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                    🧹
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewCard({ task, isEn, router }: { task: DashboardTask, isEn: boolean, router: any }) {
  const [isApproving, setIsApproving] = useState(false);
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const t = {
    approveBtn: isEn ? "Receptionist Approve" : "اعتماد الاستقبال",
    rejectBtn: isEn ? "Reject" : "رفض",
    confirmApprove: isEn ? "Confirm Approval" : "تأكيد الاعتماد",
    cancel: isEn ? "Cancel" : "إلغاء",
    noteOptional: isEn ? "Note (Optional)" : "ملاحظة (اختياري)",
    new: isEn ? "New" : "جديد",
    timeElapsed: isEn ? "Elapsed" : "استغرقت",
    withinSLA: isEn ? "Within deadline" : "ضمن الموعد",
    late: isEn ? "Late" : "متأخر",
    normal: isEn ? "Normal" : "عادي",
    high: isEn ? "High" : "مرتفع",
  };

  const completedTime = new Date(task.completedAt);
  const now = new Date();
  const diffMins = Math.round((now.getTime() - completedTime.getTime()) / 60000);
  
  let taskDurationMins = 0;
  if (task.startedAt) {
    const startedTime = new Date(task.startedAt);
    taskDurationMins = Math.max(0, Math.round((completedTime.getTime() - startedTime.getTime()) / 60000));
  }
  
  const isLate = task.dueDate < completedTime;
  const isNew = diffMins < 60;

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      await fetch(`/api/tasks/${task.id}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approved_receptionist",
          details: "Receptionist approved the completed task.",
          notes: note || "Approved from receptionist dashboard."
        })
      });
      router.refresh();
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
    setIsApproving(false);
  };

  const handleReject = async () => {
    const rNote = prompt(isEn ? "Enter rejection reason:" : "أدخل سبب الرفض:");
    if (!rNote) return;
    
    setIsLoading(true);
    try {
      await fetch(`/api/tasks/${task.id}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rejected_receptionist",
          details: "Receptionist rejected the task.",
          notes: rNote,
          newStatus: task.taskType === "CLEANING" ? "CLEANING_STARTED" : "WORK_STARTED"
        })
      });
      router.refresh();
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  return (
    <div className="border border-slate-100 rounded-2xl p-4 hover:border-nassayem/30 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-slate-800">
            {task.buildingName} {task.unitName ? `— ${task.unitName}` : ""}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {task.assignedUserName} · {task.taskType === "CLEANING" ? (isEn ? "Cleaning" : "تنظيف") : (isEn ? "Maintenance" : "صيانة")}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded-lg">
          <Clock className="w-3 h-3" />
          {formatTimeAgo(diffMins, isEn)}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {isNew && <span className="bg-purple-100 text-purple-700 text-[11px] font-bold px-2 py-1 rounded-md">{t.new}</span>}
        <span className={`text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1 ${isLate ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
          <Clock className="w-3 h-3" />
          {taskDurationMins > 0 ? `${t.timeElapsed} ${taskDurationMins} ${isEn ? 'm' : 'د'} — ` : ""}
          {isLate ? t.late : t.withinSLA}
        </span>
        {task.priority === "HIGH" || task.priority === "URGENT" ? (
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
        {task.photos.length > 0 ? (
          task.photos.map((photo: any) => (
            <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer" className="w-24 h-24 shrink-0 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200 overflow-hidden hover:opacity-90 transition-opacity">
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
            </a>
          ))
        ) : (
          <div className="w-24 h-24 shrink-0 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 border-dashed">
            <ImageIcon className="w-6 h-6 text-slate-300" />
          </div>
        )}
      </div>

      {isApproving ? (
        <div className="flex flex-col gap-3 pt-4 border-t border-slate-50 bg-emerald-50/30 p-4 rounded-xl mt-2">
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
              onClick={handleApprove}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {t.confirmApprove}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row items-center justify-end gap-2">
          <button 
            disabled={isLoading}
            onClick={handleReject}
            className="flex-1 md:flex-none border border-red-200 text-red-600 hover:bg-red-50 py-2.5 px-4 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {t.rejectBtn}
          </button>
          <button 
            disabled={isLoading}
            onClick={() => setIsApproving(true)}
            className="flex-1 md:flex-none bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 px-6 rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            {t.approveBtn}
          </button>
        </div>
      )}
    </div>
  );
}
