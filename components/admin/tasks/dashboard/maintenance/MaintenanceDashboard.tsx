"use client";

import React, { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Briefcase, CircleDot, Timer, PackageX, Star, QrCode, ListChecks, History, CheckCircle2,
} from "lucide-react";
import type { MaintenanceDashboardData, MaintenanceTask } from "@/lib/reports/maintenanceDashboard";
import type { TTaskStatus } from "@/lib/tasks/statuses";
import TaskDetailPanel from "@/components/admin/tasks/TaskDetailPanel";
import MaintenanceTaskCard from "./MaintenanceTaskCard";
import MaintenanceLog from "./MaintenanceLog";
import PauseForPartsModal from "./PauseForPartsModal";
import { formatDuration } from "../../timeUtils";

type Props = {
  locale: string;
  currentUserId: string;
  currentUserRole: string;
  data: MaintenanceDashboardData;
  /** Maintenance technicians (manager view: pick whose dashboard to see). */
  technicians: { id: string; name: string | null; email: string }[];
};

type Tab = "tasks" | "log";

export default function MaintenanceDashboard({ locale, currentUserId, currentUserRole, data, technicians }: Props) {
  const isEn = locale === "en";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isRefreshing, startRefresh] = useTransition();

  const [tab, setTab] = useState<Tab>("tasks");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pauseTask, setPauseTask] = useState<MaintenanceTask | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const isOwnDashboard = data.technician.id === currentUserId;
  const canPickTechnician = currentUserRole === "MANAGER" || currentUserRole === "SUPERVISOR";

  const t = {
    roleTitle: isEn ? "Maintenance Technician" : "فني صيانة",
    subtitle: isOwnDashboard
      ? (isEn ? "Your tasks from supervisors, reception and management" : "مهامك الواردة من المشرف والاستقبال والمدير")
      : (isEn ? "Technician's tasks from supervisors, reception and management" : "مهام الفني الواردة من المشرف والاستقبال والمدير"),
    visitByCode: isEn ? "Visit by code" : "زيارة بالكود",
    myTasks: isOwnDashboard ? (isEn ? "My tasks" : "مهامي") : (isEn ? "Tasks" : "المهام"),
    taskLog: isEn ? "Task log" : "سجل المهام",
    technician: isEn ? "Technician" : "الفني",
    open: isEn ? "Open tasks" : "مهام مفتوحة",
    notStarted: isEn ? "Not started yet" : "لم يبدأ العمل عليها",
    avgStart: isEn ? "Avg. arrival → start (30 days)" : "متوسط الوصول ← البدء (30 يوماً)",
    partsHolds: isEn ? "Paused for parts (30 days)" : "أوقفت لقطع غيار (30 يوماً)",
    satisfaction: isEn ? "Branch satisfaction (30 days)" : "رضا الفروع (30 يوماً)",
    satisfactionHint: isEn ? "Reviewed tasks accepted without rejection" : "المهام المراجَعة المقبولة دون رفض",
    sortHint: isEn ? "Not-started tasks first" : "التي لم يبدأ العمل عليها أولاً",
    awaitingGroup: isEn ? "Done — awaiting review" : "منجزة — بانتظار التقييم",
    awaitingHint: isEn ? "Stay here until the supervisor approves and rates them" : "تبقى هنا حتى يعتمدها المشرف ويقيّمها",
    empty: isEn ? "No tasks right now — nice work!" : "لا توجد مهام حالياً — عمل رائع!",
    failed: isEn ? "Could not update the task." : "تعذّر تحديث المهمة.",
    network: isEn ? "Network error." : "خطأ في الشبكة.",
  };

  // ── Status changes ─────────────────────────────────────────────────────────
  const updateStatus = useCallback(async (task: MaintenanceTask, status: TTaskStatus, holdReason?: string) => {
    setBusyId(task.id);
    setErrors((prev) => ({ ...prev, [task.id]: "" }));
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(holdReason ? { status, holdReason } : { status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrors((prev) => ({ ...prev, [task.id]: body.error ?? t.failed }));
        return false;
      }
      startRefresh(() => router.refresh());
      return true;
    } catch {
      setErrors((prev) => ({ ...prev, [task.id]: t.network }));
      return false;
    } finally {
      setBusyId(null);
    }
  }, [router, t.failed, t.network]);

  async function confirmPause(reason: string) {
    if (!pauseTask) return;
    const ok = await updateStatus(pauseTask, "ON_HOLD", reason);
    if (ok) setPauseTask(null);
  }

  const closeTaskPanel = useCallback(() => {
    setOpenTaskId(null);
    startRefresh(() => router.refresh());
  }, [router]);

  function changeTechnician(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tech", id);
    router.push(`${pathname}?${params.toString()}`);
  }

  const { stats } = data;
  const activeTasks = data.openTasks.filter((task) => !task.awaitingReview);
  const awaitingTasks = data.openTasks.filter((task) => task.awaitingReview);

  const renderCard = (task: MaintenanceTask) => (
    <MaintenanceTaskCard
      key={task.id}
      task={task}
      isEn={isEn}
      locale={locale}
      busy={busyId === task.id}
      error={errors[task.id]}
      onAdvance={(tk, status) => updateStatus(tk, status)}
      onPause={setPauseTask}
      onOpenTask={setOpenTaskId}
    />
  );
  const statCards = [
    { label: t.open, value: String(stats.openCount), icon: <Briefcase className="w-5 h-5" />, bubble: "bg-blue-50 text-blue-600" },
    { label: t.notStarted, value: String(stats.notStartedCount), icon: <CircleDot className="w-5 h-5" />, bubble: "bg-red-50 text-red-600", valueCls: stats.notStartedCount > 0 ? "text-red-600" : undefined },
    { label: t.avgStart, value: stats.avgArrivalToStartMins === null ? "—" : formatDuration(stats.avgArrivalToStartMins, isEn), icon: <Timer className="w-5 h-5" />, bubble: "bg-sky-50 text-sky-600" },
    { label: t.partsHolds, value: String(stats.partsHoldsCount), icon: <PackageX className="w-5 h-5" />, bubble: "bg-amber-50 text-amber-600" },
    { label: t.satisfaction, value: stats.satisfactionPct === null ? "—" : `${stats.satisfactionPct}%`, icon: <Star className="w-5 h-5" />, bubble: "bg-emerald-50 text-emerald-600", title: t.satisfactionHint },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto hide-scrollbar">
        <TabButton active={tab === "tasks"} onClick={() => setTab("tasks")} icon={<ListChecks className="w-4 h-4" />}>
          {t.myTasks}
          {stats.openCount > 0 && (
            <span className="ms-1.5 text-[10px] font-bold bg-nassayem text-white rounded-full px-1.5 py-0.5">{stats.openCount}</span>
          )}
        </TabButton>
        <TabButton active={tab === "log"} onClick={() => setTab("log")} icon={<History className="w-4 h-4" />}>
          {t.taskLog}
        </TabButton>
        <Link
          href={`/${locale}/admin/maintenance/scan`}
          className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-500 hover:text-slate-800 border-b-2 border-transparent whitespace-nowrap"
        >
          <QrCode className="w-4 h-4" />
          {t.visitByCode}
        </Link>
      </nav>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 truncate">
            {data.technician.name} <span className="text-slate-400 font-medium">— {t.roleTitle}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canPickTechnician && technicians.length > 0 && (
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
              {t.technician}
              <select
                value={data.technician.id}
                onChange={(e) => changeTechnician(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
              >
                {!technicians.some((u) => u.id === data.technician.id) && (
                  <option value={data.technician.id}>{data.technician.name}</option>
                )}
                {technicians.map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.email.split("@")[0]}</option>
                ))}
              </select>
            </label>
          )}
          <Link
            href={`/${locale}/admin/maintenance/scan`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-nassayem/40 transition-colors"
          >
            <QrCode className="w-4 h-4 text-nassayem" />
            {t.visitByCode}
          </Link>
        </div>
      </header>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((c) => (
          <div key={c.label} title={c.title} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${c.bubble}`}>{c.icon}</span>
            <div className="min-w-0">
              <p className={`text-2xl font-black leading-none ${c.valueCls ?? "text-slate-900"}`}>{c.value}</p>
              <p className="text-xs text-slate-500 mt-1.5 leading-snug">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className={`transition-opacity ${isRefreshing ? "opacity-60" : ""}`}>
        {tab === "tasks" ? (
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{t.myTasks}</h3>
              <span className="text-xs text-slate-500 font-medium">{t.sortHint}</span>
            </div>
            <div className="p-4 md:p-5 space-y-4">
              {data.openTasks.length === 0 ? (
                <div className="py-14 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-9 h-9 text-emerald-400" />
                  {t.empty}
                </div>
              ) : (
                <>
                  {activeTasks.map(renderCard)}

                  {awaitingTasks.length > 0 && (
                    <div className="pt-2 space-y-4">
                      <div className="flex items-center gap-3">
                        <h4 className="text-sm font-bold text-emerald-700 whitespace-nowrap">
                          {t.awaitingGroup} ({awaitingTasks.length})
                        </h4>
                        <span className="h-px flex-1 bg-emerald-100" />
                        <span className="text-xs text-slate-400 hidden sm:inline">{t.awaitingHint}</span>
                      </div>
                      {awaitingTasks.map(renderCard)}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        ) : (
          <MaintenanceLog isEn={isEn} tasks={data.logTasks} onOpenTask={setOpenTaskId} />
        )}
      </div>

      {pauseTask && (
        <PauseForPartsModal
          isEn={isEn}
          taskTitle={pauseTask.title}
          busy={busyId === pauseTask.id}
          onCancel={() => setPauseTask(null)}
          onConfirm={confirmPause}
        />
      )}

      {/* Task details (photos, notes, other actions) */}
      <TaskDetailPanel
        locale={locale}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        taskId={openTaskId}
        onClose={closeTaskPanel}
        onOpenTask={setOpenTaskId}
      />
    </div>
  );
}

function TabButton({
  active, onClick, icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
        active ? "border-nassayem text-nassayem" : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
