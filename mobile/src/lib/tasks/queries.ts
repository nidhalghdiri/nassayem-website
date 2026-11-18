import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addTaskNote,
  completeInspection,
  fetchTask,
  fetchTaskSummary,
  fetchTasks,
  updateChecklistItem,
  updateTaskStatus,
  uploadTaskPhoto,
  type ChecklistItemStatus,
  type TaskDetail,
  type TaskListParams,
} from '@/lib/api/tasks';
import type { TTaskStatus } from '@shared/tasks/statuses';

export const taskKeys = {
  all: ['tasks'] as const,
  list: (params: Omit<TaskListParams, 'cursor'>) => ['tasks', 'list', params] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
  summary: (scope: 'mine' | 'all') => ['tasks', 'summary', scope] as const,
};

export function useTaskList(params: Omit<TaskListParams, 'cursor'>, enabled = true) {
  return useInfiniteQuery({
    enabled,
    queryKey: taskKeys.list(params),
    queryFn: ({ pageParam }) => fetchTasks({ ...params, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useTaskSummary(scope: 'mine' | 'all', enabled = true) {
  return useQuery({ queryKey: taskKeys.summary(scope), queryFn: () => fetchTaskSummary(scope), enabled });
}

export function useTask(id: string) {
  return useQuery({ queryKey: taskKeys.detail(id), queryFn: () => fetchTask(id) });
}

/** After any change: refetch this task and every task list (counts, ordering, tabs). */
function useInvalidateTasks() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: taskKeys.all });
}

export function useUpdateTaskStatus(id: string) {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ status, holdReason }: { status: TTaskStatus; holdReason?: string }) =>
      updateTaskStatus(id, status, holdReason),
    onSettled: invalidate,
  });
}

export function useAddTaskNote(id: string) {
  const invalidate = useInvalidateTasks();
  return useMutation({ mutationFn: (text: string) => addTaskNote(id, text), onSettled: invalidate });
}

export function useUploadTaskPhotos(id: string) {
  const invalidate = useInvalidateTasks();
  return useMutation({
    // One by one: phones on weak signal do better than with parallel uploads.
    mutationFn: async (photos: { uri: string; width: number; height: number }[]) => {
      for (const photo of photos) await uploadTaskPhoto(id, photo);
    },
    onSettled: invalidate,
  });
}

/** Checklist taps update the screen immediately and roll back if the save fails. */
export function useUpdateChecklistItem(taskId: string) {
  const queryClient = useQueryClient();
  const key = taskKeys.detail(taskId);
  return useMutation({
    mutationFn: ({ itemId, ...changes }: { itemId: string; status?: ChecklistItemStatus; notes?: string }) =>
      updateChecklistItem(taskId, itemId, changes),
    onMutate: async ({ itemId, ...changes }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TaskDetail>(key);
      if (previous?.inspectionChecklist) {
        queryClient.setQueryData<TaskDetail>(key, {
          ...previous,
          inspectionChecklist: {
            ...previous.inspectionChecklist,
            items: previous.inspectionChecklist.items.map((item) =>
              item.id === itemId ? { ...item, ...changes } : item,
            ),
          },
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
  });
}

export function useCompleteInspection(id: string) {
  const invalidate = useInvalidateTasks();
  return useMutation({ mutationFn: (notes?: string) => completeInspection(id, notes), onSettled: invalidate });
}
