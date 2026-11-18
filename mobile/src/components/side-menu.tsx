import { router, usePathname } from 'expo-router';
import { ChevronRight, House, LogOut, UserRound, X, type LucideIcon } from 'lucide-react-native';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Animated,
  Easing,
  I18nManager,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { SoonPill } from '@/components/ui/list-group';
import { Text } from '@/components/ui/text';
import { useCurrentUser, useSession } from '@/lib/auth/session';
import { APP_VERSION } from '@/lib/config';
import { FEATURES, openFeature, type FeatureKey } from '@/lib/features';
import { useLanguage } from '@/lib/i18n/use-language';
import { roleLabel } from '@/lib/tasks/labels';
import { colors, tint } from '@/lib/theme';

const SideMenuContext = createContext<{ open: () => void }>({ open: () => {} });

/** Opens the side menu from any screen's header. */
export function useSideMenu() {
  return useContext(SideMenuContext);
}

export function SideMenuProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));

  function open() {
    progress.setValue(0);
    setVisible(true);
  }

  function close() {
    Animated.timing(progress, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
      () => setVisible(false),
    );
  }

  function show() {
    Animated.timing(progress, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }

  return (
    <SideMenuContext.Provider value={{ open }}>
      {children}
      <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent onShow={show} onRequestClose={close}>
        <SideMenu progress={progress} onClose={close} />
      </Modal>
    </SideMenuContext.Provider>
  );
}

type Item = { key: string; icon: LucideIcon; color: string; label: string; soon: boolean; active: boolean; onPress: () => void };

function SideMenu({ progress, onClose }: { progress: Animated.Value; onClose: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const user = useCurrentUser();
  const { signOut } = useSession();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(width * 0.84, 340);
  const hasTasks = user.modules.includes('tasks');

  // Transforms are not mirrored in RTL: the panel comes from the right there.
  const hidden = I18nManager.isRTL ? panelWidth : -panelWidth;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [hidden, 0] });

  function go(action: () => void) {
    action();
    onClose();
  }

  function feature(key: FeatureKey): Item {
    const config = FEATURES[key];
    const path = key === 'tasks' ? '/tasks' : key === 'messages' ? '/messages' : key === 'notifications' ? '/notifications' : null;
    return {
      key,
      icon: config.icon,
      color: config.color,
      label: t(`features.${key}.title`),
      soon: !config.live,
      active: path !== null && pathname.startsWith(path),
      onPress: () => go(() => openFeature(key)),
    };
  }

  const groups: { title: string; items: Item[] }[] = [
    {
      title: t('menu.main'),
      items: [
        {
          key: 'home',
          icon: House,
          color: colors.brand,
          label: t('tabs.home'),
          soon: false,
          active: pathname === '/',
          onPress: () => go(() => router.navigate('/')),
        },
        ...(hasTasks ? [feature('tasks')] : []),
        feature('notifications'),
        feature('messages'),
      ],
    },
    {
      title: t('menu.operations'),
      items: [
        feature('units'),
        feature('reservations'),
        feature('checkInOut'),
        feature('dailyReport'),
        feature('salesReport'),
      ],
    },
    { title: t('menu.requests'), items: [feature('expenses'), feature('purchases')] },
    {
      title: t('menu.account'),
      items: [
        {
          key: 'profile',
          icon: UserRound,
          color: '#475569',
          label: t('tabs.profile'),
          soon: false,
          active: pathname === '/profile',
          onPress: () => go(() => router.navigate('/profile')),
        },
      ],
    },
  ];

  function confirmSignOut() {
    Alert.alert(t('profile.signOutConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: () => go(() => void signOut()) },
    ]);
  }

  return (
    <View className="flex-1">
      <Animated.View className="absolute inset-0 bg-black/40" style={{ opacity: progress }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} className="flex-1" onPress={onClose} />
      </Animated.View>

      <Animated.View
        className="absolute bottom-0 start-0 top-0 bg-surface"
        style={{ width: panelWidth, transform: [{ translateX }], boxShadow: '0px 0px 32px rgba(0,0,0,0.18)' }}>
        <View className="overflow-hidden bg-brand px-5 pb-5" style={{ paddingTop: insets.top + 12 }}>
          <View className="absolute -end-12 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <View className="flex-row items-start justify-between">
            <Avatar name={user.name} fallback={user.email} size={56} onBrand />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={8}
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full bg-white/15 active:bg-white/25">
              <X size={20} color="#ffffff" />
            </Pressable>
          </View>
          <Text weight="bold" className="mt-3 text-lg text-white" numberOfLines={1}>
            {user.name || user.email}
          </Text>
          <Text className="text-sm text-white/75" numberOfLines={1}>
            {roleLabel(user.role, language)}
          </Text>
        </View>

        <ScrollView contentContainerClassName="gap-4 px-3 py-4">
          {groups.map((group) => (
            <View key={group.title} className="gap-0.5">
              <Text weight="semibold" className="px-3 pb-1 text-xs uppercase tracking-wide text-muted">
                {group.title}
              </Text>
              {group.items.map((item) => (
                <MenuItem key={item.key} item={item} soonLabel={t('common.soon')} />
              ))}
            </View>
          ))}
        </ScrollView>

        <View className="gap-2 border-t border-border px-3 pt-2" style={{ paddingBottom: insets.bottom + 10 }}>
          <Pressable
            accessibilityRole="button"
            onPress={confirmSignOut}
            className="min-h-12 flex-row items-center gap-3 rounded-xl px-3 active:bg-red-50">
            <LogOut size={20} color={colors.danger} />
            <Text weight="semibold" className="text-danger">
              {t('profile.signOut')}
            </Text>
          </Pressable>
          <Text className="px-3 text-xs text-muted">{t('profile.version', { version: APP_VERSION })}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

function MenuItem({ item, soonLabel }: { item: Item; soonLabel: string }) {
  const Icon = item.icon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: item.active }}
      onPress={item.onPress}
      className={`min-h-12 flex-row items-center gap-3 rounded-xl px-3 ${item.active ? 'bg-brand-50' : 'active:bg-background'}`}>
      <View className="h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: tint(item.color) }}>
        <Icon size={17} color={item.color} />
      </View>
      <Text weight={item.active ? 'semibold' : 'medium'} className={`flex-1 ${item.active ? 'text-brand-dark' : ''}`}>
        {item.label}
      </Text>
      {item.soon ? (
        <SoonPill label={soonLabel} />
      ) : (
        <ChevronRight size={16} color={colors.faint} style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }} />
      )}
    </Pressable>
  );
}
