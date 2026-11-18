import Constants from 'expo-constants';

const PRODUCTION_API_URL = 'https://www.nassayem.com';

/**
 * In development, the website runs on the same computer as Metro (port 3000),
 * so its address follows Metro's — no need to edit .env when the Wi-Fi gives
 * the computer a new IP.
 */
function devApiUrl(): string | null {
  if (!__DEV__) return null;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:3000` : null;
}

/** Website that serves the mobile API. EXPO_PUBLIC_API_URL (builds' eas.json profiles) wins. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || devApiUrl() || PRODUCTION_API_URL).replace(/\/+$/, '');

/** Version of this build (app.json "version"), compared with the API's minAppVersion. */
export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
