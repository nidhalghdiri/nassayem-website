import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { z } from 'zod';

import type { TTaskStatus } from '@shared/tasks/statuses';

import { apiRequest } from './client';
import { BuildingSchema, StaffRoleSchema } from './schemas';

// Mirrors lib/mobileTasks.ts on the website — change both together.

const TaskTypeSchema = z.enum(['CLEANING', 'INSPECTION', 'MAINTENANCE', 'WORK_ORDER']);
const TaskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
const TaskStatusSchema = z.enum([
  'ASSIGNED',
  'CLEANING_STARTED',
  'CLEANING_COMPLETED',
  'INSPECTING',
  'ISSUES_FOUND',
  'NO_ISSUES',
  'WORK_STARTED',
  'WORK_COMPLETED',
  'IN_PROGRESS',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED',
]) satisfies z.ZodType<TTaskStatus>;

export type TaskType = z.infer<typeof TaskTypeSchema>;

const PersonSchema = z.object({ id: z.string(), name: z.string().nullable(), role: StaffRoleSchema });
export type Person = z.infer<typeof PersonSchema>;

const TaskSummarySchema = z.object({
  id: z.string(),
  requestNumber: z.number(),
  type: TaskTypeSchema,
  title: z.string(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  dueDate: z.string(),
  unitNumber: z.string().nullable(),
  updatedAt: z.string(),
  building: BuildingSchema,
  unit: z.object({ id: z.string(), name: z.string() }).nullable(),
  assignedTo: PersonSchema,
  _count: z.object({ notes: z.number(), photos: z.number() }),
});
export type TaskSummary = z.infer<typeof TaskSummarySchema>;

const TaskListSchema = z.object({
  tasks: z.array(TaskSummarySchema),
  nextCursor: z.string().nullable(),
});
export type TaskListPage = z.infer<typeof TaskListSchema>;

const LinkedTaskSchema = z.object({
  id: z.string(),
  requestNumber: z.number(),
  title: z.string(),
  type: TaskTypeSchema,
});

const ChecklistItemStatusSchema = z.enum(['pending', 'pass', 'fail', 'na']);
export type ChecklistItemStatus = z.infer<typeof ChecklistItemStatusSchema>;

const ChecklistItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  label: z.string(),
  status: ChecklistItemStatusSchema.catch('pending'),
  notes: z.string().nullable(),
  severity: z.string().nullable(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

const TaskDetailSchema = TaskSummarySchema.extend({
  description: z.string().nullable(),
  cleaningType: z.enum(['DEEP', 'MEDIUM', 'REGULAR']).nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdBy: PersonSchema,
  parentTask: LinkedTaskSchema.nullable(),
  subTasks: z.array(LinkedTaskSchema.extend({ status: TaskStatusSchema })),
  notes: z.array(z.object({ id: z.string(), text: z.string(), createdAt: z.string(), user: PersonSchema })),
  photos: z.array(
    z.object({
      id: z.string(),
      photoUrl: z.string(),
      caption: z.string().nullable(),
      createdAt: z.string(),
      user: PersonSchema,
    }),
  ),
  activities: z.array(
    z.object({ id: z.string(), action: z.string(), details: z.string(), createdAt: z.string(), user: PersonSchema }),
  ),
  inspectionChecklist: z
    .object({
      id: z.string(),
      completedAt: z.string().nullable(),
      inspectorNotes: z.string().nullable(),
      items: z.array(ChecklistItemSchema),
    })
    .nullable(),
});
export type TaskDetail = z.infer<typeof TaskDetailSchema>;

// ── Requests ─────────────────────────────────────────────────────────────────

export type TaskListParams = {
  view: 'open' | 'done';
  scope: 'mine' | 'all';
  type?: TaskType;
  cursor?: string | null;
};

export const TaskCountsSchema = z.object({
  open: z.number(),
  overdue: z.number(),
  dueToday: z.number(),
  doneToday: z.number(),
});
export type TaskCounts = z.infer<typeof TaskCountsSchema>;

/** Home screen counts: open, overdue, due today and finished today. */
export function fetchTaskSummary(scope: 'mine' | 'all') {
  return apiRequest(`/tasks/summary?scope=${scope}`, { schema: TaskCountsSchema });
}

export function fetchTasks({ view, scope, type, cursor }: TaskListParams) {
  const query = new URLSearchParams({ view, scope });
  if (type) query.set('type', type);
  if (cursor) query.set('cursor', cursor);
  return apiRequest(`/tasks?${query}`, { schema: TaskListSchema });
}

export async function fetchTask(id: string) {
  return (await apiRequest(`/tasks/${id}`, { schema: z.object({ task: TaskDetailSchema }) })).task;
}

const AnyJson = z.unknown();

export function updateTaskStatus(id: string, status: TTaskStatus, holdReason?: string) {
  return apiRequest(`/tasks/${id}`, {
    method: 'PATCH',
    body: holdReason ? { status, holdReason } : { status },
    schema: AnyJson,
  });
}

export function addTaskNote(id: string, text: string) {
  return apiRequest(`/tasks/${id}/notes`, { method: 'POST', body: { text }, schema: AnyJson });
}

export function updateChecklistItem(taskId: string, itemId: string, changes: { status?: ChecklistItemStatus; notes?: string }) {
  return apiRequest(`/tasks/${taskId}/checklist/items/${itemId}`, { method: 'PATCH', body: changes, schema: AnyJson });
}

export function completeInspection(taskId: string, inspectorNotes?: string) {
  return apiRequest(`/tasks/${taskId}/checklist/complete`, {
    method: 'POST',
    body: inspectorNotes ? { inspectorNotes } : {},
    schema: AnyJson,
  });
}

// ── Photos ───────────────────────────────────────────────────────────────────

const MAX_PHOTO_SIDE = 1600;

/** Shrinks a camera/library photo to at most 1600 px and re-encodes it as JPEG. */
async function compressPhoto(photo: { uri: string; width: number; height: number }) {
  const context = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > MAX_PHOTO_SIDE) {
    context.resize(photo.width >= photo.height ? { width: MAX_PHOTO_SIDE } : { height: MAX_PHOTO_SIDE });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  context.release();
  image.release();
  return result.uri;
}

export async function uploadTaskPhoto(taskId: string, photo: { uri: string; width: number; height: number }) {
  const uri = await compressPhoto(photo);
  const form = new FormData();
  // Expo's fetch (the global fetch since SDK 54) can't send React Native's
  // { uri, name, type } file parts; it needs a Blob-like File it can read.
  form.append('file', new File(uri), `photo-${Date.now()}.jpg`);
  return apiRequest(`/tasks/${taskId}/photos`, { method: 'POST', formData: form, schema: AnyJson });
}
