import { describe, expect, it } from 'vitest';
import { readApiResponse } from './api-response';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-request-id': 'req-1' },
  });
}

describe('readApiResponse', () => {
  it('passes a success envelope through', async () => {
    const envelope = { data: { answer: 'yes' }, error: null, meta: { requestId: 'req-1' } };
    expect(await readApiResponse(jsonResponse(envelope))).toEqual(envelope);
  });

  it('passes an error envelope through with its message and field errors', async () => {
    const envelope = {
      data: null,
      error: { code: 'VALIDATION_FAILED', message: 'Some of the submitted values are invalid.', fieldErrors: { email: ['Enter a valid email address'] } },
      meta: { requestId: 'req-1' },
    };
    expect(await readApiResponse(jsonResponse(envelope, 422))).toEqual(envelope);
  });

  it('reads a 204 as success with no data', async () => {
    const result = await readApiResponse<null>(new Response(null, { status: 204 }));
    expect(result).toEqual({ data: null, error: null, meta: { requestId: '' } });
  });

  it('never renders a body that is not our envelope', async () => {
    const proxyPage = new Response('<html>502 Bad Gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } });
    const result = await readApiResponse(proxyPage, { fallbackMessage: 'Please try again.' });
    expect(result).toEqual({ data: null, error: { code: 'INTERNAL', message: 'Please try again.' }, meta: { requestId: '' } });
  });

  it('maps a bare status to its code and safe message when no fallback is given', async () => {
    const result = await readApiResponse(new Response('slow down', { status: 429 }));
    expect(result.error).toEqual({ code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' });
  });

  it('treats a 200 that is not an envelope as a failure, not as data', async () => {
    const result = await readApiResponse(jsonResponse({ answer: 'yes' }));
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe('INTERNAL');
  });
});
