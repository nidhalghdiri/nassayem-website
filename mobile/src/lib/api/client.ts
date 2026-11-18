import type { z } from 'zod';

import { API_URL } from '@/lib/config';

/** Error codes the API returns (lib/mobileApi.ts) plus client-side failures. */
export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_CREDENTIALS'
  | 'TOO_MANY_ATTEMPTS'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'REJECTED'
  | 'NETWORK'
  | 'BAD_RESPONSE'
  | 'SERVER';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ApiError';
  }
}

// The session provider registers these so the client can stay a plain module
// (usable from TanStack Query functions, outside React).
let getToken: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

export function configureApiClient(options: {
  getToken: () => string | null;
  onUnauthorized: () => void;
}) {
  getToken = options.getToken;
  onUnauthorized = options.onUnauthorized;
}

type RequestOptions<T> = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Multipart body (photo uploads); sent instead of `body`. */
  formData?: FormData;
  /** Validates the JSON response; the request fails with BAD_RESPONSE if it does not match. */
  schema: z.ZodType<T>;
  /** Send the stored token (default true). */
  auth?: boolean;
  signal?: AbortSignal;
};

const REQUEST_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 120_000;

export async function apiRequest<T>(path: string, options: RequestOptions<T>): Promise<T> {
  const { method = 'GET', body, formData, schema, auth = true, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  // Plain AbortController: AbortSignal.timeout/any are not reliable on Hermes.
  const controller = new AbortController();
  // Photo uploads on mobile data can take a while.
  const timer = setTimeout(() => controller.abort(), formData ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/mobile/v1${path}`, {
      method,
      headers,
      // For FormData, fetch sets the multipart Content-Type with its boundary.
      body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
      signal: controller.signal,
    });
  } catch (error) {
    if (__DEV__) console.warn(`[api] ${method} ${path} failed before a response`, error);
    throw new ApiError('NETWORK', 0);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const { code, error } = (json ?? {}) as { code?: ApiErrorCode; error?: string };
    if (response.status === 401 && token) onUnauthorized();
    throw new ApiError(code ?? (response.status >= 500 ? 'SERVER' : 'BAD_RESPONSE'), response.status, error);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    if (__DEV__) console.warn(`[api] ${method} ${path} response did not match schema`, parsed.error);
    throw new ApiError('BAD_RESPONSE', response.status);
  }
  return parsed.data;
}
