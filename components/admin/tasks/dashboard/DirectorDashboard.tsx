"use client";

import React, { useState } from "react";
import { Plus, CheckCircle2, AlertCircle, TrendingUp, CalendarDays, X } from "lucide-react";
import CreateTaskForm from "@/components/admin/tasks/CreateTaskForm";
import EmployeeOfTheWeekReport from "../reports/EmployeeOfTheWeekReport";
import type { LeaderboardEmployee } from "@/lib/reports/employeeRanking";
import type { BuildingPerformance } from "@/lib/reports/buildingPerformance";
import type { DashboardAlert } from "@/lib/reports/alerts";
import NominationCriteriaReport from "../reports/NominationCriteriaReport";
import RecentSupervisorNotes, { SupervisorNote } from "../reports/RecentSupervisorNotes";

type Building = {
  id: string;
  nameEn: string;
  nameAr: string;
  shortName?: string | null;
  buildingUnits?: { id: string; name: string }[];
};

type StaffUser = { id: string; name: string | null; email: string; role: string };

type Stats = {
  totalAssigned: number;
  active: number;
  completed: number;
  delayed: number;
};

type Props = {
  locale: string;
  currentUserId: string;
  currentUserRole: string;
  stats: Stats;
  buildings: Building[];
  assignableStaff: StaffUser[];
  topEmployees: LeaderboardEmployee[];
  lastWeekEmployees: LeaderboardEmployee[];
  buildingPerformance: BuildingPerformance[];
  recentNotes: SupervisorNote[];
  alerts: DashboardAlert[];
};

