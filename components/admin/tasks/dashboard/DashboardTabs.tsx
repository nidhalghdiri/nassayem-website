"use client";

import React, { useTransition } from "react";
import DirectorDashboard from "./DirectorDashboard";
import SupervisorDashboard from "./SupervisorDashboard";
import ReceptionistDashboard from "./ReceptionistDashboard";
import WorkerDashboard from "./WorkerDashboard";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, Users, ClipboardCheck, Wrench } from "lucide-react";

type Props = {
  locale: string;
  currentUserId: string;
  currentUserRole: string;
  directorProps: any;
  supervisorProps: any;
  receptionistProps: any;
  workerProps: any;
};

export default function DashboardTabs({ locale, currentUserId, currentUserRole, directorProps, supervisorProps, receptionistProps, workerProps }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEn = locale === "en";
  const [isPending, startTransition] = useTransition();

  let availableTabIds = ["worker"];
  if (currentUserRole === "RECEPTIONIST") availableTabIds = ["receptionist", "worker"];
  if (currentUserRole === "SUPERVISOR") availableTabIds = ["supervisor", "receptionist", "worker"];
  if (currentUserRole === "MANAGER") availableTabIds = ["manager", "supervisor", "receptionist", "worker"];

  const fallbackTab = currentUserRole === "MANAGER" ? "manager" :
                      currentUserRole === "SUPERVISOR" ? "supervisor" :
                      currentUserRole === "RECEPTIONIST" ? "receptionist" : "worker";

  const requestedTab = searchParams.get("tab");
  const activeTab = requestedTab && availableTabIds.includes(requestedTab) ? requestedTab : fallbackTab;

  const tabs = [
    { id: "manager", labelEn: "Manager Dashboard", labelAr: "لوحة تحكم المدير", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "supervisor", labelEn: "Supervisor Dashboard", labelAr: "لوحة تحكم المشرف", icon: <ClipboardCheck className="w-4 h-4" /> },
    { id: "receptionist", labelEn: "Receptionist Dashboard", labelAr: "لوحة تحكم الاستقبال", icon: <Users className="w-4 h-4" /> },
    { id: "worker", labelEn: "Worker Dashboard", labelAr: "لوحة تحكم العامل", icon: <Wrench className="w-4 h-4" /> },
  ].filter(tab => availableTabIds.includes(tab.id));

  const handleTabChange = (tabId: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tabId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col" dir={isEn ? "ltr" : "rtl"}>
      <div className="w-full bg-white border-b border-slate-200 relative z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 overflow-x-auto hide-scrollbar">
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                disabled={isPending}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-nassayem text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {tab.icon}
                {isEn ? tab.labelEn : tab.labelAr}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        {isPending && (
          <div className="absolute inset-0 bg-white/40 flex items-start justify-center pt-20 z-50 backdrop-blur-[1px]">
            <div className="w-8 h-8 border-4 border-nassayem border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {activeTab === "manager" && directorProps && <DirectorDashboard {...directorProps} />}
        {activeTab === "supervisor" && supervisorProps && <SupervisorDashboard {...supervisorProps} />}
        {activeTab === "receptionist" && receptionistProps && <ReceptionistDashboard {...receptionistProps} />}
        {activeTab === "worker" && workerProps && <WorkerDashboard {...workerProps} />}
      </div>
    </div>
  );
}
