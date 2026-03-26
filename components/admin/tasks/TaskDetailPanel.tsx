"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  TASK_TYPE_CONFIG,
  TASK_PRIORITY_CONFIG,
  STAFF_ROLE_CONFIG,
} from "@/lib/tasks/constants";
import {
  STATUS_CONFIG,
  STATUS_TRANSITIONS,
  TRANSITION_BUTTON_LABEL,
  TERMINAL_STATUSES,
} from "@/lib/tasks/statuses";
import { canUpdateTaskStatus, canApproveRequests, canSpawnSubtasks } from "@/lib/tasks/permissions";
import type { TStaffRole, TTaskType, TTaskPriority } from "@/lib/tasks/constants";
import type { TTaskStatus } from "@/lib/tasks/statuses";

// ── Types ──────────────────────────────────────────────────────────────────────

type NoteItem = {
  id: string;
  text: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
};

type PhotoItem = {
  id: string;
  photoUrl: string;
  caption: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
};

type ActivityItem = {
  id: string;
  action: string;
  details: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
};

type FullTask = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: string;
  requiresApproval: boolean;
  approvalStatus: string | null;
  building: { id: string; nameEn: string; nameAr: string } | null;
  unit: { id: string; titleEn: string; titleAr: string } | null;
  assignedTo: { id: string; name: string | null; email: string; role: string } | null;
  createdBy: { id: string; name: string | null; email: string } | null;
  approvedBy: { id: string; name: string | null; email: string } | null;
  notes: NoteItem[];
  photos: PhotoItem[];
  activities: ActivityItem[];
  subTasks: { id: string; title: string; type: string; status: string }[];
};

