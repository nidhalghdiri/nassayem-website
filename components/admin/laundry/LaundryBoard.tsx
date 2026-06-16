"use client";

import { useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import LaundryCard from "./LaundryCard";
import { LAUNDRY_STATUS_CONFIG, type TLaundryStatus } from "@/lib/laundry/constants";
import { TASK_PRIORITY_CONFIG } from "@/lib/tasks/constants";
import { canCreateLaundryOrder, canManageLaundryItems } from "@/lib/laundry/permissions";
import { isTerminalLaundryStatus } from "@/lib/laundry/workflow";
import type { SerializedLaundryOrder, Building } from "./types";
import type { TStaffRole } from "@/lib/tasks/constants";

type Props = {
  orders: SerializedLaundryOrder[];
  buildings: Building[];
  locale: string;
  currentUserRole: string;
};

// Display order of the status sections in the pipeline.
const SECTION_ORDER: TLaundryStatus[] = [
  "REQUESTED",
  "PICKED_UP",
  "AT_LAUNDRY",
  "PROCESSING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
];

export default function LaundryBoard({
  orders,
  buildings,
  locale,
  currentUserRole,
}: Props) {
  const isEn = locale === "en";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const role = currentUserRole as TStaffRole;

  const currentStatus = searchParams.get("status") ?? "";
  const currentPriority = searchParams.get("priority") ?? "";
  const currentBuilding = searchParams.get("buildingId") ?? "";
  const currentSearch = searchParams.get("search") ?? "";
  const hasActiveFilters = !!(currentStatus || currentPriority || currentBuilding || currentSearch);

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(window.location.search);
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname],
  );

  const clearFilters = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  // Group orders by status, preserving the incoming (createdAt desc) order.
  const grouped = useMemo(() => {
    const map = new Map<string, SerializedLaundryOrder[]>();
    for (const o of orders) {
      const arr = map.get(o.status) ?? [];
      arr.push(o);
      map.set(o.status, arr);
    }
    return map;
  }, [orders]);

  const activeCount = orders.filter((o) => !isTerminalLaundryStatus(o.status as TLaundryStatus)).length;
  const missingCount = orders.filter((o) => o.hasDiscrepancy).length;

  const statCards = [
    {
      labelEn: "Open Orders",
      labelAr: "الطلبات المفتوحة",
      value: activeCount,
      color: "text-blue-700",
      bg: "bg-blue-50",
      border: "border-blue-100",
      iconPath: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
    },
    {
      labelEn: "With Discrepancy",
      labelAr: "بها نقص",
      value: missingCount,
      color: missingCount > 0 ? "text-red-700" : "text-gray-400",
      bg: missingCount > 0 ? "bg-red-50" : "bg-gray-50",
      border: missingCount > 0 ? "border-red-100" : "border-gray-100",
      iconPath: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEn ? "Laundry" : "المغسلة"}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {orders.length} {isEn ? (orders.length === 1 ? "order" : "orders") : "طلب"}
            {hasActiveFilters && (
              <span className="ms-1.5 text-nassayem font-medium">· {isEn ? "filtered" : "مُصفَّى"}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canManageLaundryItems(role) && (
            <button
              onClick={() => router.push(`${pathname}/items`)}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span className="hidden sm:inline">{isEn ? "Manage Items" : "إدارة الأصناف"}</span>
            </button>
          )}
          {canCreateLaundryOrder(role) && (
            <button
              onClick={() => router.push(`${pathname}/new`)}
              className="flex items-center gap-1.5 bg-nassayem text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-nassayem/90 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">{isEn ? "New Request" : "طلب جديد"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((s) => (
          <div key={s.labelEn} className={`${s.bg} border ${s.border} rounded-xl p-4 flex items-center gap-3`}>
            <div className={`${s.color} shrink-0`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={s.iconPath} />
              </svg>
            </div>
            <div>
              <p className={`text-2xl font-bold leading-none ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{isEn ? s.labelEn : s.labelAr}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <svg className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              defaultValue={currentSearch}
              placeholder={isEn ? "Search by code…" : "ابحث بالرمز…"}
              className="w-full ps-9 pe-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
              onKeyDown={(e) => {
                if (e.key === "Enter") updateFilter("search", (e.target as HTMLInputElement).value.trim());
              }}
              onBlur={(e) => updateFilter("search", e.target.value.trim())}
            />
          </div>

          <select
            value={currentStatus}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
          >
            <option value="">{isEn ? "All Statuses" : "كل الحالات"}</option>
            {SECTION_ORDER.map((s) => (
              <option key={s} value={s}>
                {isEn ? LAUNDRY_STATUS_CONFIG[s].labelEn : LAUNDRY_STATUS_CONFIG[s].labelAr}
              </option>
            ))}
          </select>

          <select
            value={currentPriority}
            onChange={(e) => updateFilter("priority", e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
          >
            <option value="">{isEn ? "All Priorities" : "كل الأولويات"}</option>
            {Object.entries(TASK_PRIORITY_CONFIG).map(([key, conf]) => (
              <option key={key} value={key}>{isEn ? conf.labelEn : conf.labelAr}</option>
            ))}
          </select>

          {buildings.length > 0 && (
            <select
              value={currentBuilding}
              onChange={(e) => updateFilter("buildingId", e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
            >
              <option value="">{isEn ? "All Buildings" : "كل المباني"}</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{isEn ? b.nameEn : b.nameAr}</option>
              ))}
            </select>
          )}

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors font-medium"
            >
              {isEn ? "Clear filters" : "مسح الفلاتر"}
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {orders.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6V4m0 2a6 6 0 016 6c0 3.314-2.686 6-6 6s-6-2.686-6-6a6 6 0 016-6zm0 0v0" />
          </svg>
          <p className="text-sm text-gray-500 mt-3">
            {isEn ? "No laundry orders yet." : "لا توجد طلبات غسيل بعد."}
          </p>
        </div>
      )}

      {/* Grouped sections */}
      {SECTION_ORDER.map((statusKey) => {
        const list = grouped.get(statusKey);
        if (!list || list.length === 0) return null;
        const conf = LAUNDRY_STATUS_CONFIG[statusKey];
        return (
          <section key={statusKey} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${conf.badge}`}>
                {isEn ? conf.labelEn : conf.labelAr}
              </span>
              <span className="text-xs text-gray-400 font-medium">{list.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((order) => (
                <LaundryCard key={order.id} order={order} locale={locale} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
