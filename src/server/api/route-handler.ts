import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { ApiFailure, ApiSuccess, PaginatedResult } from '@/domain/api';
import {
  AppError,
  invalidQuery,
  notFound,
  toPublicError,
  unauthenticated,
  validationFailed,
  type PublicError,
} from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getCronSecret, getServerEnv } from '@/lib/env';
import { CSRF_HEADER } from '@/lib/csrf-constants';
import { CSRF_COOKIE, verifyCsrf } from '@/server/security/csrf';
import { sha256Hex, timingSafeEqual } from '@/server/security/crypto';
import { checkRateLimit, rateLimitHeaders, type RateLimitRule } from '@/server/security/rate-limit';
import { getAllowedOrigins, getRequestContext, type RequestContext } from '@/server/security/request-context';
import { getCurrentSession } from '@/server/auth/current-user';
import { requirePermission, type Permission } from '@/server/auth/rbac';
import type { SessionContext } from '@/server/auth/session';
import { recordAudit } from '@/server/services/audit-service';

/**
 * The single entry point for every API route.
 *
 * Routing every handler through one wrapper means the security checks are applied by
 * construction rather than by remembering: a new endpoint gets CSRF verification, rate
 * limiting, body-size limits, schema validation, permission checks and safe error
 * serialisation without its author opting in. Forgetting a guard requires actively
 * bypassing this function, which is visible in review — and fails the architecture test.
 *
 * Order matters — the cheapest and most protective checks run first, so an unauthorised
 * or forged request is rejected before it can touch the database:
 *
 *   1. CSRF (browser routes)       4. session + permission (browser routes)
 *   2. rate limit                  5. input: params → 404, query → 400, body → 422
 *   3. secret / signature (machine routes)
 *
 * Every response is the `{ data, error, meta }` envelope from `@/domain/api`.
 */

/**
 * Who may call a route.
 *
 * - `session` (default): browsers. CSRF is verified on state-changing methods, and the
 *   caller's session, if any, is resolved and checked against `permission`.
 * - `cron`: a scheduler presenting `Authorization: Bearer <CRON_SECRET>`, which is what
 *   Vercel Cron sends.
 * - `webhook`: a third party whose request `verify` authenticates over the exact raw
 *   body, such as an SNS message signature.
 *
 * Machine routes never read cookies — their `session` is always null — so there is no
 * ambient credential for a cross-site request to ride on, and CSRF does not apply. They
 * must live under `/api/internal/` or `/api/webhooks/`, the only paths middleware admits
 * without an `Origin` header; the architecture test enforces both halves of that.
 */
export type RouteAccess =
  | { kind: 'session' }
  | { kind: 'cron' }
  | { kind: 'webhook'; verify: (input: { request: NextRequest; rawBody: string }) => Promise<boolean> };

type Schema = z.ZodTypeAny | undefined;
type Inferred<TSchema> = TSchema extends z.ZodTypeAny ? z.infer<TSchema> : undefined;

interface RouteOptions<TBody extends Schema, TQuery extends Schema, TParams extends Schema> {
  /** Zod schema for the JSON body. Omit for endpoints that take no body. Failure is a 422. */
  schema?: TBody;
  /** Zod schema for the query string. Each key's first value is used. Failure is a 400. */
  query?: TQuery;
  /**
   * Zod schema for dynamic route segments. Failure is a 404: a malformed id or slug
   * addresses nothing, and describing why in more detail only helps enumeration.
   */
  params?: TParams;
  /** Rate-limit rule. Every mutating endpoint should set one. */
  rateLimit?: RateLimitRule;
  /** Permission required to invoke the route. Omit for public endpoints. Session routes only. */
  permission?: Permission;
  /** Skip CSRF verification. Only valid for endpoints that cannot mutate state. */
  skipCsrf?: boolean;
  access?: RouteAccess;
}

export interface Responder {
  /** `{ data, error: null, meta }` with status 200, or `status`. */
  ok<T>(data: T, init?: { status?: number; headers?: Record<string, string> }): Response;
  /** One page of results: the items as `data`, paging in `meta.pagination`. */
  paginated<T>(result: PaginatedResult<T>): Response;
  /** 204. Deliberately bodiless — the platform refuses to send a 204 that has one. */
  noContent(): Response;
}

interface HandlerContext<TBody, TQuery, TParams> {
  request: NextRequest;
  body: TBody;
  query: TQuery;
  params: TParams;
  /** Always null on `cron` and `webhook` routes, which never read cookies. */
  session: SessionContext | null;
  requestContext: RequestContext;
  /** The exact request body. Set only on `webhook` routes, whose signature covers it. */
  rawBody: string | null;
  respond: Responder;
}

