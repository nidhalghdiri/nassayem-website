"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, Bell, CheckCircle2, AlertCircle, TrendingUp, CalendarDays } from "lucide-react";

type Props = {
  locale: string;
  currentUserId: string;
  currentUserRole: string;
};

const ROLES = [
  { id: "director", label: "المدير", active: true },
  { id: "employee", label: "الموظف", active: false },
  { id: "accommodation", label: "مسؤول السكن", active: false },
  { id: "supervisor", label: "المشرف الداخلي", active: false },
];

export default function DirectorDashboard({ locale }: Props) {
  const isEn = locale === "en";
  const [activeRole, setActiveRole] = useState("director");

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8" dir={isEn ? "ltr" : "rtl"}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Navigation / Role Selector */}
        <div className="flex justify-between items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-nassayem text-white flex items-center justify-center rounded-full font-bold">
              ن
            </div>
            <div>
              <p className="font-bold text-sm">نسائم عائلة</p>
              <p className="text-xs text-slate-500">نظام متابعة الصيانة - موظفي نسائم</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {ROLES.map((role) => (
              <button
                key={role.id}
                onClick={() => setActiveRole(role.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeRole === role.id
                    ? "bg-nassayem text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-4 text-sm text-slate-500 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
            <CalendarDays className="w-4 h-4" />
            <span>الأحد 20 أكتوبر 2024</span>
          </div>
        </div>

        {/* Header Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800">إسناد مهمة جديدة لموظف</h1>
            <p className="text-sm text-slate-500 mt-1">
              شاشتك لإدارة الشؤون اليومية لموظفي قسم عمليات النظافة والصيانة
            </p>
          </div>
          <Link
            href={`/${locale}/admin/tasks/new`}
            className="flex items-center gap-2 bg-nassayem hover:bg-nassayem/90 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            مهمة جديدة
          </Link>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
            <p className="text-sm font-medium text-slate-500 mb-2">إجمالي المهام المعينة</p>
            <p className="text-4xl font-bold text-yellow-600">3</p>
            <p className="text-xs text-yellow-600 mt-2 bg-yellow-50 px-2 py-1 rounded-md">كفاءة العمل</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
            <p className="text-sm font-medium text-slate-500 mb-2">مهام متأخرة</p>
            <p className="text-4xl font-bold text-red-500">9</p>
            <p className="text-xs text-red-500 mt-2 bg-red-50 px-2 py-1 rounded-md">تحتاج متابعة فورية</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
            <p className="text-sm font-medium text-slate-500 mb-2">المهام المنجزة</p>
            <p className="text-4xl font-bold text-emerald-600">87</p>
            <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3 h-3" />
              5% هذا الأسبوع
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
            <p className="text-sm font-medium text-slate-500 mb-2">المهام النشطة</p>
            <p className="text-4xl font-bold text-slate-800">7</p>
            <p className="text-xs text-slate-500 mt-2">تستمر متابعتها من النظافة</p>
          </div>
        </div>

        {/* Middle Section (Charts & Top Employees) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Employees Leaderboard */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 lg:col-span-1">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-base font-bold text-slate-800">موظف الأسبوع</h2>
              <span className="text-xs text-slate-500">آخر 7 أيام</span>
            </div>
            <div className="space-y-5">
              {[
                { name: "فؤاد عبدالله يحيى", role: "موظف صيانة", score: 97, best: true, initial: "ف" },
                { name: "محمد أبو نور الدين", role: "مشرف سكن العمال", score: 95, initial: "م" },
                { name: "أشقر خان", role: "مشرف الوادي", score: 90, initial: "أ" },
                { name: "راشد البلوشي", role: "استقبال - مقيم", score: 88, initial: "ر" },
                { name: "محمد محي الدين", role: "نظافة - الواحة", score: 85, initial: "م" },
              ].map((emp, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-400 w-4">{idx + 1}</span>
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm">
                      {emp.initial}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{emp.name}</p>
                      <p className="text-xs text-slate-500">{emp.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {emp.best && (
                      <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                        الأفضل {emp.score}
                      </span>
                    )}
                    {!emp.best && <span className="text-sm font-bold text-slate-700">{emp.score}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Building Performance Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 lg:col-span-2">
            <h2 className="text-base font-bold text-slate-800 mb-6">أداء المباني - نسبة الالتزام بالوقت</h2>
            <div className="space-y-6">
              {[
                { label: "الحي التجاري", val: 92, color: "bg-nassayem" },
                { label: "المجمعات", val: 87, color: "bg-teal-700" },
                { label: "الفيصلية", val: 81, color: "bg-amber-600" },
                { label: "الوادي", val: 78, color: "bg-amber-700" },
                { label: "المحارة", val: 90, color: "bg-teal-600" },
                { label: "عوقد", val: 69, color: "bg-red-600" },
                { label: "عوقد جنوب", val: 84, color: "bg-amber-600" },
                { label: "نسمو", val: 95, color: "bg-teal-800" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 text-sm">
                  <span className="w-24 font-medium text-slate-700">{item.label}</span>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden relative">
                    <div
                      className={`absolute top-0 bottom-0 end-0 rounded-full ${item.color}`}
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
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-base font-bold text-slate-800">اتجاه المهام المنجزة</h2>
              <span className="text-xs text-slate-500">أخر 30 يوم</span>
            </div>
            <div className="h-40 w-full relative flex items-end pt-4">
              {/* Custom SVG Line Chart */}
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
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
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <div className="bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg">
                  اليوم: 131 مهمة
                </div>
              </div>
            </div>
          </div>

          {/* Center Column: Criteria & Notes */}
          <div className="space-y-6">
            {/* Criteria */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-base font-bold text-slate-800 mb-4">معايير ترشيح موظف الأسبوع</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center text-sm font-bold text-slate-400">1</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">الإنتاجية والسرعة</p>
                    <p className="text-xs text-slate-500">في التفاعل مع بلاغات المهام</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center text-sm font-bold text-slate-400">2</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">إتمام المهام</p>
                    <p className="text-xs text-slate-500">دون تأخير أو تمديد عن المطلوب</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center text-sm font-bold text-slate-400">3</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">المبادرة وحل المشكلات</p>
                    <p className="text-xs text-slate-500">في حل المشكلات الصعبة</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center text-sm font-bold text-slate-400">4</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">التعاون مع الفريق</p>
                    <p className="text-xs text-slate-500">في دعم ملاحظات المشرف</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-base font-bold text-slate-800 mb-4">آخر ملاحظات المشرف اليومية</h2>
              <div className="space-y-3">
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-emerald-900">فؤاد عبدالله يحيى — ممتازة للبدء بإنهاء مهام التنظيف في الوحدة 501</p>
                    <p className="text-xs text-emerald-700 mt-1">يستحق مكافأة — قبل 2 ساعة</p>
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-emerald-900">راشد البلوشي — ساعد فريق التنظيف في إنهاء تجهيز 6 وحدات</p>
                    <p className="text-xs text-emerald-700 mt-1">تعاون مع الفريق — قبل 3 ساعات</p>
                  </div>
                </div>
                <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-900">محمد محي الدين — تأخر عن بدء مهمة صيانة مجدولة دون إشعار مسبق</p>
                    <p className="text-xs text-red-700 mt-1">يحتاج إلى تنبيه — قبل 5 ساعات</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Alerts Feed */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-base font-bold text-slate-800 mb-4">تنبيهات تحتاج انتباهك</h2>
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-800">الوحدة 501 - استضافة 30: لم تنظف تنظيفاً عميقاً منذ 30 يوماً</p>
                  <p className="text-xs text-slate-500 mt-1">تنبيه</p>
                </div>
              </div>
              <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-800">مبنى عوقد: نسبة الالتزام بالوقت أقل من 75% لأسبوعين متتاليين</p>
                  <p className="text-xs text-slate-500 mt-1">تنبيه</p>
                </div>
              </div>
              <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-800">6 مهام صيانة في الانتظار لقطع غيار منذ أكثر من 4 أيام</p>
                  <p className="text-xs text-slate-500 mt-1">متابعة</p>
                </div>
              </div>
              <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-800">الوحدة 1013 - الحي التجاري: أبلغت عن تعطل التكييف مرتين هذا الشهر</p>
                  <p className="text-xs text-slate-500 mt-1">متابعة</p>
                </div>
              </div>
              <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-800">مبنى الوادي: لم يجر تفتيش داخلي منذ 6 أيام</p>
                  <p className="text-xs text-slate-500 mt-1">تنبيه</p>
                </div>
              </div>
              <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-800">موظف واحد إجازة اليوم في عوقد شمال دون تغطية معلنة</p>
                  <p className="text-xs text-slate-500 mt-1">متابعة</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
