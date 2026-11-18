/**
 * Response shapes of the mobile app's task routes (/api/mobile/v1/tasks/*).
 * Kept lean: the app gets what its screens show, not the full Prisma rows.
 * The app validates these with Zod (mobile/src/lib/api/tasks.ts) — change both
 * together.
 */
import type { Prisma } from "@prisma/client";
import { MOBILE_BUILDING_SELECT } from "@/lib/mobileApi";

const PERSON_SELECT = { id: true, name: true, role: true } as const;

export const MOBILE_TASK_LIST_SELECT = {
  id: true,
  requestNumber: true,
  type: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  unitNumber: true,
  updatedAt: true,
  building: { select: MOBILE_BUILDING_SELECT },
  unit: { select: { id: true, name: true } },
  assignedTo: { select: PERSON_SELECT },
  _count: { select: { notes: true, photos: true } },
} satisfies Prisma.TaskSelect;

export const MOBILE_TASK_DETAIL_SELECT = {
  ...MOBILE_TASK_LIST_SELECT,
  description: true,
  cleaningType: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
  createdBy: { select: PERSON_SELECT },
  parentTask: { select: { id: true, requestNumber: true, title: true, type: true } },
  subTasks: {
    select: { id: true, requestNumber: true, title: true, type: true, status: true },
    orderBy: { createdAt: "asc" },
  },
  notes: {
    select: { id: true, text: true, createdAt: true, user: { select: PERSON_SELECT } },
    orderBy: { createdAt: "asc" },
  },
  photos: {
    select: { id: true, photoUrl: true, caption: true, createdAt: true, user: { select: PERSON_SELECT } },
    orderBy: { createdAt: "asc" },
  },
  activities: {
    select: { id: true, action: true, details: true, createdAt: true, user: { select: PERSON_SELECT } },
    orderBy: { createdAt: "desc" },
    take: 50,
  },
  inspectionChecklist: {
    select: {
      id: true,
      completedAt: true,
      inspectorNotes: true,
      items: {
        select: { id: true, category: true, label: true, status: true, notes: true, severity: true },
        orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
      },
    },
  },
} satisfies Prisma.TaskSelect;
