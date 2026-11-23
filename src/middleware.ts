import { NextResponse, type NextRequest } from 'next/server';
import type { ApiFailure } from '@/domain/api';
import { parseCloudinaryUrl } from '@/lib/cloudinary-url';
import { CSRF_COOKIE } from '@/lib/csrf-constants';
import { safeMessage } from '@/lib/errors';
import { isSafeMethod } from '@/server/security/csrf';
import { hmacSign, randomToken } from '@/server/security/crypto';

/**
 * Edge middleware. Runs before every non-static request.
 *
 * Responsibilities, in order:
 *  1. stamp a request id used to correlate logs and audit rows;
 *  2. reject cross-origin state-changing requests early (cheap, before any DB work);
 *  3. mint a CSRF cookie for sessions that don't have one;
 *  4. emit a nonce-based Content-Security-Policy.
 *
 * Deliberately does NOT do authentication. Middleware cannot reach the database, so a
 * check here could only read an unverified cookie — and a "logged in" decision made on
 * an unverified cookie is exactly the bug class we're avoiding. Authorization happens in
 * Server Components, Server Actions and route handlers via `requirePermission`.
 */

const isProduction = process.env.NODE_ENV === 'production';

function allowedOrigins(): string[] {
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return [];
  try {
    return [new URL(appUrl).origin];
  } catch {
    return [];
  }
}

/**
 * Paths served to machines — schedulers and webhooks — rather than browsers.
 *
 * Exempt from the Origin check below because their callers never send one. Safe to
 * exempt because the routes behind them (`access: cron | webhook` in `defineRoute`)
 * never read a cookie: a cross-site request has no ambient credential to ride on, and
 * the route authenticates its caller by secret or signature instead. Dot segments are
 * already resolved in `nextUrl.pathname`, so `/api/webhooks/../auth/…` cannot match.
 */
const MACHINE_PATH_PREFIXES = ['/api/internal/', '/api/webhooks/'] as const;

function isMachinePath(pathname: string): boolean {
  return MACHINE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/** Our Cloudinary cloud, when configured. Only the name is used here — never the key or secret. */
const cloudinaryCloud = parseCloudinaryUrl(process.env.CLOUDINARY_URL)?.cloudName ?? null;

function buildCsp(nonce: string, pathname: string): string {
  // Media is served from our own cloud only, never from Cloudinary at large.
  const cloudinaryImages = cloudinaryCloud ? ` https://res.cloudinary.com/${cloudinaryCloud}/` : '';
  // Admin pages upload straight to Cloudinary with a server-issued signature. The
  // allowance is scoped to our cloud's upload path and to those pages alone, so script
  // injected anywhere else still cannot post data out to someone else's cloud.
  const adminUploads =
    cloudinaryCloud && isAdminPath(pathname) ? ` https://api.cloudinary.com/v1_1/${cloudinaryCloud}/` : '';

  const directives = [
    `default-src 'self'`,
    // strict-dynamic lets Next's nonce'd bootstrap load its own chunks; the host
    // allow-list is ignored by browsers that honour strict-dynamic and acts as a
    // fallback for those that don't.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isProduction ? '' : "'unsafe-eval'"}`.trim(),
    // Next injects inline <style> for critical CSS; a nonce is not threaded through
    // those, so 'unsafe-inline' is required for styles specifically. Scripts remain strict.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: https://images.unsplash.com https://tile.openstreetmap.org${cloudinaryImages}`,
    `font-src 'self' data:`,
    `connect-src 'self'${adminUploads}${isProduction ? '' : ' ws: http://localhost:*'}`,
    `object-src 'none'`,
    `base-uri 'none'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `manifest-src 'self'`,
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ];

  return directives.join('; ');
}

export async function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const nonce = randomToken(16);

  // --- 2. Cross-origin guard -------------------------------------------------
  if (!isSafeMethod(request.method) && !isMachinePath(request.nextUrl.pathname)) {
    const origin = request.headers.get('origin');
    const permitted = allowedOrigins();

    // A same-origin fetch always sends Origin for non-safe methods. A missing Origin
    // on a mutation is either an old client or a forgery attempt — fail closed.
    if (!origin || (permitted.length > 0 && !permitted.includes(origin))) {
      const body: ApiFailure = {
        data: null,
        error: { code: 'CSRF_FAILED', message: safeMessage('CSRF_FAILED') },
        meta: { requestId },
      };
      return NextResponse.json(body, {
        status: 403,
        headers: { 'x-request-id': requestId, 'Cache-Control': 'no-store' },
      });
    }
  }

  // Propagate context to the Node.js runtime via request headers.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // --- 3. CSRF cookie --------------------------------------------------------
  if (!request.cookies.has(CSRF_COOKIE)) {
    const secret = process.env.CSRF_SECRET;
    if (secret && secret.length >= 32) {
      const value = randomToken(32);
      const token = `${value}.${await hmacSign(secret, value)}`;
      response.cookies.set(CSRF_COOKIE, token, {
        // Readable by our own script so it can populate the x-csrf-token header.
        // Carries no authority by itself.
        httpOnly: false,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 8,
      });
    }
  }

  // --- 4. Content-Security-Policy -------------------------------------------
  response.headers.set('Content-Security-Policy', buildCsp(nonce, request.nextUrl.pathname));
  response.headers.set('x-request-id', requestId);

  return response;
}

export const config = {
  matcher: [
    /**
     * Everything except Next's static output, image optimiser and common static files.
     * Those are immutable assets with no session or CSRF surface.
     */
    {
      source: '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|webp|avif|gif|ico|woff2?)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
