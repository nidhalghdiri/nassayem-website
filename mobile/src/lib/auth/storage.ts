import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { MobileUserSchema, type MobileUser } from '@/lib/api/schemas';

// The session token is a credential: keep it in the Keychain / Keystore.
const TOKEN_KEY = 'nassayem.sessionToken';
// The profile is not secret and can outgrow SecureStore's value size limit.
const USER_KEY = 'nassayem.user';

export async function loadStoredSession(): Promise<{ token: string; user: MobileUser | null } | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  if (!token) return null;

  const raw = await AsyncStorage.getItem(USER_KEY).catch(() => null);
  let user: MobileUser | null = null;
  try {
    const parsed = MobileUserSchema.safeParse(raw ? JSON.parse(raw) : null);
    user = parsed.success ? parsed.data : null;
  } catch {
    user = null;
  }
  return { token, user };
}

export async function storeSession(token: string, user: MobileUser): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await storeUser(user);
}

export async function storeUser(user: MobileUser): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user)).catch(() => {});
}

export async function clearStoredSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  await AsyncStorage.removeItem(USER_KEY).catch(() => {});
}
