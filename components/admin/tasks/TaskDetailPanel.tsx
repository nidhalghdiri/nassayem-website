"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import imageCompression from "browser-image-compression";
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
import {
  canUpdateTaskStatus,
  canApproveRequests,
  canSpawnSubtasks,
} from "@/lib/tasks/permissions";
import type { TStaffRole, TTaskType, TTaskPriority } from "@/lib/tasks/constants";
import type { TTaskStatus } from "@/lib/tasks/statuses";

// ── Types ───────────────────────────────────────────────────────────────────────

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
  user: { id: string; name: string | null; email: string; role?: string };
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
  unit: { id: string; unitCode: string | null; titleEn: string; titleAr: string } | null;
  assignedTo: { id: string; name: string | null; email: string; role: string } | null;
  createdBy: { id: string; name: string | null; email: string } | null;
  approvedBy: { id: string; name: string | null; email: string } | null;
  notes: NoteItem[];
  photos: PhotoItem[];
  activities: ActivityItem[];
  subTasks: { id: string; title: string; type: string; status: string }[];
  inspectionChecklist?: {
    id: string;
    completedAt: string | null;
    items: {
      id: string;
      label: string;
      status: string;
      notes: string | null;
      maintenanceTaskId: string | null;
    }[];
  } | null;
};

type ToastData = { msg: string; type: "success" | "error" };

type Props = {
  locale: string;
  currentUserId: string;
  currentUserRole: string;
};

// ── Helpers ─────────────────────────────────────────────────────────────────────

