import type { TTaskType, TTaskPriority } from "@/lib/tasks/constants";
import type { TTaskStatus } from "@/lib/tasks/statuses";

export type SerializedTask = {
  id: string;
  type: TTaskType;
  title: string;
  description: string | null;
  priority: TTaskPriority;
  status: TTaskStatus;
  /** Classified from expectedHours; null on tasks created before the field existed. */
  taskSize: string | null;
  expectedHours: number | null;
  actualHours: number | null;
  startedAt: string | null;
  completedAt: string | null;
  dueDate: string;
  building: { id: string; nameEn: string; nameAr: string; shortName?: string | null } | null;
  unitId: string | null;
  unit: { id: string; name: string } | null;
  unitNumber: string | null;
  cleaningType: string | null;
  assignedTo: { id: string; name: string | null; email: string; role: string } | null;
  createdBy: { id: string; name: string | null; email: string } | null;
  _count: { notes: number; photos: number; subTasks: number };
  createdAt: string;
  updatedAt: string;
};

export type Building = { id: string; nameEn: string; nameAr: string; shortName?: string | null; buildingUnits?: { id: string; name: string }[] };
export type StaffUser = { id: string; name: string | null; email: string; role: string };
