import { router } from 'expo-router';
import {
  Bell,
  Building2,
  ChevronRight,
  CircleCheck,
  Clock,
  DoorOpen,
  ListTodo,
  LogIn,
  Menu,
  RefreshCw,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, I18nManager, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildingLabel } from '@shared/buildingLabel';
import { canSeeAllTasks } from '@shared/tasks/permissions';

import { useSideMenu } from '@/components/side-menu';
import { TaskCard } from '@/components/tasks/task-card';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { SoonPill } from '@/components/ui/list-group';
import { EmptyState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useCurrentUser, useSession } from '@/lib/auth/session';
import { FEATURES, openFeature, type FeatureKey } from '@/lib/features';
import { formatLongDate, omanHour } from '@/lib/format';
import { useLanguage } from '@/lib/i18n/use-language';
import { roleLabel } from '@/lib/tasks/labels';
import { useUnreadCount } from '@/lib/notifications/queries';
import { useTodayMovements } from '@/lib/reservations/queries';
import { useTaskList, useTaskSummary } from '@/lib/tasks/queries';
import { colors, tint } from '@/lib/theme';

const SERVICES: FeatureKey[] = ['tasks', 'units', 'reservations', 'salesReport', 'expenses', 'purchases', 'dailyReport', 'messages'];
const NEXT_COUNT = 3;

export default function HomeScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const user = useCurrentUser();
  const { refreshUser } = useSession();
  const menu = useSideMenu();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const unread = useUnreadCount();

  const hasTasks = user.modules.includes('tasks');
  // Supervisors, managers and receptionists see their team's numbers.
  const oversees = canSeeAllTasks(user.role) || user.role === 'RECEPTIONIST';
  const summary = useTaskSummary(oversees ? 'all' : 'mine', hasTasks);
  const next = useTaskList({ view: 'open', scope: 'mine' }, hasTasks);
  const nextTasks = next.data?.pages[0]?.tasks.slice(0, NEXT_COUNT) ?? [];
  // The front desk's first question every morning: who arrives and leaves today.
  const frontDesk = user.role === 'RECEPTIONIST';
  const movements = useTodayMovements(frontDesk);

  const hour = omanHour();
  const greeting = hour < 12 ? t('home.morning') : hour < 17 ? t('home.afternoon') : t('home.evening');
  const firstName = (user.name ?? '').trim().split(/\s+/)[0] || user.email;

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([
      refreshUser(),
      hasTasks ? summary.refetch() : null,
      hasTasks ? next.refetch() : null,
      frontDesk ? movements.refetch() : null,
    ]);
    setRefreshing(false);
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#ffffff"
          colors={[colors.brand]}
          progressViewOffset={insets.top}
        />
      }>
      {/* Brand header */}
      <View className="overflow-hidden rounded-b-[32px] bg-brand px-5 pb-20" style={{ paddingTop: insets.top + 8 }}>
        <View className="absolute -end-20 -top-16 h-64 w-64 rounded-full bg-white/10" />
        <View className="absolute -start-10 bottom-0 h-32 w-32 rounded-full bg-white/5" />

        <View className="flex-row items-center justify-between">
          <IconButton icon={Menu} label={t('menu.open')} variant="light" onPress={menu.open} />
          <IconButton icon={Bell} label={t('menu.notifications')} variant="light" dot={unread > 0} onPress={() => openFeature('notifications')} />
        </View>

        <View className="mt-6 flex-row items-center gap-4">
          <Avatar name={user.name} fallback={user.email} size={56} onBrand />
          <View className="flex-1 gap-0.5">
            <Text className="text-sm text-white/80">{greeting} 👋</Text>
            <Text weight="bold" className="text-2xl text-white" numberOfLines={1}>
              {firstName}
            </Text>
          </View>
        </View>

        <View className="mt-4 flex-row flex-wrap items-center gap-2">
          <View className="rounded-full bg-white/15 px-3 py-1">
            <Text weight="medium" className="text-xs text-white">
              {roleLabel(user.role, language)}
            </Text>
          </View>
          <Text className="text-xs text-white/75">{formatLongDate(new Date(), language)}</Text>
        </View>
      </View>

      <View className="-mt-14 gap-7 px-4">
        {frontDesk ? <FrontDesk query={movements} /> : null}

        {hasTasks ? (
          <Card className="gap-4 p-4">
            <View className="flex-row items-center justify-between">
              <Text weight="semibold">{oversees ? t('home.teamToday') : t('home.today')}</Text>
              {summary.isFetching && !refreshing ? <ActivityIndicator size="small" color={colors.brand} /> : null}
            </View>
            <View className="flex-row">
              <Stat icon={ListTodo} color={colors.brand} value={summary.data?.open} label={t('home.statOpen')} />
              <Stat icon={TriangleAlert} color={colors.danger} value={summary.data?.overdue} label={t('home.statOverdue')} />
              <Stat icon={Clock} color="#b45309" value={summary.data?.dueToday} label={t('home.statDueToday')} />
              <Stat icon={CircleCheck} color="#15803d" value={summary.data?.doneToday} label={t('home.statDoneToday')} />
            </View>
          </Card>
        ) : null}

        <View className="gap-3">
          <SectionTitle title={t('home.services')} />
          <Card className="flex-row flex-wrap px-1 py-3">
            {SERVICES.filter((key) => key !== 'tasks' || hasTasks).map((key) => (
              <ServiceTile key={key} feature={key} />
            ))}
          </Card>
        </View>

        {hasTasks ? (
          <View className="gap-3">
            <SectionTitle title={t('home.nextTasks')} action={t('common.seeAll')} onAction={() => openFeature('tasks')} />
            {next.isPending ? (
              <ActivityIndicator color={colors.brand} style={{ paddingVertical: 24 }} />
            ) : nextTasks.length === 0 ? (
              <Card className="items-center gap-2 py-6">
                <CircleCheck size={32} color="#15803d" />
                <Text className="text-center text-muted">{t('home.noNextTasks')}</Text>
              </Card>
            ) : (
              nextTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onPress={() => router.navigate({ pathname: '/tasks/[id]', params: { id: task.id } })}
                />
              ))
            )}
          </View>
        ) : null}

        {user.role === 'RECEPTIONIST' && user.buildings.length > 0 ? (
          <View className="gap-3">
            <SectionTitle title={t('home.buildings')} />
            <Card className="gap-3">
              {user.buildings.map((building) => (
                <View key={building.id} className="flex-row items-center gap-3">
                  <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: tint('#2563eb') }}>
                    <Building2 size={18} color="#2563eb" />
                  </View>
                  <Text weight="medium" className="flex-1">
                    {buildingLabel(building, language === 'en')}
                  </Text>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {user.modules.length === 0 ? <EmptyState message={t('home.noModules')} /> : null}
      </View>
    </ScrollView>
  );
}

function FrontDesk({ query }: { query: ReturnType<typeof useTodayMovements> }) {
  const { t } = useTranslation();
  return (
    <Card className="gap-4 p-4">
      <View className="flex-row items-center justify-between">
        <Text weight="semibold">{t('home.frontDesk')}</Text>
        {query.isFetching ? <ActivityIndicator size="small" color={colors.brand} /> : null}
      </View>
      {query.isError && !query.data ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => query.refetch()}
          className="flex-row items-center gap-2 rounded-xl bg-background px-3 py-3 active:bg-border/50">
          <RefreshCw size={16} color={colors.muted} />
          <Text className="flex-1 text-sm text-muted">{t('home.frontDeskError')}</Text>
          <Text weight="semibold" className="text-sm text-brand">
            {t('common.retry')}
          </Text>
        </Pressable>
      ) : (
        <View className="flex-row gap-3">
          <Movement icon={LogIn} color="#0891b2" label={t('home.checkIns')} count={query.data?.checkIns} />
          <Movement icon={DoorOpen} color="#7c3aed" label={t('home.checkOuts')} count={query.data?.checkOuts} />
        </View>
      )}
    </Card>
  );
}

