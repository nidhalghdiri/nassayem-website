import type { TTaskType, TTaskPriority } from "@/lib/tasks/constants";
import type { TTaskStatus } from "@/lib/tasks/statuses";

export type SerializedTask = {
  id: string;
  type: TTaskType;
  title: string;
  description: string | null;
  priority: TTaskPriority;
  status: TTaskStatus;
  dueDate: string;
  requiresApproval: boolean;
  approvalStatus: string | null;
  building: { id: string; nameEn: string; nameAr: string } | null;
  unit: { id: string; titleEn: string; titleAr: string } | null;
  assignedTo: { id: string; name: string | null; email: string; role: string } | null;
  createdBy: { id: string; name: string | null; email: string } | null;
  _count: { notes: number; photos: number; subTasks: number };
  createdAt: string;
  updatedAt: string;
};

export type Building = { id: string; nameEn: string; nameAr: string };
export type StaffUser = { id: string; name: string | null; email: string; role: string };
