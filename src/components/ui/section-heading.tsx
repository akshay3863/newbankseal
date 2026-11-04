import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * The repeating section header from the design: a two-tone title where the second
 * word is brand-coloured ("New Listed *Properties*"), with an optional "View All".
 */
export function SectionHeading({
  lead,
  highlight,
  viewAllHref,
  viewAllLabel = 'View All',
  className,
  id,
}: {
  lead: string;
  highlight?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
  id?: string;
}) {
  return (
    // Centred, not baseline-aligned: the pill is taller than the heading's cap height,
    // and bottom-aligning the two left the pill visibly hanging below the title.
    <div className={cn('mb-gap flex items-center justify-between gap-3', className)}>
      <h2 id={id} className="font-display text-h4 font-extrabold text-ink-900">
        {lead}
        {highlight ? <span className="text-brand-600"> {highlight}</span> : null}
      </h2>

      {viewAllHref ? (
        <Link
          href={viewAllHref}
          // A real pill, per the design — not plain text. Padding and radius are the
          // exact values from Figma (10px radius, 8px/15px padding); the near-invisible
          // fill is `brand-accent` at 5% so it still shows as a button and not a link.
          // `tap-target` covers the gap between that padding and a 44px hit area on a
          // phone (it shrinks to ~38px there) without growing the pill past its design
          // size, the same trick used for the homepage map's pins.
          //
          // Body size, not a heading size: at `text-h5` the label competed with the
          // section title beside it instead of reading as the secondary action it is.
          className="tap-target inline-flex shrink-0 items-center rounded-btn bg-brand-accent/5 px-[0.9375rem] py-2 text-body font-semibold text-brand-accent transition-colors hover:bg-brand-accent/10"
        >
          {viewAllLabel}
        </Link>
      ) : null}
    </div>
  );
}