type Props = {
  locale: string;
  currentUserId: string;
  currentUserRole: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string, withTime = false) {
  const d = new Date(iso);
  if (withTime) {
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string | null, email: string) {
  return (name ?? email).slice(0, 2).toUpperCase();
}

const ACTIVITY_ICON: Record<string, { path: string; color: string }> = {
  task_created: {
    path: "M12 4v16m8-8H4",
    color: "text-blue-500 bg-blue-50",
  },
  status_changed: {
    path: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    color: "text-orange-500 bg-orange-50",
  },
  note_added: {
    path: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    color: "text-gray-500 bg-gray-100",
  },
  photo_uploaded: {
    path: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
    color: "text-purple-500 bg-purple-50",
  },
  request_approved: {
    path: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    color: "text-green-600 bg-green-50",
  },
  request_rejected: {
    path: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
    color: "text-red-500 bg-red-50",
  },
};

function statusButtonClass(s: TTaskStatus) {
  if (s === "CANCELLED")
    return "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100";
  if (s === "ON_HOLD")
    return "border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100";
  if (s === "ISSUES_FOUND")
    return "border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100";
  return "bg-nassayem text-white hover:bg-nassayem/90 shadow-sm";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TaskDetailPanel({
  locale,
  currentUserId,
  currentUserRole,
}: Props) {
  const isEn = locale === "en";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const taskId = searchParams.get("taskId");
  const isOpen = !!taskId;

  const [task, setTask] = useState<FullTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Notes
  const [noteText, setNoteText] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  // Photos
  const [showPhotoForm, setShowPhotoForm] = useState(false);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reject flow
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // ── Data fetching ──────────────────────────────────────────────────────────

  async function loadTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`);
    if (!res.ok) throw new Error("not found");
    return res.json() as Promise<FullTask>;
  }

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      setFetchError(null);
      setRejectMode(false);
      setNoteText("");
      setShowPhotoForm(false);
      return;
    }
    setLoading(true);
    setFetchError(null);
    loadTask(taskId)
      .then(setTask)
      .catch(() =>
        setFetchError(isEn ? "Could not load task." : "تعذّر تحميل المهمة."),
      )
      .finally(() => setLoading(false));
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refresh() {
    if (!task) return;
    const updated = await loadTask(task.id);
    setTask(updated);
  }

  // ── Panel close ────────────────────────────────────────────────────────────

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("taskId");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // ── Status actions ─────────────────────────────────────────────────────────

  async function handleStatus(newStatus: TTaskStatus) {
    if (!task || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to update status.");
        return;
      }
      await refresh();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove() {
    if (!task || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to approve.");
        return;
      }
      await refresh();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!task || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to reject.");
        return;
      }
      setRejectMode(false);
      setRejectReason("");
      await refresh();
    } finally {
      setActionLoading(false);
    }
  }

  // ── Notes ──────────────────────────────────────────────────────────────────

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!task || !noteText.trim() || noteLoading) return;
    setNoteLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: noteText.trim() }),
      });
      if (res.ok) {
        setNoteText("");
        await refresh();
      }
    } finally {
      setNoteLoading(false);
    }
  }

  // ── Photos ─────────────────────────────────────────────────────────────────

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !task) return;
    setPhotoLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (photoCaption.trim()) fd.append("caption", photoCaption.trim());
      const res = await fetch(`/api/tasks/${task.id}/photos`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        setPhotoCaption("");
        setShowPhotoForm(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await refresh();
      }
    } finally {
      setPhotoLoading(false);
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const validNextStatuses: TTaskStatus[] = task
    ? ((STATUS_TRANSITIONS as Record<string, Record<string, TTaskStatus[]>>)[
        task.type
      ]?.[task.status] ?? [])
    : [];

  const isAssignedToMe = task?.assignedTo?.id === currentUserId;
  const canAct =
    task &&
    !TERMINAL_STATUSES.includes(task.status as TTaskStatus) &&
    task.status !== "PENDING_APPROVAL" &&
    canUpdateTaskStatus(
      currentUserRole as TStaffRole,
      (task.assignedTo?.role ?? "HOUSEKEEPING") as TStaffRole,
      isAssignedToMe,
    );
  const canApprove = canApproveRequests(currentUserRole as TStaffRole);
  const isPending = task?.status === "PENDING_APPROVAL";
  const isTerminal = task ? TERMINAL_STATUSES.includes(task.status as TTaskStatus) : false;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-[500px] bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-start gap-2.5 min-w-0">
            {task && (
              <>
                <span
                  className={`mt-0.5 shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${TASK_TYPE_CONFIG[task.type as TTaskType].bg} ${TASK_TYPE_CONFIG[task.type as TTaskType].text}`}
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d={TASK_TYPE_CONFIG[task.type as TTaskType].iconPath}
                    />
                  </svg>
                  {isEn
                    ? TASK_TYPE_CONFIG[task.type as TTaskType].labelEn
                    : TASK_TYPE_CONFIG[task.type as TTaskType].labelAr}
                </span>
                <h2 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 pt-0.5">
                  {task.title}
                </h2>
              </>
            )}
            {loading && !task && (
              <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
            )}
          </div>
          <button
            onClick={close}
            className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading skeleton */}
          {loading && (
            <div className="p-5 space-y-4 animate-pulse">
              {[60, 80, 40, 100, 70].map((w, i) => (
                <div
                  key={i}
                  className="h-3 bg-gray-200 rounded"
                  style={{ width: `${w}%` }}
                />
              ))}
              <div className="h-24 bg-gray-200 rounded-xl" />
            </div>
          )}

          {/* Error */}
          {fetchError && !loading && (
            <div className="p-5">
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {fetchError}
              </p>
            </div>
          )}

          {/* Content */}
          {task && !loading && (
            <div className="divide-y divide-gray-100">

              {/* ── Status & Actions ──────────────────────────────────────── */}
              <section className="px-5 py-4 space-y-3">
                {/* Current status + priority badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CONFIG[task.status as TTaskStatus].badge}`}
                  >
                    {isEn
                      ? STATUS_CONFIG[task.status as TTaskStatus].labelEn
                      : STATUS_CONFIG[task.status as TTaskStatus].labelAr}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${TASK_PRIORITY_CONFIG[task.priority as TTaskPriority].badge}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${TASK_PRIORITY_CONFIG[task.priority as TTaskPriority].dot}`}
                    />
                    {isEn
                      ? TASK_PRIORITY_CONFIG[task.priority as TTaskPriority].labelEn
                      : TASK_PRIORITY_CONFIG[task.priority as TTaskPriority].labelAr}
                  </span>
                </div>

                {/* Approve / Reject */}
                {isPending && canApprove && !rejectMode && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors disabled:opacity-60"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {isEn ? "Approve" : "موافقة"}
                    </button>
                    <button
                      onClick={() => setRejectMode(true)}
                      disabled={actionLoading}
                      className="flex-1 flex items-center justify-center gap-2 py-2 border border-red-200 bg-red-50 text-red-700 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors disabled:opacity-60"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      {isEn ? "Reject" : "رفض"}
                    </button>
                  </div>
                )}

                {/* Rejection reason form */}
                {rejectMode && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-red-800">
                      {isEn ? "Rejection reason (optional)" : "سبب الرفض (اختياري)"}
                    </p>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                      placeholder={isEn ? "Explain why…" : "اشرح السبب…"}
                      className="w-full px-3 py-2 text-sm border border-red-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleReject}
                        disabled={actionLoading}
                        className="flex-1 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                      >
                        {isEn ? "Confirm Reject" : "تأكيد الرفض"}
                      </button>
                      <button
                        onClick={() => {
                          setRejectMode(false);
                          setRejectReason("");
                        }}
                        className="px-3 py-1.5 text-gray-600 text-sm border border-gray-200 bg-white rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {isEn ? "Cancel" : "إلغاء"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Status transition buttons */}
                {canAct && validNextStatuses.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {validNextStatuses.map((next) => {
                      const btnLabel = TRANSITION_BUTTON_LABEL[next];
                      return (
                        <button
                          key={next}
                          onClick={() => handleStatus(next)}
                          disabled={actionLoading}
                          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors disabled:opacity-60 ${statusButtonClass(next)}`}
                        >
                          {btnLabel
                            ? isEn
                              ? btnLabel.labelEn
                              : btnLabel.labelAr
                            : isEn
                              ? STATUS_CONFIG[next].labelEn
                              : STATUS_CONFIG[next].labelAr}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Spawn sub-task — shown when Inspection has Issues Found */}
                {task.type === "INSPECTION" &&
                  task.status === "ISSUES_FOUND" &&
                  canSpawnSubtasks(currentUserRole as TStaffRole) && (
                    <a
                      href={`/${locale}/admin/tasks/new?parentTaskId=${task.id}`}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold rounded-xl hover:bg-orange-100 transition-colors w-fit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      {isEn ? "Spawn Work Order / Maintenance" : "إنشاء أمر عمل / صيانة"}
                    </a>
                  )}

                {isTerminal && (
                  <p className="text-xs text-gray-400 italic">
                    {isEn ? "This task is complete — no further actions available." : "هذه المهمة مكتملة ولا توجد إجراءات إضافية."}
                  </p>
                )}
              </section>

              {/* ── Metadata ─────────────────────────────────────────────── */}
              <section className="px-5 py-4">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      {isEn ? "Building" : "المبنى"}
                    </dt>
                    <dd className="font-medium text-gray-800">
                      {task.building
                        ? isEn
                          ? task.building.nameEn
                          : task.building.nameAr
                        : "—"}
                    </dd>
                    {task.unit && (
                      <dd className="text-xs text-gray-500 mt-0.5">
                        {isEn ? task.unit.titleEn : task.unit.titleAr}
                      </dd>
                    )}
                  </div>

                  <div>
                    <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      {isEn ? "Assigned To" : "مُعيَّن إلى"}
                    </dt>
                    {task.assignedTo ? (
                      <dd className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {initials(task.assignedTo.name, task.assignedTo.email)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 leading-none">
                            {task.assignedTo.name ??
                              task.assignedTo.email.split("@")[0]}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {isEn
                              ? STAFF_ROLE_CONFIG[
                                  task.assignedTo.role as TStaffRole
                                ]?.labelEn
                              : STAFF_ROLE_CONFIG[
                                  task.assignedTo.role as TStaffRole
                                ]?.labelAr}
                          </p>
                        </div>
                      </dd>
                    ) : (
                      <dd className="text-gray-500">—</dd>
                    )}
                  </div>

                  <div>
                    <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      {isEn ? "Due Date" : "تاريخ الاستحقاق"}
                    </dt>
                    <dd
                      className={`font-medium ${
                        new Date(task.dueDate) < new Date() && !isTerminal
                          ? "text-red-600"
                          : "text-gray-800"
                      }`}
                    >
                      {formatDate(task.dueDate)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      {isEn ? "Created By" : "أنشأه"}
                    </dt>
                    <dd className="font-medium text-gray-800">
                      {task.createdBy?.name ??
                        task.createdBy?.email.split("@")[0] ??
                        "—"}
                    </dd>
                  </div>

                  {task.approvedBy && (
                    <div className="col-span-2">
                      <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                        {task.approvalStatus === "REJECTED"
                          ? isEn
                            ? "Rejected By"
                            : "رُفض بواسطة"
                          : isEn
                            ? "Approved By"
                            : "وافق عليه"}
                      </dt>
                      <dd className="font-medium text-gray-800">
                        {task.approvedBy.name ??
                          task.approvedBy.email.split("@")[0]}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>

              {/* ── Description ──────────────────────────────────────────── */}
              {task.description && (
                <section className="px-5 py-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    {isEn ? "Description" : "الوصف"}
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {task.description}
                  </p>
                </section>
              )}

              {/* ── Notes ────────────────────────────────────────────────── */}
              <section className="px-5 py-4 space-y-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {isEn
                    ? `Notes (${task.notes.length})`
                    : `ملاحظات (${task.notes.length})`}
                </h3>

                {task.notes.length > 0 && (
                  <div className="space-y-4">
                    {task.notes.map((note) => (
                      <div key={note.id} className="flex gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {initials(note.user.name, note.user.email)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-gray-800">
                              {note.user.name ??
                                note.user.email.split("@")[0]}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatDate(note.createdAt, true)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mt-1 leading-relaxed whitespace-pre-wrap">
                            {note.text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add note */}
                <form onSubmit={handleAddNote} className="space-y-2">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={2}
                    placeholder={
                      isEn ? "Add a note…" : "أضف ملاحظة…"
                    }
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem resize-none"
                  />
                  {noteText.trim() && (
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={noteLoading}
                        className="px-4 py-1.5 bg-nassayem text-white text-xs font-semibold rounded-lg hover:bg-nassayem/90 transition-colors disabled:opacity-60"
                      >
                        {noteLoading
                          ? isEn
                            ? "Saving…"
                            : "جارٍ الحفظ…"
                          : isEn
                            ? "Add Note"
                            : "إضافة ملاحظة"}
                      </button>
                    </div>
                  )}
                </form>
              </section>

              {/* ── Photos ───────────────────────────────────────────────── */}
              <section className="px-5 py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {isEn
                      ? `Photos (${task.photos.length})`
                      : `صور (${task.photos.length})`}
                  </h3>
                  <button
                    onClick={() => setShowPhotoForm(!showPhotoForm)}
                    className="text-xs font-semibold text-nassayem hover:text-nassayem/70 transition-colors"
                  >
                    {showPhotoForm
                      ? isEn
                        ? "Cancel"
                        : "إلغاء"
                      : isEn
                        ? "+ Add Photo"
                        : "+ إضافة صورة"}
                  </button>
                </div>

                {showPhotoForm && (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
                    <input
                      type="text"
                      value={photoCaption}
                      onChange={(e) => setPhotoCaption(e.target.value)}
                      placeholder={
                        isEn
                          ? "Caption (optional)"
                          : "تعليق (اختياري)"
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
                    />
                    <label className="block">
                      <span className="block text-xs text-gray-500 mb-1.5">
                        {isEn
                          ? "Choose an image file"
                          : "اختر ملف صورة"}
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        disabled={photoLoading}
                        className="block w-full text-sm text-gray-600 file:me-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-nassayem/10 file:text-nassayem hover:file:bg-nassayem/20 cursor-pointer disabled:opacity-50"
                      />
                    </label>
                    {photoLoading && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <svg
                          className="w-3.5 h-3.5 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        {isEn ? "Uploading…" : "جارٍ الرفع…"}
                      </div>
                    )}
                  </div>
                )}

                {task.photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {task.photos.map((photo) => (
                      <a
                        key={photo.id}
                        href={photo.photoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative block rounded-xl overflow-hidden aspect-square bg-gray-100 border border-gray-200 hover:border-nassayem/40 transition-colors"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.photoUrl}
                          alt={photo.caption ?? "Task photo"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {photo.caption && (
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1.5">
                            <p className="text-white text-xs truncate">
                              {photo.caption}
                            </p>
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Activity Timeline ─────────────────────────────────────── */}
              <section className="px-5 py-4 space-y-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {isEn ? "Activity" : "النشاط"}
                </h3>
                <div>
                  {[...task.activities].reverse().map((act, idx, arr) => {
                    const conf =
                      ACTIVITY_ICON[act.action] ?? ACTIVITY_ICON.task_created;
                    const isLast = idx === arr.length - 1;
                    return (
                      <div key={act.id} className="flex gap-3">
                        <div className="flex flex-col items-center shrink-0">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${conf.color}`}
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d={conf.path}
                              />
                            </svg>
                          </div>
                          {!isLast && (
                            <div className="w-px flex-1 bg-gray-200 my-1 min-h-[16px]" />
                          )}
                        </div>
                        <div className="pb-5 min-w-0">
                          <p className="text-xs font-semibold text-gray-700">
                            {act.user.name ?? act.user.email.split("@")[0]}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                            {act.details}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(act.createdAt, true)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

            </div>
          )}
        </div>
      </aside>
    </>
  );
}
