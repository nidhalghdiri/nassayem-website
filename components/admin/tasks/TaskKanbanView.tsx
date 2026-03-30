"use client";

import { useState, useRef, useCallback, memo, useMemo } from "react";
import TaskCard from "./TaskCard";
import type { SerializedTask } from "./types";
import type { TTaskStatus } from "@/lib/tasks/statuses";
import type { TStaffRole } from "@/lib/tasks/constants";
import { STATUS_TRANSITIONS, TERMINAL_STATUSES } from "@/lib/tasks/statuses";
import { canUpdateTaskStatus } from "@/lib/tasks/permissions";

type KanbanColumn = {
  id: string;
  labelEn: string;
  labelAr: string;
  statuses: TTaskStatus[];
  headerBg: string;
  dot: string;
};

const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: "approval", labelEn: "Pending Approval", labelAr: "قيد الموافقة", statuses: ["PENDING_APPROVAL"], headerBg: "bg-yellow-50 border-yellow-200", dot: "bg-yellow-400" },
  { id: "assigned", labelEn: "Assigned", labelAr: "مُعيَّن", statuses: ["ASSIGNED"], headerBg: "bg-blue-50 border-blue-200", dot: "bg-blue-400" },
  { id: "active", labelEn: "In Progress", labelAr: "جارٍ", statuses: ["CLEANING_STARTED", "INSPECTING", "WORK_STARTED", "IN_PROGRESS"], headerBg: "bg-orange-50 border-orange-200", dot: "bg-orange-400" },
  { id: "blocked", labelEn: "Issues / On Hold", labelAr: "مشاكل / معلق", statuses: ["ISSUES_FOUND", "ON_HOLD"], headerBg: "bg-red-50 border-red-200", dot: "bg-red-400" },
  { id: "done", labelEn: "Done", labelAr: "مكتمل", statuses: ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED"], headerBg: "bg-green-50 border-green-200", dot: "bg-green-500" },
  { id: "cancelled", labelEn: "Cancelled", labelAr: "ملغي", statuses: ["CANCELLED"], headerBg: "bg-gray-50 border-gray-200", dot: "bg-gray-400" },
];

// Given a task type + current status + list of column statuses → return valid drop target
function getDropTargetStatus(
  taskType: string,
  currentStatus: string,
  columnStatuses: TTaskStatus[],
): TTaskStatus | null {
  const transitions =
    (STATUS_TRANSITIONS as Record<string, Record<string, TTaskStatus[]>>)[
      taskType
    ]?.[currentStatus] ?? [];
  return columnStatuses.find((s) => transitions.includes(s)) ?? null;
}

type Props = {
  tasks: SerializedTask[];
  locale: string;
  currentUserId: string;
  currentUserRole: string;
  onTaskClick: (id: string) => void;
  onStatusChange: (taskId: string, newStatus: TTaskStatus) => Promise<void>;
  onToast: (msg: string, type?: "success" | "error") => void;
};

