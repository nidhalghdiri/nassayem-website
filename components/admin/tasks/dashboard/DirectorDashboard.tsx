"use client";

import React, { useState } from "react";
import { Plus, CheckCircle2, AlertCircle, TrendingUp, CalendarDays, X, Clock, Activity, CheckSquare } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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
  timeAdherence?: number;
  waitingAudit?: number;
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
  trendData?: { date: string; count: number }[];
};

export default function DirectorDashboard({ locale, stats, trendData, buildings, assignableStaff, topEmployees, lastWeekEmployees, buildingPerformance, recentNotes, alerts }: Props) {
  const isEn = locale === "en";
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"ACTIVE" | "DELAYED" | "WAITING_AUDIT" | null>(null);
  const [modalTasks, setModalTasks] = useState<any[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  React.useEffect(() => {
    if (!modalType) {
      setModalTasks([]);
      return;
    }
    setIsLoadingTasks(true);
    let url = `/api/tasks?`;
    if (modalType === "ACTIVE") url += "status=IN_PROGRESS&status=ASSIGNED&status=WORK_STARTED"; // Simplified for now, or fetch all and filter, wait API doesn't support multiple same params easily in this basic implementation, we can just fetch all and filter or add an endpoint. Actually, let's just fetch all and filter in JS if not too many, or just rely on standard statuses.
    // Better: just fetch all tasks for the modal and filter client side since it's a dashboard and tasks aren't millions.
    fetch(`/api/tasks`)
      .then(res => res.json())
      .then(data => {
        let filtered = data;
        const TERMINAL = ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED", "CANCELLED"];
        if (modalType === "ACTIVE") {
          filtered = data.filter((t: any) => !TERMINAL.includes(t.status));
        } else if (modalType === "DELAYED") {
          filtered = data.filter((t: any) => !TERMINAL.includes(t.status) && new Date(t.dueDate) < new Date());
        } else if (modalType === "WAITING_AUDIT") {
          filtered = data.filter((t: any) => ["CLEANING_COMPLETED", "WORK_COMPLETED"].includes(t.status));
        }
        setModalTasks(filtered);
        setIsLoadingTasks(false);
      })
      .catch(() => setIsLoadingTasks(false));
  }, [modalType]);

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
    timeAdherence: isEn ? "Time Adherence" : "الالتزام بالوقت",
    waitingAudit: isEn ? "Waiting Audit" : "بانتظار تدقيق المشرف",
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
          <div 
            onClick={() => setModalType("ACTIVE")}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center cursor-pointer hover:border-nassayem/50 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-3 group-hover:scale-110 transition-transform">
              <Activity className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">{t.activeTasks}</p>
            <p className="text-3xl font-bold text-slate-800">{stats.active}</p>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">{t.timeAdherence}</p>
            <p className="text-3xl font-bold text-emerald-600">{stats.timeAdherence}%</p>
          </div>

          <div 
            onClick={() => setModalType("DELAYED")}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center cursor-pointer hover:border-red-300 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 mb-3 group-hover:scale-110 transition-transform">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">{t.delayedTasks}</p>
            <p className="text-3xl font-bold text-red-500">{stats.delayed}</p>
          </div>

          <div 
            onClick={() => setModalType("WAITING_AUDIT")}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center cursor-pointer hover:border-orange-300 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 mb-3 group-hover:scale-110 transition-transform">
              <CheckSquare className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">{t.waitingAudit}</p>
            <p className="text-3xl font-bold text-orange-500">{stats.waitingAudit}</p>
          </div>
        </div>

        {/* Trend Chart Area */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-bold text-slate-800">{t.trendTitle}</h2>
            <span className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-md">{isEn ? "Last 14 Days" : "آخر 14 يوماً"}</span>
          </div>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#334155' }}
                />
                <Area type="monotone" dataKey="count" stroke="#0f766e" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
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
          <NominationCriteriaReport employees={topEmployees} locale={locale} />
        </div>

        {/* Employee of the Week Detailed Report */}
        <div className="mt-8 -mx-4 md:-mx-8">
          <EmployeeOfTheWeekReport employees={topEmployees} lastWeekEmployees={lastWeekEmployees} locale={locale} />
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
              <CreateTaskForm
                buildings={buildings}
                assignableStaff={assignableStaff}
                locale={locale}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tasks List Modal */}
      {modalType && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {modalType === "ACTIVE" && <Activity className="w-5 h-5 text-blue-600" />}
                {modalType === "DELAYED" && <AlertCircle className="w-5 h-5 text-red-600" />}
                {modalType === "WAITING_AUDIT" && <CheckSquare className="w-5 h-5 text-orange-600" />}
                {modalType === "ACTIVE" ? t.activeTasks : modalType === "DELAYED" ? t.delayedTasks : t.waitingAudit}
              </h2>
              <button
                onClick={() => setModalType(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
              {isLoadingTasks ? (
                <div className="flex justify-center items-center h-32">
                  <div className="w-8 h-8 border-4 border-nassayem border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : modalTasks.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p>{isEn ? "No tasks found." : "لا توجد مهام."}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {modalTasks.map((t) => (
                    <div key={t.id} className="bg-white border border-slate-100 p-4 rounded-xl flex justify-between items-center hover:border-nassayem/30 transition-colors shadow-sm">
                      <div>
                        <h3 className="font-bold text-sm text-slate-800">{t.title}</h3>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                          <span>{isEn ? t.building?.nameEn : t.building?.nameAr}</span>
                          {t.unitNumber && (
                            <>
                              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                              <span>{t.unitNumber}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="text-end">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                          modalType === 'DELAYED' ? 'bg-red-50 text-red-600' :
                          modalType === 'WAITING_AUDIT' ? 'bg-orange-50 text-orange-600' :
                          'bg-blue-50 text-blue-600'
                        }`}>
                          {t.status}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1.5">
                          {new Date(t.dueDate).toLocaleDateString(isEn ? 'en-US' : 'ar-EG', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
