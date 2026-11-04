"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ListChecks, QrCode, Hammer, MonitorSmartphone, ClipboardList } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Manager / Supervisor dashboards — Tasks · Equipment maintenance · Other
// maintenance · Equipment list (· Visits, Manager only). The open tab is kept in the URL (?view=) so a refresh or a
// shared link opens the same tab; switching does not reload the page.
// ─────────────────────────────────────────────────────────────────────────────

export type DashboardSection = "tasks" | "equipment" | "other" | "devices" | "visits";

const SECTIONS: DashboardSection[] = ["tasks", "equipment", "other", "devices", "visits"];

export function useDashboardSection(withVisits = false): [DashboardSection, (next: DashboardSection) => void] {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("view") as DashboardSection;
  const allowed = SECTIONS.includes(fromUrl) && (withVisits || fromUrl !== "visits");
  const [section, setSection] = useState<DashboardSection>(allowed ? fromUrl : "tasks");

  function change(next: DashboardSection) {
    setSection(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "tasks") params.delete("view");
    else params.set("view", next);
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }

  return [section, change];
}

export default function DashboardSectionTabs({
  isEn,
  section,
  onChange,
  withVisits = false,
}: {
  isEn: boolean;
  section: DashboardSection;
  onChange: (next: DashboardSection) => void;
  /** Show the barcode "Visits" tab (Manager dashboard). */
  withVisits?: boolean;
}) {
  const tabs = [
    { key: "tasks" as const, icon: ListChecks, label: isEn ? "Tasks" : "المهام" },
    { key: "equipment" as const, icon: QrCode, label: isEn ? "Equipment maintenance" : "صيانة الأجهزة" },
    { key: "other" as const, icon: Hammer, label: isEn ? "Other maintenance" : "الصيانة الأخرى" },
    { key: "devices" as const, icon: MonitorSmartphone, label: isEn ? "Equipment list" : "قائمة الأجهزة" },
    ...(withVisits ? [{ key: "visits" as const, icon: ClipboardList, label: isEn ? "Visits" : "الزيارات" }] : []),
  ];

  return (
    <nav role="tablist" aria-label={isEn ? "Dashboard sections" : "أقسام لوحة التحكم"} className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto hide-scrollbar">
      {tabs.map(({ key, icon: Icon, label }) => {
        const active = section === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={`flex items-center gap-2 px-4 py-3 -mb-px border-b-2 text-sm font-bold whitespace-nowrap transition-colors ${
              active ? "border-nassayem text-nassayem" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon className="w-4 h-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
