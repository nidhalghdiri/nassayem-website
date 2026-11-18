import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Section } from '@/components/ui/section';
import { useErrorMessage } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import type { ChecklistItem, ChecklistItemStatus, TaskDetail } from '@/lib/api/tasks';
import { useCompleteInspection, useUpdateChecklistItem } from '@/lib/tasks/queries';

const CHOICES: { value: Exclude<ChecklistItemStatus, 'pending'>; key: 'tasks.pass' | 'tasks.fail' | 'tasks.na'; on: string }[] = [
  { value: 'pass', key: 'tasks.pass', on: 'bg-green-600 border-green-600' },
  { value: 'fail', key: 'tasks.fail', on: 'bg-red-600 border-red-600' },
  { value: 'na', key: 'tasks.na', on: 'bg-slate-500 border-slate-500' },
];

/**
 * The inspection checklist. Editable while the inspection is in progress and
 * the user may act on the task; otherwise it shows the recorded results.
 */
export function ChecklistSection({ task, canEdit }: { task: TaskDetail; canEdit: boolean }) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const update = useUpdateChecklistItem(task.id);
  const complete = useCompleteInspection(task.id);
  const [inspectorNotes, setInspectorNotes] = useState('');

  const checklist = task.inspectionChecklist;
  if (!checklist || checklist.items.length === 0) return null;

  const editable = canEdit && task.status === 'INSPECTING' && !checklist.completedAt;
  const done = checklist.items.filter((item) => item.status !== 'pending').length;
  const left = checklist.items.length - done;

  // Keep the server's order, grouped by category.
  const groups: { category: string; items: ChecklistItem[] }[] = [];
  for (const item of checklist.items) {
    const group = groups.find((g) => g.category === item.category);
    if (group) group.items.push(item);
    else groups.push({ category: item.category, items: [item] });
  }

  function setStatus(item: ChecklistItem, status: ChecklistItemStatus) {
    // Tapping the selected choice again clears it.
    const next = item.status === status ? 'pending' : status;
    update.mutate({ itemId: item.id, status: next }, { onError: (error) => Alert.alert(errorMessage(error)) });
  }

  function saveNotes(item: ChecklistItem, notes: string) {
    if ((item.notes ?? '') === notes) return;
    update.mutate({ itemId: item.id, notes }, { onError: (error) => Alert.alert(errorMessage(error)) });
  }

  function finish() {
    Alert.alert(t('tasks.finishConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('tasks.finishInspection'),
        onPress: () =>
          complete.mutate(inspectorNotes.trim() || undefined, { onError: (error) => Alert.alert(errorMessage(error)) }),
      },
    ]);
  }

  return (
    <Section
      title={t('tasks.checklist')}
      right={<Text className="text-sm text-muted">{t('tasks.checklistProgress', { done, total: checklist.items.length })}</Text>}>
      {checklist.completedAt ? <Text className="text-sm text-brand">{t('tasks.checklistDone')}</Text> : null}

      {groups.map((group) => (
        <View key={group.category} className="gap-2">
          <Text weight="semibold" className="text-sm text-muted">
            {group.category}
          </Text>
          {group.items.map((item) => (
            <View key={item.id} className="gap-2 rounded-xl bg-background p-3">
              <Text>{item.label}</Text>
              <View className="flex-row gap-2">
                {CHOICES.map((choice) => {
                  const selected = item.status === choice.value;
                  return (
                    <Pressable
                      key={choice.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled: !editable }}
                      disabled={!editable}
                      onPress={() => setStatus(item, choice.value)}
                      className={`min-h-10 flex-1 items-center justify-center rounded-lg border ${selected ? choice.on : 'border-border bg-surface'} ${!editable && !selected ? 'opacity-50' : ''}`}>
                      <Text weight="medium" className={`text-sm ${selected ? 'text-white' : 'text-ink'}`}>
                        {t(choice.key)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {item.status === 'fail' ? (
                editable ? (
                  <ItemNotes item={item} onSave={(notes) => saveNotes(item, notes)} />
                ) : item.notes ? (
                  <Text className="text-sm text-danger">{item.notes}</Text>
                ) : null
              ) : null}
            </View>
          ))}
        </View>
      ))}

      {editable ? (
        <View className="gap-3 pt-1">
          <TextField label={t('tasks.inspectorNotes')} value={inspectorNotes} onChangeText={setInspectorNotes} multiline />
          {left > 0 ? <Text className="text-sm text-muted">{t('tasks.finishPending', { count: left })}</Text> : null}
          <Button label={t('tasks.finishInspection')} disabled={left > 0} loading={complete.isPending} onPress={finish} />
        </View>
      ) : null}
    </Section>
  );
}

/** Notes for a failed item, saved when the field loses focus. */
function ItemNotes({ item, onSave }: { item: ChecklistItem; onSave: (notes: string) => void }) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState(item.notes ?? '');
  return (
    <TextField
      label={t('tasks.itemNotes')}
      value={notes}
      onChangeText={setNotes}
      onBlur={() => onSave(notes.trim())}
      multiline
    />
  );
}
