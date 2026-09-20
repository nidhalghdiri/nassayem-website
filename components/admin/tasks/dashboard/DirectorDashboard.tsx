"use client";

import React, { useState } from "react";
import { Plus, CheckCircle2, AlertCircle, TrendingUp, CalendarDays, X } from "lucide-react";
import CreateTaskForm from "@/components/admin/tasks/CreateTaskForm";
import type { LeaderboardEmployee } from "@/lib/reports/employeeRanking";

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
};

export default function DirectorDashboard({ locale, stats, buildings, assignableStaff, topEmployees }: Props) {
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
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8" dir={isEn ? "ltr" : "rtl"}>
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

        {/* Middle Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Employees Leaderboard */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 lg:col-span-1">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-base font-bold text-slate-800">{t.employeeOfWeek}</h2>
              <span className="text-xs text-slate-500">{t.last7Days}</span>
            </div>
            <div className="space-y-5">
              {topEmployees.length > 0 ? (
                topEmployees.map((emp, idx) => (
                  <div key={emp.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-400 w-4">{idx + 1}</span>
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm">
                        {emp.initial}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{emp.name}</p>
                        <p className="text-xs text-slate-500">
                          {emp.role === "HOUSEKEEPING" ? (isEn ? "Housekeeping" : "نظافة") : 
                           emp.role === "MAINTENANCE" ? (isEn ? "Maintenance" : "صيانة") : 
                           emp.role === "SUPERVISOR" ? (isEn ? "Supervisor" : "مشرف") : 
                           emp.role === "RECEPTIONIST" ? (isEn ? "Receptionist" : "استقبال") : 
                           emp.role === "MANAGER" ? (isEn ? "Manager" : "مدير") : emp.role}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {emp.best && (
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                          {t.best} {emp.score}
                        </span>
                      )}
                      {!emp.best && <span className="text-sm font-bold text-slate-700">{emp.score}</span>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-500 text-sm">
                  {isEn ? "No tasks completed in the last 7 days." : "لا توجد مهام منجزة في آخر 7 أيام."}
                </div>
              )}
            </div>
          </div>

          {/* Building Performance Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 lg:col-span-2">
            <h2 className="text-base font-bold text-slate-800 mb-6">{t.buildingPerf}</h2>
            <div className="space-y-6">
              {[
                { label: isEn ? "Commercial" : "الحي التجاري", val: 92, color: "bg-nassayem" },
                { label: isEn ? "Complexes" : "المجمعات", val: 87, color: "bg-teal-700" },
                { label: isEn ? "Al Faisaliyah" : "الفيصلية", val: 81, color: "bg-amber-600" },
                { label: isEn ? "Al Wadi" : "الوادي", val: 78, color: "bg-amber-700" },
                { label: isEn ? "Al Mahara" : "المحارة", val: 90, color: "bg-teal-600" },
                { label: isEn ? "Awqad" : "عوقد", val: 69, color: "bg-red-600" },
                { label: isEn ? "Awqad South" : "عوقد جنوب", val: 84, color: "bg-amber-600" },
                { label: isEn ? "Nasmo" : "نسمو", val: 95, color: "bg-teal-800" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 text-sm">
                  <span className="w-24 font-medium text-slate-700 truncate" title={item.label}>{item.label}</span>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden relative">
                    <div
                      className={`absolute top-0 bottom-0 ${isEn ? "left-0" : "right-0"} rounded-full ${item.color}`}
                      style={{ width: `${item.val}%` }}
                    />
                  </div>
                  <span className="w-8 text-end font-bold text-slate-600">{item.val}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Trend Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-base font-bold text-slate-800">{t.trendTitle}</h2>
              <span className="text-xs text-slate-500">{t.last30Days}</span>
            </div>
            <div className="flex-1 min-h-[160px] w-full relative flex items-end pt-4">
              <svg className="w-full h-full absolute inset-0" preserveAspectRatio="none" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="gradientArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,80 L10,60 L20,70 L30,40 L40,50 L50,20 L60,35 L70,10 L80,25 L90,15 L100,5 L100,100 L0,100 Z"
                  fill="url(#gradientArea)"
                />
                <polyline
                  points="0,80 10,60 20,70 30,40 40,50 50,20 60,35 70,10 80,25 90,15 100,5"
                  fill="none"
                  stroke="#0d9488"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Criteria & Notes */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-base font-bold text-slate-800 mb-4">{t.criteriaTitle}</h2>
              <div className="space-y-3">
                {[
                  { id: 1, title: isEn ? "Productivity & Speed" : "الإنتاجية والسرعة", desc: isEn ? "In responding to task reports" : "في التفاعل مع بلاغات المهام" },
                  { id: 2, title: isEn ? "Task Completion" : "إتمام المهام", desc: isEn ? "Without delays or extensions" : "دون تأخير أو تمديد عن المطلوب" },
                  { id: 3, title: isEn ? "Initiative & Problem Solving" : "المبادرة وحل المشكلات", desc: isEn ? "In solving difficult problems" : "في حل المشكلات الصعبة" },
                  { id: 4, title: isEn ? "Team Collaboration" : "التعاون مع الفريق", desc: isEn ? "In supporting supervisor notes" : "في دعم ملاحظات المشرف" },
                ].map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="w-6 text-center text-sm font-bold text-slate-400">{item.id}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-base font-bold text-slate-800 mb-4">{t.notesTitle}</h2>
              <div className="space-y-3">
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-emerald-900">{isEn ? "Fouad — Excellent start in Unit 501" : "فؤاد عبدالله يحيى — ممتازة للبدء بإنهاء مهام التنظيف في الوحدة 501"}</p>
                    <p className="text-xs text-emerald-700 mt-1">{isEn ? "Deserves reward — 2 hours ago" : "يستحق مكافأة — قبل 2 ساعة"}</p>
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-emerald-900">{isEn ? "Rashed — Helped clean 6 units" : "راشد البلوشي — ساعد فريق التنظيف في إنهاء تجهيز 6 وحدات"}</p>
                    <p className="text-xs text-emerald-700 mt-1">{isEn ? "Great teamwork — 3 hours ago" : "تعاون مع الفريق — قبل 3 ساعات"}</p>
                  </div>
                </div>
                <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-900">{isEn ? "Mohammad — Delayed scheduled maintenance" : "محمد محي الدين — تأخر عن بدء مهمة صيانة مجدولة دون إشعار مسبق"}</p>
                    <p className="text-xs text-red-700 mt-1">{isEn ? "Needs warning — 5 hours ago" : "يحتاج إلى تنبيه — قبل 5 ساعات"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Alerts Feed */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-base font-bold text-slate-800 mb-4">{t.alertsTitle}</h2>
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{isEn ? "Unit 501: No deep clean in 30 days" : "الوحدة 501 - استضافة 30: لم تنظف تنظيفاً عميقاً منذ 30 يوماً"}</p>
                  <p className="text-xs text-slate-500 mt-1">{isEn ? "Alert" : "تنبيه"}</p>
                </div>
              </div>
              <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{isEn ? "Awqad Building: Time adherence < 75%" : "مبنى عوقد: نسبة الالتزام بالوقت أقل من 75% لأسبوعين متتاليين"}</p>
                  <p className="text-xs text-slate-500 mt-1">{isEn ? "Alert" : "تنبيه"}</p>
                </div>
              </div>
              <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{isEn ? "6 maintenance tasks waiting for parts" : "6 مهام صيانة في الانتظار لقطع غيار منذ أكثر من 4 أيام"}</p>
                  <p className="text-xs text-slate-500 mt-1">{isEn ? "Follow up" : "متابعة"}</p>
                </div>
              </div>
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