function Movement({
  icon: Icon,
  color,
  label,
  count,
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  count?: { total: number; done: number };
}) {
  const { t } = useTranslation();
  const progress = count && count.total > 0 ? count.done / count.total : 0;
  return (
    <View className="flex-1 gap-3 rounded-2xl p-3.5" style={{ backgroundColor: tint(color, 0.08) }}>
      <View className="flex-row items-center justify-between">
        <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: tint(color, 0.16) }}>
          <Icon size={20} color={color} />
        </View>
        <Text weight="bold" className="text-3xl" style={{ color }}>
          {count?.total ?? '–'}
        </Text>
      </View>
      <View className="gap-1.5">
        <Text weight="semibold" className="text-sm">
          {label}
        </Text>
        <View className="h-1.5 overflow-hidden rounded-full bg-white">
          <View className="h-full rounded-full" style={{ width: `${progress * 100}%`, backgroundColor: color }} />
        </View>
        <Text className="text-xs text-muted">
          {count ? t('home.movementDone', { done: count.done, total: count.total }) : ' '}
        </Text>
      </View>
    </View>
  );
}

function Stat({ icon: Icon, color, value, label }: { icon: LucideIcon; color: string; value?: number; label: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => openFeature('tasks')} className="flex-1 items-center gap-1.5 rounded-xl py-1 active:bg-background">
      <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: tint(color) }}>
        <Icon size={18} color={color} />
      </View>
      <Text weight="bold" className="text-xl">
        {value ?? '–'}
      </Text>
      <Text className="text-center text-xs text-muted" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function ServiceTile({ feature }: { feature: FeatureKey }) {
  const { t } = useTranslation();
  const { icon: Icon, color, live } = FEATURES[feature];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => openFeature(feature)}
      className="w-1/4 items-center gap-2 rounded-xl px-1 py-2 active:bg-background">
      <View>
        <View className="h-13 w-13 items-center justify-center rounded-2xl" style={{ backgroundColor: tint(color) }}>
          <Icon size={24} color={color} />
        </View>
        {!live ? (
          <View className="absolute -end-2.5 -top-1.5">
            <SoonPill label={t('common.soon')} small />
          </View>
        ) : null}
      </View>
      <Text weight="medium" className="text-center text-xs" numberOfLines={2}>
        {t(`features.${feature}.title`)}
      </Text>
    </Pressable>
  );
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View className="flex-row items-center justify-between px-1">
      <Text weight="bold" className="text-lg">
        {title}
      </Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onAction} className="flex-row items-center gap-0.5">
          <Text weight="semibold" className="text-sm text-brand">
            {action}
          </Text>
          <ChevronRight size={16} color={colors.brand} style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }} />
        </Pressable>
      ) : null}
    </View>
  );
}
