import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Architecture guards for the CLAUDE.md non-negotiables that a type checker cannot see.
 *
 * Each rule exists because breaking it fails silently: a hand-written route handler
 * quietly drops CSRF and rate limiting, an admin route without a permission is open,
 * and a server module without `server-only` can be bundled for the browser.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url));
const METHODS = 'GET|HEAD|OPTIONS|POST|PUT|PATCH|DELETE';

function filesUnder(dir: string, predicate: (path: string) => boolean = () => true): string[] {
  const root = join(SRC, dir);
  if (!existsSync(root)) return [];
  return (readdirSync(root, { recursive: true }) as string[])
    .map((path) => `${dir}/${path.replaceAll('\\', '/')}`)
    .filter(predicate);
}

const source = (path: string) => readFileSync(join(SRC, path), 'utf8');
const isRoute = (path: string) => path.endsWith('/route.ts');

describe('API routes', () => {
  const routes = filesUnder('app/api', isRoute);

  it('exist (guards against this test silently matching nothing)', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('are all built with defineRoute', () => {
    const violations = routes.filter((path) => {
      const code = source(path);
      const handwritten = new RegExp(`export\\s+(async\\s+)?function\\s+(${METHODS})\\b`).test(code);
      const exportsOtherwise = [...code.matchAll(new RegExp(`export\\s+const\\s+(${METHODS})\\s*=\\s*([^\\s(]+)`, 'g'))].some(
        (match) => match[2] !== 'defineRoute',
      );
      return handwritten || exportsOtherwise;
    });
    expect(violations).toEqual([]);
  });

  it('under /api/admin all declare a permission', () => {
    const open = filesUnder('app/api/admin', isRoute).filter((path) => !/\bpermission\s*:/.test(source(path)));
    expect(open).toEqual([]);
  });

  it('use machine access exactly when they live under /api/internal or /api/webhooks', () => {
    const machineAccess = /kind:\s*'(cron|webhook)'/;
    const isMachinePath = (path: string) => /^app\/api\/(internal|webhooks)\//.test(path);

    const unauthenticatedMachineRoutes = routes.filter((path) => isMachinePath(path) && !machineAccess.test(source(path)));
    const misplacedMachineRoutes = routes.filter((path) => !isMachinePath(path) && machineAccess.test(source(path)));

    expect(unauthenticatedMachineRoutes).toEqual([]);
    // Middleware admits Origin-less requests only on the machine paths.
    expect(misplacedMachineRoutes).toEqual([]);
  });
});

describe('server modules', () => {
  /**
   * Imported by edge middleware as well as the Node runtime. They hold no secrets and
   * no I/O, and `server-only` resolution in the middleware bundle is not guaranteed.
   */
  const EDGE_SHARED = new Set(['server/security/crypto.ts', 'server/security/csrf.ts']);

  it("all start with import 'server-only'", () => {
    const unmarked = filesUnder('server', (path) => path.endsWith('.ts') && !path.endsWith('.test.ts'))
      .filter((path) => !EDGE_SHARED.has(path))
      .filter((path) => !source(path).split('\n').slice(0, 5).some((line) => line.trim() === "import 'server-only';"));
    expect(unmarked).toEqual([]);
  });
});
