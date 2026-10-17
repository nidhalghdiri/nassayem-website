import prisma from "@/lib/prisma";
import type { TaskStatus } from "@prisma/client";
import { toBuildingFilter } from "./receptionistDashboard";

// ─────────────────────────────────────────────────────────────────────────────
// Receptionist dashboard — the branch's maintenance requests:
//   • current requests (open MAINTENANCE tasks, not yet finished)
//   • last closed requests (finally approved by a supervisor) with the rating
//     and comment the supervisor gave.
//
// The rating is stored as a task note "★N - comment" written at approval time
// (see /api/tasks/:id/activity); it is parsed here. "Time ago" values are
// computed on the server so the page renders identically on server and client.
// ─────────────────────────────────────────────────────────────────────────────

const TERMINAL_STATUSES: TaskStatus[] = ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED", "CANCELLED"];
// Placeholder notes the approve buttons add when the reviewer writes nothing
const DEFAULT_NOTES = ["Approved directly from dashboard.", "Approved from receptionist dashboard."];

export type BranchMaintenanceRequest = {
  id: string;
  requestNumber: number;
  category: string | null;
  room: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  buildingNameEn: string;
  buildingNameAr: string;
  unitName: string | null;
  createdByName: string;
  technicianName: string;
  createdAt: Date;
  dueDate: Date;
  /** Minutes since the request was created. */
  ageMins: number;
  isOverdue: boolean;
  startedAt: Date | null;
  /** Why the task is paused (only while ON_HOLD). */
  holdReason: string | null;
  photoCount: number;
};

export type ClosedMaintenanceRequest = {
  id: string;
  requestNumber: number;
  title: string;
  unitName: string | null;
  buildingNameEn: string;
  buildingNameAr: string;
  closedAt: Date;
  /** 1–5 stars from the supervisor's approval note (null = not rated). */
  rating: number | null;
  comment: string | null;
};

export type BranchMaintenanceData = {
  current: BranchMaintenanceRequest[];
  closed: ClosedMaintenanceRequest[];
};

function parseRatingNote(text: string | undefined): { rating: number | null; comment: string | null } {
  if (!text) return { rating: null, comment: null };
  const m = text.match(/^★\s*(\d+)\s*(?:-\s*)?([\s\S]*)$/);
  if (!m) return { rating: null, comment: null };
  const rating = Math.min(5, Math.max(1, parseInt(m[1], 10)));
  const raw = m[2].trim();
  return { rating, comment: !raw || DEFAULT_NOTES.includes(raw) ? null : raw };
}

export async function getBranchMaintenanceData(
  selectedBuildingId: string | null,
  assignedBuildingIds?: string[] | null,
): Promise<BranchMaintenanceData> {
  const buildingFilter = toBuildingFilter(selectedBuildingId, assignedBuildingIds);
  const now = Date.now();

  const [openTasks, approvals] = await Promise.all([
    prisma.task.findMany({
      where: { type: "MAINTENANCE", status: { notIn: TERMINAL_STATUSES }, ...buildingFilter },
      select: {
        id: true, title: true, description: true, status: true, priority: true, unitNumber: true,
        requestNumber: true, category: true, room: true,
        createdAt: true, dueDate: true,
        building: { select: { nameEn: true, nameAr: true, shortName: true } },
        unit: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
        assignedTo: { select: { name: true, email: true } },
        _count: { select: { photos: true } },
        activities: {
          where: { action: { in: ["status_changed", "on_hold_reason"] } },
          orderBy: { createdAt: "asc" },
          select: { action: true, details: true, createdAt: true },
        },
      },
    }),
    // Newest final approvals first; a task approved more than once is de-duplicated below
    prisma.taskActivity.findMany({
      where: { action: "approved", task: { type: "MAINTENANCE", ...buildingFilter } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        createdAt: true,
        task: {
          select: {
            id: true, requestNumber: true, title: true, unitNumber: true,
            unit: { select: { name: true } },
            building: { select: { nameEn: true, nameAr: true, shortName: true } },
            notes: {
              where: { text: { startsWith: "★" } },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { text: true },
            },
          },
        },
      },
    }),
  ]);

  const current: BranchMaintenanceRequest[] = openTasks.map((t) => {
    const startedAct = t.activities.find(
      (a) => a.action === "status_changed" && /to (WORK_STARTED|IN_PROGRESS)/.test(a.details),
    );
    const holdReasons = t.activities.filter((a) => a.action === "on_hold_reason");
    return {
      id: t.id,
      requestNumber: t.requestNumber,
      category: t.category,
      room: t.room,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      buildingNameEn: t.building.shortName || t.building.nameEn,
      buildingNameAr: t.building.shortName || t.building.nameAr,
      unitName: t.unit?.name || t.unitNumber || null,
      createdByName: t.createdBy.name || t.createdBy.email.split("@")[0],
      technicianName: t.assignedTo.name || t.assignedTo.email.split("@")[0],
      createdAt: t.createdAt,
      dueDate: t.dueDate,
      ageMins: Math.max(0, Math.round((now - t.createdAt.getTime()) / 60000)),
      isOverdue: t.dueDate.getTime() < now,
      startedAt: startedAct?.createdAt ?? null,
      holdReason: t.status === "ON_HOLD" && holdReasons.length > 0 ? holdReasons[holdReasons.length - 1].details : null,
      photoCount: t._count.photos,
    };
  });

  // Not started first, then in progress, then paused; oldest first within each group
  const rank = (s: string) => (s === "ASSIGNED" ? 0 : s === "ON_HOLD" ? 2 : 1);
  current.sort((a, b) => rank(a.status) - rank(b.status) || a.createdAt.getTime() - b.createdAt.getTime());

  const seen = new Set<string>();
  const closed: ClosedMaintenanceRequest[] = [];
  for (const a of approvals) {
    if (seen.has(a.task.id)) continue;
    seen.add(a.task.id);
    const { rating, comment } = parseRatingNote(a.task.notes[0]?.text);
    closed.push({
      id: a.task.id,
      requestNumber: a.task.requestNumber,
      title: a.task.title,
      unitName: a.task.unit?.name || a.task.unitNumber || null,
      buildingNameEn: a.task.building.shortName || a.task.building.nameEn,
      buildingNameAr: a.task.building.shortName || a.task.building.nameAr,
      closedAt: a.createdAt,
      rating,
      comment,
    });
    if (closed.length === 8) break;
  }

  return { current, closed };
}
