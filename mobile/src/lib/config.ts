import Constants from 'expo-constants';

const PRODUCTION_API_URL = 'https://www.nassayem.com';

/** Website that serves the mobile API. Set EXPO_PUBLIC_API_URL in .env for local dev. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL).replace(/\/+$/, '');

/** Version of this build (app.json "version"), compared with the API's minAppVersion. */
export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
