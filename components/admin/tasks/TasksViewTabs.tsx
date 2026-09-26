"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, ListTodo } from "lucide-react";

export default function TasksViewTabs({ currentView, locale }: { currentView: string; locale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEn = locale === "en";

  const handleTabChange = (view: string) => {
    const params = new URLSearchParams(searchParams);
    if (view === "dashboard") {
      params.delete("view");
    } else {
      params.set("view", view);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="bg-white border-b border-slate-200" dir={isEn ? "ltr" : "rtl"}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex gap-2">
          <button
            onClick={() => handleTabChange("dashboard")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              currentView === "dashboard"
                ? "bg-nassayem text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            {isEn ? "Dashboard" : "لوحة التحكم"}
          </button>
          
          <button
            onClick={() => handleTabChange("list")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              currentView === "list"
                ? "bg-nassayem text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <ListTodo className="w-4 h-4" />
            {isEn ? "Tasks List" : "قائمة المهام"}
          </button>
        </div>
      </div>
    </div>
  );
}
