import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { STATUS_CONFIG, type TTaskStatus } from '@shared/tasks/statuses';

import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import type { TaskDetail } from '@/lib/api/tasks';
import { formatDateTime } from '@/lib/format';
import { en, type Translations } from '@/lib/i18n/en';
import { useLanguage } from '@/lib/i18n/use-language';
import { statusLabel } from '@/lib/tasks/labels';

type KnownAction = keyof Translations['activity'];

const isStatus = (value: string): value is TTaskStatus => value in STATUS_CONFIG;

/** Task history, newest first. Server entries are English text; known ones are shown translated. */
export function ActivitySection({ task }: { task: TaskDetail }) {
  const { t } = useTranslation();
  const language = useLanguage();

  function describe(action: string, details: string): string {
    if (action === 'status_changed') {
      // details: "Status changed from ASSIGNED to CLEANING_STARTED"
      const match = /from (\w+) to (\w+)/.exec(details);
      if (match && isStatus(match[1]) && isStatus(match[2])) {
        return t('activity.status_changed', {
          from: statusLabel(match[1], language),
          to: statusLabel(match[2], language),
        });
      }
    }
    if (action === 'on_hold_reason') return t('activity.on_hold_reason', { details });
    if (action in en.activity) return t(`activity.${action as KnownAction}`);
    return details;
  }

  if (task.activities.length === 0) return null;

  return (
    <Section title={t('tasks.activity')}>
      {task.activities.map((activity, index) => (
        <View key={activity.id} className="flex-row gap-3">
          <View className="items-center">
            <View className="mt-1.5 h-2.5 w-2.5 rounded-full bg-brand" />
            {index < task.activities.length - 1 ? <View className="w-px flex-1 bg-border" /> : null}
          </View>
          <View className="flex-1 gap-0.5 pb-3">
            <Text className="text-sm">{describe(activity.action, activity.details)}</Text>
            <Text className="text-xs text-muted">
              {activity.user.name ?? '—'} · {formatDateTime(activity.createdAt, language)}
            </Text>
          </View>
        </View>
      ))}
    </Section>
  );
}
