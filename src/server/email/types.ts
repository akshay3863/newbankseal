import 'server-only';

/**
 * The email contract every sender depends on — Auth (03) for verification and resets,
 * Notifications (06) for reminders and digests.
 *
 * Callers hold an `EmailProvider`, never an SES client, so tests and local development
 * run against providers that cannot reach a real inbox (06: never send real email from
 * tests), and the SES implementation can land without touching any caller.
 */

interface EmailBase {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * `transactional` mail (verification, password reset) is always sent and carries no
 * unsubscribe link. Opt-in mail must carry one — the type makes forgetting it a compile
 * error rather than a compliance problem (06: unsubscribe link on optional digests).
 */
export type EmailMessage = EmailBase &
  (
    | { category: 'transactional'; unsubscribeUrl?: never }
    | {
        category: 'reminder' | 'digest';
        /** Rendered as `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058) by real providers. */
        unsubscribeUrl: string;
      }
  );

export type EmailCategory = EmailMessage['category'];

export interface EmailSendResult {
  provider: string;
  /** The provider's message id, recorded on the delivery row for bounce correlation. */
  messageId: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