export default function DirectorDashboard({ locale, stats, buildings, assignableStaff, topEmployees, lastWeekEmployees, buildingPerformance, recentNotes, alerts }: Props) {
  const isEn = locale === "en";
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Translations
  const t = {
    systemName: isEn ? "Nassayem Staff" : "نسائم عائلة",
    systemDesc: isEn ? "Maintenance Tracking System - Nassayem Staff" : "نظام متابعة الصيانة - موظفي نسائم",
    todayDate: isEn ? new Date().toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString("ar-EG", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    headerTitle: isEn ? "Assign New Task" : "إسناد مهمة جديدة لموظف",
    headerDesc: isEn ? "Your screen to manage daily affairs for cleaning and maintenance operations employees" : "شاشتك لإدارة الشؤون اليومية لموظفي قسم عمليات النظافة والصيانة",
    newTaskBtn: isEn ? "New Task" : "مهمة جديدة",
    totalAssigned: isEn ? "Total Assigned Tasks" : "إجمالي المهام المعينة",
    workEfficiency: isEn ? "Work Efficiency" : "كفاءة العمل",
    delayedTasks: isEn ? "Delayed Tasks" : "مهام متأخرة",
    needsFollowup: isEn ? "Needs Immediate Follow-up" : "تحتاج متابعة فورية",
    completedTasks: isEn ? "Completed Tasks" : "المهام المنجزة",
    thisWeek: isEn ? "this week" : "هذا الأسبوع",
    activeTasks: isEn ? "Active Tasks" : "المهام النشطة",
    trackedByCleaning: isEn ? "Currently tracked" : "تستمر متابعتها من النظافة",
    employeeOfWeek: isEn ? "Employee of the Week" : "موظف الأسبوع",
    last7Days: isEn ? "Last 7 days" : "آخر 7 أيام",
    best: isEn ? "Best" : "الأفضل",
    buildingPerf: isEn ? "Building Performance - Time Adherence %" : "أداء المباني - نسبة الالتزام بالوقت",
    trendTitle: isEn ? "Trend of Completed Tasks" : "اتجاه المهام المنجزة",
    last30Days: isEn ? "Last 30 days" : "أخر 30 يوم",
    criteriaTitle: isEn ? "Employee of the Week Nomination Criteria" : "معايير ترشيح موظف الأسبوع",
    notesTitle: isEn ? "Latest Daily Supervisor Notes" : "آخر ملاحظات المشرف اليومية",
    alertsTitle: isEn ? "Alerts That Need Your Attention" : "تنبيهات تحتاج انتباهك",
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans" dir={isEn ? "ltr" : "rtl"}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Navigation */}
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-nassayem text-white flex items-center justify-center rounded-full font-bold">
              {isEn ? "N" : "ن"}
            </div>
            <div>
              <p className="font-bold text-sm text-slate-800">{t.systemName}</p>
              <p className="text-xs text-slate-500">{t.systemDesc}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-slate-500 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
            <CalendarDays className="w-4 h-4" />
            <span>{t.todayDate}</span>
          </div>
        </div>

        {/* Header Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{t.headerTitle}</h1>
            <p className="text-sm text-slate-500 mt-1">{t.headerDesc}</p>
          </div>
          <button
            onClick={() => setIsTaskModalOpen(true)}
            className="flex items-center gap-2 bg-nassayem hover:bg-nassayem/90 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-5 h-5" />
            {t.newTaskBtn}
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
            <p className="text-sm font-medium text-slate-500 mb-2">{t.totalAssigned}</p>
            <p className="text-4xl font-bold text-yellow-600">{stats.totalAssigned}</p>
            <p className="text-xs text-yellow-600 mt-2 bg-yellow-50 px-2 py-1 rounded-md">{t.workEfficiency}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
            <p className="text-sm font-medium text-slate-500 mb-2">{t.delayedTasks}</p>
            <p className="text-4xl font-bold text-red-500">{stats.delayed}</p>
            <p className="text-xs text-red-500 mt-2 bg-red-50 px-2 py-1 rounded-md">{t.needsFollowup}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
            <p className="text-sm font-medium text-slate-500 mb-2">{t.completedTasks}</p>
            <p className="text-4xl font-bold text-emerald-600">{stats.completed}</p>
            <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3 h-3" />
              5% {t.thisWeek}
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
            <p className="text-sm font-medium text-slate-500 mb-2">{t.activeTasks}</p>
            <p className="text-4xl font-bold text-slate-800">{stats.active}</p>
            <p className="text-xs text-slate-500 mt-2">{t.trackedByCleaning}</p>
          </div>
        </div>

        {/* Middle Section: Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Building Performance Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-base font-bold text-slate-800 mb-6">{t.buildingPerf}</h2>
            <div className="space-y-6">
              {buildingPerformance.length > 0 ? (
                buildingPerformance.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 text-sm">
                    <span className="w-24 font-medium text-slate-700 truncate" title={isEn ? item.labelEn : item.labelAr}>
                      {isEn ? item.labelEn : item.labelAr}
                    </span>
                    <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden relative">
                      <div
                        className={`absolute top-0 bottom-0 ${isEn ? "left-0" : "right-0"} rounded-full ${item.color}`}
                        style={{ width: `${item.val}%` }}
                      />
                    </div>
                    <span className="w-8 text-end font-bold text-slate-600">{item.val}%</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-500 text-sm">
                  {isEn ? "No completed tasks in the last 30 days." : "لا توجد مهام منجزة في آخر 30 يوماً."}
                </div>
              )}
            </div>
          </div>

          {/* Nomination Criteria Report */}
          <NominationCriteriaReport employees={topEmployees} />
        </div>

        {/* Employee of the Week Detailed Report */}
        <div className="mt-8 -mx-4 md:-mx-8">
          <EmployeeOfTheWeekReport employees={topEmployees} lastWeekEmployees={lastWeekEmployees} />
        </div>

        {/* Bottom Section: Notes & Alerts */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentSupervisorNotes notes={recentNotes} locale={locale} />

          {/* Alerts Feed */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-base font-bold text-slate-800 mb-4">{t.alertsTitle}</h2>
            <div className="space-y-3">
              {alerts.length > 0 ? alerts.map((alert) => (
                <div key={alert.id} className={`border p-3 rounded-xl flex items-start gap-3 ${alert.severity === 'high' ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                  <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${alert.severity === 'high' ? 'text-red-600' : 'text-orange-600'}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{isEn ? alert.textEn : alert.textAr}</p>
                    <p className="text-xs text-slate-500 mt-1">{isEn ? "Alert" : "تنبيه"}</p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-6 text-slate-500 text-sm">
                  {isEn ? "No alerts at this time." : "لا توجد تنبيهات في الوقت الحالي."}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <div className="sticky top-0 bg-white/95 backdrop-blur z-10 flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">
                {isEn ? "Create New Task" : "إنشاء مهمة جديدة"}
              </h2>
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 md:p-6">
              {/* Note: CreateTaskForm expects buildings, assignableStaff, locale */}
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
