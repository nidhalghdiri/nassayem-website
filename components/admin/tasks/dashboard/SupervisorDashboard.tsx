"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import CreateTaskForm from "@/components/admin/tasks/CreateTaskForm";
import MaintenanceRequestButton from "@/components/admin/tasks/MaintenanceRequestButton";
import TaskDetailPanel from "@/components/admin/tasks/TaskDetailPanel";
import MaintenanceTasksReport from "./supervisor/MaintenanceTasksReport";
import OtherMaintenanceSummary from "./supervisor/OtherMaintenanceSummary";
import EquipmentMaintenanceSummary from "./supervisor/EquipmentMaintenanceSummary";
import DashboardSectionTabs, { useDashboardSection } from "./DashboardSectionTabs";
import EquipmentListTab from "./EquipmentListTab";
import AuditList from "./AuditList";
import LastAuditPerBuilding from "./LastAuditPerBuilding";
import EmployeeDailyNotebook, { EmployeeNoteProps } from "./EmployeeDailyNotebook";
import UnitsStatusSection from "./receptionist/UnitsStatusSection";
import type { PendingAudit, SupervisorStats, BuildingAuditStatus } from "@/lib/reports/supervisorAudit";
import type { UnitStatusInfo, TimelineEvent } from "@/lib/reports/receptionistDashboard";

type Props = {
  locale: string;
  currentUserId: string;
  currentUserRole: string;
  buildings: any[];
  assignableStaff: any[];
  stats: SupervisorStats;
  pendingAudits: PendingAudit[];
  buildingAuditStatus: BuildingAuditStatus[];
  todaysEmployeeNotes: EmployeeNoteProps[];
  unitsStatus: UnitStatusInfo[];
  readinessTimeline: TimelineEvent[];
};

export default function SupervisorDashboard({ locale, currentUserId, currentUserRole, buildings, assignableStaff, stats, pendingAudits, buildingAuditStatus, todaysEmployeeNotes, unitsStatus, readinessTimeline }: Props) {
  const isEn = locale === "en";
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const router = useRouter();
  // Task details panel (opened from the maintenance report) + report reload after changes
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [reportKey, setReportKey] = useState(0);
  const [section, setSection] = useDashboardSection();

  const closeTaskPanel = useCallback(() => {
    setOpenTaskId(null);
    setReportKey((k) => k + 1); // reload the report with whatever changed in the panel
    router.refresh();
  }, [router]);

  const t = {
    createTitle: isEn ? "Create Task & Assign" : "إنشاء مهمة وإسنادها لموظف",
    createDesc: isEn ? "As an internal supervisor, you can create a task and assign it to the responsible employee." : "كمشرف داخلي، تقدر تنشئ مهمة وتحدد الموظف المسؤول عنها",
    newTaskBtn: isEn ? "+ New Task" : "+ مهمة جديدة",
    stats: {
      awaitingNow: isEn ? "Awaiting your audit now" : "بانتظار تدقيقك الآن",
      acceptanceRate: isEn ? "First-time acceptance rate" : "نسبة القبول من أول مرة",
      responseTime: isEn ? "Average response time" : "متوسط زمن استجابتك",
      lateBuildings: isEn ? "Late buildings" : "مبان متأخرة عن الجولة",
      mins: isEn ? "m" : "د"
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      
      {/* Top Banner (Create Task) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t.createTitle}</h2>
          <p className="text-slate-500 text-sm mt-1">{t.createDesc}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
          <MaintenanceRequestButton locale={locale} className="flex items-center justify-center gap-2 border border-nassayem/40 text-nassayem bg-white hover:bg-nassayem/5 px-5 py-3 rounded-xl font-bold transition-colors shrink-0" />
          <button
            onClick={() => setIsTaskModalOpen(true)}
            className="bg-nassayem hover:bg-nassayem/90 text-white px-6 py-3 rounded-xl font-bold shadow-sm transition-colors shrink-0"
          >
            {t.newTaskBtn}
          </button>
        </div>
      </div>

      <DashboardSectionTabs isEn={isEn} section={section} onChange={setSection} />

      {section === "equipment" && (
        <>
          <EquipmentMaintenanceSummary isEn={isEn} refreshKey={reportKey} onOpenTask={setOpenTaskId} />
          <MaintenanceTasksReport scope="EQUIPMENT" isEn={isEn} buildings={buildings} onOpenTask={setOpenTaskId} refreshKey={reportKey} />
        </>
      )}

      {section === "devices" && <EquipmentListTab locale={locale} />}

      {section === "other" && (
        <>
          <OtherMaintenanceSummary isEn={isEn} refreshKey={reportKey} onOpenTask={setOpenTaskId} />
          <MaintenanceTasksReport scope="OTHER" isEn={isEn} buildings={buildings} onOpenTask={setOpenTaskId} refreshKey={reportKey} />
        </>
      )}

      {section === "tasks" && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
              <p className="text-slate-500 font-medium mb-3">{t.stats.lateBuildings}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-red-600">{stats.lateBuildingsCount}</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
              <p className="text-slate-500 font-medium mb-3">{t.stats.responseTime}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-slate-800">{stats.avgResponseTimeMins}</span>
                <span className="text-xl font-bold text-slate-400">{t.stats.mins}</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
              <p className="text-slate-500 font-medium mb-3">{t.stats.acceptanceRate}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-emerald-600">{stats.firstTimeAcceptanceRate}</span>
                <span className="text-xl font-bold text-emerald-400">%</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
              <p className="text-slate-500 font-medium mb-3">{t.stats.awaitingNow}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-orange-500">{stats.pendingAuditsCount}</span>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left Column (Last Audit) */}
            <div className="lg:col-span-1">
              <LastAuditPerBuilding data={buildingAuditStatus} locale={locale} />
            </div>

            {/* Right Column (Audit List) */}
            <div className="lg:col-span-2">
              <AuditList audits={pendingAudits} locale={locale} />
            </div>

          </div>

          {/* Units Grid & Timeline */}
          <UnitsStatusSection isEn={isEn} units={unitsStatus} timeline={readinessTimeline} />

          {/* Employee Daily Notebook */}
          <div>
            <EmployeeDailyNotebook locale={locale} todaysNotes={todaysEmployeeNotes} assignableStaff={assignableStaff} />
          </div>
        </>
      )}

      {/* Task details (slide-over) */}
      <TaskDetailPanel
        locale={locale}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        taskId={openTaskId}
        onClose={closeTaskPanel}
        onOpenTask={setOpenTaskId}
      />

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