/** JSON bodies above this are rejected before parsing. Prevents memory-exhaustion posts. */
const MAX_BODY_BYTES = 64 * 1024;

export function defineRoute<
  TBody extends Schema = undefined,
  TQuery extends Schema = undefined,
  TParams extends Schema = undefined,
>(
  options: RouteOptions<TBody, TQuery, TParams>,
  handler: (context: HandlerContext<Inferred<TBody>, Inferred<TQuery>, Inferred<TParams>>) => Promise<Response>,
) {
  const access: RouteAccess = options.access ?? { kind: 'session' };

  if (access.kind !== 'session' && options.permission) {
    // A machine route has no session, so the check could only ever fail — or, worse,
    // be "fixed" by loading one. Refuse the configuration when the module loads.
    throw new Error('defineRoute: `permission` applies to session routes only; machine routes authenticate by secret or signature.');
  }

  // Next passes `{ params: Promise<…> }` as the second argument. It is typed `unknown`
  // so one wrapper satisfies every route's segment shape; `params` is schema-validated
  // before a handler sees it.
  return async function route(request: NextRequest, context?: unknown): Promise<Response> {
    const requestContext = await getRequestContext();
    const respond = createResponder(requestContext.requestId);

    try {
      // --- 1. CSRF ------------------------------------------------------------
      if (access.kind === 'session' && !options.skipCsrf) {
        await assertCsrf(request, requestContext);
      }

      // --- 2. Rate limit ------------------------------------------------------
      let limitHeaders: Record<string, string> = {};
      if (options.rateLimit) {
        const limit = await checkRateLimit(options.rateLimit, requestContext.ipAddress);
        limitHeaders = rateLimitHeaders(limit);

        if (!limit.allowed) {
          return errorResponse(toPublicError(new AppError('RATE_LIMITED')).body, 429, requestContext.requestId, limitHeaders);
        }
      }

      // --- 3. Machine callers ---------------------------------------------------
      // Behind the limiter: a signature check can mean fetching a signing certificate,
      // and every rejection writes an audit row.
      let rawBody: string | null = null;
      if (access.kind === 'cron') {
        await assertCronSecret(request, requestContext);
      } else if (access.kind === 'webhook') {
        rawBody = await readBodyText(request);
        await assertWebhookSignature(access, request, rawBody, requestContext);
      }

      // --- 4. Authorization ---------------------------------------------------
      const session = access.kind === 'session' ? await getCurrentSession() : null;
      if (options.permission) {
        requirePermission(session, options.permission);
      }

      // --- 5. Input -------------------------------------------------------------
      // After authorization, so an unauthenticated caller cannot probe which ids exist.
      const params = (options.params ? await parseParams(context, options.params) : undefined) as Inferred<TParams>;
      const query = (options.query ? parseQuery(request, options.query) : undefined) as Inferred<TQuery>;
      const body = (options.schema ? await parseBody(request, options.schema, rawBody) : undefined) as Inferred<TBody>;

      const response = await handler({ request, body, query, params, session, requestContext, rawBody, respond });
      for (const [key, value] of Object.entries(limitHeaders)) response.headers.set(key, value);
      return response;
    } catch (error) {
      return handleError(error, request, requestContext);
    }
  };
}

async function assertCsrf(request: NextRequest, requestContext: RequestContext): Promise<void> {
  const { CSRF_SECRET } = getServerEnv();
  const result = await verifyCsrf({
    secret: CSRF_SECRET,
    method: request.method,
    origin: requestContext.origin,
    referer: requestContext.referer,
    allowedOrigins: getAllowedOrigins(),
    cookieToken: request.cookies.get(CSRF_COOKIE)?.value,
    submittedToken: request.headers.get(CSRF_HEADER) ?? undefined,
  });

  if (!result.ok) {
    await recordAudit({
      action: 'security.csrf_rejected',
      outcome: 'failure',
      metadata: { reason: result.reason, path: new URL(request.url).pathname },
      context: requestContext,
    });
    throw new AppError('CSRF_FAILED');
  }
}

async function assertCronSecret(request: NextRequest, requestContext: RequestContext): Promise<void> {
  const path = new URL(request.url).pathname;
  const secret = getCronSecret();
  if (!secret) logger.error('api.cron_secret_not_configured', { path });

  // Digest both sides so the comparison always runs over two equal-length values.
  const presented = request.headers.get('authorization') ?? '';
  const valid =
    secret !== null && timingSafeEqual(await sha256Hex(presented), await sha256Hex(`Bearer ${secret}`));

  if (!valid) {
    await recordAudit({
      action: 'security.machine_auth_rejected',
      outcome: 'failure',
      metadata: { access: 'cron', path },
      context: requestContext,
    });
    throw unauthenticated();
  }
}

