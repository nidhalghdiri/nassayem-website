"use client";

import React from "react";
import {
  MapPin, UserRound, Wrench, AlertTriangle, Clock, PlayCircle, PackageX, CalendarClock,
  ChevronRight, Star, Image as ImageIcon, CheckCircle2,
} from "lucide-react";
import type { BranchMaintenanceData, BranchMaintenanceRequest, ClosedMaintenanceRequest } from "@/lib/reports/branchMaintenance";
import { categoryLabel, roomLabel } from "@/lib/maintenance/categories";
import { formatDateSlashOman, formatDateTimeOman, formatDuration, formatTimeAgo, formatTimeOman } from "../../timeUtils";

type Props = {
  isEn: boolean;
  data: BranchMaintenanceData;
  onOpenTask: (id: string) => void;
};

/** The two maintenance reports on the Receptionist dashboard. */
export default function BranchMaintenanceSection({ isEn, data, onOpenTask }: Props) {
  const t = {
    currentTitle: isEn ? "Current branch requests" : "طلبات الفرع الجارية",
    closedTitle: isEn ? "Latest closed requests" : "آخر الطلبات المغلقة",
    noCurrent: isEn ? "No open maintenance requests." : "لا توجد طلبات صيانة جارية.",
    noClosed: isEn ? "No closed requests yet." : "لا توجد طلبات مغلقة بعد.",
    requests: isEn ? "requests" : "طلب",
  };

  return (
    <div className="space-y-6">
      {/* ── Current requests ─────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">{t.currentTitle}</h3>
          <span className="text-xs text-slate-500 font-medium">{data.current.length} {t.requests}</span>
        </div>
        <div className="p-4 md:p-5 space-y-3">
          {data.current.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
              <Wrench className="w-8 h-8 text-slate-300" />
              {t.noCurrent}
            </div>
          ) : (
            data.current.map((req) => <CurrentRequestCard key={req.id} req={req} isEn={isEn} onOpenTask={onOpenTask} />)
          )}
        </div>
      </section>

      {/* ── Last closed requests ─────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-800">{t.closedTitle}</h3>
        </div>
        {data.closed.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-slate-300" />
            {t.noClosed}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.closed.map((req) => <ClosedRequestRow key={req.id} req={req} isEn={isEn} onOpenTask={onOpenTask} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── A current (open) request ─────────────────────────────────────────────────
function CurrentRequestCard({ req, isEn, onOpenTask }: { req: BranchMaintenanceRequest; isEn: boolean; onOpenTask: (id: string) => void }) {
  const t = {
    newNotStarted: isEn ? "New — not started" : "جديدة — لم يبدأ العمل",
    inProgress: isEn ? "In progress" : "قيد التنفيذ",
    onHold: isEn ? "Paused — waiting for parts" : "متوقفة — بانتظار قطع غيار",
    from: isEn ? "From" : "من",
    to: isEn ? "Technician" : "الفني",
    arrived: isEn ? "Arrived" : "وصلت",
    started: isEn ? "Started" : "بدأ",
    notStartedFor: isEn ? "Not started for" : "لم يبدأ العمل منذ",
    waitingFor: isEn ? "Waiting for" : "بانتظار",
    waitingGeneric: isEn ? "Spare parts" : "قطع غيار",
    due: isEn ? "Due" : "الاستحقاق",
    overdue: isEn ? "Overdue" : "متأخرة",
    details: isEn ? "Details" : "التفاصيل",
  };

  const isNew = req.status === "ASSIGNED";
  const isOnHold = req.status === "ON_HOLD";
  const frame = isNew
    ? "border-red-200 border-s-4 border-s-red-500"
    : isOnHold
      ? "border-amber-200 border-s-4 border-s-amber-500"
      : "border-slate-200";
  const badge = isNew
    ? { label: t.newNotStarted, cls: "bg-blue-50 text-blue-700" }
    : isOnHold
      ? { label: t.onHold, cls: "bg-amber-50 text-amber-700" }
      : { label: t.inProgress, cls: "bg-indigo-50 text-indigo-700" };

  return (
    <article className={`rounded-2xl border p-4 md:p-5 bg-white transition-shadow hover:shadow-md ${frame}`}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-bold text-slate-900 text-[15px] leading-snug min-w-0">
          <span className="text-slate-400 font-mono text-xs me-1.5" dir="ltr">#{req.requestNumber}</span>
          {req.title}
        </h4>
        <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
            {isEn ? req.buildingNameEn : req.buildingNameAr}
            {req.unitName && <span className="text-slate-400">—</span>}
            {req.unitName && <span className="font-semibold text-slate-700">{req.unitName}</span>}
            {roomLabel(req.room, isEn) && <span className="text-slate-500">• {roomLabel(req.room, isEn)}</span>}
            {req.category && req.category !== "EQUIPMENT" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{categoryLabel(req.category, isEn)}</span>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            <UserRound className="w-4 h-4 text-slate-400 shrink-0" />
            {t.from}: <span className="font-semibold text-slate-800">{req.createdByName}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Wrench className="w-4 h-4 text-slate-400 shrink-0" />
            {t.to}: <span className="font-semibold text-slate-800">{req.technicianName}</span>
          </span>
        </div>

        {req.description && (
          <p className="flex items-start gap-1.5 text-slate-800 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span className="line-clamp-2 whitespace-pre-wrap">{req.description}</span>
          </p>
        )}
      </div>

      {isOnHold && (
        <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2.5 text-sm">
          <PackageX className="w-4 h-4 shrink-0 mt-0.5" />
          <span><span className="font-bold">{t.waitingFor}:</span> {req.holdReason || t.waitingGeneric}</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {t.arrived} {formatDateTimeOman(req.createdAt, isEn)}
          <span className="text-slate-400">({formatTimeAgo(req.ageMins, isEn)})</span>
        </span>
        {req.startedAt && (
          <span className="flex items-center gap-1.5">
            <PlayCircle className="w-3.5 h-3.5" />
            {t.started} {formatTimeOman(req.startedAt)}
          </span>
        )}
        <span className={`flex items-center gap-1.5 ${req.isOverdue ? "font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded" : ""}`}>
          <CalendarClock className="w-3.5 h-3.5" />
          {req.isOverdue ? `${t.overdue} · ` : ""}{t.due} {formatDateTimeOman(req.dueDate, isEn)}
        </span>
        {req.photoCount > 0 && (
          <span className="flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" />
            {req.photoCount}
          </span>
        )}
      </div>

      {isNew && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-red-600">
          <AlertTriangle className="w-4 h-4" />
          {t.notStartedFor} {formatDuration(req.ageMins, isEn)}
        </p>
      )}

      <div className="mt-4">
        <button
          onClick={() => onOpenTask(req.id)}
          className="px-5 py-2.5 rounded-xl text-sm font-bold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
        >
          {t.details}
        </button>
      </div>
    </article>
  );
}

// ── A closed request row: title, date, rating, comment ──────────────────────
function ClosedRequestRow({ req, isEn, onOpenTask }: { req: ClosedMaintenanceRequest; isEn: boolean; onOpenTask: (id: string) => void }) {
  const unitWord = isEn ? "Unit" : "شقة";
  return (
    <li>
      <button
        onClick={() => onOpenTask(req.id)}
        className="w-full text-start px-5 py-4 hover:bg-slate-50 transition-colors group grid gap-x-6 gap-y-2 md:grid-cols-[minmax(0,2fr)_auto_auto_minmax(0,2fr)_auto] items-center"
      >
        <div className="min-w-0">
          <p className="font-bold text-slate-800 text-sm truncate">
            <span className="text-slate-400 font-mono text-xs me-1.5" dir="ltr">#{req.requestNumber}</span>
            {req.title}
          </p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {req.unitName ? `${unitWord} ${req.unitName} · ` : ""}{isEn ? req.buildingNameEn : req.buildingNameAr}
          </p>
        </div>

        <span className="text-sm font-semibold text-slate-700 tabular-nums" dir="ltr">
          {formatDateSlashOman(req.closedAt)}
        </span>

        <RatingCell rating={req.rating} />

        <p className="text-xs text-slate-500 min-w-0 line-clamp-2">{req.comment ?? ""}</p>

        <ChevronRight className="hidden md:block w-4 h-4 text-slate-300 group-hover:text-nassayem rtl:rotate-180" />
      </button>
    </li>
  );
}

function RatingCell({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-sm text-slate-300">—</span>;
  return (
    <span className="flex items-center gap-2" aria-label={`${rating}/5`}>
      <span className="text-sm font-black text-slate-900 tabular-nums">{rating * 20}%</span>
      <span className="flex items-center gap-0.5" dir="ltr">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${i <= rating ? "fill-amber-500 text-amber-500" : "text-amber-300"}`}
          />
        ))}
      </span>
    </span>
  );
}
