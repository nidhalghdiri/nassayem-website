import { SendHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, I18nManager, Pressable, TextInput, View } from 'react-native';

import { Section } from '@/components/ui/section';
import { useErrorMessage } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import type { TaskDetail } from '@/lib/api/tasks';
import { fontFamily } from '@/lib/fonts';
import { formatDateTime } from '@/lib/format';
import { useLanguage } from '@/lib/i18n/use-language';
import { useAddTaskNote } from '@/lib/tasks/queries';

export function NotesSection({ task }: { task: TaskDetail }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const errorMessage = useErrorMessage();
  const mutation = useAddTaskNote(task.id);
  const [text, setText] = useState('');

  async function send() {
    const value = text.trim();
    if (!value || mutation.isPending) return;
    try {
      await mutation.mutateAsync(value);
      setText('');
    } catch (error) {
      Alert.alert(errorMessage(error));
    }
  }

  return (
    <Section title={t('tasks.notes')}>
      {task.notes.length === 0 ? <Text className="text-sm text-muted">{t('tasks.noNotes')}</Text> : null}
      {task.notes.map((note) => (
        <View key={note.id} className="gap-1 rounded-xl bg-background p-3">
          <Text>{note.text}</Text>
          <Text className="text-xs text-muted">
            {note.user.name ?? '—'} · {formatDateTime(note.createdAt, language)}
          </Text>
        </View>
      ))}

      <View className="flex-row items-end gap-2">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('tasks.addNote')}
          placeholderTextColor="#9aa8a9"
          multiline
          maxLength={2000}
          className="max-h-32 min-h-12 flex-1 rounded-xl border border-border bg-surface px-3 py-3 text-base text-ink"
          style={{ fontFamily: fontFamily(language, 'regular'), textAlign: I18nManager.isRTL ? 'right' : 'left' }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('tasks.send')}
          onPress={send}
          disabled={!text.trim() || mutation.isPending}
          className={`h-12 w-12 items-center justify-center rounded-xl bg-brand active:bg-brand-dark ${!text.trim() ? 'opacity-40' : ''}`}>
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            // Mirror the arrow so it points "forward" in Arabic too.
            <SendHorizontal size={20} color="#fff" style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }} />
          )}
        </Pressable>
      </View>
    </Section>
  );
}
