"use client";

import React, { useState } from "react";
import ReceptionistReviewSection from "./receptionist/ReceptionistReviewSection";
import LiveTasksSection from "./receptionist/LiveTasksSection";
import UnitsStatusSection from "./receptionist/UnitsStatusSection";
import CreateTaskForm from "@/components/admin/tasks/CreateTaskForm";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ReceptionistDashboardData } from "@/lib/reports/receptionistDashboard";

export default function ReceptionistDashboard({
  locale,
  buildings,
  data,
  selectedBuilding,
  currentUserRole,
  assignableStaff,
}: {
  locale: string;
  buildings: { id: string; nameEn: string; nameAr: string; shortName: string | null }[];
  data: ReceptionistDashboardData;
  selectedBuilding: string;
  currentUserRole: string;
  assignableStaff: any[];
}) {
  const isEn = locale === "en";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const handleBuildingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams);
    params.set("building", val);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const t = {
    branch: isEn ? "Branch" : "الفرع",
    createTitle: isEn ? "Create Task & Assign" : "إنشاء مهمة وإسنادها لموظف",
    createDesc: isEn ? "As a receptionist, you can create a task and assign it to the responsible employee." : "كموظف استقبال، تقدر تنشئ مهمة وتحدد الموظف المسؤول عنها",
    newTaskBtn: isEn ? "+ New Task" : "+ مهمة جديدة",
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Top Banner (Create Task) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t.createTitle}</h2>
          <p className="text-slate-500 text-sm mt-1">{t.createDesc}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex flex-col items-end gap-1">
            <label className="text-xs font-bold text-slate-500">{t.branch}</label>
          <select 
            value={selectedBuilding}
            onChange={handleBuildingChange}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-nassayem shadow-sm text-sm font-bold min-w-[200px]"
            dir={isEn ? "ltr" : "rtl"}
          >
            {currentUserRole !== "RECEPTIONIST" && (
              <option value="ALL">{isEn ? "All Branches" : "جميع الفروع"}</option>
            )}
            {buildings.map(b => (
              <option key={b.id} value={b.id}>
                {isEn ? (b.nameEn || b.shortName) : (b.nameAr || b.nameEn)}
              </option>
            ))}
          </select>
          </div>
          <button
            onClick={() => setIsTaskModalOpen(true)}
            className="bg-nassayem hover:bg-nassayem/90 text-white px-6 py-3 mt-4 md:mt-0 rounded-xl font-bold shadow-sm transition-colors shrink-0"
          >
            {t.newTaskBtn}
          </button>
        </div>
      </div>

      {/* Main Review Section */}
      <ReceptionistReviewSection isEn={isEn} stats={data.stats} pendingTasks={data.pendingReviewTasks} approvedTasks={data.approvedPendingSupervisorTasks} />

      {/* Live Tasks & Leaderboard */}
      <LiveTasksSection isEn={isEn} liveTasks={data.liveTasks} staff={data.staffPerformance} />

      {/* Units Grid & Timeline */}
      <UnitsStatusSection isEn={isEn} units={data.units} timeline={data.timeline} />

      {/* Create Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <div className="sticky top-0 bg-white/95 backdrop-blur z-10 flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">
                {isEn ? "Create New Task" : "إنشاء مهمة جديدة"}
              </h2>
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-4 md:p-6">
              <CreateTaskForm
                buildings={buildings}
                assignableStaff={assignableStaff}
                locale={locale}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
