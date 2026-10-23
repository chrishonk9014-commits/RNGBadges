import type { ApiError as ApiErrorBody } from '../shared/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

/** True when the request never reached the server (offline, server down). */
export const isNetworkError = (e: unknown): boolean => e instanceof ApiError && e.status === 0;

export async function api<T>(path: string, init: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, 'network', 'Can’t reach the RNG Badges server.');
  }
  if (res.ok) return (await res.json()) as T;
  let body: Partial<ApiErrorBody> = {};
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // Non-JSON error page (e.g. a proxy). Fall through with the status text.
  }
  throw new ApiError(res.status, body.error ?? 'http_error', body.message ?? res.statusText, body.retryAfterMs);
}
