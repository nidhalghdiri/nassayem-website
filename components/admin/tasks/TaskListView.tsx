"use client";

import { memo } from "react";
import { TASK_TYPE_CONFIG, TASK_PRIORITY_CONFIG } from "@/lib/tasks/constants";
import { STATUS_CONFIG, TERMINAL_STATUSES } from "@/lib/tasks/statuses";
import type { SerializedTask } from "./types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Props = {
  tasks: SerializedTask[];
  locale: string;
  onTaskClick: (id: string) => void;
};

const TaskListView = memo(function TaskListView({ tasks, locale, onTaskClick }: Props) {
  const isEn = locale === "en";

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg className="w-14 h-14 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-sm font-medium">{isEn ? "No tasks found" : "لا توجد مهام"}</p>
        <p className="text-xs mt-1">{isEn ? "Try adjusting your filters" : "حاول تعديل الفلاتر"}</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-start px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[35%]">
                {isEn ? "Task" : "المهمة"}
              </th>
              <th className="text-start px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {isEn ? "Building" : "المبنى"}
              </th>
              <th className="text-start px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {isEn ? "Assigned To" : "مُعيَّن إلى"}
              </th>
              <th className="text-start px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {isEn ? "Priority" : "الأولوية"}
              </th>
              <th className="text-start px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {isEn ? "Status" : "الحالة"}
              </th>
              <th className="text-start px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {isEn ? "Due" : "الموعد"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tasks.map((task) => {
              const typeConf = TASK_TYPE_CONFIG[task.type];
              const prioConf = TASK_PRIORITY_CONFIG[task.priority];
              const statusConf = STATUS_CONFIG[task.status];
              const isTerminal = TERMINAL_STATUSES.includes(task.status);
              const isOverdue = new Date(task.dueDate) < new Date() && !isTerminal;

              return (
                <tr
                  key={task.id}
                  onClick={() => onTaskClick(task.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-1 h-10 rounded-full shrink-0 ${typeConf.border.replace("border-", "bg-")}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${typeConf.bg} ${typeConf.text}`}>
                            {isEn ? typeConf.labelEn : typeConf.labelAr}
                          </span>
                        </div>
                        <p className="font-medium text-gray-800 line-clamp-1 text-sm">{task.title}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {task.building ? (
                      <div className="min-w-0">
                        <p className="truncate font-medium">{isEn ? task.building.nameEn : task.building.nameAr}</p>
                        {task.unit && (
                          <p className="text-gray-400 mt-0.5 flex items-center gap-1">
                            {task.unit.unitCode && (
                              <span className="shrink-0 px-1 py-0.5 bg-gray-50 text-gray-500 rounded text-[9px] font-mono font-bold border border-gray-100">
                                {task.unit.unitCode}
                              </span>
                            )}
                            <span className="truncate">{isEn ? task.unit.titleEn : task.unit.titleAr}</span>
                          </p>
                        )}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {task.assignedTo
                      ? (task.assignedTo.name ?? task.assignedTo.email.split("@")[0])
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${prioConf.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${prioConf.dot}`} />
                      {isEn ? prioConf.labelEn : prioConf.labelAr}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConf.badge}`}>
                      {isEn ? statusConf.labelEn : statusConf.labelAr}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-xs font-medium ${isOverdue ? "text-red-600" : "text-gray-500"}`}>
                    {isOverdue && <span className="me-0.5">⚠</span>}
                    {formatDate(task.dueDate)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {tasks.map((task) => {
          const typeConf = TASK_TYPE_CONFIG[task.type];
          const statusConf = STATUS_CONFIG[task.status];
          const prioConf = TASK_PRIORITY_CONFIG[task.priority];
          const isTerminal = TERMINAL_STATUSES.includes(task.status);
          const isOverdue = new Date(task.dueDate) < new Date() && !isTerminal;

          return (
            <div
              key={task.id}
              onClick={() => onTaskClick(task.id)}
              className={`bg-white rounded-xl border border-gray-200 p-4 shadow-sm cursor-pointer border-l-4 ${typeConf.border}`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeConf.bg} ${typeConf.text}`}>
                  {isEn ? typeConf.labelEn : typeConf.labelAr}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConf.badge}`}>
                  {isEn ? statusConf.labelEn : statusConf.labelAr}
                </span>
              </div>
              <p className="font-semibold text-gray-800 mb-1.5">{task.title}</p>
              {task.building && (
                <div className="text-xs text-gray-500 mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span>{isEn ? task.building.nameEn : task.building.nameAr}</span>
                  {task.unit && (
                    <span className="flex items-center gap-1 text-gray-400">
                      · 
                      {task.unit.unitCode && (
                        <span className="shrink-0 px-1 py-0.5 bg-gray-50 text-gray-500 rounded text-[9px] font-mono font-bold border border-gray-100 uppercase">
                          {task.unit.unitCode}
                        </span>
                      )}
                      {isEn ? task.unit.titleEn : task.unit.titleAr}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${prioConf.dot}`} />
                  <span className="text-gray-500">
                    {task.assignedTo?.name ?? task.assignedTo?.email.split("@")[0] ?? "—"}
                  </span>
                </div>
                <span className={isOverdue ? "text-red-600 font-medium" : "text-gray-400"}>
                  {isOverdue && "⚠ "}{formatDate(task.dueDate)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
});

export default TaskListView;
