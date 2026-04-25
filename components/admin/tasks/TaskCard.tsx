"use client";

import { useState, memo } from "react";
import { TASK_TYPE_CONFIG, TASK_PRIORITY_CONFIG } from "@/lib/tasks/constants";
import { STATUS_CONFIG, STATUS_TRANSITIONS, TRANSITION_BUTTON_LABEL, TERMINAL_STATUSES } from "@/lib/tasks/statuses";
import type { SerializedTask } from "./types";
import type { TTaskStatus } from "@/lib/tasks/statuses";

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
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, task: SerializedTask) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  /** Called from mobile move menu — only passed when in kanban view */
  onMobileMove?: (taskId: string, newStatus: TTaskStatus) => void;
};

const TaskCard = memo(function TaskCard({
  task,
  locale,
  onClick,
  isDragging = false,
  onDragStart,
  onDragEnd,
  onMobileMove,
}: Props) {
  const isEn = locale === "en";
  const typeConf = TASK_TYPE_CONFIG[task.type];
  const prioConf = TASK_PRIORITY_CONFIG[task.priority];
  const statusConf = STATUS_CONFIG[task.status as TTaskStatus];
  const { label: dueLabel, isOverdue } = formatDueDate(task.dueDate);
  const isTerminal = TERMINAL_STATUSES.includes(task.status as TTaskStatus);
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const validMoveTargets: TTaskStatus[] = isTerminal
    ? []
    : ((STATUS_TRANSITIONS as Record<string, Record<string, TTaskStatus[]>>)[
        task.type
      ]?.[task.status] ?? []);

  function handleCardClick(e: React.MouseEvent) {
    // Don't open detail panel if clicking the move menu button
    if ((e.target as HTMLElement).closest("[data-move-btn]")) return;
    onClick(task.id);
  }

  return (
    <div
      draggable={!!onDragStart && !isTerminal}
      onDragStart={onDragStart ? (e) => onDragStart(e, task) : undefined}
      onDragEnd={onDragEnd}
      onClick={handleCardClick}
      className={`
        bg-white rounded-xl border border-gray-200 shadow-sm
        cursor-pointer transition-all duration-200 overflow-hidden
        border-l-4 ${typeConf.border}
        ${isTerminal ? "opacity-70" : ""}
        ${isDragging ? "rotate-1 shadow-lg scale-[1.02]" : "hover:shadow-md"}
        ${onDragStart && !isTerminal ? "cursor-grab active:cursor-grabbing" : ""}
      `}
    >
      <div className="p-3.5 space-y-2.5">
        {/* Type + Priority dot + drag grip */}
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeConf.bg} ${typeConf.text}`}>
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={typeConf.iconPath} />
            </svg>
            {isEn ? typeConf.labelEn : typeConf.labelAr}
          </span>
          <div className="flex items-center gap-2">
            {/* Drag grip — desktop hint */}
            {onDragStart && !isTerminal && (
              <svg className="w-3.5 h-3.5 text-gray-300 hidden sm:block" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="9" cy="7" r="1.5" /><circle cx="15" cy="7" r="1.5" />
                <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="17" r="1.5" /><circle cx="15" cy="17" r="1.5" />
              </svg>
            )}
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${prioConf.dot}`}
              title={isEn ? prioConf.labelEn : prioConf.labelAr}
            />
          </div>
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug">
          {task.title}
        </p>

        {/* Building / Unit */}
        {task.building && (
          <p className="text-xs text-gray-500 truncate">
            {isEn ? task.building.nameEn : task.building.nameAr}
            {task.unitNumber && (
              <span className="text-gray-400"> · {task.unitNumber}</span>
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

        {/* Status + attachment counts + mobile move button */}
        <div className="flex items-center justify-between">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConf.badge}`}>
            {isEn ? statusConf.labelEn : statusConf.labelAr}
          </span>
          <div className="flex items-center gap-2">
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

            {/* Mobile "Move to…" button — only shown when onMobileMove is provided and there are valid moves */}
            {onMobileMove && validMoveTargets.length > 0 && (
              <div className="relative sm:hidden" data-move-btn="1">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  title={isEn ? "Move to…" : "نقل إلى…"}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </button>
                {showMoveMenu && (
                  <div className="absolute end-0 bottom-full mb-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-30 min-w-[160px]">
                    <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase">
                      {isEn ? "Move to" : "نقل إلى"}
                    </p>
                    {validMoveTargets.map((s) => {
                      const lbl = TRANSITION_BUTTON_LABEL[s];
                      return (
                        <button
                          key={s}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMoveMenu(false);
                            onMobileMove(task.id, s);
                          }}
                          className="w-full text-start px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          {lbl ? (isEn ? lbl.labelEn : lbl.labelAr) : s}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default TaskCard;
