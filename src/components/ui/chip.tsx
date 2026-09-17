import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * The filter/tag used across the city, bank and category lists.
 *
 * A filled grey rounded rectangle, matching the design — not an outlined pill. It sits
 * on the same height as `TabList`'s tabs because the design stacks the two directly and
 * a mismatch there reads as a mistake.
 *
 * It takes `card-well` rather than the tabs' `surface-well`: chips live inside a white
 * card, and the warmer, darker fill the tabs use on the page ground is too heavy there.
 *
 * Renders as a link when `href` is given so filters stay shareable and crawlable.
 */
export function Chip({
  href,
  active = false,
  className,
  children,
}: {
  href?: string;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const classes = cn(
    'inline-flex h-control items-center gap-1 rounded-lg px-4 text-meta font-medium transition-colors',
    active
      ? 'bg-brand-600 text-white hover:bg-brand-700'
      : 'bg-card-well text-ink-700 hover:bg-brand-50 hover:text-brand-700',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes} aria-current={active ? 'page' : undefined}>
        {children}
      </Link>
    );
  }

  return <span className={classes}>{children}</span>;
}
