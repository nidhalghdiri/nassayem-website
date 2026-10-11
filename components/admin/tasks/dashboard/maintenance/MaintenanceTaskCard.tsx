"use client";

import React from "react";
import {
  MapPin, UserRound, AlertTriangle, Clock, PlayCircle, Wrench, PackageX,
  Play, CheckCircle2, Pause, Loader2, ClipboardCheck, Image as ImageIcon,
} from "lucide-react";
import type { MaintenanceTask } from "@/lib/reports/maintenanceDashboard";
import { STAFF_ROLE_CONFIG, TASK_TYPE_CONFIG } from "@/lib/tasks/constants";
import type { TStaffRole, TTaskType } from "@/lib/tasks/constants";
import { STATUS_TRANSITIONS } from "@/lib/tasks/statuses";
import type { TTaskStatus } from "@/lib/tasks/statuses";
import { formatDateTimeOman, formatDuration, formatTimeAgo, formatTimeOman } from "../../timeUtils";

export type TaskActions = {
  start?: TTaskStatus;
  finish?: TTaskStatus;
  resume?: TTaskStatus;
  canPause: boolean;
};

/** The one-tap actions a technician has for a task in its current status. */
export function getTaskActions(task: Pick<MaintenanceTask, "type" | "status">): TaskActions {
  const options =
    (STATUS_TRANSITIONS as Record<string, Partial<Record<string, TTaskStatus[]>>>)[task.type]?.[task.status] ?? [];
  const forward = options.filter((s) => s !== "ON_HOLD" && s !== "CANCELLED");
  if (task.status === "ASSIGNED") return { start: forward[0], canPause: false };
  if (task.status === "ON_HOLD") return { resume: forward[0], canPause: false };
  return { finish: forward[0], canPause: options.includes("ON_HOLD") };
}

type Props = {
  task: MaintenanceTask;
  isEn: boolean;
  locale: string;
  busy: boolean;
  error?: string;
  onAdvance: (task: MaintenanceTask, status: TTaskStatus) => void;
  onPause: (task: MaintenanceTask) => void;
  onOpenTask: (id: string) => void;
};

