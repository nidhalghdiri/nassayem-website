"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, Search, Clock, Image as ImageIcon, User, ChevronRight, CheckCircle2 } from "lucide-react";
import type { DashboardTask } from "@/lib/reports/receptionistDashboard";
import { TASK_TYPE_CONFIG, TASK_PRIORITY_CONFIG, STAFF_ROLE_CONFIG } from "@/lib/tasks/constants";
import type { TTaskType, TTaskPriority, TStaffRole } from "@/lib/tasks/constants";
import { STATUS_CONFIG, TERMINAL_STATUSES } from "@/lib/tasks/statuses";
import type { TTaskStatus } from "@/lib/tasks/statuses";
import { formatDateTimeOman, formatTimeAgo } from "../../timeUtils";

type Props = {
  isEn: boolean;
  title: string;
  /** Tailwind classes for the header accent (icon bubble). */
  accentClass: string;
  tasks: DashboardTask[];
  /** Review lists show when the work was completed instead of when it was created. */
  showCompletedAt?: boolean;
  onClose: () => void;
  onOpenTask: (id: string) => void;
};

export default function TaskListModal({ isEn, title, accentClass, tasks, showCompletedAt = false, onClose, onOpenTask }: Props) {
  const [query, setQuery] = useState("");

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) =>
      [t.taskTitle, t.unitName ?? "", t.assignedUserName, t.buildingName, t.buildingNameEn]
        .some((v) => v.toLowerCase().includes(q)),
    );
  }, [tasks, query]);

  const t = {
    search: isEn ? "Search by title, unit or staff…" : "ابحث بالعنوان أو الوحدة أو الموظف…",
    noTasks: isEn ? "No tasks found." : "لا توجد مهام.",
    due: isEn ? "Due" : "الاستحقاق",
    overdue: isEn ? "Overdue" : "متأخرة",
    created: isEn ? "Created" : "أُنشئت",
    completed: isEn ? "Completed" : "اكتملت",
    tasks: isEn ? "tasks" : "مهمة",
    unassigned: isEn ? "Unassigned" : "غير معيّن",
  };

  const now = Date.now();

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accentClass}`}>
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-800 truncate">{title}</h2>
              <p className="text-xs text-slate-500">{filtered.length} {t.tasks}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        {tasks.length > 5 && (
          <div className="px-5 py-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.search}
                className="w-full ps-9 pe-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
              />
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-slate-50/40">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-500">{t.noTasks}</div>
          ) : (
            filtered.map((task) => {
              const type = TASK_TYPE_CONFIG[task.taskType as TTaskType];
              const status = STATUS_CONFIG[task.status as TTaskStatus];
              const priority = TASK_PRIORITY_CONFIG[task.priority as TTaskPriority];
              const role = STAFF_ROLE_CONFIG[task.assignedUserRole as TStaffRole];
              const isOpen = !TERMINAL_STATUSES.includes(task.status as TTaskStatus);
              const isOverdue = isOpen && new Date(task.dueDate).getTime() < now;
              const refTime = showCompletedAt ? task.completedAt : task.createdAt;
              const refMins = Math.max(0, Math.round((now - new Date(refTime).getTime()) / 60000));

              return (
                <button
                  key={task.id}
                  onClick={() => onOpenTask(task.id)}
                  className={`w-full text-start bg-white border rounded-xl p-4 hover:border-nassayem/40 hover:shadow-sm transition-all group ${isOverdue ? "border-red-200" : "border-slate-100"}`}
                >
                  {/* Row 1: type + title + status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {type && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${type.bg} ${type.text}`}>
                            {isEn ? type.labelEn : type.labelAr}
                          </span>
                        )}
                        <h3 className="font-bold text-sm text-slate-800 truncate">{task.taskTitle}</h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        {isEn ? task.buildingNameEn : task.buildingName}
                        {task.unitName ? ` — ${task.unitName}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {status && (
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${status.badge}`}>
                          {isEn ? status.labelEn : status.labelAr}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-nassayem rtl:rotate-180" />
                    </div>
                  </div>

                  {/* Row 2: details */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      <span className="font-semibold text-slate-700">{task.assignedUserName || t.unassigned}</span>
                      {role && <span className="text-slate-400">· {isEn ? role.labelEn : role.labelAr}</span>}
                    </span>

                    <span className={`flex items-center gap-1 ${isOverdue ? "text-red-600 font-bold" : ""}`}>
                      <Clock className="w-3.5 h-3.5" />
                      {t.due}: {formatDateTimeOman(task.dueDate, isEn)}
                      {isOverdue && (
                        <span className="ms-1 bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold">{t.overdue}</span>
                      )}
                    </span>

                    {priority && (
                      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium ${priority.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                        {isEn ? priority.labelEn : priority.labelAr}
                      </span>
                    )}

                    <span className="flex items-center gap-1">
                      {showCompletedAt ? t.completed : t.created}: {formatTimeAgo(refMins, isEn)}
                    </span>

                    {task.photoCount > 0 && (
                      <span className="flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5" />
                        {task.photoCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
