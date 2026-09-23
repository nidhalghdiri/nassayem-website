"use client";

import React, { useState } from "react";
import ReceptionistReviewSection from "./receptionist/ReceptionistReviewSection";
import LiveTasksSection from "./receptionist/LiveTasksSection";
import UnitsStatusSection from "./receptionist/UnitsStatusSection";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ReceptionistDashboardData } from "@/lib/reports/receptionistDashboard";

export default function ReceptionistDashboard({
  locale,
  buildings,
  data,
  selectedBuilding,
}: {
  locale: string;
  buildings: { id: string; nameEn: string | null; nameAr: string | null; shortName: string | null }[];
  data: ReceptionistDashboardData;
  selectedBuilding: string;
}) {
  const isEn = locale === "en";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleBuildingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams);
    params.set("building", val);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const t = {
    branch: isEn ? "Branch" : "الفرع",
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header / Branch Selection */}
      <div className="flex justify-end mb-4">
        <div className="flex flex-col items-end gap-2">
          <label className="text-xs font-bold text-slate-500">{t.branch}</label>
          <select 
            value={selectedBuilding}
            onChange={handleBuildingChange}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-nassayem shadow-sm text-sm font-bold min-w-[200px]"
            dir={isEn ? "ltr" : "rtl"}
          >
            <option value="ALL">{isEn ? "All Branches" : "جميع الفروع"}</option>
            {buildings.map(b => (
              <option key={b.id} value={b.id}>
                {isEn ? (b.nameEn || b.shortName) : (b.nameAr || b.nameEn)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Review Section */}
      <ReceptionistReviewSection isEn={isEn} stats={data.stats} pendingTasks={data.pendingReviewTasks} approvedTasks={data.approvedPendingSupervisorTasks} />

      {/* Live Tasks & Leaderboard */}
      <LiveTasksSection isEn={isEn} liveTasks={data.liveTasks} staff={data.staffPerformance} />

      {/* Units Grid & Timeline */}
      <UnitsStatusSection isEn={isEn} units={data.units} timeline={data.timeline} />
    </div>
  );
}
