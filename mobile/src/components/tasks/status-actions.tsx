import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';

import { canUpdateTaskStatus } from '@shared/tasks/permissions';
import { STATUS_TRANSITIONS, TERMINAL_STATUSES, type TTaskStatus } from '@shared/tasks/statuses';

import { Button } from '@/components/ui/button';
import { Section } from '@/components/ui/section';
import { useErrorMessage } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import type { MobileUser } from '@/lib/api/schemas';
import type { TaskDetail } from '@/lib/api/tasks';
import { useLanguage } from '@/lib/i18n/use-language';
import { transitionLabel } from '@/lib/tasks/labels';
import { useUpdateTaskStatus } from '@/lib/tasks/queries';

/** Next-status buttons for a task, following the website's transition rules. */
export function StatusActions({ task, user }: { task: TaskDetail; user: MobileUser }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const errorMessage = useErrorMessage();
  const mutation = useUpdateTaskStatus(task.id);
  const [pending, setPending] = useState<TTaskStatus | null>(null);
  const [holdOpen, setHoldOpen] = useState(false);

  if (TERMINAL_STATUSES.includes(task.status)) return null;

  const canAct = canUpdateTaskStatus(user.role, task.assignedTo.role, task.assignedTo.id === user.id);
  if (!canAct) {
    return (
      <Section title={t('tasks.actions')}>
        <Text className="text-sm text-muted">{t('tasks.readOnly')}</Text>
      </Section>
    );
  }

  let next = STATUS_TRANSITIONS[task.type]?.[task.status] ?? [];
  // An inspection in progress is finished from its checklist, which works out
  // Issues Found / No Issues from the items.
  const checklistOpen = task.inspectionChecklist && !task.inspectionChecklist.completedAt;
  if (task.type === 'INSPECTION' && task.status === 'INSPECTING' && checklistOpen) {
    next = next.filter((s) => s !== 'ISSUES_FOUND' && s !== 'NO_ISSUES');
  }
  // Closing an inspection with issues waits for its sub-tasks (server rule).
  const subTasksDone =
    task.subTasks.length > 0 && task.subTasks.every((sub) => TERMINAL_STATUSES.includes(sub.status));
  const blocked = (status: TTaskStatus) =>
    task.type === 'INSPECTION' && task.status === 'ISSUES_FOUND' && status === 'COMPLETED' && !subTasksDone;

  const forward = next.filter((s) => s !== 'ON_HOLD' && s !== 'CANCELLED');
  if (next.length === 0) return null;

  async function change(status: TTaskStatus, holdReason?: string) {
    setPending(status);
    try {
      await mutation.mutateAsync({ status, holdReason });
    } catch (error) {
      Alert.alert(errorMessage(error));
    } finally {
      setPending(null);
    }
  }

  function confirmCancel() {
    Alert.alert(t('tasks.cancelConfirm'), undefined, [
      { text: t('tasks.keep'), style: 'cancel' },
      { text: t('tasks.cancelYes'), style: 'destructive', onPress: () => change('CANCELLED') },
    ]);
  }

  const busy = pending !== null;
  return (
    <Section title={t('tasks.actions')}>
      {forward.map((status, index) => (
        <View key={status} className="gap-1.5">
          <Button
            label={transitionLabel(status, language)}
            variant={index === 0 ? 'primary' : 'secondary'}
            loading={pending === status}
            disabled={busy || blocked(status)}
            onPress={() => change(status)}
          />
          {blocked(status) ? <Text className="text-xs text-muted">{t('tasks.subTasksPending')}</Text> : null}
        </View>
      ))}
      {next.includes('ON_HOLD') || next.includes('CANCELLED') ? (
        <View className="flex-row gap-2">
          {next.includes('ON_HOLD') ? (
            <Button
              className="flex-1"
              label={transitionLabel('ON_HOLD', language)}
              variant="secondary"
              loading={pending === 'ON_HOLD'}
              disabled={busy}
              onPress={() => setHoldOpen(true)}
            />
          ) : null}
          {next.includes('CANCELLED') ? (
            <Button
              className="flex-1"
              label={transitionLabel('CANCELLED', language)}
              variant="danger"
              loading={pending === 'CANCELLED'}
              disabled={busy}
              onPress={confirmCancel}
            />
          ) : null}
        </View>
      ) : null}

      <HoldReasonModal
        visible={holdOpen}
        onClose={() => setHoldOpen(false)}
        onConfirm={(reason) => {
          setHoldOpen(false);
          void change('ON_HOLD', reason || undefined);
        }}
      />
    </Section>
  );
}

function HoldReasonModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={() => setReason('')}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
          {/* Inner Pressable swallows taps so they do not close the sheet. */}
          <Pressable className="gap-4 rounded-t-3xl bg-surface p-5 pb-10" onPress={() => {}}>
            <Text weight="bold" className="text-lg">
              {t('tasks.holdTitle')}
            </Text>
            <TextField
              label={t('tasks.holdReason')}
              value={reason}
              onChangeText={setReason}
              maxLength={300}
              multiline
              autoFocus
            />
            <View className="flex-row gap-2">
              <Button className="flex-1" label={t('common.cancel')} variant="secondary" onPress={onClose} />
              <Button className="flex-1" label={t('tasks.holdConfirm')} onPress={() => onConfirm(reason.trim())} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
