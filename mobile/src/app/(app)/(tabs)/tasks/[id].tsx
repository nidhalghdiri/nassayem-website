import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, Pressable, View } from 'react-native';

import { buildingLabel } from '@shared/buildingLabel';
import { canUpdateTaskStatus } from '@shared/tasks/permissions';
import { TERMINAL_STATUSES } from '@shared/tasks/statuses';

import { ActivitySection } from '@/components/tasks/activity-section';
import { ChecklistSection } from '@/components/tasks/checklist-section';
import { NotesSection } from '@/components/tasks/notes-section';
import { PhotosSection } from '@/components/tasks/photos-section';
import { StatusActions } from '@/components/tasks/status-actions';
import { useTaskLocation } from '@/components/tasks/task-card';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import type { TaskDetail } from '@/lib/api/tasks';
import { useCurrentUser } from '@/lib/auth/session';
import { formatDateTime, isOverdue } from '@/lib/format';
import { useLanguage } from '@/lib/i18n/use-language';
import { priorityBadge, priorityLabel, roleLabel, statusBadge, statusLabel, typeBadge, typeLabel } from '@/lib/tasks/labels';
import { useTask } from '@/lib/tasks/queries';

const CLEANING_TYPE = {
  DEEP: { en: 'Deep', ar: 'عميق' },
  MEDIUM: { en: 'Medium', ar: 'متوسط' },
  REGULAR: { en: 'Regular', ar: 'عادي' },
} as const;

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const query = useTask(id);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await query.refetch();
    setRefreshing(false);
  }

  const title = query.data ? t('tasks.taskNumber', { number: query.data.requestNumber }) : '';

  return (
    <>
      <Stack.Screen options={{ title }} />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <Screen refreshing={refreshing} onRefresh={refresh}>
          <TaskBody task={query.data} />
        </Screen>
      )}
    </>
  );
}

function TaskBody({ task }: { task: TaskDetail }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const user = useCurrentUser();
  const location = useTaskLocation(task);
  const open = !TERMINAL_STATUSES.includes(task.status);
  const late = open && isOverdue(task.dueDate);
  const canAct = canUpdateTaskStatus(user.role, task.assignedTo.role, task.assignedTo.id === user.id);

  return (
    <>
      <Card className="gap-3">
        <View className="flex-row flex-wrap gap-2">
          <Badge label={typeLabel(task.type, language)} className={typeBadge(task.type)} />
          <Badge label={statusLabel(task.status, language)} className={statusBadge(task.status)} />
          <Badge label={priorityLabel(task.priority, language)} className={priorityBadge(task.priority)} />
        </View>
        <Text weight="bold" className="text-xl">
          {task.title}
        </Text>
        <View className="gap-2">
          <Row label={t('tasks.building')} value={buildingLabel(task.building, language === 'en')} />
          <Row label={t('tasks.location')} value={location} />
          <Row
            label={t('tasks.dueDate')}
            value={`${late ? `${t('tasks.overdue')} · ` : ''}${formatDateTime(task.dueDate, language)}`}
            danger={late}
          />
          <Row
            label={t('tasks.assignedTo')}
            value={`${task.assignedTo.name ?? '—'} (${roleLabel(task.assignedTo.role, language)})`}
          />
          <Row label={t('tasks.createdBy')} value={task.createdBy.name ?? '—'} />
          {task.cleaningType ? (
            <Row label={t('tasks.cleaningType')} value={CLEANING_TYPE[task.cleaningType][language]} />
          ) : null}
        </View>
        {task.description ? (
          <View className="gap-1 border-t border-border pt-3">
            <Text weight="semibold" className="text-sm text-muted">
              {t('tasks.description')}
            </Text>
            <Text>{task.description}</Text>
          </View>
        ) : null}
      </Card>

      <StatusActions task={task} user={user} />

      <ChecklistSection task={task} canEdit={canAct} />

      {task.parentTask ? (
        <Section title={t('tasks.parentTask')}>
          <TaskLink task={task.parentTask} />
        </Section>
      ) : null}

      {task.subTasks.length > 0 ? (
        <Section title={t('tasks.subTasks')}>
          {task.subTasks.map((sub) => (
            <TaskLink key={sub.id} task={sub} />
          ))}
        </Section>
      ) : null}

      <PhotosSection task={task} canAdd={task.status !== 'CANCELLED'} />
      <NotesSection task={task} />
      <ActivitySection task={task} />
    </>
  );
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View className="flex-row justify-between gap-4">
      <Text className="text-sm text-muted">{label}</Text>
      <Text weight="medium" className={`flex-1 text-end text-sm ${danger ? 'text-danger' : ''}`}>
        {value}
      </Text>
    </View>
  );
}

function TaskLink({ task }: { task: TaskDetail['subTasks'][number] | NonNullable<TaskDetail['parentTask']> }) {
  const language = useLanguage();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push({ pathname: '/tasks/[id]', params: { id: task.id } })}
      className="flex-row items-center gap-3 rounded-xl bg-background p-3 active:bg-border/50">
      <View className="flex-1 gap-1">
        <Text weight="medium" numberOfLines={1}>
          #{task.requestNumber} · {task.title}
        </Text>
        <View className="flex-row gap-2">
          <Text className="text-xs text-muted">{typeLabel(task.type, language)}</Text>
          {'status' in task ? (
            <Text className="text-xs text-muted">· {statusLabel(task.status, language)}</Text>
          ) : null}
        </View>
      </View>
      <ChevronRight size={18} color="#9aa8a9" style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }} />
    </Pressable>
  );
}
