import Image from 'next/image';
import Link from 'next/link';
import logo from '@/assets/brand/logo.png';
import logoInverse from '@/assets/brand/logo-inverse.png';
import { siteConfig } from '@/lib/site-config';
import { cn } from '@/lib/cn';

/**
 * The Bank Seal Property lockup — the "B" house mark, a rule, and the two-line name.
 *
 * Two versions of one artwork, cut from the supplied PNG (the original is kept beside
 * them in `src/assets/brand`). `brand` is the file as supplied, navy and blue, for
 * light grounds. `inverse` keeps the blue mark but turns the rule and the name white,
 * for the brand-blue footer and the dark sign-in panel, where the navy name all but
 * disappeared. Both are trimmed to the artwork's edges, so the height set here is the
 * height the logo actually draws at, with no transparent margin padding it out.
 *
 * Statically imported, so Next knows the intrinsic size and reserves the space: the
 * header does not jump when the image arrives. `priority` because the header logo is
 * on every page above the fold. The image is decorative inside a labelled link — its
 * text would repeat the label — so it carries an empty `alt`.
 */
export function Wordmark({
  tone = 'brand',
  className,
}: {
  tone?: 'brand' | 'inverse';
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cn('inline-flex shrink-0 items-center py-1.5 lg:py-0', className)}
      aria-label={`${siteConfig.name} home`}
    >
      <Image
        src={tone === 'brand' ? logo : logoInverse}
        alt=""
        priority={tone === 'brand'}
        // 40px tall on a phone, 48px from `lg`: as large as the 72px and 96px header
        // bars hold with breathing room, and the "PROPERTY" line stays legible.
        className="h-10 w-auto lg:h-12"
        sizes="(min-width: 1024px) 156px, 130px"
      />
    </Link>
  );
}
