"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function AdminSidebar({ locale }: { locale: string }) {
  const pathname = usePathname();
  const isEn = locale === "en";
  const [isOpen, setIsOpen] = useState(false);

  // Define our admin routes
  const navItems = [
    {
      nameEn: "Dashboard",
      nameAr: "لوحة القيادة",
      href: `/${locale}/admin`,
      icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    },
    {
      nameEn: "Buildings",
      nameAr: "المباني",
      href: `/${locale}/admin/buildings`,
      icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    },
    {
      nameEn: "Units",
      nameAr: "الوحدات",
      href: `/${locale}/admin/units`,
      icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", // We'll refine icons later
    },
    {
      nameEn: "Bookings",
      nameAr: "الحجوزات",
      href: `/${locale}/admin/bookings`,
      icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    },
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden bg-gray-900 text-white p-4 flex justify-between items-center sticky top-0 z-50">
        <span className="font-bold text-lg">Nassayem Admin</span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="focus:outline-none"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
            />
          </svg>
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`
        fixed inset-y-0 start-0 z-40 w-64 bg-gray-900 text-gray-300 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        ${!isEn && !isOpen ? "translate-x-full" : ""} 
      `}
      >
        <div className="h-full flex flex-col">
          {/* Admin Brand Area */}
          <div className="h-16 flex items-center px-6 bg-gray-950 border-b border-gray-800">
            <span className="text-xl font-bold text-white tracking-wide">
              {isEn ? "Nassayem " : "نسائم "}
              <span className="text-nassayem">
                {isEn ? "Admin" : "للإدارة"}
              </span>
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              // Check if the current path matches the link exactly, or if it's a sub-page
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200
                    ${
                      isActive
                        ? "bg-nassayem text-white shadow-md"
                        : "hover:bg-gray-800 hover:text-white"
                    }
                  `}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d={item.icon}
                    />
                  </svg>
                  {isEn ? item.nameEn : item.nameAr}
                </Link>
              );
            })}
          </nav>

          {/* User / Exit Area */}
          <div className="p-4 border-t border-gray-800">
            <Link
              href={`/${locale}`}
              className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              {isEn ? "Back to Website" : "العودة للموقع"}
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
