import { describe, expect, it, vi } from 'vitest';

const BASE_ENV = {
  SESSION_SECRET: 's'.repeat(40),
  CSRF_SECRET: 'c'.repeat(40),
  APP_URL: 'http://localhost:3000',
};

/** `getServerEnv()` caches its parse, so each case loads a fresh copy of the module. */
async function loadEnv(overrides: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) vi.stubEnv(key, value);
  return import('./env');
}

describe('getCronSecret', () => {
  it('is null when unset, so every job call is rejected', async () => {
    expect((await loadEnv({ CRON_SECRET: '' })).getCronSecret()).toBeNull();
  });

  it('is null when too short to be a secret', async () => {
    expect((await loadEnv({ CRON_SECRET: 'short' })).getCronSecret()).toBeNull();
  });

  it('returns a configured secret', async () => {
    const secret = 'x'.repeat(48);
    expect((await loadEnv({ CRON_SECRET: secret })).getCronSecret()).toBe(secret);
  });
});

describe('getEmailConfig', () => {
  it('defaults to the console provider outside production', async () => {
    expect((await loadEnv({ EMAIL_PROVIDER: '' })).getEmailConfig().provider).toBe('console');
  });

  it('refuses to guess a provider in production', async () => {
    const env = await loadEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:password@localhost/bankseal',
      EMAIL_PROVIDER: '',
    });
    expect(() => env.getEmailConfig()).toThrow(/must be set in production/);
  });

  it('rejects an unknown provider', async () => {
    const env = await loadEnv({ EMAIL_PROVIDER: 'smtp' });
    expect(() => env.getEmailConfig()).toThrow(/"console" or "ses"/);
  });

  it('requires a sender and a region for SES', async () => {
    const env = await loadEnv({ EMAIL_PROVIDER: 'ses', EMAIL_FROM: '', AWS_REGION: 'ap-south-1' });
    expect(() => env.getEmailConfig()).toThrow(/EMAIL_FROM and AWS_REGION/);
  });

  it('never lets one subsystem break the rest: a bad email setting leaves getServerEnv working', async () => {
    const env = await loadEnv({ EMAIL_PROVIDER: 'smtp', CLOUDINARY_URL: 'not-a-url', CRON_SECRET: 'short' });
    expect(() => env.getServerEnv()).not.toThrow();
  });
});

describe('getCloudinaryConfig', () => {
  it('explains the expected format when misconfigured', async () => {
    const env = await loadEnv({ CLOUDINARY_URL: 'https://example.com' });
    expect(() => env.getCloudinaryConfig()).toThrow(/cloudinary:\/\/<api_key>:<api_secret>@<cloud_name>/);
  });
});
