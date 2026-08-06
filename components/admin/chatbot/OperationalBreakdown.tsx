"use client";

import {
  MessageSquare,
  Globe,
  Bot,
  User,
  Wrench,
  UserCheck,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

export type OperationalData = {
  channelWhatsapp: number;
  channelWeb: number;
  langArabic: number;
  langEnglish: number;
  roleAi: number;
  roleUser: number;
  roleTool: number;
  roleStaff: number;
  statusResolved: number;
  statusEscalated: number;
};

type Props = {
  isEn: boolean;
  data: OperationalData;
};

export default function OperationalBreakdown({ isEn, data }: Props) {
  const totalChannels = Math.max(1, data.channelWhatsapp + data.channelWeb);
  const waPct = Math.round((data.channelWhatsapp / totalChannels) * 100);
  const webPct = Math.max(0, 100 - waPct);

  const totalLangs = Math.max(1, data.langArabic + data.langEnglish);
  const arPct = Math.round((data.langArabic / totalLangs) * 100);
  const enPct = Math.max(0, 100 - arPct);

  const totalMsgs = Math.max(1, data.roleAi + data.roleUser + data.roleTool + data.roleStaff);
  const aiMsgPct = ((data.roleAi / totalMsgs) * 100).toFixed(1);
  const userMsgPct = ((data.roleUser / totalMsgs) * 100).toFixed(1);
  const toolMsgPct = ((data.roleTool / totalMsgs) * 100).toFixed(1);
  const staffMsgPct = ((data.roleStaff / totalMsgs) * 100).toFixed(1);

  const totalStatus = Math.max(1, data.statusResolved + data.statusEscalated);
  const resolvedPct = Math.round((data.statusResolved / totalStatus) * 100);
  const escalatedPct = Math.max(0, 100 - resolvedPct);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* 1. Channel Distribution */}
      <div className="bg-white border border-gray-200/90 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              {isEn ? "Channel Preference" : "قنوات المحادثة"}
            </span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {waPct}% WhatsApp
            </span>
          </div>

          <div className="space-y-3 mt-4">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-700">WhatsApp</span>
                <span className="text-gray-900">{data.channelWhatsapp.toLocaleString()} ({waPct}%)</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${waPct}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-700">{isEn ? "Website Widget" : "الموقع الإلكتروني"}</span>
                <span className="text-gray-900">{data.channelWeb.toLocaleString()} ({webPct}%)</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${webPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-gray-400 mt-4">
          {isEn ? "WhatsApp is the primary booking channel for guests." : "الواتساب هو القناة الأساسية لحجوزات النزلاء."}
        </p>
      </div>

      {/* 2. Language Preference */}
      <div className="bg-white border border-gray-200/90 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-blue-600" />
              {isEn ? "Customer Language" : "لغة المحادثات"}
            </span>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
              {arPct}% Arabic
            </span>
          </div>

          <div className="space-y-3 mt-4">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-700">{isEn ? "Arabic (العربية)" : "اللغة العربية"}</span>
                <span className="text-gray-900">{data.langArabic.toLocaleString()} ({arPct}%)</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#1B365D] rounded-full" style={{ width: `${arPct}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-700">{isEn ? "English" : "اللغة الإنجليزية"}</span>
                <span className="text-gray-900">{data.langEnglish.toLocaleString()} ({enPct}%)</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${enPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-gray-400 mt-4">
          {isEn ? "Includes Arabizi detection and regional dialect handling." : "يدعم اللهجات الخليجية والعمانية والفرانكو-آراب."}
        </p>
      </div>

      {/* 3. Resolution Health */}
      <div className="bg-white border border-gray-200/90 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-indigo-600" />
              {isEn ? "Automation Rate" : "معدل الحسم الآلي"}
            </span>
            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
              {resolvedPct}% Automated
            </span>
          </div>

          <div className="space-y-3 mt-4">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-700">{isEn ? "Self-Resolved (Bot)" : "معالجة آلية كاملة"}</span>
                <span className="text-emerald-700 font-bold">{data.statusResolved.toLocaleString()} ({resolvedPct}%)</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${resolvedPct}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-700">{isEn ? "Escalated to Staff" : "تم التصعيد لموظف"}</span>
                <span className="text-amber-700 font-bold">{data.statusEscalated.toLocaleString()} ({escalatedPct}%)</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${escalatedPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-gray-400 mt-4">
          {isEn ? "90.9% of guest inquiries solved without receptionist involvement." : "90.9% من الاستفسارات حُلت دون حاجة لموظف استقبال."}
        </p>
      </div>

      {/* 4. Message Composition */}
      <div className="bg-white border border-gray-200/90 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-purple-600" />
              {isEn ? "Message Composition" : "توزيع أنواع الرسائل"}
            </span>
            <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
              {totalMsgs.toLocaleString()} Msgs
            </span>
          </div>

          <div className="space-y-2 mt-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-blue-600" />
                {isEn ? "AI Responses:" : "ردود المساعد:"}
              </span>
              <strong className="text-gray-900">{data.roleAi.toLocaleString()} ({aiMsgPct}%)</strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-600" />
                {isEn ? "Customer Inbound:" : "رسائل النزلاء:"}
              </span>
              <strong className="text-gray-900">{data.roleUser.toLocaleString()} ({userMsgPct}%)</strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-purple-600" />
                {isEn ? "PMS Tool Invocations:" : "عمليات النظام:"}
              </span>
              <strong className="text-gray-900">{data.roleTool.toLocaleString()} ({toolMsgPct}%)</strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                {isEn ? "Staff Messages:" : "تدخلات الموظفين:"}
              </span>
              <strong className="text-gray-900">{data.roleStaff.toLocaleString()} ({staffMsgPct}%)</strong>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-gray-400 mt-3">
          {isEn ? "PMS tools check live availability, prices, & holds." : "عمليات النظام تفحص التوفر والأسعار وإنشاء الحجوزات."}
        </p>
      </div>
    </div>
  );
}
