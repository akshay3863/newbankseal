import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Unit and architecture tests (`npm test`).
 *
 * Vite is pinned to 6.x in package.json: Vite 7 requires Node 20.19+, and the
 * supported floor here is still 20.x.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws unless resolved under React's server condition, which only
      // Next's bundler applies. Tests run server modules directly, so it becomes a no-op.
      'server-only': fileURLToPath(new URL('./src/test/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Run as a UTC host, like production. Display code must pin Asia/Kolkata itself;
    // a developer machine in India would hide that bug.
    env: { TZ: 'UTC' },
    unstubEnvs: true,
  },
});
