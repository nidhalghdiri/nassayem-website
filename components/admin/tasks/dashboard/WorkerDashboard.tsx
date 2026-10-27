"use client";

import React, { useCallback, useState } from "react";
import TaskDetailPanel from "@/components/admin/tasks/TaskDetailPanel";
import type { WorkerDashboardData } from "@/lib/reports/workerDashboard";
import WorkerStatsSection from "./worker/WorkerStatsSection";
import WorkerOpenTasks from "./worker/WorkerOpenTasks";
import WorkerRecentTasks from "./worker/WorkerRecentTasks";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { canOpenCreateTask } from "@/lib/tasks/permissions";
import type { TStaffRole } from "@/lib/tasks/constants";

export default function WorkerDashboard({
  locale,
  currentUserId,
  data,
  currentUserRole,
  staffUsers,
  selectedWorkerId,
}: {
  locale: string;
  currentUserId: string;
  data: WorkerDashboardData;
  currentUserRole: string;
  staffUsers: { id: string; name: string; role: string }[];
  selectedWorkerId: string;
}) {
  const isEn = locale === "en";
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const closeTaskPanel = useCallback(() => {
    setOpenTaskId(null);
    router.refresh(); // pick up status changes / photos made in the panel
  }, [router]);

  const handleWorkerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("worker", e.target.value);
    router.push(pathname + "?" + params.toString());
  };

  const showFilter = currentUserRole === "MANAGER" || currentUserRole === "SUPERVISOR";
  // Housekeeping (and any self-only role) can log a task for themselves; the
  // create form assigns it to them automatically.
  const canCreate = canOpenCreateTask(currentUserRole as TStaffRole);
  const workers = staffUsers?.filter(u => u.role === "HOUSEKEEPING" || u.role === "MAINTENANCE") || [];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Top Bar with Filter / New Task */}
      {(showFilter || canCreate) && (
        <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
          {showFilter && (
            <select 
              value={selectedWorkerId}
              onChange={handleWorkerChange}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
              dir={isEn ? "ltr" : "rtl"}
            >
              <option value="" disabled>{isEn ? "Select a worker" : "اختر عاملاً"}</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          )}
          {canCreate && (
            <Link
              href={`/${locale}/admin/tasks/new`}
              className="flex items-center gap-2 bg-nassayem text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-nassayem/90 transition-colors"
            >
              <Plus className="w-4 h-4 shrink-0" />
              {isEn ? "New Task" : "مهمة جديدة"}
            </Link>
          )}
        </div>
      )}

      {/* Stats Section */}
      <WorkerStatsSection isEn={isEn} stats={data.stats} />

      {/* Open Tasks Section */}
      <WorkerOpenTasks isEn={isEn} locale={locale} tasks={data.openTasks} onOpenTask={setOpenTaskId} />

      {/* Recent Completed Tasks Section */}
      <WorkerRecentTasks isEn={isEn} tasks={data.recentTasks} />

      {/* Task details (photos, notes, other status actions) */}
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
