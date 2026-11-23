import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { PaginatedResult } from '@/domain/api';
import type { SessionContext } from '@/server/auth/session';

const state = vi.hoisted(() => {
  const secrets = {
    csrfSecret: 'c'.repeat(40),
    cronSecret: 'cron-secret-for-tests-'.padEnd(48, 'x'),
  };
  process.env.SESSION_SECRET = 's'.repeat(40);
  process.env.CSRF_SECRET = secrets.csrfSecret;
  process.env.APP_URL = 'http://localhost:3000';
  process.env.CRON_SECRET = secrets.cronSecret;
  return { ...secrets, session: null as SessionContext | null, origin: 'http://localhost:3000' as string | null };
});

vi.mock('@/server/security/request-context', () => ({
  getRequestContext: async () => ({
    ipAddress: '203.0.113.7',
    userAgent: 'vitest',
    requestId: 'req-test',
    origin: state.origin,
    referer: null,
  }),
  getAllowedOrigins: () => ['http://localhost:3000'],
}));
vi.mock('@/server/auth/current-user', () => ({ getCurrentSession: vi.fn(async () => state.session) }));
vi.mock('@/server/services/audit-service', () => ({ recordAudit: vi.fn(async () => undefined) }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { defineRoute } = await import('./route-handler');
const { getCurrentSession } = await import('@/server/auth/current-user');
const { recordAudit } = await import('@/server/services/audit-service');
const { logger } = await import('@/lib/logger');
const { CSRF_COOKIE, CSRF_HEADER, issueCsrfToken } = await import('@/server/security/csrf');
const { listingSlugSchema } = await import('@/lib/validation/listing');

const ORIGIN = 'http://localhost:3000';

const adminSession: SessionContext = {
  sessionId: 'sess-admin',
  user: {
    id: 'user-admin',
    email: 'admin@example.com',
    fullName: 'Admin User',
    role: 'admin',
    status: 'active',
    emailVerifiedAt: null,
  },
};
const buyerSession: SessionContext = {
  sessionId: 'sess-buyer',
  user: { ...adminSession.user, id: 'user-buyer', role: 'buyer' },
};

function get(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`${ORIGIN}${path}`, { headers });
}

async function post(
  path: string,
  body: string,
  options: { csrf?: boolean; headers?: Record<string, string> } = {},
): Promise<NextRequest> {
  const headers = new Headers({ 'content-type': 'application/json', origin: ORIGIN, ...options.headers });
  if (options.csrf !== false) {
    const token = await issueCsrfToken(state.csrfSecret);
    headers.set('cookie', `${CSRF_COOKIE}=${token}`);
    headers.set(CSRF_HEADER, token);
  }
  return new NextRequest(`${ORIGIN}${path}`, { method: 'POST', headers, body });
}

async function read(response: Response) {
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

beforeEach(() => {
  state.session = null;
  state.origin = ORIGIN;
  vi.clearAllMocks();
});

describe('defineRoute — envelope', () => {
  it('wraps handler data as { data, error: null, meta }', async () => {
    const route = defineRoute({}, async ({ respond }) => respond.ok({ hello: 'world' }));
    expect(await read(await route(get('/api/test')))).toEqual({
      status: 200,
      body: { data: { hello: 'world' }, error: null, meta: { requestId: 'req-test' } },
    });
  });

  it('puts paging in meta and nothing beyond the paging contract', async () => {
    const page = { items: [1, 2], page: 2, perPage: 2, total: 5, totalPages: 3, internalCursor: 'x' };
    const route = defineRoute({}, async ({ respond }) => respond.paginated(page as PaginatedResult<number>));
    const { body } = await read(await route(get('/api/test')));
    expect(body).toEqual({
      data: [1, 2],
      error: null,
      meta: { requestId: 'req-test', pagination: { page: 2, perPage: 2, total: 5, totalPages: 3 } },
    });
  });

  it('answers 204 with no body at all', async () => {
    const route = defineRoute({}, async ({ respond }) => respond.noContent());
    const response = await route(await post('/api/test', '{}'));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('never leaks an internal error to the client', async () => {
    const route = defineRoute({}, async () => {
      throw new Error('relation "users" does not exist');
    });
    const { status, body } = await read(await route(get('/api/test')));
    expect(status).toBe(500);
    expect(body).toEqual({
      data: null,
      error: { code: 'INTERNAL', message: 'Something went wrong on our end.' },
      meta: { requestId: 'req-test' },
    });
    expect(logger.error).toHaveBeenCalledOnce();
  });
});

describe('defineRoute — input validation', () => {
  const queryRoute = defineRoute(
    { query: z.object({ city: z.string().optional(), page: z.coerce.number().int().min(1).default(1) }) },
    async ({ query, respond }) => respond.ok(query),
  );

  it('parses the query string through its schema', async () => {
    const { body } = await read(await queryRoute(get('/api/test?city=pune&page=2')));
    expect(body.data).toEqual({ city: 'pune', page: 2 });
  });

  it('uses the first value of a repeated key', async () => {
    const { body } = await read(await queryRoute(get('/api/test?city=pune&city=mumbai')));
    expect(body.data).toEqual({ city: 'pune', page: 1 });
  });

  it('rejects an invalid query with 400 and field errors (02)', async () => {
    const { status, body } = await read(await queryRoute(get('/api/test?page=0')));
    expect(status).toBe(400);
    expect(body.error).toMatchObject({ code: 'BAD_REQUEST', fieldErrors: { page: expect.any(Array) } });
  });

  const slugRoute = defineRoute({ params: z.object({ slug: listingSlugSchema }) }, async ({ params, respond }) =>
    respond.ok(params.slug),
  );

  it('validates route params', async () => {
    const response = await slugRoute(get('/api/listings/x'), { params: Promise.resolve({ slug: 'flat-in-pune' }) });
    expect((await read(response)).body.data).toBe('flat-in-pune');
  });

  it('answers 404 for a malformed or missing param', async () => {
    const malformed = await slugRoute(get('/api/listings/x'), { params: Promise.resolve({ slug: 'Not A Slug!' }) });
    expect((await read(malformed)).body.error).toMatchObject({ code: 'NOT_FOUND' });
    expect((await slugRoute(get('/api/listings/x'))).status).toBe(404);
  });

  it('rejects an invalid body with 422 and field errors', async () => {
    const route = defineRoute({ schema: z.object({ name: z.string().min(2, 'Too short') }) }, async ({ respond }) =>
      respond.ok(null),
    );
    const { status, body } = await read(await route(await post('/api/test', '{"name":"x"}')));
    expect(status).toBe(422);
    expect(body.error).toMatchObject({ code: 'VALIDATION_FAILED', fieldErrors: { name: ['Too short'] } });
  });
});

describe('defineRoute — browser callers', () => {
  it('rejects a state-changing request without a CSRF token, and audits it', async () => {
    const route = defineRoute({}, async ({ respond }) => respond.noContent());
    const { status, body } = await read(await route(await post('/api/test', '{}', { csrf: false })));
    expect(status).toBe(403);
    expect(body.error).toMatchObject({ code: 'CSRF_FAILED' });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'security.csrf_rejected' }));
  });

  it('enforces permissions on the server', async () => {
    const route = defineRoute({ permission: 'admin:access' }, async ({ respond }) => respond.ok('admitted'));

    expect((await read(await route(get('/api/admin/test')))).body.error).toMatchObject({ code: 'UNAUTHENTICATED' });

    state.session = buyerSession;
    expect((await read(await route(get('/api/admin/test')))).body.error).toMatchObject({ code: 'FORBIDDEN' });

    state.session = adminSession;
    expect((await read(await route(get('/api/admin/test')))).body.data).toBe('admitted');
  });

  it('answers 429 in the envelope, with Retry-After', async () => {
    const route = defineRoute(
      { rateLimit: { name: 'test-route-handler-429', limit: 1, windowMs: 60_000 } },
      async ({ respond }) => respond.ok(null),
    );
    expect((await route(get('/api/test'))).status).toBe(200);

    const limited = await route(get('/api/test'));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBeTruthy();
    expect((await limited.json()).error).toMatchObject({ code: 'RATE_LIMITED' });
  });
});

describe('defineRoute — machine callers', () => {
  const cronRoute = defineRoute({ access: { kind: 'cron' } }, async ({ session, respond }) =>
    respond.ok({ sawSession: session !== null }),
  );

  it('accepts the configured bearer secret without CSRF and without loading a session', async () => {
    state.origin = null;
    const request = await post('/api/internal/jobs/test', '{}', {
      csrf: false,
      headers: { authorization: `Bearer ${state.cronSecret}` },
    });
    const { status, body } = await read(await cronRoute(request));
    expect(status).toBe(200);
    expect(body.data).toEqual({ sawSession: false });
    expect(getCurrentSession).not.toHaveBeenCalled();
  });

  it('rejects a missing or wrong secret with 401, and audits it', async () => {
    // Missing, wrong, and right-secret-wrong-scheme.
    const attempts: Record<string, string>[] = [{}, { authorization: 'Bearer wrong' }, { authorization: state.cronSecret }];
    for (const headers of attempts) {
      const { status, body } = await read(await cronRoute(get('/api/internal/jobs/test', headers)));
      expect(status).toBe(401);
      expect(body.error).toMatchObject({ code: 'UNAUTHENTICATED' });
    }
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'security.machine_auth_rejected' }));
  });

  it('refuses a permission on a machine route when the module loads', () => {
    expect(() =>
      defineRoute({ access: { kind: 'cron' }, permission: 'audit:read' }, async ({ respond }) => respond.noContent()),
    ).toThrow(/session routes only/);
  });

  const verify = vi.fn(async ({ rawBody }: { rawBody: string }) => rawBody.includes('"signed":true'));
  const webhookRoute = defineRoute(
    { access: { kind: 'webhook', verify }, schema: z.object({ signed: z.boolean(), type: z.string() }) },
    async ({ body, rawBody, respond }) => respond.ok({ type: body.type, rawBody }),
  );

  function webhookRequest(body: string) {
    // SNS posts JSON as text/plain and sends no Origin header.
    return new NextRequest(`${ORIGIN}/api/webhooks/test`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain; charset=UTF-8' },
      body,
    });
  }

  it('verifies the exact raw body, then parses it whatever its content type', async () => {
    const raw = '{"signed":true,"type":"Notification"}';
    const { status, body } = await read(await webhookRoute(webhookRequest(raw)));
    expect(status).toBe(200);
    expect(body.data).toEqual({ type: 'Notification', rawBody: raw });
    expect(verify).toHaveBeenCalledWith(expect.objectContaining({ rawBody: raw }));
  });

  it('rejects a body that fails verification', async () => {
    const { status } = await read(await webhookRoute(webhookRequest('{"signed":false,"type":"Notification"}')));
    expect(status).toBe(401);
  });

  it('treats a verifier that throws as a rejection', async () => {
    const route = defineRoute(
      {
        access: {
          kind: 'webhook',
          verify: async () => {
            throw new Error('certificate fetch failed');
          },
        },
      },
      async ({ respond }) => respond.noContent(),
    );
    expect((await route(webhookRequest('{}'))).status).toBe(401);
  });
});