const TaskKanbanView = memo(function TaskKanbanView({
  tasks,
  locale,
  currentUserId,
  currentUserRole,
  onTaskClick,
  onStatusChange,
  onToast,
}: Props) {
  const isEn = locale === "en";

  // Drag state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [dropValid, setDropValid] = useState<boolean>(false);
  const draggedTask = useRef<SerializedTask | null>(null);

  // Group tasks by status — MEMOIZED
  const tasksByStatus = useMemo(() => {
    const map = new Map<TTaskStatus, SerializedTask[]>();
    for (const task of tasks) {
      const existing = map.get(task.status as TTaskStatus) ?? [];
      map.set(task.status as TTaskStatus, [...existing, task]);
    }
    return map;
  }, [tasks]);

  // ── Drag handlers (passed to TaskCard) ────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.DragEvent, task: SerializedTask) => {
      draggedTask.current = task;
      setDraggedTaskId(task.id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("taskId", task.id);
      // Slight delay so the drag ghost renders before the card dims
      requestAnimationFrame(() => {
        (e.target as HTMLElement).classList.add("opacity-60");
      });
    },
    [],
  );

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.target as HTMLElement).classList.remove("opacity-60");
    setDraggedTaskId(null);
    setDragOverColId(null);
    setDropValid(false);
    draggedTask.current = null;
  }, []);

  // ── Column drop zone handlers ──────────────────────────────────────────────

  const handleDragOver = useCallback(
    (e: React.DragEvent, col: KanbanColumn) => {
      e.preventDefault();
      if (!draggedTask.current) return;
      const task = draggedTask.current;

      // Check permission
      const isAssigned = task.assignedTo?.id === currentUserId;
      const canAct = canUpdateTaskStatus(
        currentUserRole as TStaffRole,
        (task.assignedTo?.role ?? "HOUSEKEEPING") as TStaffRole,
        isAssigned,
      );
      if (!canAct) {
        e.dataTransfer.dropEffect = "none";
        setDragOverColId(col.id);
        setDropValid(false);
        return;
      }

      // Check valid transition
      const isTerminal = TERMINAL_STATUSES.includes(task.status as TTaskStatus);
      const targetStatus = isTerminal
        ? null
        : getDropTargetStatus(task.type, task.status, col.statuses);

      const valid = !!targetStatus && task.status !== targetStatus;
      e.dataTransfer.dropEffect = valid ? "move" : "none";
      setDragOverColId(col.id);
      setDropValid(valid);
    },
    [currentUserId, currentUserRole],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverColId(null);
    setDropValid(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, col: KanbanColumn) => {
      e.preventDefault();
      setDragOverColId(null);
      setDropValid(false);

      const task = draggedTask.current;
      if (!task) return;

      // Permission check
      const isAssigned = task.assignedTo?.id === currentUserId;
      const canAct = canUpdateTaskStatus(
        currentUserRole as TStaffRole,
        (task.assignedTo?.role ?? "HOUSEKEEPING") as TStaffRole,
        isAssigned,
      );
      if (!canAct) {
        onToast(
          isEn
            ? "You don't have permission to update this task."
            : "ليس لديك صلاحية لتحديث هذه المهمة.",
          "error",
        );
        return;
      }

      // Check valid transition
      const isTerminal = TERMINAL_STATUSES.includes(task.status as TTaskStatus);
      if (isTerminal) {
        onToast(
          isEn ? "This task is already complete." : "هذه المهمة مكتملة بالفعل.",
          "error",
        );
        return;
      }

      const targetStatus = getDropTargetStatus(task.type, task.status, col.statuses);
      if (!targetStatus) {
        onToast(
          isEn
            ? "Can't move directly to that status."
            : "لا يمكن نقل المهمة مباشرة إلى هذه الحالة.",
          "error",
        );
        return;
      }

      if (task.status === targetStatus) return; // no-op

      await onStatusChange(task.id, targetStatus);
    },
    [currentUserId, currentUserRole, isEn, onStatusChange, onToast],
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "calc(100vh - 320px)" }}>
      {KANBAN_COLUMNS.map((col) => {
        const colTasks = col.statuses.flatMap((s) => tasksByStatus.get(s) ?? []);
        const isDragOver = dragOverColId === col.id;
        const isValidDrop = isDragOver && dropValid;
        const isInvalidDrop = isDragOver && !dropValid;

        return (
          <div
            key={col.id}
            className="flex-shrink-0 w-72"
            onDragOver={(e) => handleDragOver(e, col)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col)}
          >
            {/* Column header */}
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border mb-3 transition-colors ${col.headerBg}`}>
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${col.dot}`} />
              <span className="text-sm font-semibold text-gray-700 flex-1">
                {isEn ? col.labelEn : col.labelAr}
              </span>
              <span className="text-xs font-medium text-gray-500 bg-white/80 px-2 py-0.5 rounded-full border border-white/60">
                {colTasks.length}
              </span>
            </div>

            {/* Drop zone */}
            <div
              className={`space-y-3 min-h-[120px] rounded-xl p-1.5 -m-1.5 transition-colors ${
                isValidDrop
                  ? "bg-green-50/80 ring-2 ring-green-400/50"
                  : isInvalidDrop
                    ? "bg-red-50/60 ring-2 ring-red-300/40"
                    : ""
              }`}
            >
              {colTasks.length === 0 ? (
                <div
                  className={`text-center py-10 text-gray-300 border-2 border-dashed rounded-xl transition-colors ${
                    isValidDrop ? "border-green-400" : "border-gray-200"
                  }`}
                >
                  <svg className="w-8 h-8 mx-auto mb-1.5 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-xs">{isEn ? "No tasks" : "لا توجد مهام"}</p>
                </div>
              ) : (
                <>
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      locale={locale}
                      onClick={onTaskClick}
                      isDragging={draggedTaskId === task.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
                  {/* Drop placeholder ghost */}
                  {isValidDrop && draggedTaskId && (
                    <div className="h-16 rounded-xl border-2 border-dashed border-green-400 bg-green-50/50" />
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default TaskKanbanView;
