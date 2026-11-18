import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Section } from '@/components/ui/section';
import { useErrorMessage } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import type { TaskDetail } from '@/lib/api/tasks';
import { useUploadTaskPhotos } from '@/lib/tasks/queries';

const MAX_PICK = 5;

export function PhotosSection({ task, canAdd }: { task: TaskDetail; canAdd: boolean }) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const upload = useUploadTaskPhotos(task.id);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const { width } = useWindowDimensions();
  const thumb = Math.floor((width - 32 - 32 - 16) / 3); // screen padding, card padding, 2 gaps

  async function send(assets: ImagePicker.ImagePickerAsset[]) {
    if (assets.length === 0) return;
    setUploadingCount(assets.length);
    try {
      await upload.mutateAsync(assets.map(({ uri, width: w, height: h }) => ({ uri, width: w, height: h })));
    } catch (error) {
      Alert.alert(errorMessage(error));
    } finally {
      setUploadingCount(0);
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('tasks.cameraDenied'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) await send(result.assets);
  }

  async function choosePhotos() {
    // The system photo picker needs no permission prompt.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PICK,
      quality: 0.8,
    });
    if (!result.canceled) await send(result.assets);
  }

  return (
    <Section title={t('tasks.photos')}>
      {task.photos.length === 0 && !uploadingCount ? (
        <Text className="text-sm text-muted">{t('tasks.noPhotos')}</Text>
      ) : null}

      {task.photos.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {task.photos.map((photo, index) => (
            <Pressable key={photo.id} accessibilityRole="imagebutton" onPress={() => setViewerIndex(index)}>
              <Image
                source={{ uri: photo.photoUrl }}
                style={{ width: thumb, height: thumb, borderRadius: 12, backgroundColor: '#e3e8e8' }}
                contentFit="cover"
                transition={150}
              />
            </Pressable>
          ))}
        </View>
      ) : null}

      {uploadingCount > 0 ? <Text className="text-sm text-brand">{t('tasks.uploading', { count: uploadingCount })}</Text> : null}

      {canAdd ? (
        <View className="flex-row gap-2">
          <Button className="flex-1" label={t('tasks.takePhoto')} icon={Camera} variant="secondary" disabled={upload.isPending} onPress={takePhoto} />
          <Button className="flex-1" label={t('tasks.choosePhotos')} icon={ImagePlus} variant="secondary" disabled={upload.isPending} onPress={choosePhotos} />
        </View>
      ) : null}

      <PhotoViewer photos={task.photos} index={viewerIndex} onClose={() => setViewerIndex(null)} />
    </Section>
  );
}

/** Full-screen photos, swipe between them. */
function PhotoViewer({
  photos,
  index,
  onClose,
}: {
  photos: TaskDetail['photos'];
  index: number | null;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={index !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-black">
        {index !== null ? (
          <FlatList
            data={photos}
            horizontal
            pagingEnabled
            initialScrollIndex={index}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(photo) => photo.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={{ width, height }} className="justify-center">
                <Image source={{ uri: item.photoUrl }} style={{ width, height: height * 0.8 }} contentFit="contain" />
                {item.caption ? <Text className="px-4 text-center text-white">{item.caption}</Text> : null}
              </View>
            )}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          className="absolute end-4 h-11 w-11 items-center justify-center rounded-full bg-white/20"
          style={{ top: insets.top + 8 }}>
          <X size={24} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}
