import type { ApiResponse } from '@/domain/api';
import { safeMessage, type ErrorCode } from '@/lib/errors';

const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
};

/**
 * Read any API response as the `{ data, error, meta }` envelope.
 *
 * Whatever actually arrived — our envelope, a 204, a platform error page, a body cut
 * off mid-stream — the caller gets an `ApiResponse` and branches only on `error`.
 *
 * A body that is not our envelope is never trusted for its message: the caller's
 * `fallbackMessage` (or the safe message for the status) is used instead, so a proxy's
 * HTML error page or an upstream's internals can never be rendered into the UI.
 */
export async function readApiResponse<T>(
  response: Response,
  options: { fallbackMessage?: string } = {},
): Promise<ApiResponse<T>> {
  const requestId = response.headers.get('x-request-id') ?? '';

  // A 204 has no body by definition. Endpoints that answer 204 are read as
  // `readApiResponse<null>`, which is what makes this cast true.
  if (response.status === 204) return { data: null as T, error: null, meta: { requestId } };

  const body: unknown = await response.json().catch(() => null);
  if (isEnvelope<T>(body)) return body;

  const code: ErrorCode = response.ok ? 'INTERNAL' : (CODE_BY_STATUS[response.status] ?? 'INTERNAL');
  return {
    data: null,
    error: { code, message: options.fallbackMessage ?? safeMessage(code) },
    meta: { requestId },
  };
}

function isEnvelope<T>(value: unknown): value is ApiResponse<T> {
  if (typeof value !== 'object' || value === null) return false;
  if (!('data' in value) || !('error' in value) || !('meta' in value)) return false;

  const { error, meta } = value;
  if (typeof meta !== 'object' || meta === null) return false;
  if (error === null) return true;

  return (
    typeof error === 'object' &&
    'code' in error &&
    'message' in error &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  );
}
