"use client";

import { useState } from "react";
import { TASK_TYPE_CONFIG, TASK_PRIORITY_CONFIG } from "@/lib/tasks/constants";
import type { TTaskType, TTaskPriority } from "@/lib/tasks/constants";

type PendingTask = {
  id: string;
  type: string;
  title: string;
  priority: string;
  dueDate: string;
  unitNumber: string | null;
  building: { nameEn: string; nameAr: string } | null;
  createdBy: { name: string | null; email: string } | null;
  createdAt: string;
};

type Props = {
  initialTasks: PendingTask[];
  locale: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ApprovalsQueue({ initialTasks, locale }: Props) {
  const isEn = locale === "en";
  const [tasks, setTasks] = useState(initialTasks);
  const [loading, setLoading] = useState<Record<string, "approving" | "rejecting" | null>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function approve(id: string) {
    setLoading((l) => ({ ...l, [id]: "approving" }));
    try {
      const res = await fetch(`/api/tasks/${id}/approve`, { method: "POST" });
      if (res.ok) {
        setTasks((t) => t.filter((task) => task.id !== id));
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to approve.");
      }
    } finally {
      setLoading((l) => ({ ...l, [id]: null }));
    }
  }

  async function reject(id: string) {
    setLoading((l) => ({ ...l, [id]: "rejecting" }));
    try {
      const res = await fetch(`/api/tasks/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      });
      if (res.ok) {
        setTasks((t) => t.filter((task) => task.id !== id));
        setRejectingId(null);
        setRejectReason("");
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to reject.");
      }
    } finally {
      setLoading((l) => ({ ...l, [id]: null }));
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-base font-semibold">
          {isEn ? "All clear!" : "لا شيء للمراجعة!"}
        </p>
        <p className="text-sm mt-1">
          {isEn ? "No requests pending approval." : "لا توجد طلبات معلقة."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => {
        const typeConf = TASK_TYPE_CONFIG[task.type as TTaskType];
        const prioConf = TASK_PRIORITY_CONFIG[task.priority as TTaskPriority];
        const isActing = !!loading[task.id];
        const isRejectOpen = rejectingId === task.id;
        const isOverdue = new Date(task.dueDate) < new Date();

        return (
          <div
            key={task.id}
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-opacity ${isActing ? "opacity-50 pointer-events-none" : ""} border-l-4 ${typeConf.border}`}
          >
            <div className="p-4 md:p-5">
              {/* Top row */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className={`mt-0.5 shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${typeConf.bg} ${typeConf.text}`}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={typeConf.iconPath} />
                    </svg>
                    {isEn ? typeConf.labelEn : typeConf.labelAr}
                  </span>
                  <span className={`mt-0.5 shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${prioConf.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${prioConf.dot}`} />
                    {isEn ? prioConf.labelEn : prioConf.labelAr}
                  </span>
                </div>

                {/* Action buttons (desktop) */}
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => approve(task.id)}
                    disabled={isActing}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-60"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    {isEn ? "Approve" : "موافقة"}
                  </button>
                  <button
                    onClick={() => {
                      setRejectingId(task.id);
                      setRejectReason("");
                    }}
                    disabled={isActing}
                    className="flex items-center gap-1.5 px-4 py-2 border border-red-200 bg-red-50 text-red-700 text-sm font-semibold rounded-xl hover:bg-red-100 transition-colors disabled:opacity-60"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {isEn ? "Reject" : "رفض"}
                  </button>
                </div>
              </div>

              {/* Title */}
              <h3 className="text-base font-bold text-gray-900 mb-1">{task.title}</h3>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                {task.building && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
                    </svg>
                    {isEn ? task.building.nameEn : task.building.nameAr}
                    {task.unitNumber && (
                      <span> · {task.unitNumber}</span>
                    )}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {isEn ? "Submitted by" : "بواسطة"}{" "}
                  <span className="font-medium text-gray-700">
                    {task.createdBy?.name ?? task.createdBy?.email.split("@")[0] ?? "—"}
                  </span>
                </span>
                <span className={`flex items-center gap-1 ${isOverdue ? "text-red-600 font-semibold" : ""}`}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {isEn ? "Due" : "الموعد"} {formatDate(task.dueDate)}
                  {isOverdue && " ⚠"}
                </span>
                <span className="text-gray-400">
                  {isEn ? "Submitted" : "أُرسل"} {formatDate(task.createdAt)}
                </span>
              </div>

              {/* Mobile action buttons */}
              <div className="flex gap-2 mt-3 sm:hidden">
                <button
                  onClick={() => approve(task.id)}
                  disabled={isActing}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-60"
                >
                  {isEn ? "Approve" : "موافقة"}
                </button>
                <button
                  onClick={() => {
                    setRejectingId(task.id);
                    setRejectReason("");
                  }}
                  disabled={isActing}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-red-200 bg-red-50 text-red-700 text-sm font-semibold rounded-xl hover:bg-red-100 transition-colors disabled:opacity-60"
                >
                  {isEn ? "Reject" : "رفض"}
                </button>
              </div>
            </div>

            {/* Inline rejection form */}
            {isRejectOpen && (
              <div className="border-t border-red-100 bg-red-50 px-4 md:px-5 py-4 space-y-3">
                <p className="text-xs font-semibold text-red-800">
                  {isEn ? "Rejection reason (optional)" : "سبب الرفض (اختياري)"}
                </p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                  autoFocus
                  placeholder={isEn ? "Explain why this request is being rejected…" : "اشرح سبب رفض الطلب…"}
                  className="w-full px-3 py-2 text-sm border border-red-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => reject(task.id)}
                    disabled={isActing}
                    className="flex-1 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-60"
                  >
                    {isEn ? "Confirm Reject" : "تأكيد الرفض"}
                  </button>
                  <button
                    onClick={() => setRejectingId(null)}
                    className="px-4 py-2 text-gray-600 text-sm border border-gray-200 bg-white rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    {isEn ? "Cancel" : "إلغاء"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
