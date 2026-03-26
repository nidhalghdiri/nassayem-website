"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import TaskKanbanView from "./TaskKanbanView";
import TaskListView from "./TaskListView";
import { TASK_TYPE_CONFIG, TASK_PRIORITY_CONFIG } from "@/lib/tasks/constants";
import type { SerializedTask, Building, StaffUser } from "./types";

type Stats = {
  total: number;
  pendingApproval: number;
  active: number;
  overdue: number;
} | null;

type Props = {
  tasks: SerializedTask[];
  buildings: Building[];
  staffUsers: StaffUser[];
  stats: Stats;
  locale: string;
  currentUserId: string;
  currentUserRole: string;
};

export default function TaskBoard({
  tasks,
  buildings,
  staffUsers,
  stats,
  locale,
  currentUserRole,
}: Props) {
  const isEn = locale === "en";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const currentType = searchParams.get("type") ?? "";
  const currentPriority = searchParams.get("priority") ?? "";
  const currentAssignedTo = searchParams.get("assignedToId") ?? "";
  const currentSearch = searchParams.get("search") ?? "";
  const hasActiveFilters = !!(currentType || currentPriority || currentAssignedTo || currentSearch);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    router.push(pathname);
  }

  // Clicking a task stores taskId in URL — Phase 4 will read this to open the panel
  const handleTaskClick = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("taskId", id);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const statCards = stats
    ? [
        {
          labelEn: "Active Tasks",
          labelAr: "المهام النشطة",
          value: stats.total,
          iconPath:
            "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
          color: "text-blue-700",
          bg: "bg-blue-50",
          border: "border-blue-100",
        },
        {
          labelEn: "Pending Approval",
          labelAr: "قيد الموافقة",
          value: stats.pendingApproval,
          iconPath: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
          color: "text-yellow-700",
          bg: "bg-yellow-50",
          border: "border-yellow-100",
        },
        {
          labelEn: "In Progress",
          labelAr: "جارٍ العمل",
          value: stats.active,
          iconPath: "M13 10V3L4 14h7v7l9-11h-7z",
          color: "text-orange-700",
          bg: "bg-orange-50",
          border: "border-orange-100",
        },
        {
          labelEn: "Overdue",
          labelAr: "متأخرة",
          value: stats.overdue,
          iconPath:
            "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
          color: stats.overdue > 0 ? "text-red-700" : "text-gray-400",
          bg: stats.overdue > 0 ? "bg-red-50" : "bg-gray-50",
          border: stats.overdue > 0 ? "border-red-100" : "border-gray-100",
        },
      ]
    : [];

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEn ? "Tasks" : "المهام"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tasks.length} {isEn ? (tasks.length === 1 ? "task" : "tasks") : "مهمة"}
            {hasActiveFilters && (
              <span className="ms-1.5 text-nassayem font-medium">
                · {isEn ? "filtered" : "مُصفَّى"}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Kanban / List toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <button
              onClick={() => setView("kanban")}
              title={isEn ? "Kanban" : "كانبان"}
              className={`px-3 py-2 transition-colors ${
                view === "kanban"
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
            </button>
            <button
              onClick={() => setView("list")}
              title={isEn ? "List" : "قائمة"}
              className={`px-3 py-2 transition-colors ${
                view === "list"
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* New Task — wired up in Phase 3 */}
          <button
            onClick={() => router.push(`${pathname}/new`)}
            className="flex items-center gap-1.5 bg-nassayem text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-nassayem/90 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">{isEn ? "New Task" : "مهمة جديدة"}</span>
          </button>
        </div>
      </div>

      {/* ── Manager stats ────────────────────────────────────────────────── */}
      {statCards.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((s) => (
            <div
              key={s.labelEn}
              className={`${s.bg} border ${s.border} rounded-xl p-4 flex items-center gap-3`}
            >
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
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <svg
              className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              key={currentSearch}
              defaultValue={currentSearch}
              placeholder={isEn ? "Search tasks…" : "ابحث عن مهمة…"}
              className="w-full ps-9 pe-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  updateFilter("search", (e.target as HTMLInputElement).value.trim());
              }}
              onBlur={(e) => updateFilter("search", e.target.value.trim())}
            />
          </div>

          {/* Type */}
          <select
            value={currentType}
            onChange={(e) => updateFilter("type", e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
          >
            <option value="">{isEn ? "All Types" : "كل الأنواع"}</option>
            {(Object.entries(TASK_TYPE_CONFIG) as [string, typeof TASK_TYPE_CONFIG[keyof typeof TASK_TYPE_CONFIG]][]).map(
              ([key, conf]) => (
                <option key={key} value={key}>
                  {isEn ? conf.labelEn : conf.labelAr}
                </option>
              ),
            )}
          </select>

          {/* Priority */}
          <select
            value={currentPriority}
            onChange={(e) => updateFilter("priority", e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
          >
            <option value="">{isEn ? "All Priorities" : "كل الأولويات"}</option>
            {(Object.entries(TASK_PRIORITY_CONFIG) as [string, typeof TASK_PRIORITY_CONFIG[keyof typeof TASK_PRIORITY_CONFIG]][]).map(
              ([key, conf]) => (
                <option key={key} value={key}>
                  {isEn ? conf.labelEn : conf.labelAr}
                </option>
              ),
            )}
          </select>

          {/* Assigned-to (Manager only) */}
          {currentUserRole === "MANAGER" && staffUsers.length > 0 && (
            <select
              value={currentAssignedTo}
              onChange={(e) => updateFilter("assignedToId", e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
            >
              <option value="">{isEn ? "All Staff" : "كل الموظفين"}</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email.split("@")[0]}
                </option>
              ))}
            </select>
          )}

          {/* Clear */}
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

      {/* ── Board ────────────────────────────────────────────────────────── */}
      {view === "kanban" ? (
        <TaskKanbanView tasks={tasks} locale={locale} onTaskClick={handleTaskClick} />
      ) : (
        <TaskListView tasks={tasks} locale={locale} onTaskClick={handleTaskClick} />
      )}
    </div>
  );
}
