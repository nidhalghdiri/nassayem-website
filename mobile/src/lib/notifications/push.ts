import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { registerDevice, unregisterDevice } from '@/lib/api/notifications';

// The token this phone registered, so sign-out can unregister exactly it.
const PUSH_TOKEN_KEY = 'nassayem.pushToken';
export const ANDROID_CHANNEL_ID = 'default'; // must match lib/appNotifications.ts on the server

// Show notifications that arrive while the app is open, too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type PushRegistration = 'registered' | 'denied' | 'unavailable' | 'failed';

/**
 * Asks for permission (once — Android and iOS remember the answer), gets this
 * phone's Expo push token and registers it for the signed-in user.
 */
export async function registerForPush(): Promise<PushRegistration> {
  // Simulators/emulators cannot receive remote pushes.
  if (!Device.isDevice) return 'unavailable';

  try {
    // Android 13+ only shows the permission prompt once a channel exists.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Nassayem',
        importance: AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2a7475',
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerDevice(token);
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token).catch(() => {});
    return 'registered';
  } catch (error) {
    // Typically: no Firebase (FCM) credentials in an Android build, or no network.
    if (__DEV__) console.warn('[push] registration failed', error);
    return 'failed';
  }
}

/** Stops this phone receiving the current user's pushes (call while still signed in). */
export async function unregisterForPush(): Promise<void> {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY).catch(() => null);
  if (!token) return;
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => {});
  try {
    await unregisterDevice(token);
  } catch {
    // Best effort: the server also drops tokens Expo reports as gone.
  }
  await Notifications.setBadgeCountAsync(0).catch(() => {});
}

export async function notificationsAllowed(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}
