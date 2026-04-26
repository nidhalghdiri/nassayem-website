"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAdmin } from "@/app/actions/auth";
import AdminLocaleSwitcher from "./AdminLocaleSwitcher";

type Props = {
  locale: string;
  userEmail?: string;
  userRole?: string;
};

// ── Which nav items each role can see ──────────────────────────────────────────
// MANAGER      : everything
// SUPERVISOR   : Dashboard, Buildings (view), Units (view), Tasks
// RECEPTIONIST : Dashboard, Tasks
// HOUSEKEEPING : Dashboard, Tasks
// MAINTENANCE  : Dashboard, Tasks
const ROLE_NAV_ACCESS: Record<string, string[]> = {
  MANAGER:      ["dashboard", "buildings", "units", "bookings", "tasks", "blog", "users", "settings"],
  SUPERVISOR:   ["dashboard", "buildings", "units", "tasks"],
  RECEPTIONIST: ["dashboard", "tasks"],
  HOUSEKEEPING: ["dashboard", "tasks"],
  MAINTENANCE:  ["dashboard", "tasks"],
};

export default function AdminSidebar({ locale, userEmail, userRole = "MANAGER" }: Props) {
  const pathname = usePathname();
  const isEn = locale === "en";
  const [isOpen, setIsOpen] = useState(false);

  const allowedKeys = ROLE_NAV_ACCESS[userRole] ?? ROLE_NAV_ACCESS["MANAGER"];

  const allNavItems = [
    {
      key: "dashboard",
      nameEn: "Dashboard",
      nameAr: "لوحة القيادة",
      href: `/${locale}/admin`,
      exact: true,
      icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    },
    {
      key: "buildings",
      nameEn: "Buildings",
      nameAr: "المباني",
      href: `/${locale}/admin/buildings`,
      exact: false,
      icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    },
    {
      key: "units",
      nameEn: "Units",
      nameAr: "الوحدات",
      href: `/${locale}/admin/units`,
      exact: false,
      icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
    },
    {
      key: "bookings",
      nameEn: "Bookings",
      nameAr: "الحجوزات",
      href: `/${locale}/admin/bookings`,
      exact: false,
      icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    },
    {
      key: "tasks",
      nameEn: "Tasks",
      nameAr: "المهام",
      href: `/${locale}/admin/tasks`,
      exact: false,
      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    },
    {
      key: "blog",
      nameEn: "Blog",
      nameAr: "المدونة",
      href: `/${locale}/admin/blog`,
      exact: false,
      icon: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z M14 2v4a2 2 0 002 2h4 M10 9H8m2 4H8m5 4h-5",
    },
    {
      key: "users",
      nameEn: "Users",
      nameAr: "المستخدمون",
      href: `/${locale}/admin/users`,
      exact: false,
      icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    },
    {
      key: "settings",
      nameEn: "Settings",
      nameAr: "الإعدادات",
      href: `/${locale}/admin/settings`,
      exact: false,
      icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    },
  ];

  const navItems = allNavItems.filter((item) => allowedKeys.includes(item.key));

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden bg-gray-900 text-white px-4 py-3 flex justify-between items-center sticky top-0 z-50">
        <span className="font-bold text-base">
          Nassayem <span className="text-nassayem">Admin</span>
        </span>
        <div className="flex items-center gap-2">
          <AdminLocaleSwitcher locale={locale} />
          <button onClick={() => setIsOpen(!isOpen)} className="focus:outline-none p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Sidebar panel */}
      <aside
        className={`
          fixed inset-y-0 start-0 z-40 w-64 bg-gray-900 text-gray-300
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:inset-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${!isEn && !isOpen ? "translate-x-full" : ""}
        `}
      >
        <div className="h-full flex flex-col">
          {/* Brand */}
          <div className="h-16 flex items-center px-6 bg-gray-950 border-b border-gray-800 shrink-0">
            <span className="text-xl font-bold text-white tracking-wide">
              {isEn ? "Nassayem " : "نسائم "}
              <span className="text-nassayem">{isEn ? "Admin" : "للإدارة"}</span>
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 text-sm
                    ${isActive
                      ? "bg-nassayem text-white shadow-md"
                      : "hover:bg-gray-800 hover:text-white text-gray-400"
                    }
                  `}
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                  </svg>
                  {isEn ? item.nameEn : item.nameAr}
                </Link>
              );
            })}
          </nav>

          {/* Bottom: user info + actions */}
          <div className="p-3 border-t border-gray-800 space-y-1 shrink-0">
            {/* User email (shown when we know it) */}
            {userEmail && (
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl">
                <div className="w-8 h-8 bg-nassayem text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                  {userEmail.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-gray-400 truncate">{userEmail}</span>
              </div>
            )}

            {/* Back to website */}
            <Link
              href={`/${locale}`}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all text-sm"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {isEn ? "View Website" : "عرض الموقع"}
            </Link>

            {/* Sign out — available on mobile where the header bar is hidden */}
            <form action={logoutAdmin} className="lg:hidden">
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-gray-400 hover:bg-red-900/40 hover:text-red-400 transition-all text-sm"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {isEn ? "Sign Out" : "تسجيل الخروج"}
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
