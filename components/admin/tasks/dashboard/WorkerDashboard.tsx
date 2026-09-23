"use client";

import React from "react";
import type { WorkerDashboardData } from "@/lib/reports/workerDashboard";
import WorkerStatsSection from "./worker/WorkerStatsSection";
import WorkerOpenTasks from "./worker/WorkerOpenTasks";
import WorkerRecentTasks from "./worker/WorkerRecentTasks";

export default function WorkerDashboard({
  locale,
  currentUserId,
  data,
}: {
  locale: string;
  currentUserId: string;
  data: WorkerDashboardData;
}) {
  const isEn = locale === "en";

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Stats Section */}
      <WorkerStatsSection isEn={isEn} stats={data.stats} />

      {/* Open Tasks Section */}
      <WorkerOpenTasks isEn={isEn} tasks={data.openTasks} />

      {/* Recent Completed Tasks Section */}
      <WorkerRecentTasks isEn={isEn} tasks={data.recentTasks} />
    </div>
  );
}
