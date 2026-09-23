"use client";

import React from "react";
import { Info, Image as ImageIcon, CheckCircle2, Clock } from "lucide-react";

export default function ReceptionistReviewSection({ isEn }: { isEn: boolean }) {
  const t = {
    howItWorks: isEn ? "How does approval work?" : "كيف يعمل الاعتماد؟",
    instruction1: isEn 
      ? "① Initial approval: Review photos and approve. The task remains pending with the supervisor until final approval." 
      : "① اعتماد مبدئي: تراجع الصور وتعتمد، وتبقى المهمة معلقة بيد المشرف حتى اعتماده النهائي.",
    instruction2: isEn
      ? "② The supervisor can approve directly even if it passes you, or they may settle for your approval and photos without site visit."
      : "② المشرف يقدر يعتمد مباشرة حتى لو ما مرّت عليك، أو يكتفي باعتمادك وصورك بدون نزول للموقع.",
    pendingYourReview: isEn ? "Pending your review" : "بانتظار مراجعتك",
    approvedPendingSupervisor: isEn ? "You approved — pending supervisor" : "اعتمدتها — بانتظار المشرف",
    finalApproved: isEn ? "Final approved by supervisor" : "اعتمدها المشرف نهائياً",
    taskDetails: isEn ? "Fouad Abdullah Yahya · Normal cleaning" : "فؤاد عبدالله يحيى · تنظيف عادي",
    timeAgo: isEn ? "278 mins ago" : "منذ 278 د",
    onTime: isEn ? "On time" : "ضمن الموعد",
    elapsed: isEn ? "Elapsed 1h 58m — " : "استغرقت 1 س 58 د — ",
    new: isEn ? "New" : "جديد",
    normal: isEn ? "Normal" : "عادي",
    approveBtn: isEn ? "Receptionist Approve" : "اعتماد الاستقبال",
    pendingSupervisorTitle: isEn ? "Approved by you — Pending supervisor" : "اعتمدتها — معلقة بيد المشرف",
    pendingTime: isEn ? "Approved 9:13am" : "اعتمدتها 9:13 ص"
  };

  return (
    <div className="space-y-4">
      {/* Instructions Banner */}
      <div className="bg-white rounded-2xl border border-nassayem/30 p-5 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1 h-full bg-nassayem"></div>
        <h3 className="font-bold text-slate-800 mb-2">{t.howItWorks}</h3>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>{t.instruction1}</li>
          <li>{t.instruction2}</li>
        </ul>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500 mb-2">{t.finalApproved}</div>
          <div className="text-3xl font-black text-slate-800">1</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500 mb-2">{t.approvedPendingSupervisor}</div>
          <div className="text-3xl font-black text-emerald-600">1</div>
        </div>
        <div className="bg-white rounded-2xl border border-orange-200 bg-orange-50/30 p-5 shadow-sm relative">
          <div className="text-xs font-bold text-orange-700 mb-2">{t.pendingYourReview}</div>
          <div className="text-3xl font-black text-orange-600">1</div>
        </div>
      </div>

      {/* Pending Your Review Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800 text-sm">{t.pendingYourReview}</h3>
          <span className="text-xs text-slate-500 font-medium">1 {isEn ? 'task' : 'مهمة'}</span>
        </div>
        <div className="p-5">
          <div className="border border-slate-100 rounded-2xl p-4 hover:border-nassayem/30 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-slate-800">الوحدة 118</h3>
                <p className="text-sm text-slate-500 mt-1">{t.taskDetails}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded-lg">
                <Clock className="w-3 h-3" />
                {t.timeAgo}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <span className="bg-purple-100 text-purple-700 text-[11px] font-bold px-2 py-1 rounded-md">{t.new}</span>
              <span className="bg-emerald-50 text-emerald-600 text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t.elapsed}{t.onTime}
              </span>
              <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                {t.normal}
              </span>
            </div>

            {/* Photos */}
            <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar pb-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex-1 h-24 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
                  <ImageIcon className="w-6 h-6 text-slate-300" />
                </div>
              ))}
            </div>

            <button className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm">
              {t.approveBtn}
            </button>
          </div>
        </div>
      </div>

      {/* Pending Supervisor */}
      <div>
        <h3 className="font-bold text-slate-500 text-xs mb-3">{t.pendingSupervisorTitle}</h3>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
          <div>
            <h4 className="font-bold text-slate-800">تنظيف عميق — الوحدة 207</h4>
            <p className="text-xs text-slate-500 mt-1">محمد اريفور رحمن</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 items-center">
            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {t.pendingTime}
            </span>
            <span className="bg-orange-50 text-orange-600 text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              معلقة بيد المشرف
            </span>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
              🧹
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
