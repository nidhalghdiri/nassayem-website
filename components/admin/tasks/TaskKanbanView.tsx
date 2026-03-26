"use client";

import TaskCard from "./TaskCard";
import type { SerializedTask } from "./types";
import type { TTaskStatus } from "@/lib/tasks/statuses";

type KanbanColumn = {
  id: string;
  labelEn: string;
  labelAr: string;
  statuses: TTaskStatus[];
  headerBg: string;
  dot: string;
};

const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: "approval",
    labelEn: "Pending Approval",
    labelAr: "قيد الموافقة",
    statuses: ["PENDING_APPROVAL"],
    headerBg: "bg-yellow-50 border-yellow-200",
    dot: "bg-yellow-400",
  },
  {
    id: "assigned",
    labelEn: "Assigned",
    labelAr: "مُعيَّن",
    statuses: ["ASSIGNED"],
    headerBg: "bg-blue-50 border-blue-200",
    dot: "bg-blue-400",
  },
  {
    id: "active",
    labelEn: "In Progress",
    labelAr: "جارٍ",
    statuses: ["CLEANING_STARTED", "INSPECTING", "WORK_STARTED", "IN_PROGRESS"],
    headerBg: "bg-orange-50 border-orange-200",
    dot: "bg-orange-400",
  },
  {
    id: "blocked",
    labelEn: "Issues / On Hold",
    labelAr: "مشاكل / معلق",
    statuses: ["ISSUES_FOUND", "ON_HOLD"],
    headerBg: "bg-red-50 border-red-200",
    dot: "bg-red-400",
  },
  {
    id: "done",
    labelEn: "Done",
    labelAr: "مكتمل",
    statuses: ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED"],
    headerBg: "bg-green-50 border-green-200",
    dot: "bg-green-500",
  },
  {
    id: "cancelled",
    labelEn: "Cancelled",
    labelAr: "ملغي",
    statuses: ["CANCELLED"],
    headerBg: "bg-gray-50 border-gray-200",
    dot: "bg-gray-400",
  },
];

type Props = {
  tasks: SerializedTask[];
  locale: string;
  onTaskClick: (id: string) => void;
};

export default function TaskKanbanView({ tasks, locale, onTaskClick }: Props) {
  const isEn = locale === "en";

  // Group tasks by status
  const tasksByStatus = new Map<TTaskStatus, SerializedTask[]>();
  for (const task of tasks) {
    const existing = tasksByStatus.get(task.status) ?? [];
    tasksByStatus.set(task.status, [...existing, task]);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "calc(100vh - 320px)" }}>
      {KANBAN_COLUMNS.map((col) => {
        const colTasks = col.statuses.flatMap((s) => tasksByStatus.get(s) ?? []);

        return (
          <div key={col.id} className="flex-shrink-0 w-72">
            {/* Column header */}
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border mb-3 ${col.headerBg}`}>
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${col.dot}`} />
              <span className="text-sm font-semibold text-gray-700 flex-1">
                {isEn ? col.labelEn : col.labelAr}
              </span>
              <span className="text-xs font-medium text-gray-500 bg-white/80 px-2 py-0.5 rounded-full border border-white/60">
                {colTasks.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-3">
              {colTasks.length === 0 ? (
                <div className="text-center py-10 text-gray-300 border-2 border-dashed border-gray-200 rounded-xl">
                  <svg className="w-8 h-8 mx-auto mb-1.5 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-xs">{isEn ? "No tasks" : "لا توجد مهام"}</p>
                </div>
              ) : (
                colTasks.map((task) => (
                  <TaskCard key={task.id} task={task} locale={locale} onClick={onTaskClick} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
