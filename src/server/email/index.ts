import 'server-only';

import { getEmailConfig } from '@/lib/env';
import { createConsoleEmailProvider } from './console-provider';
import type { EmailProvider } from './types';

export type { EmailCategory, EmailMessage, EmailProvider, EmailSendResult } from './types';

let testOverride: EmailProvider | null = null;

/**
 * The configured provider. Resolved per call, so a configuration error surfaces when
 * mail is actually sent rather than when some unrelated module imports this one.
 */
export function getEmailProvider(): EmailProvider {
  if (testOverride) return testOverride;

  const config = getEmailConfig();
  if (config.provider === 'ses') {
    // Implemented by the Notifications workstream (06) behind this same interface.
    throw new Error('The SES email provider is not implemented yet (workstream 06).');
  }
  return createConsoleEmailProvider({ includeBody: process.env.NODE_ENV === 'development' });
}

/** Tests only: send through `provider` (e.g. a memory provider); `null` restores the default. */
export function setEmailProviderForTests(provider: EmailProvider | null): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setEmailProviderForTests() may only be called from tests.');
  }
  testOverride = provider;
}
