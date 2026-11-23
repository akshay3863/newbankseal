import { z } from 'zod';
import { parseCloudinaryUrl, type CloudinaryCredentials } from '@/lib/cloudinary-url';

/**
 * Fail-fast environment validation.
 *
 * Split into two schemas so that a client bundle can never pull in a server secret:
 * `serverEnv` is guarded by a runtime check and must only be imported from server code,
 * while `clientEnv` contains exclusively NEXT_PUBLIC_* values.
 */

const nonEmpty = (name: string) => z.string().min(1, `${name} must be set`);

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /**
   * Optional in the schema, required in practice.
   *
   * It is not `nonEmpty` here because this schema is parsed as a whole by every
   * subsystem: making one variable mandatory for all of them meant a missing database
   * URL also disabled CSRF and sessions, taking down API routes that never touch
   * Postgres. The requirement is enforced instead by the production refinement below
   * and by `getDatabaseUrl()`, so a real deployment still fails loudly.
   */
  DATABASE_URL: z.string().url().optional(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),

  /**
   * Canonical origin. Security-relevant: CSRF and cookie scoping compare against it.
   * Defaults to the deployment origin Vercel injects so a preview build is not blocked,
   * but a production deployment on a custom domain MUST set this explicitly — the
   * injected value is the *.vercel.app host, which would reject legitimate requests.
   */
  APP_URL: z
    .string()
    .optional()
    .transform((value) => value?.trim() || process.env.VERCEL_URL || '')
    .transform((value) => (value && !/^https?:\/\//i.test(value) ? `https://${value}` : value))
    .pipe(nonEmpty('APP_URL').url()),

  // 32 bytes of entropy minimum. Base64 of 32 bytes is 44 chars.
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  CSRF_SECRET: z.string().min(32, 'CSRF_SECRET must be at least 32 characters'),

  RATE_LIMIT_REDIS_URL: z.string().url().optional().or(z.literal('')),
  RATE_LIMIT_REDIS_TOKEN: z.string().optional(),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  /*
   * Everything below belongs to a single subsystem, so — for the reason given on
   * DATABASE_URL — each is a plain optional string here and is validated by its own
   * accessor further down. A malformed value then breaks that feature, loudly, instead
   * of every route that parses this schema.
   */

  /** `cloudinary://<api_key>:<api_secret>@<cloud_name>`. See `getCloudinaryConfig()`. */
  CLOUDINARY_URL: z.string().optional(),

  /** `console` | `ses`. Must be explicit in production. See `getEmailConfig()`. */
  EMAIL_PROVIDER: z.string().optional(),
  /** Verified SES sender, e.g. `Bank Seal <no-reply@example.com>`. */
  EMAIL_FROM: z.string().optional(),
  AWS_REGION: z.string().optional(),
  // Read by the AWS SDK's own credential chain. Declared so the contract lives in one
  // place; never read or logged by application code.
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  SES_CONFIGURATION_SET: z.string().optional(),
  /** The only SNS topic the bounce/complaint webhook accepts messages from. */
  SES_SNS_TOPIC_ARN: z.string().optional(),

  /** Bearer secret for `/api/internal/*`. See `getCronSecret()`. */
  CRON_SECRET: z.string().optional(),

  /** Search Console HTML-tag verification token. */
  GOOGLE_SITE_VERIFICATION: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  /**
   * GA4 measurement id. Analytics is optional, so a value that is not one is dropped
   * instead of failing the build — this schema is parsed at module load.
   */
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z
    .string()
    .trim()
    .regex(/^G-[A-Z0-9]{4,}$/)
    .optional()
    .catch(undefined),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

let cachedServerEnv: ServerEnv | null = null;

/**
 * Parse and cache the server environment. Throws on first access if misconfigured,
 * which surfaces the problem at boot rather than at the first request that needs it.
 */
export function getServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('getServerEnv() was called in the browser. This is a server-only module.');
  }
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverSchema
    .superRefine((env, ctx) => {
      // A serving production process must have a database. During `next build` there
      // is nothing to connect to yet, so that phase is exempt.
      const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
      if (env.NODE_ENV === 'production' && !isBuildPhase && !env.DATABASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DATABASE_URL'],
          message: 'DATABASE_URL is required in production',
        });
      }
    })
    .safeParse(process.env);

  if (!parsed.success) {
    // Print the failing keys only — never the values, which are secrets.
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid server environment configuration:\n${issues}`);
  }

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

/**
 * Resolve the public origin without ever throwing.
 *
 * This value only feeds `metadataBase`, the sitemap entry and share links. Getting it
 * wrong degrades those; it should not be able to fail a deployment. The previous
 * version parsed at module scope, so an empty or protocol-less value took the whole
 * build down while collecting page data — Zod's `.default()` only applies to
 * `undefined`, not to `""` or to `app.example.com`.
 *
 * Resolution order: an explicit NEXT_PUBLIC_APP_URL, then the origin Vercel injects for
 * the current deployment, then localhost.
 */
function resolvePublicAppUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    // Vercel supplies these as bare hostnames, with no scheme.
    process.env.NEXT_PUBLIC_VERCEL_URL,
    process.env.VERCEL_URL,
  ];

  for (const candidate of candidates) {
    const normalised = normaliseOrigin(candidate);
    if (normalised) return normalised;
  }

  return 'http://localhost:3000';
}

/** Accepts a full URL or a bare host, and returns a valid origin or null. */
function normaliseOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

// Still parsed through the schema so the contract has one definition, but against a
// value the resolver has already guaranteed is a valid absolute URL — so this cannot
// throw during a build the way parsing raw `process.env` did.
export const clientEnv: ClientEnv = clientSchema.parse({
  NEXT_PUBLIC_APP_URL: resolvePublicAppUrl(),
  // Written out in full so Next can inline it into client bundles.
  NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
});

export const isProduction = process.env.NODE_ENV === 'production';

/**
 * The database connection string, or a clear failure.
 *
 * Separated from `getServerEnv()` so the database's requirements stay the database's:
 * callers that need Postgres get an actionable error, and callers that don't are
 * unaffected by its absence.
 */
export function getDatabaseUrl(): string {
  const url = getServerEnv().DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not configured. Copy .env.example to .env.local and add your Neon connection string, then run `npm run db:push && npm run db:seed`.',
    );
  }
  return url;
}

/** Cloudinary credentials for signing uploads and deleting assets, or a clear failure. */
export function getCloudinaryConfig(): CloudinaryCredentials {
  const credentials = parseCloudinaryUrl(getServerEnv().CLOUDINARY_URL);
  if (!credentials) {
    throw new Error(
      'CLOUDINARY_URL is missing or malformed. Expected cloudinary://<api_key>:<api_secret>@<cloud_name>.',
    );
  }
  return credentials;
}

const MIN_CRON_SECRET_LENGTH = 32;

/**
 * The bearer secret scheduled jobs must present, or null.
 *
 * Null when unset or too short to be a secret — and a null secret rejects every caller.
 * A job endpoint whose secret was never configured must be unreachable, not open.
 */
export function getCronSecret(): string | null {
  const secret = getServerEnv().CRON_SECRET?.trim();
  if (!secret || secret.length < MIN_CRON_SECRET_LENGTH) return null;
  return secret;
}

export type EmailProviderName = 'console' | 'ses';

export interface EmailConfig {
  provider: EmailProviderName;
  from: string | null;
  region: string | null;
  configurationSet: string | null;
  snsTopicArn: string | null;
}

/**
 * Mail configuration, or a clear failure.
 *
 * Production must name its provider. Defaulting a production process to `console`
 * would turn every verification and reset email into a log line while the page tells
 * the user to check their inbox. A preview that must never send mail says `console`.
 */
export function getEmailConfig(): EmailConfig {
  const env = getServerEnv();
  const requested = env.EMAIL_PROVIDER?.trim();

  let provider: EmailProviderName | null;
  if (requested === 'console' || requested === 'ses') provider = requested;
  else if (requested) throw new Error('EMAIL_PROVIDER must be "console" or "ses".');
  else provider = env.NODE_ENV === 'production' ? null : 'console';

  if (!provider) {
    throw new Error('EMAIL_PROVIDER must be set in production: "ses", or "console" for a deployment that must not send mail.');
  }

  const from = env.EMAIL_FROM?.trim() || null;
  const region = env.AWS_REGION?.trim() || null;
  if (provider === 'ses' && (!from || !region)) {
    throw new Error('EMAIL_PROVIDER=ses requires EMAIL_FROM and AWS_REGION.');
  }

  return {
    provider,
    from,
    region,
    configurationSet: env.SES_CONFIGURATION_SET?.trim() || null,
    snsTopicArn: env.SES_SNS_TOPIC_ARN?.trim() || null,
  };
}
