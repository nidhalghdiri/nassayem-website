import { Camera, MessageSquare } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { buildingLabel } from '@shared/buildingLabel';
import { TERMINAL_STATUSES } from '@shared/tasks/statuses';

import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import type { TaskSummary } from '@/lib/api/tasks';
import { formatDateTime, isOverdue } from '@/lib/format';
import { useLanguage } from '@/lib/i18n/use-language';
import { priorityBadge, priorityLabel, statusBadge, statusLabel, TYPE_COLOR, TYPE_ICON, typeLabel } from '@/lib/tasks/labels';
import { shadow, tint } from '@/lib/theme';

/** "Unit 204" / "Common area" — the structured unit first, then the free-text number. */
export function useTaskLocation(task: Pick<TaskSummary, 'unit' | 'unitNumber'>) {
  const { t } = useTranslation();
  const unit = task.unit?.name ?? task.unitNumber;
  return unit ? t('tasks.unit', { unit }) : t('tasks.commonArea');
}

export function TaskCard({ task, onPress }: { task: TaskSummary; onPress: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const location = useTaskLocation(task);
  const Icon = TYPE_ICON[task.type];
  const open = !TERMINAL_STATUSES.includes(task.status);
  const late = open && isOverdue(task.dueDate);
  const showPriority = task.priority === 'HIGH' || task.priority === 'URGENT';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`gap-3 overflow-hidden rounded-2xl bg-surface p-4 active:bg-background ${late ? 'border-s-4 border-s-danger' : ''}`}
      style={shadow.card}>
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: tint(TYPE_COLOR[task.type]) }}>
          <Icon size={19} color={TYPE_COLOR[task.type]} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text weight="semibold" numberOfLines={2}>
            {task.title}
          </Text>
          <Text className="text-sm text-muted" numberOfLines={1}>
            {buildingLabel(task.building, language === 'en')} · {location}
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap items-center gap-2">
        <Badge label={statusLabel(task.status, language)} className={statusBadge(task.status)} />
        {showPriority ? <Badge label={priorityLabel(task.priority, language)} className={priorityBadge(task.priority)} /> : null}
        <Text className="text-xs text-muted">{typeLabel(task.type, language)}</Text>
      </View>

      <View className="flex-row items-center justify-between border-t border-border pt-2.5">
        <Text weight={late ? 'semibold' : 'regular'} className={`text-xs ${late ? 'text-danger' : 'text-muted'}`}>
          {late ? `${t('tasks.overdue')} · ` : ''}
          {t('tasks.due', { date: formatDateTime(task.dueDate, language) })}
        </Text>
        <View className="flex-row items-center gap-3">
          {task._count.notes > 0 ? <Counter icon="notes" count={task._count.notes} /> : null}
          {task._count.photos > 0 ? <Counter icon="photos" count={task._count.photos} /> : null}
          <Text className="text-xs text-muted">#{task.requestNumber}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function Counter({ icon, count }: { icon: 'notes' | 'photos'; count: number }) {
  const Icon = icon === 'notes' ? MessageSquare : Camera;
  return (
    <View className="flex-row items-center gap-1">
      <Icon size={13} color="#66797a" />
      <Text className="text-xs text-muted">{count}</Text>
    </View>
  );
}
