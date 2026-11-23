import { z } from 'zod';

/**
 * Input contracts for public listing surfaces.
 *
 * Like every schema in this folder, these are the server's validation; the browser
 * reuses them for instant feedback only.
 */

/**
 * A listing's public URL key. Bounded and character-restricted before it reaches a
 * query — it arrives as a visitor-controlled path segment or body field.
 */
export const listingSlugSchema = z
  .string()
  .trim()
  .max(200)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Invalid listing');

/**
 * Query contract for the public browse surface — the subset of `ListingFilters`
 * (`@/domain/listing`) the page supports today.
 */
export const exploreQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  city: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9-]*$/, 'Invalid city')
    .optional(),
  category: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9-]*$/, 'Invalid category')
    .optional(),
  bank: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9-]*$/, 'Invalid bank')
    .optional(),
  possession: z.enum(['physical', 'symbolic', 'constructive']).optional(),
  /** Marketing shortcuts surfaced as filter pills. */
  tag: z.enum(['popular', 'car-auction']).optional(),
  sort: z.enum(['newest', 'featured', 'price_asc', 'price_desc']).default('newest'),
  // Page is capped so a crafted `?page=999999` cannot force a huge OFFSET scan.
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export type ExploreQuery = z.infer<typeof exploreQuerySchema>;

/** Contract for the listing assistant. */
export const listingQuestionSchema = z.object({
  slug: listingSlugSchema,
  // Bounded hard: this string is only ever matched against keywords, never executed
  // or interpolated, but an unbounded body is still a denial-of-service vector.
  question: z.string().trim().min(3, 'Ask a question').max(300, 'Keep questions under 300 characters'),
});

export type ListingQuestionInput = z.infer<typeof listingQuestionSchema>;
