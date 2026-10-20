import Link from "next/link";
import { LayoutDashboard, ClipboardCheck, ConciergeBell, HardHat, Wrench, List, type LucideIcon } from "lucide-react";
import type { TDashboardTab } from "@/lib/tasks/permissions";

// ─────────────────────────────────────────────────────────────────────────────
// Quick links between the Tasks dashboards — the same ones as the sidebar's
// Tasks section, limited to the dashboards this user may open
// (getDashboardTabs), plus the Tasks List.
// ─────────────────────────────────────────────────────────────────────────────

const DASHBOARD_LINKS: Record<TDashboardTab, { path: string; en: string; ar: string; icon: LucideIcon }> = {
  manager:      { path: "",              en: "Manager Dashboard",      ar: "لوحة تحكم المدير",     icon: LayoutDashboard },
  supervisor:   { path: "/supervisor",   en: "Supervisor Dashboard",   ar: "لوحة تحكم المشرف",     icon: ClipboardCheck },
  receptionist: { path: "/receptionist", en: "Receptionist Dashboard", ar: "لوحة تحكم الاستقبال",  icon: ConciergeBell },
  worker:       { path: "/worker",       en: "Worker Dashboard",       ar: "لوحة تحكم العامل",     icon: HardHat },
  maintenance:  { path: "/maintenance",  en: "Maintenance Dashboard",  ar: "لوحة تحكم الصيانة",    icon: Wrench },
};

type Props = {
  locale: string;
  /** Dashboards this user may open, in order */
  tabs: TDashboardTab[];
  activeTab: TDashboardTab;
  showTasksList: boolean;
};

export default function DashboardQuickLinks({ locale, tabs, activeTab, showTasksList }: Props) {
  const isEn = locale === "en";
  const base = `/${locale}/admin/tasks`;

  const links: { key: string; href: string; label: string; icon: LucideIcon; active: boolean }[] = tabs.map((tab) => {
    const l = DASHBOARD_LINKS[tab];
    return { key: tab, href: `${base}${l.path}`, label: isEn ? l.en : l.ar, icon: l.icon, active: tab === activeTab };
  });
  if (showTasksList) {
    links.push({ key: "list", href: `${base}/list`, label: isEn ? "Tasks List" : "قائمة المهام", icon: List, active: false });
  }

  // A single link has nowhere to go
  if (links.length < 2) return null;

  return (
    <nav
      aria-label={isEn ? "Tasks dashboards" : "لوحات المهام"}
      className="flex items-center gap-2 overflow-x-auto hide-scrollbar"
    >
      {links.map(({ key, href, label, icon: Icon, active }) => (
        <Link
          key={key}
          href={href}
          aria-current={active ? "page" : undefined}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold whitespace-nowrap shrink-0 transition-colors ${
            active
              ? "bg-nassayem border-nassayem text-white shadow-sm"
              : "bg-white border-slate-200 text-slate-700 hover:border-nassayem/40 hover:text-nassayem"
          }`}
        >
          <Icon className="w-4 h-4 shrink-0" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