async function assertWebhookSignature(
  access: Extract<RouteAccess, { kind: 'webhook' }>,
  request: NextRequest,
  rawBody: string,
  requestContext: RequestContext,
): Promise<void> {
  const path = new URL(request.url).pathname;

  let valid = false;
  try {
    valid = await access.verify({ request, rawBody });
  } catch (error) {
    // A verifier that throws has not verified anything.
    logger.warn('api.webhook_verifier_threw', { path, error });
  }

  if (!valid) {
    await recordAudit({
      action: 'security.machine_auth_rejected',
      outcome: 'failure',
      metadata: { access: 'webhook', path },
      context: requestContext,
    });
    throw unauthenticated();
  }
}

function assertDeclaredLength(request: NextRequest): void {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new AppError('BAD_REQUEST', 'Request body is too large.', { expose: true });
  }
}

async function readBodyText(request: NextRequest): Promise<string> {
  assertDeclaredLength(request);
  const text = await request.text();
  // Guard again after reading: content-length is client-supplied and can lie.
  if (text.length > MAX_BODY_BYTES) {
    throw new AppError('BAD_REQUEST', 'Request body is too large.', { expose: true });
  }
  return text;
}

async function parseBody<TSchema extends z.ZodTypeAny>(
  request: NextRequest,
  schema: TSchema,
  rawBody: string | null,
): Promise<z.infer<TSchema>> {
  if (rawBody === null) {
    assertDeclaredLength(request);
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new AppError('BAD_REQUEST', 'Expected a JSON request body.', { expose: true });
    }
  }
  // A webhook body was already read for its signature. Providers disagree on its
  // content type (SNS sends text/plain), so it is not enforced there.
  const text = rawBody ?? (await readBodyText(request));

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AppError('BAD_REQUEST', 'Request body is not valid JSON.', { expose: true });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // Field messages are authored by us in the schemas and are safe to return; they
    // describe the input, never the system.
    throw validationFailed(parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }

  return parsed.data;
}

async function parseParams<TSchema extends z.ZodTypeAny>(context: unknown, schema: TSchema): Promise<z.infer<TSchema>> {
  const raw = typeof context === 'object' && context !== null && 'params' in context ? await context.params : undefined;
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) throw notFound();
  return parsed.data;
}

function parseQuery<TSchema extends z.ZodTypeAny>(request: NextRequest, schema: TSchema): z.infer<TSchema> {
  // First value wins for a repeated key, as on the browse page: `?city=a&city=b` is
  // read as `a` rather than rejected wholesale. A Map keeps `__proto__` an ordinary key.
  const values = new Map<string, string>();
  for (const [key, value] of new URL(request.url).searchParams) {
    if (!values.has(key)) values.set(key, value);
  }

  const parsed = schema.safeParse(Object.fromEntries(values));
  if (!parsed.success) {
    throw invalidQuery(parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }
  return parsed.data;
}

function createResponder(requestId: string): Responder {
  return {
    ok<T>(data: T, init: { status?: number; headers?: Record<string, string> } = {}) {
      const body: ApiSuccess<T> = { data, error: null, meta: { requestId } };
      return jsonResponse(body, init.status ?? 200, init.headers);
    },
    paginated<T>(result: PaginatedResult<T>) {
      // Copied field by field so nothing beyond the paging contract reaches the client.
      const body: ApiSuccess<T[]> = {
        data: result.items,
        error: null,
        meta: {
          requestId,
          pagination: { page: result.page, perPage: result.perPage, total: result.total, totalPages: result.totalPages },
        },
      };
      return jsonResponse(body, 200);
    },
    noContent() {
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    },
  };
}

function handleError(error: unknown, request: NextRequest, context: RequestContext): Response {
  const { status, body } = toPublicError(error);

  // Unexpected failures are logged in full server-side; the client sees only a
  // generic message and the request id it can quote to support.
  if (status >= 500) {
    logger.error('api.unhandled_error', {
      path: new URL(request.url).pathname,
      method: request.method,
      requestId: context.requestId,
      error,
    });
  } else {
    logger.info('api.request_rejected', {
      path: new URL(request.url).pathname,
      code: body.code,
      requestId: context.requestId,
    });
  }

  return errorResponse(body, status, context.requestId);
}

function errorResponse(error: PublicError, status: number, requestId: string, headers: Record<string, string> = {}): Response {
  const body: ApiFailure = { data: null, error, meta: { requestId } };
  return jsonResponse(body, status, { 'x-request-id': requestId, ...headers });
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return NextResponse.json(body, {
    status,
    headers: {
      // API responses are per-user by definition; never let a shared cache hold one.
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}
