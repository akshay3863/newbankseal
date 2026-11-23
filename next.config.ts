import type { NextConfig } from 'next';

/**
 * Security headers applied to every response.
 *
 * `Content-Security-Policy` is intentionally NOT set here — it is emitted per-request
 * from `src/middleware.ts` so that it can carry a fresh nonce. Everything below is
 * request-independent and therefore safe to serve statically.
 */
const securityHeaders = [
  // Stop the browser from MIME-sniffing a response away from the declared content type.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Clickjacking protection (CSP frame-ancestors is the modern equivalent; both are sent).
  { key: 'X-Frame-Options', value: 'DENY' },
  // Don't leak full URLs (which may carry ids) to third parties.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Force HTTPS for 2 years, including subdomains. Only honoured over TLS.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Drop powerful APIs this product never uses.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()',
  },
  // Cross-origin isolation hardening.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
];

/**
 * Our Cloudinary cloud name, from `cloudinary://<key>:<secret>@<cloud>`. Only the name is
 * read. Inlined rather than imported from `src/lib/cloudinary-url.ts` because this file
 * is loaded as ESM before the app's module resolution exists.
 */
function cloudinaryCloudName(): string | null {
  try {
    const url = new URL(process.env.CLOUDINARY_URL?.trim() ?? '');
    return url.protocol === 'cloudinary:' && /^[A-Za-z0-9_-]{1,64}$/.test(url.hostname) ? url.hostname : null;
  } catch {
    return null;
  }
}

const cloudinaryCloud = cloudinaryCloudName();

const nextConfig: NextConfig = {
  /**
   * `next build` and `next dev` share `.next` by default, so a verification build run
   * while the dev server is up wipes the manifests it is serving and the running app
   * loses its stylesheet. `npm run build:check` sets this to build somewhere else.
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',

  reactStrictMode: true,
  poweredByHeader: false,

  // Fail the production build on type or lint errors — never ship a broken contract.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },

  experimental: {
    // Server Actions are same-origin only; add deploy domains via env at rollout time.
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    // Every `quality` value used anywhere in the app must be declared here; Next 16
    // rejects undeclared ones rather than silently re-encoding at the default.
    qualities: [75, 82],
    // Allow-list remote image hosts explicitly; never use a wildcard.
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Scoped to our own cloud. Allowing all of res.cloudinary.com would let anyone run
      // any Cloudinary-hosted image through this deployment's optimiser, on our bill.
      ...(cloudinaryCloud
        ? [{ protocol: 'https' as const, hostname: 'res.cloudinary.com', pathname: `/${cloudinaryCloud}/**` }]
        : []),
    ],
  },

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // API responses must never be cached by shared caches.
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' }],
      },
    ];
  },
};

export default nextConfig;
