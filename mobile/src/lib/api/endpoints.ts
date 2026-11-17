import { apiRequest } from './client';
import {
  ConfigResponseSchema,
  LoginResponseSchema,
  MeResponseSchema,
  type Language,
} from './schemas';

export function login(email: string, password: string) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
    schema: LoginResponseSchema,
    auth: false,
  });
}

export async function fetchMe() {
  return (await apiRequest('/me', { schema: MeResponseSchema })).user;
}

export async function updateMyLanguage(preferredLanguage: Language) {
  return (
    await apiRequest('/me', {
      method: 'PATCH',
      body: { preferredLanguage },
      schema: MeResponseSchema,
    })
  ).user;
}

export function fetchAppConfig() {
  return apiRequest('/config', { schema: ConfigResponseSchema, auth: false });
}
