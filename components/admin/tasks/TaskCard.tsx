"use client";

import { TASK_TYPE_CONFIG, TASK_PRIORITY_CONFIG } from "@/lib/tasks/constants";
import { STATUS_CONFIG, TERMINAL_STATUSES } from "@/lib/tasks/statuses";
import type { SerializedTask } from "./types";

function formatDueDate(iso: string): { label: string; isOverdue: boolean } {
  const d = new Date(iso);
  const isOverdue = d < new Date();
  const label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return { label, isOverdue };
}

function getInitials(name: string | null, email: string): string {
  if (name) return name.slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

type Props = {
  task: SerializedTask;
  locale: string;
  onClick: (id: string) => void;
};

export default function TaskCard({ task, locale, onClick }: Props) {
  const isEn = locale === "en";
  const typeConf = TASK_TYPE_CONFIG[task.type];
  const prioConf = TASK_PRIORITY_CONFIG[task.priority];
  const statusConf = STATUS_CONFIG[task.status];
  const { label: dueLabel, isOverdue } = formatDueDate(task.dueDate);
  const isTerminal = TERMINAL_STATUSES.includes(task.status);

  return (
    <div
      onClick={() => onClick(task.id)}
      className={`
        bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md
        cursor-pointer transition-all duration-200 overflow-hidden
        border-l-4 ${typeConf.border}
        ${isTerminal ? "opacity-70" : ""}
      `}
    >
      <div className="p-3.5 space-y-2.5">
        {/* Type + Priority dot */}
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeConf.bg} ${typeConf.text}`}>
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={typeConf.iconPath} />
            </svg>
            {isEn ? typeConf.labelEn : typeConf.labelAr}
          </span>
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${prioConf.dot}`}
            title={isEn ? prioConf.labelEn : prioConf.labelAr}
          />
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug">
          {task.title}
        </p>

        {/* Building / Unit */}
        {task.building && (
          <p className="text-xs text-gray-500 truncate">
            {isEn ? task.building.nameEn : task.building.nameAr}
            {task.unit && (
              <span className="text-gray-400"> · {isEn ? task.unit.titleEn : task.unit.titleAr}</span>
            )}
          </p>
        )}

        {/* Assignee + Due date */}
        <div className="flex items-center justify-between pt-0.5">
          {task.assignedTo ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-6 h-6 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                {getInitials(task.assignedTo.name, task.assignedTo.email)}
              </div>
              <span className="text-xs text-gray-500 truncate max-w-[80px]">
                {task.assignedTo.name ?? task.assignedTo.email.split("@")[0]}
              </span>
            </div>
          ) : (
            <span />
          )}
          <span className={`text-xs font-medium shrink-0 ${isOverdue && !isTerminal ? "text-red-600" : "text-gray-400"}`}>
            {isOverdue && !isTerminal && "⚠ "}
            {dueLabel}
          </span>
        </div>

        {/* Status + attachment counts */}
        <div className="flex items-center justify-between">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConf.badge}`}>
            {isEn ? statusConf.labelEn : statusConf.labelAr}
          </span>
          {(task._count.notes > 0 || task._count.photos > 0) && (
            <div className="flex items-center gap-2 text-gray-400">
              {task._count.notes > 0 && (
                <span className="flex items-center gap-0.5 text-xs">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {task._count.notes}
                </span>
              )}
              {task._count.photos > 0 && (
                <span className="flex items-center gap-0.5 text-xs">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {task._count.photos}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
