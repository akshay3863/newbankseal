import 'server-only';

import { logger } from '@/lib/logger';
import { randomToken } from '@/server/security/crypto';
import type { EmailMessage, EmailProvider } from './types';

/** `a***@example.com`: enough to tell messages apart in a log without recording the address. */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${address[0]}***${address.slice(at)}`;
}

/**
 * Writes mail to the log instead of sending it. The default outside production.
 *
 * With `includeBody` the plain-text body is logged too, so a developer can follow a
 * verification link without a mail server. Only ever enabled in development: that body
 * carries single-use tokens, and a preview deployment's logs are no place for them.
 */
export function createConsoleEmailProvider(options: { includeBody: boolean }): EmailProvider {
  return {
    name: 'console',
    async send(message) {
      const messageId = `console-${randomToken(12)}`;
      logger.info('email.console_delivery', {
        messageId,
        to: maskEmail(message.to),
        subject: message.subject,
        category: message.category,
        ...(options.includeBody ? { body: message.text } : {}),
      });
      return { provider: 'console', messageId };
    },
  };
}

export interface MemoryEmailProvider extends EmailProvider {
  readonly sent: readonly EmailMessage[];
}

/** Collects messages for assertions. Tests only — see `setEmailProviderForTests`. */
export function createMemoryEmailProvider(): MemoryEmailProvider {
  const sent: EmailMessage[] = [];
  return {
    name: 'memory',
    sent,
    async send(message) {
      sent.push(message);
      return { provider: 'memory', messageId: `memory-${sent.length}` };
    },
  };
}
