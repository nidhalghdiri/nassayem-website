"use client";

import React from "react";
import type { WorkerDashboardData } from "@/lib/reports/workerDashboard";
import WorkerStatsSection from "./worker/WorkerStatsSection";
import WorkerOpenTasks from "./worker/WorkerOpenTasks";
import WorkerRecentTasks from "./worker/WorkerRecentTasks";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

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

  const handleWorkerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("worker", e.target.value);
    router.push(pathname + "?" + params.toString());
  };

  const showFilter = currentUserRole === "MANAGER" || currentUserRole === "SUPERVISOR";
  const workers = staffUsers?.filter(u => u.role === "CLEANER" || u.role === "MAINTENANCE") || [];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Top Bar with Filter */}
      {showFilter && (
        <div className="flex justify-end mb-4">
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
        </div>
      )}

      {/* Stats Section */}
      <WorkerStatsSection isEn={isEn} stats={data.stats} />

      {/* Open Tasks Section */}
      <WorkerOpenTasks isEn={isEn} tasks={data.openTasks} />

      {/* Recent Completed Tasks Section */}
      <WorkerRecentTasks isEn={isEn} tasks={data.recentTasks} />
    </div>
  );
}