export default function MaintenanceTaskCard({ task, isEn, locale, busy, error, onAdvance, onPause, onOpenTask }: Props) {
  const t = {
    awaitingReview: isEn ? "Completed — awaiting review" : "منجزة — بانتظار التقييم",
    awaitingSupervisor: isEn ? "Approved by reception — awaiting supervisor" : "اعتمدها الاستقبال — بانتظار المشرف",
    completedAt: isEn ? "Completed" : "اكتملت",
    rejectedRedo: isEn ? "Rejected — redo" : "مرفوضة — تحتاج إعادة",
    newNotStarted: isEn ? "New — not started" : "جديدة — لم يبدأ العمل",
    inProgress: isEn ? "In progress" : "قيد التنفيذ",
    onHold: isEn ? "Paused — waiting for parts" : "متوقفة — بانتظار قطع غيار",
    from: isEn ? "From" : "من",
    arrived: isEn ? "Arrived" : "وصلت",
    started: isEn ? "Started" : "بدأ",
    arrivalToStart: isEn ? "arrival → start" : "الوصول ← البدء",
    workTime: isEn ? "Work time" : "وقت العمل",
    pausedForParts: isEn ? "Paused for parts" : "إيقاف لقطع غيار",
    ongoing: isEn ? "ongoing" : "مستمر",
    notStartedFor: isEn ? "Not started for" : "لم يبدأ العمل منذ",
    waitingFor: isEn ? "Waiting for" : "بانتظار",
    waitingGeneric: isEn ? "Spare parts" : "قطع غيار",
    since: isEn ? "for" : "منذ",
    overdue: isEn ? "Overdue" : "متأخرة",
    due: isEn ? "Due" : "الاستحقاق",
    startWork: isEn ? "Start work" : "بدء العمل",
    finishTask: isEn ? "Finish task" : "إنهاء المهمة",
    pause: isEn ? "Pause — waiting for parts" : "إيقاف — بانتظار قطع غيار",
    resume: isEn ? "Resume work" : "استئناف العمل",
    openInspection: isEn ? "Open inspection" : "فتح الفحص",
    details: isEn ? "Details" : "التفاصيل",
  };

  const isAwaiting = !!task.awaitingReview;
  const isNew = task.status === "ASSIGNED";
  const isOnHold = task.status === "ON_HOLD";
  const actions = getTaskActions(task);
  const role = STAFF_ROLE_CONFIG[task.createdByRole as TStaffRole];
  const type = TASK_TYPE_CONFIG[task.type as TTaskType];
  const isUrgent = task.priority === "URGENT" || task.priority === "HIGH";

  const frame = isAwaiting
    ? "border-emerald-200 border-s-4 border-s-emerald-500"
    : isNew
    ? "border-red-200 border-s-4 border-s-red-500"
    : isOnHold
      ? "border-amber-200 border-s-4 border-s-amber-500"
      : "border-slate-200";

  const badge = isAwaiting
    ? task.awaitingReview === "approved_receptionist"
      ? { label: t.awaitingSupervisor, cls: "bg-teal-50 text-teal-700" }
      : { label: t.awaitingReview, cls: "bg-emerald-50 text-emerald-700" }
    : isNew
    ? { label: t.newNotStarted, cls: "bg-blue-50 text-blue-700" }
    : isOnHold
      ? { label: t.onHold, cls: "bg-amber-50 text-amber-700" }
      : { label: t.inProgress, cls: "bg-indigo-50 text-indigo-700" };

  return (
    <article className={`bg-white rounded-2xl border shadow-sm p-5 transition-shadow hover:shadow-md ${frame}`}>
      {/* ── Title + status ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {type && task.type !== "MAINTENANCE" && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${type.bg} ${type.text}`}>
                {isEn ? type.labelEn : type.labelAr}
              </span>
            )}
            <h4 className="font-bold text-slate-900 text-[15px] leading-snug">{task.title}</h4>
            {isUrgent && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-600">
                {isEn ? (task.priority === "URGENT" ? "Urgent" : "High") : (task.priority === "URGENT" ? "عاجل" : "مرتفع")}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
          {!isAwaiting && task.hasRejection && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600">{t.rejectedRedo}</span>
          )}
        </div>
      </div>

      {/* ── Where / who / what ─────────────────────────────────────────── */}
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
            {isEn ? task.buildingNameEn : task.buildingNameAr}
            {task.unitName && <span className="text-slate-400">—</span>}
            {task.unitName && <span className="font-semibold text-slate-700">{task.unitName}</span>}
          </span>
          <span className="flex items-center gap-1.5">
            <UserRound className="w-4 h-4 text-slate-400 shrink-0" />
            {t.from}: <span className="font-semibold text-slate-800">{task.createdByName}</span>
            {role && <span className="text-xs text-slate-400">({isEn ? role.labelEn : role.labelAr})</span>}
          </span>
        </div>

        {task.description && (
          <p className="flex items-start gap-1.5 text-slate-800 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span className="line-clamp-2 whitespace-pre-wrap">{task.description}</span>
          </p>
        )}
      </div>

      {/* ── Waiting-for-parts banner ───────────────────────────────────── */}
      {isOnHold && (
        <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2.5 text-sm">
          <PackageX className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <span className="font-bold">{t.waitingFor}:</span> {task.holdReason || t.waitingGeneric}
            {task.holdSince && (
              <span className="text-amber-600 text-xs ms-2">({t.since} {formatDuration(task.holdMins, isEn)})</span>
            )}
          </span>
        </div>
      )}

      {/* ── Timing ─────────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {t.arrived} {formatDateTimeOman(task.createdAt, isEn)}
          <span className="text-slate-400">({formatTimeAgo(task.ageMins, isEn)})</span>
        </span>

        {isAwaiting && task.completedAt && (
          <span className="flex items-center gap-1.5 text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t.completedAt} {formatDateTimeOman(task.completedAt, isEn)}
          </span>
        )}

        {task.startedAt && (
          <span className="flex items-center gap-1.5">
            <PlayCircle className="w-3.5 h-3.5" />
            {t.started} {formatTimeOman(task.startedAt)}
            {task.arrivalToStartMins !== null && (
              <span>— {t.arrivalToStart}: <b className="text-slate-700">{formatDuration(task.arrivalToStartMins, isEn)}</b></span>
            )}
          </span>
        )}

        {task.workMins !== null && (
          <span className="flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5" />
            {t.workTime}: <b className="text-slate-700">{formatDuration(task.workMins, isEn)}</b>
          </span>
        )}

        {task.holdMins > 0 && (
          <span className="flex items-center gap-1.5 text-amber-700">
            <PackageX className="w-3.5 h-3.5" />
            {t.pausedForParts}: <b>{formatDuration(task.holdMins, isEn)}</b>
            {isOnHold && <span>({t.ongoing})</span>}
          </span>
        )}

        {task.photoCount > 0 && (
          <span className="flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" />
            {task.photoCount}
          </span>
        )}

        {task.isOverdue && (
          <span className="font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
            {t.overdue} · {t.due} {formatDateTimeOman(task.dueDate, isEn)}
          </span>
        )}
      </div>

      {isNew && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-red-600">
          <AlertTriangle className="w-4 h-4" />
          {t.notStartedFor} {formatDuration(task.ageMins, isEn)}
        </p>
      )}

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {task.type === "INSPECTION" ? (
          <a
            href={`/${locale}/admin/tasks/${task.id}/inspect`}
            className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
          >
            <ClipboardCheck className="w-4 h-4" />
            {t.openInspection}
          </a>
        ) : (
          <>
            {actions.start && (
              <ActionButton onClick={() => onAdvance(task, actions.start!)} busy={busy} cls="bg-blue-600 hover:bg-blue-700 text-white shadow-sm" icon={<Play className="w-4 h-4" />}>
                {t.startWork}
              </ActionButton>
            )}
            {actions.resume && (
              <ActionButton onClick={() => onAdvance(task, actions.resume!)} busy={busy} cls="bg-blue-600 hover:bg-blue-700 text-white shadow-sm" icon={<Play className="w-4 h-4" />}>
                {t.resume}
              </ActionButton>
            )}
            {actions.finish && (
              <ActionButton onClick={() => onAdvance(task, actions.finish!)} busy={busy} cls="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" icon={<CheckCircle2 className="w-4 h-4" />}>
                {t.finishTask}
              </ActionButton>
            )}
            {actions.canPause && (
              <ActionButton onClick={() => onPause(task)} busy={false} disabled={busy} cls="border border-amber-300 text-amber-700 bg-white hover:bg-amber-50" icon={<Pause className="w-4 h-4" />}>
                {t.pause}
              </ActionButton>
            )}
          </>
        )}
        <button
          onClick={() => onOpenTask(task.id)}
          className="px-5 py-2.5 rounded-xl text-sm font-bold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
        >
          {t.details}
        </button>
      </div>

      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </article>
  );
}

function ActionButton({
  children, onClick, busy, disabled, cls, icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
  cls: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${cls}`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
