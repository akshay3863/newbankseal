import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const NO_DATABASE_IN_UI = {
  group: ['@/db', '@/db/*', '@/server/repositories/*'],
  message:
    'UI code must not access the database directly. Fetch in a Server Component, Server Action or route handler and pass the result down as props.',
};

const NO_ADMIN_ON_PUBLIC_SURFACES = {
  group: ['@/domain/admin', '@/domain/admin/*', '@/server/services/admin', '@/server/services/admin/*'],
  message:
    'Public pages, features and APIs must not import admin-only contracts or services. Use the public DTOs in @/domain.',
};

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  { ignores: ['.next/**', 'node_modules/**', 'src/db/migrations/**'] },

  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      // Reverse-tabnabbing: an external link opened in a new tab must not hand the
      // opener reference to the destination.
      'react/jsx-no-target-blank': ['error', { allowReferrer: false, enforceDynamicLinks: 'always' }],
    },
  },

  {
    /**
     * Layering rule: the presentation layer never reaches the database directly.
     * Components and feature modules receive data as props from a page/route handler,
     * which is the only place allowed to call a service or repository.
     *
     * This complements — but does not replace — the `server-only` package, which is
     * what actually makes a client-bundle import of a server module a build error.
     */
    files: ['src/components/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [NO_DATABASE_IN_UI] }],
    },
  },

  {
    /**
     * Public/admin separation (01-FOUNDATION: "public fields vs admin-only fields
     * explicitly separated"). Admin-only DTOs live in `@/domain/admin` and admin services
     * in `@/server/services/admin`; no public page, public feature or public API may
     * import them, so an admin-only field cannot reach an anonymous payload by accident.
     *
     * The public feature folders also match the block above, and a later block replaces
     * an earlier block's options for the same rule — so they restate the database rule.
     */
    files: ['src/features/{home,explore,listing}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [NO_DATABASE_IN_UI, NO_ADMIN_ON_PUBLIC_SURFACES] }],
    },
  },

  {
    files: [
      'src/app/page.tsx',
      'src/app/{explore,listings,banks,cities}/**/*.{ts,tsx}',
      'src/app/sitemap.ts',
      'src/app/api/{listings,banks,locations}/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': ['error', { patterns: [NO_ADMIN_ON_PUBLIC_SURFACES] }],
    },
  },
];

export default eslintConfig;
