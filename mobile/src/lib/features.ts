import { router } from 'expo-router';
import {
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  ChartColumn,
  FileText,
  KeyRound,
  MessageCircle,
  Receipt,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react-native';

/**
 * Every area of the app. Only Tasks is live; the others open a "coming soon"
 * page so the navigation already shows where the app is going.
 */
export type FeatureKey =
  | 'tasks'
  | 'units'
  | 'reservations'
  | 'checkInOut'
  | 'expenses'
  | 'purchases'
  | 'dailyReport'
  | 'salesReport'
  | 'messages'
  | 'notifications';

export type SoonFeature = Exclude<FeatureKey, 'tasks'>;

export const FEATURES: Record<FeatureKey, { icon: LucideIcon; color: string; live: boolean }> = {
  tasks: { icon: ClipboardList, color: '#2a7475', live: true },
  units: { icon: Building2, color: '#2563eb', live: false },
  reservations: { icon: CalendarDays, color: '#7c3aed', live: false },
  checkInOut: { icon: KeyRound, color: '#0891b2', live: false },
  expenses: { icon: Receipt, color: '#d97706', live: false },
  purchases: { icon: ShoppingCart, color: '#db2777', live: false },
  dailyReport: { icon: FileText, color: '#4f46e5', live: false },
  salesReport: { icon: ChartColumn, color: '#16a34a', live: false },
  messages: { icon: MessageCircle, color: '#059669', live: false },
  notifications: { icon: Bell, color: '#ea580c', live: true },
};

export function isSoonFeature(value: string | undefined): value is SoonFeature {
  return !!value && value in FEATURES && !FEATURES[value as FeatureKey].live;
}

/** Opens a feature: its tab when it has one, otherwise its own page. */
export function openFeature(key: FeatureKey) {
  if (key === 'tasks') router.navigate('/tasks');
  else if (key === 'messages') router.navigate('/messages');
  else if (key === 'notifications') router.push('/notifications');
  else router.push({ pathname: '/soon/[feature]', params: { feature: key } });
}
