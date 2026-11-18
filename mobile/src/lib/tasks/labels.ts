import { ClipboardList, Search, Sparkles, Wrench, type LucideIcon } from 'lucide-react-native';

import type { Language } from '@/lib/api/schemas';
import type { TaskType } from '@/lib/api/tasks';
import { STAFF_ROLE_CONFIG, TASK_PRIORITY_CONFIG, TASK_TYPE_CONFIG } from '@shared/tasks/constants';
import { STATUS_CONFIG, TRANSITION_BUTTON_LABEL, type TTaskStatus } from '@shared/tasks/statuses';

// Labels and colours come from the website's shared configs, so a status or
// type reads the same on the website and in the app.

type Labelled = { labelEn: string; labelAr: string };
const pick = (config: Labelled, language: Language) => (language === 'ar' ? config.labelAr : config.labelEn);

export const statusLabel = (status: TTaskStatus, language: Language) => pick(STATUS_CONFIG[status], language);
export const statusBadge = (status: TTaskStatus) => STATUS_CONFIG[status].badge;

export const typeLabel = (type: TaskType, language: Language) => pick(TASK_TYPE_CONFIG[type], language);
export const typeBadge = (type: TaskType) => `${TASK_TYPE_CONFIG[type].bg} ${TASK_TYPE_CONFIG[type].text}`;

export const priorityLabel = (priority: keyof typeof TASK_PRIORITY_CONFIG, language: Language) =>
  pick(TASK_PRIORITY_CONFIG[priority], language);
export const priorityBadge = (priority: keyof typeof TASK_PRIORITY_CONFIG) => TASK_PRIORITY_CONFIG[priority].badge;

export const roleLabel = (role: keyof typeof STAFF_ROLE_CONFIG, language: Language) =>
  pick(STAFF_ROLE_CONFIG[role], language);

export function transitionLabel(status: TTaskStatus, language: Language) {
  const config = TRANSITION_BUTTON_LABEL[status];
  return config ? pick(config, language) : statusLabel(status, language);
}

export const TYPE_ICON: Record<TaskType, LucideIcon> = {
  CLEANING: Sparkles,
  INSPECTION: Search,
  MAINTENANCE: Wrench,
  WORK_ORDER: ClipboardList,
};

/** Hex colours for icons (lucide needs a colour value, not a class). */
export const TYPE_COLOR: Record<TaskType, string> = {
  CLEANING: '#1d4ed8',
  INSPECTION: '#c2410c',
  MAINTENANCE: '#b91c1c',
  WORK_ORDER: '#7e22ce',
};
