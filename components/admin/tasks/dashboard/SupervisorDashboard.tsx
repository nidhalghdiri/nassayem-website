"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import CreateTaskForm from "@/components/admin/tasks/CreateTaskForm";
import AuditList from "./AuditList";
import LastAuditPerBuilding from "./LastAuditPerBuilding";
import EmployeeDailyNotebook, { EmployeeNoteProps } from "./EmployeeDailyNotebook";
import type { PendingAudit, SupervisorStats, BuildingAuditStatus } from "@/lib/reports/supervisorAudit";

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
};

export default function SupervisorDashboard({ locale, buildings, assignableStaff, stats, pendingAudits, buildingAuditStatus, todaysEmployeeNotes }: Props) {
  const isEn = locale === "en";
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

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
        <button
          onClick={() => setIsTaskModalOpen(true)}
          className="bg-nassayem hover:bg-nassayem/90 text-white px-6 py-3 rounded-xl font-bold shadow-sm transition-colors shrink-0"
        >
          {t.newTaskBtn}
        </button>
      </div>

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

      {/* Employee Daily Notebook */}
      <div>
        <EmployeeDailyNotebook locale={locale} todaysNotes={todaysEmployeeNotes} assignableStaff={assignableStaff} />
      </div>

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
