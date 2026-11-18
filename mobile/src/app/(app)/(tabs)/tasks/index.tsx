import { router } from 'expo-router';
import { ClipboardCheck } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { canSeeAllTasks } from '@shared/tasks/permissions';

import { AppHeader } from '@/components/app-header';
import { TaskCard } from '@/components/tasks/task-card';
import { Segmented } from '@/components/ui/segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import type { TaskType } from '@/lib/api/tasks';
import { useCurrentUser } from '@/lib/auth/session';
import { useLanguage } from '@/lib/i18n/use-language';
import { typeLabel } from '@/lib/tasks/labels';
import { useTaskList } from '@/lib/tasks/queries';

const TYPES: TaskType[] = ['CLEANING', 'INSPECTION', 'MAINTENANCE', 'WORK_ORDER'];

export default function TaskListScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const user = useCurrentUser();

  // Supervisors and managers oversee others' work, so they get a Mine / All
  // switch. Receptionists always see their buildings' tasks (the server limits
  // "all" to their buildings), so there is nothing to switch.
  const canSwitchScope = canSeeAllTasks(user.role);
  const [chosenScope, setScope] = useState<'mine' | 'all'>('all');
  const scope = canSwitchScope || user.role === 'RECEPTIONIST' ? chosenScope : 'mine';
  const [view, setView] = useState<'open' | 'done'>('open');
  const [type, setType] = useState<TaskType | undefined>(undefined);

  const query = useTaskList({ view, scope, type });
  const tasks = query.data?.pages.flatMap((page) => page.tasks) ?? [];
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await query.refetch();
    setRefreshing(false);
  }

  const header = (
    <View className="gap-3 pb-2">
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'open', label: t('tasks.open') },
          { value: 'done', label: t('tasks.done') },
        ]}
      />
      {canSwitchScope ? (
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'mine', label: t('tasks.mine') },
            { value: 'all', label: t('tasks.all') },
          ]}
        />
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        <Chip label={t('tasks.allTypes')} selected={!type} onPress={() => setType(undefined)} />
        {TYPES.map((value) => (
          <Chip
            key={value}
            label={typeLabel(value, language)}
            selected={type === value}
            onPress={() => setType(value)}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={t('tabs.tasks')} />
      <FlatList
        className="flex-1 bg-background"
        contentContainerClassName="gap-3 px-4 pb-8 pt-1"
        data={tasks}
        keyExtractor={(task) => task.id}
        renderItem={({ item }) => (
          <TaskCard task={item} onPress={() => router.push({ pathname: '/tasks/[id]', params: { id: item.id } })} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          query.isPending ? (
            <LoadingState />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : (
            <EmptyState icon={ClipboardCheck} message={view === 'open' ? t('tasks.emptyOpen') : t('tasks.emptyDone')} />
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? <ActivityIndicator color="#2a7475" style={{ paddingVertical: 16 }} /> : undefined
        }
        onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#2a7475" colors={['#2a7475']} />
        }
      />
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-9 justify-center rounded-full border px-4 ${selected ? 'border-brand bg-brand' : 'border-border bg-surface active:bg-brand-50'}`}>
      <Text weight="medium" className={`text-sm ${selected ? 'text-white' : 'text-ink'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
