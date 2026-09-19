"use client";

import { memo } from "react";
import { TASK_TYPE_CONFIG, TASK_PRIORITY_CONFIG } from "@/lib/tasks/constants";
import { STATUS_CONFIG, TERMINAL_STATUSES } from "@/lib/tasks/statuses";
import { buildingLabel } from "@/lib/buildingLabel";
import type { SerializedTask } from "./types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
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

  if (!tasks || tasks.length === 0) {
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
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-100 shadow-sm bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/80 border-b border-gray-100 backdrop-blur-sm">
            <tr>
              <th className="text-start px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[35%]">
                {isEn ? "Task details" : "تفاصيل المهمة"}
              </th>
              <th className="text-start px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {isEn ? "Location" : "الموقع"}
              </th>
              <th className="text-start px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {isEn ? "Assignee" : "المُعيَّن"}
              </th>
              <th className="text-start px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {isEn ? "Priority" : "الأولوية"}
              </th>
              <th className="text-start px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {isEn ? "Status" : "الحالة"}
              </th>
              <th className="text-start px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                {isEn ? "Progress" : "التقدم"}
              </th>
              <th className="text-start px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {isEn ? "Due Date" : "الموعد"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
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
                  className="hover:bg-gray-50/80 cursor-pointer transition-all group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-1.5 h-10 rounded-full shrink-0 mt-0.5 shadow-sm ${typeConf.border.replace("border-", "bg-")}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase ${typeConf.bg} ${typeConf.text}`}>
                            {isEn ? typeConf.labelEn : typeConf.labelAr}
                          </span>
                        </div>
                        <p className="font-semibold text-gray-900 line-clamp-1 group-hover:text-nassayem transition-colors">{task.title}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {task.building ? (
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">{buildingLabel(task.building, isEn)}</p>
                        {(task.unit?.name || task.unitNumber) && (
                          <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200 shadow-sm">
                            <svg className="w-3 h-3 me-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                            {task.unit?.name || task.unitNumber}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {task.assignedTo ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-nassayem/10 flex items-center justify-center text-nassayem font-bold text-xs uppercase shadow-sm border border-nassayem/20">
                          {(task.assignedTo.name ?? task.assignedTo.email).charAt(0)}
                        </div>
                        <span className="font-medium text-gray-700 text-sm">
                          {task.assignedTo.name ?? task.assignedTo.email.split("@")[0]}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-sm border border-white/50 ${prioConf.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${prioConf.dot} shadow-sm`} />
                      {isEn ? prioConf.labelEn : prioConf.labelAr}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-lg text-[11px] font-bold tracking-wider uppercase shadow-sm border border-white/50 ${statusConf.badge}`}>
                      {isEn ? statusConf.labelEn : statusConf.labelAr}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">{isEn ? "Progress" : "تقدم"}</span>
                        <span className="text-[10px] font-bold text-gray-700">
                          {isTerminal ? "100%" : task.status !== "ASSIGNED" && task.status !== "ON_HOLD" ? "50%" : "0%"}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden shadow-inner">
                        <div 
                          className={`h-full transition-all duration-700 ease-out ${
                            isTerminal 
                              ? (task.status === "CANCELLED" ? "bg-red-500" : "bg-emerald-500") 
                              : (task.status !== "ASSIGNED" && task.status !== "ON_HOLD" ? "bg-blue-500" : "bg-gray-300")
                          }`} 
                          style={{ width: isTerminal ? "100%" : task.status !== "ASSIGNED" && task.status !== "ON_HOLD" ? "50%" : "0%" }} 
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`flex items-center gap-1.5 text-sm font-semibold ${isOverdue ? "text-red-600 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100 inline-flex" : "text-gray-600"}`}>
                      {isOverdue && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
                      {formatDate(task.dueDate)}
                    </div>
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
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase ${statusConf.badge}`}>
                  {isEn ? statusConf.labelEn : statusConf.labelAr}
                </span>
              </div>
              <p className="font-semibold text-gray-800 mb-1.5">{task.title}</p>
              {task.building && (
                <div className="text-xs text-gray-500 mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span>{buildingLabel(task.building, isEn)}</span>
                  {(task.unit?.name || task.unitNumber) && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-semibold bg-nassayem/10 text-nassayem">
                      {task.unit?.name || task.unitNumber}
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
              <div className="pt-2 mt-3 border-t border-gray-50">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {isEn ? "Progress" : "التقدم"}
                  </span>
                  <span className="text-[10px] font-bold text-gray-500">
                    {isTerminal ? "100%" : task.status !== "ASSIGNED" && task.status !== "ON_HOLD" ? "50%" : "0%"}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      isTerminal 
                        ? (task.status === "CANCELLED" ? "bg-red-400" : "bg-green-500") 
                        : (task.status !== "ASSIGNED" && task.status !== "ON_HOLD" ? "bg-blue-500" : "bg-gray-300")
                    }`} 
                    style={{ width: isTerminal ? "100%" : task.status !== "ASSIGNED" && task.status !== "ON_HOLD" ? "50%" : "0%" }} 
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
});

export default TaskListView;
