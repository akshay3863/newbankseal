import { defineRoute } from '@/server/api/route-handler';
import { destroySession } from '@/server/auth/session';
import { recordAudit } from '@/server/services/audit-service';

/**
 * Sign out.
 *
 * A POST, not a GET: a sign-out reachable by navigation could be triggered from any
 * page that embeds an image pointing at it. CSRF verification still applies.
 *
 * Always returns 204, whether or not a session was found — an unauthenticated caller
 * learns nothing, and a client retrying after a network blip gets the same answer.
 */
export const POST = defineRoute({}, async ({ session, requestContext, respond }) => {
  await destroySession();

  if (session) {
    await recordAudit({
      action: 'auth.logout',
      actorUserId: session.user.id,
      actorRole: session.user.role,
      entityType: 'session',
      entityId: session.sessionId,
      context: requestContext,
    });
  }

  // Not `json(null, 204)`: a 204 cannot carry a body, and building one throws — which
  // used to turn every sign-out into a logged 500 after the session was already gone.
  return respond.noContent();
});

export const dynamic = 'force-dynamic';