function formatDate(iso: string, withTime = false) {
  const d = new Date(iso);
  if (withTime) {
    return d.toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function initials(name: string | null, email: string) {
  return (name ?? email).slice(0, 2).toUpperCase();
}

const ACTIVITY_ICON: Record<string, { path: string; color: string }> = {
  task_created:     { path: "M12 4v16m8-8H4", color: "text-blue-500 bg-blue-50" },
  status_changed:   { path: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", color: "text-orange-500 bg-orange-50" },
  note_added:       { path: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", color: "text-gray-500 bg-gray-100" },
  photo_uploaded:   { path: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", color: "text-purple-500 bg-purple-50" },
  request_approved: { path: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", color: "text-green-600 bg-green-50" },
  request_rejected: { path: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z", color: "text-red-500 bg-red-50" },
  inspection_completed: { path: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", color: "text-teal-600 bg-teal-50" },
};

function statusButtonClass(s: TTaskStatus) {
  if (s === "CANCELLED") return "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100";
  if (s === "ON_HOLD") return "border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100";
  if (s === "ISSUES_FOUND") return "border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100";
  return "bg-nassayem text-white hover:bg-nassayem/90 shadow-sm";
}

// ── Toast component ─────────────────────────────────────────────────────────────

function Toast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all duration-300 ${
        toast.type === "success"
          ? "bg-green-600 text-white"
          : "bg-red-600 text-white"
      }`}
    >
      {toast.type === "success" ? (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {toast.msg}
    </div>
  );
}

// ── Lightbox ────────────────────────────────────────────────────────────────────

function Lightbox({
  photos,
  index,
  onClose,
  onPrev,
  onNext,
  isEn,
}: {
  photos: PhotoItem[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  isEn: boolean;
}) {
  const photo = photos[index];
  if (!photo) return null;

  const roleConf = photo.user.role
    ? STAFF_ROLE_CONFIG[photo.user.role as TStaffRole]
    : null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 end-4 p-2 text-white/70 hover:text-white rounded-lg"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Prev */}
      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute start-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white rounded-full bg-black/40"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Image */}
      <div
        className="flex flex-col items-center gap-3 max-w-3xl max-h-[90vh] px-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.photoUrl}
          alt={photo.caption ?? "Task photo"}
          className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl"
        />
        <div className="text-center">
          {photo.caption && (
            <p className="text-white font-medium text-sm">{photo.caption}</p>
          )}
          <p className="text-white/60 text-xs mt-1">
            {photo.user.name ?? photo.user.email.split("@")[0]}
            {roleConf && (
              <span className="ms-1.5">
                · {isEn ? roleConf.labelEn : roleConf.labelAr}
              </span>
            )}
            <span className="ms-1.5">· {formatDate(photo.createdAt, true)}</span>
          </p>
          <p className="text-white/40 text-xs mt-0.5">
            {index + 1} / {photos.length}
          </p>
        </div>
      </div>

      {/* Next */}
      {index < photos.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute end-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white rounded-full bg-black/40"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────────

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

  // Toast
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string, type: "success" | "error" = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // Notes
  const [noteText, setNoteText] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  // Photos
  const [showPhotoForm, setShowPhotoForm] = useState(false);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Reject flow
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // ── Data fetching ────────────────────────────────────────────────────────────

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
      setLightboxIndex(null);
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

  const refresh = useCallback(async () => {
    if (!task) return;
    const updated = await loadTask(task.id);
    setTask(updated);
  }, [task]);

  // ── Panel close ──────────────────────────────────────────────────────────────

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("taskId");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // ── Status actions ───────────────────────────────────────────────────────────

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
        showToast(data.error ?? "Failed to update status.", "error");
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
        showToast(data.error ?? "Failed to approve.", "error");
        return;
      }
      showToast(isEn ? "Task approved." : "تمت الموافقة.");
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
        showToast(data.error ?? "Failed to reject.", "error");
        return;
      }
      setRejectMode(false);
      setRejectReason("");
      showToast(isEn ? "Task rejected." : "تم رفض الطلب.");
      await refresh();
    } finally {
      setActionLoading(false);
    }
  }

  // ── Notes ────────────────────────────────────────────────────────────────────

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
        showToast(isEn ? "Note added." : "تمت إضافة الملاحظة.");
        await refresh();
      } else {
        showToast(isEn ? "Failed to add note." : "تعذّر إضافة الملاحظة.", "error");
      }
    } finally {
      setNoteLoading(false);
    }
  }

  // ── Photos ───────────────────────────────────────────────────────────────────

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !task) return;
    setPhotoLoading(true);
    let successCount = 0;
    let lastError: string | null = null;
    for (let file of files) {
      // If file is > 1MB, compress it
      if (file.size > 1024 * 1024) {
        try {
          const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          };
          file = await imageCompression(file, options);
        } catch (error) {
          console.error("Compression failed:", error);
        }
      }

      // Final safety check (if compression failed or was still too large)
      if (file.size > 10 * 1024 * 1024) {
        lastError = isEn
          ? `"${file.name}" exceeds 10 MB.`
          : `"${file.name}" أكبر من 10 ميغابايت.`;
        continue;
      }

      const fd = new FormData();
      fd.append("file", file);
      if (photoCaption.trim()) fd.append("caption", photoCaption.trim());
      try {
        const res = await fetch(`/api/tasks/${task.id}/photos`, {
          method: "POST",
          body: fd,
        });
        if (res.ok) {
          successCount++;
        } else {
          const data = await res.json().catch(() => ({}));
          lastError = data.error ?? "Upload failed.";
        }
      } catch {
        lastError = isEn ? "Network error." : "خطأ في الشبكة.";
      }
    }
    setPhotoLoading(false);
    if (successCount > 0) {
      setPhotoCaption("");
      setShowPhotoForm(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      showToast(
        isEn
          ? successCount === 1 ? "Photo uploaded." : `${successCount} photos uploaded.`
          : successCount === 1 ? "تم رفع الصورة." : `تم رفع ${successCount} صور.`
      );
      await refresh();
    }
    if (lastError) {
      showToast(lastError, "error");
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (!task) return;
    const res = await fetch(`/api/tasks/${task.id}/photos/${photoId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      showToast(isEn ? "Photo deleted." : "تم حذف الصورة.");
      await refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Failed to delete photo.", "error");
    }
  }

  // ── Derived values ───────────────────────────────────────────────────────────

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
  const isTerminal = task
    ? TERMINAL_STATUSES.includes(task.status as TTaskStatus)
    : false;

  // Can delete photos: uploader, manager, supervisor
  const canDeletePhotos =
    currentUserRole === "MANAGER" || currentUserRole === "SUPERVISOR";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <Toast toast={toast} />

      {/* Lightbox */}
      {lightboxIndex !== null && task && task.photos.length > 0 && (
        <Lightbox
          photos={task.photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() =>
            setLightboxIndex((i) =>
              Math.min(task.photos.length - 1, (i ?? 0) + 1),
            )
          }
          isEn={isEn}
        />
      )}

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
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-start gap-2.5 min-w-0">
            {task && (
              <>
                <span
                  className={`mt-0.5 shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${TASK_TYPE_CONFIG[task.type as TTaskType].bg} ${TASK_TYPE_CONFIG[task.type as TTaskType].text}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={TASK_TYPE_CONFIG[task.type as TTaskType].iconPath} />
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
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading skeleton */}
          {loading && (
            <div className="p-5 space-y-4 animate-pulse">
              {[60, 80, 40, 100, 70].map((w, i) => (
                <div key={i} className="h-3 bg-gray-200 rounded" style={{ width: `${w}%` }} />
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

              {/* ── Inspection Mode banner ──────────────────────────────────── */}
              {task.type === "INSPECTION" && (
                <section className="px-5 py-3">
                  {!task.inspectionChecklist?.completedAt ? (
                    <a
                      href={`/${locale}/admin/tasks/${task.id}/inspect`}
                      className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 hover:bg-teal-100 transition-colors group"
                    >
                      <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-teal-200 transition-colors">
                        <svg className="w-5 h-5 text-teal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-teal-800">
                          {isEn ? "Open Inspection Mode" : "فتح وضع الفحص"}
                        </p>
                        <p className="text-xs text-teal-600 mt-0.5">
                          {isEn
                            ? "Step-by-step checklist for this inspection"
                            : "قائمة فحص خطوة بخطوة"}
                        </p>
                      </div>
                      <svg className="w-4 h-4 text-teal-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </a>
                  ) : (
                    <a
                      href={`/${locale}/admin/tasks/${task.id}/inspect`}
                      className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 hover:bg-green-100 transition-colors"
                    >
                      <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-semibold text-green-800">
                          {isEn ? "Inspection Complete" : "اكتمل الفحص"}
                        </p>
                        <p className="text-xs text-green-600 mt-0.5">
                          {isEn ? "View inspection report →" : "عرض تقرير الفحص →"}
                        </p>
                      </div>
                    </a>
                  )}
                </section>
              )}

              {/* ── Status & Actions ────────────────────────────────────────── */}
              <section className="px-5 py-4 space-y-3">
                {/* Current status + priority badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CONFIG[task.status as TTaskStatus].badge}`}>
                    {isEn
                      ? STATUS_CONFIG[task.status as TTaskStatus].labelEn
                      : STATUS_CONFIG[task.status as TTaskStatus].labelAr}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${TASK_PRIORITY_CONFIG[task.priority as TTaskPriority].badge}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${TASK_PRIORITY_CONFIG[task.priority as TTaskPriority].dot}`} />
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
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {isEn ? "Approve" : "موافقة"}
                    </button>
                    <button
                      onClick={() => setRejectMode(true)}
                      disabled={actionLoading}
                      className="flex-1 flex items-center justify-center gap-2 py-2 border border-red-200 bg-red-50 text-red-700 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors disabled:opacity-60"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
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
                        onClick={() => { setRejectMode(false); setRejectReason(""); }}
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
                            ? isEn ? btnLabel.labelEn : btnLabel.labelAr
                            : isEn
                              ? STATUS_CONFIG[next].labelEn
                              : STATUS_CONFIG[next].labelAr}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Spawn sub-task */}
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
                    {isEn
                      ? "This task is complete — no further actions available."
                      : "هذه المهمة مكتملة ولا توجد إجراءات إضافية."}
                  </p>
                )}
              </section>

              {/* ── Metadata ────────────────────────────────────────────────── */}
              <section className="px-5 py-4">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      {isEn ? "Building" : "المبنى"}
                    </dt>
                    <dd className="font-medium text-gray-800">
                      {task.building
                        ? isEn ? task.building.nameEn : task.building.nameAr
                        : "—"}
                    </dd>
                    {task.unit && (
                      <dd className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                        {task.unit.unitCode && (
                          <span className="shrink-0 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-mono font-bold border border-gray-200">
                            {task.unit.unitCode}
                          </span>
                        )}
                        <span className="truncate">
                          {isEn ? task.unit.titleEn : task.unit.titleAr}
                        </span>
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
                            {task.assignedTo.name ?? task.assignedTo.email.split("@")[0]}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {isEn
                              ? STAFF_ROLE_CONFIG[task.assignedTo.role as TStaffRole]?.labelEn
                              : STAFF_ROLE_CONFIG[task.assignedTo.role as TStaffRole]?.labelAr}
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
                      {task.createdBy?.name ?? task.createdBy?.email.split("@")[0] ?? "—"}
                    </dd>
                  </div>

                  {task.approvedBy && (
                    <div className="col-span-2">
                      <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                        {task.approvalStatus === "REJECTED"
                          ? isEn ? "Rejected By" : "رُفض بواسطة"
                          : isEn ? "Approved By" : "وافق عليه"}
                      </dt>
                      <dd className="font-medium text-gray-800">
                        {task.approvedBy.name ?? task.approvedBy.email.split("@")[0]}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>

              {/* ── Description ─────────────────────────────────────────────── */}
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

              {/* ── Inspection Summary ────────────────────────────────────────── */}
              {task.type === "INSPECTION" && task.inspectionChecklist && (
                <section className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                      {isEn ? "Inspection Summary" : "ملخص الفحص"}
                    </h3>
                    {task.inspectionChecklist.completedAt && (
                      <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        {isEn ? "Completed" : "مكتمل"}
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-white border-2 border-green-500/20 rounded-2xl p-3 text-center shadow-sm">
                      <p className="text-xl font-black text-green-600">
                        {task.inspectionChecklist.items.filter(i => i.status === 'pass').length}
                      </p>
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{isEn ? "OK" : "سليم"}</p>
                    </div>
                    <div className="bg-white border-2 border-red-500/20 rounded-2xl p-3 text-center shadow-sm">
                      <p className="text-xl font-black text-red-600">
                        {task.inspectionChecklist.items.filter(i => i.status === 'fail').length}
                      </p>
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{isEn ? "Not OK" : "معطوب"}</p>
                    </div>
                  </div>

                  {/* Issues list */}
                  <div className="space-y-2">
                    {task.inspectionChecklist.items.filter(i => i.status === 'fail').map(item => (
                      <div key={item.id} className="text-xs p-3 bg-white rounded-xl border border-red-100 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-gray-800">{item.label}</p>
                          {item.maintenanceTaskId && (
                            <span className="shrink-0 bg-orange-100 text-orange-700 font-black px-1.5 py-0.5 rounded text-[8px] uppercase">
                              {isEn ? "Maint. Req" : "طلب صيانة"}
                            </span>
                          )}
                        </div>
                        {item.notes && <p className="text-gray-500 mt-1 italic">"{item.notes}"</p>}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Notes ───────────────────────────────────────────────────── */}
              <section className="px-5 py-4 space-y-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {isEn ? `Notes (${task.notes.length})` : `ملاحظات (${task.notes.length})`}
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
                              {note.user.name ?? note.user.email.split("@")[0]}
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

                <form onSubmit={handleAddNote} className="space-y-2">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={2}
                    placeholder={isEn ? "Add a note…" : "أضف ملاحظة…"}
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
                          ? isEn ? "Saving…" : "جارٍ الحفظ…"
                          : isEn ? "Add Note" : "إضافة ملاحظة"}
                      </button>
                    </div>
                  )}
                </form>
              </section>

              {/* ── Photos ──────────────────────────────────────────────────── */}
              <section className="px-5 py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {isEn ? `Photos (${task.photos.length})` : `صور (${task.photos.length})`}
                  </h3>
                  <button
                    onClick={() => setShowPhotoForm(!showPhotoForm)}
                    className="text-xs font-semibold text-nassayem hover:text-nassayem/70 transition-colors"
                  >
                    {showPhotoForm
                      ? isEn ? "Cancel" : "إلغاء"
                      : isEn ? "+ Add Photos" : "+ إضافة صور"}
                  </button>
                </div>

                {showPhotoForm && (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
                    <input
                      type="text"
                      value={photoCaption}
                      onChange={(e) => setPhotoCaption(e.target.value)}
                      placeholder={isEn ? "Caption (optional)" : "تعليق (اختياري)"}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
                    />
                    <label className="block">
                      <span className="block text-xs text-gray-500 mb-1.5">
                        {isEn ? "Choose images (JPG, PNG, WebP — max 10 MB each)" : "اختر صوراً (JPG، PNG، WebP — حد أقصى 10 MB)"}
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={handlePhotoChange}
                        disabled={photoLoading}
                        className="block w-full text-sm text-gray-600 file:me-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-nassayem/10 file:text-nassayem hover:file:bg-nassayem/20 cursor-pointer disabled:opacity-50"
                      />
                    </label>
                    {photoLoading && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        {isEn ? "Uploading…" : "جارٍ الرفع…"}
                      </div>
                    )}
                  </div>
                )}

                {task.photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {task.photos.map((photo, idx) => {
                      const roleConf = photo.user.role
                        ? STAFF_ROLE_CONFIG[photo.user.role as TStaffRole]
                        : null;
                      const isOwnPhoto = photo.user.id === currentUserId;

                      return (
                        <div
                          key={photo.id}
                          className="group relative rounded-xl overflow-hidden aspect-square bg-gray-100 border border-gray-200 cursor-pointer"
                          onClick={() => setLightboxIndex(idx)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.photoUrl}
                            alt={photo.caption ?? "Task photo"}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />

                          {/* Caption overlay */}
                          {photo.caption && (
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-3 pb-1">
                              <p className="text-white text-[10px] truncate leading-tight">
                                {photo.caption}
                              </p>
                            </div>
                          )}

                          {/* Uploader + role tooltip on hover */}
                          <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/60 to-transparent px-1.5 pt-1 pb-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-[10px] truncate leading-tight">
                              {photo.user.name ?? photo.user.email.split("@")[0]}
                              {roleConf && (
                                <span className="ms-1 opacity-70">
                                  · {isEn ? roleConf.labelEn : roleConf.labelAr}
                                </span>
                              )}
                            </p>
                          </div>

                          {/* Delete button — visible on hover for permitted users */}
                          {(canDeletePhotos || isOwnPhoto) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePhoto(photo.id);
                              }}
                              className="absolute top-1 end-1 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 shadow-md"
                              title={isEn ? "Delete photo" : "حذف الصورة"}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ── Activity Timeline ────────────────────────────────────────── */}
              <section className="px-5 py-4 space-y-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {isEn ? "Activity" : "النشاط"}
                </h3>
                <div>
                  {[...task.activities].reverse().map((act, idx, arr) => {
                    const conf = ACTIVITY_ICON[act.action] ?? ACTIVITY_ICON.task_created;
                    const isLast = idx === arr.length - 1;
                    return (
                      <div key={act.id} className="flex gap-3">
                        <div className="flex flex-col items-center shrink-0">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${conf.color}`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={conf.path} />
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
