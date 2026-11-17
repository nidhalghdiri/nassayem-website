import { ClipboardList } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/states';

// Placeholder until Phase 1 (task list, detail, status, notes, photos).
export default function TasksScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <EmptyState icon={ClipboardList} message={t('tasks.comingSoon')} />
    </Screen>
  );
}
