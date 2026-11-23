import { signUpSchema } from '@/lib/validation/auth';
import { defineRoute } from '@/server/api/route-handler';
import { registerUser } from '@/server/services/auth-service';

/**
 * Create an account and start a session.
 * Guards (CSRF, rate limit, body limits, validation) are applied by `defineRoute`.
 */
export const POST = defineRoute({ schema: signUpSchema }, async ({ body, requestContext, respond }) => {
  const result = await registerUser(body, requestContext);

  // Only non-sensitive display fields cross back to the client. The session itself
  // lives in an httpOnly cookie set by the service.
  return respond.ok({ user: { fullName: result.fullName, role: result.role } }, { status: 201 });
});

/** Cookies are set here, so this must never be statically evaluated. */
export const dynamic = 'force-dynamic';
