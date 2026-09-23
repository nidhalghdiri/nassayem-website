"use client";

import React, { useState } from "react";
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

  // Default tab based on role, or from URL search params
  const defaultTab = searchParams.get("tab") || (
    currentUserRole === "MANAGER" ? "manager" :
    currentUserRole === "SUPERVISOR" ? "supervisor" :
    currentUserRole === "RECEPTIONIST" ? "receptionist" : "worker"
  );
  
  const [activeTab, setActiveTab] = useState(defaultTab);

  const tabs = [
    { id: "manager", labelEn: "Manager Dashboard", labelAr: "لوحة تحكم المدير", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "supervisor", labelEn: "Supervisor Dashboard", labelAr: "لوحة تحكم المشرف", icon: <ClipboardCheck className="w-4 h-4" /> },
    { id: "receptionist", labelEn: "Receptionist Dashboard", labelAr: "لوحة تحكم الاستقبال", icon: <Users className="w-4 h-4" /> },
    { id: "worker", labelEn: "Worker Dashboard", labelAr: "لوحة تحكم العامل", icon: <Wrench className="w-4 h-4" /> },
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams);
    params.set("tab", tabId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col" dir={isEn ? "ltr" : "rtl"}>
      <div className="w-full bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 overflow-x-auto hide-scrollbar">
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-nassayem text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {tab.icon}
                {isEn ? tab.labelEn : tab.labelAr}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1">
        {activeTab === "manager" && <DirectorDashboard {...directorProps} />}
        {activeTab === "supervisor" && <SupervisorDashboard {...supervisorProps} />}
        
        {activeTab === "receptionist" && (
          <ReceptionistDashboard {...receptionistProps} />
        )}
        
        {activeTab === "worker" && (
          <WorkerDashboard {...workerProps} />
        )}
      </div>
    </div>
  );
}
