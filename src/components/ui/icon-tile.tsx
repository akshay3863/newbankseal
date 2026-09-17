import { Building2, Landmark, Recycle, Store, type LucideIcon } from 'lucide-react';
import { CategoryIcon, isCategoryIconKey } from '@/components/ui/category-icon';
import { cn } from '@/lib/cn';

/**
 * Icon rendering is allow-listed rather than dynamic.
 *
 * Category rows carry an `iconKey` string from the database. Mapping it through these
 * frozen records means a tampered row can only ever select one of these icons — it can
 * never inject a component name or arbitrary markup into the tree.
 *
 * The five categories the designer drew resolve to `CategoryIcon`; the rest fall back
 * to the Lucide set they have always used. `machinery` is in that fallback because no
 * artwork was supplied for Scrap, Plant & Machinery — drop its export in beside the
 * others and move the key over, and nothing here changes.
 */
const FALLBACK_ICONS = {
  machinery: Recycle,
  land: Landmark,
  retail: Store,
} as const satisfies Record<string, LucideIcon>;

export type IconKey = CategoryIconKeyUnion | keyof typeof FALLBACK_ICONS;

type CategoryIconKeyUnion = Parameters<typeof CategoryIcon>[0]['icon'];

export function isIconKey(value: string): value is IconKey {
  return isCategoryIconKey(value) || value in FALLBACK_ICONS;
}

const SIZES = {
  /** Dense contexts — dropdown rows, list items. */
  sm: { box: 'size-9 rounded-lg', icon: 'size-4.5' },
  /** The category grid in the design. */
  lg: { box: 'size-14 rounded-2xl', icon: 'size-6' },
} as const;

/** The rounded blue square that fronts each category in the design. */
export function IconTile({
  iconKey,
  size = 'sm',
  className,
}: {
  iconKey: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const dimensions = SIZES[size];
  const Fallback = iconKey in FALLBACK_ICONS ? FALLBACK_ICONS[iconKey as keyof typeof FALLBACK_ICONS] : Building2;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center bg-brand-600 text-white',
        dimensions.box,
        className,
      )}
      aria-hidden="true"
    >
      {isCategoryIconKey(iconKey) ? (
        <CategoryIcon icon={iconKey} className={dimensions.icon} />
      ) : (
        <Fallback className={dimensions.icon} strokeWidth={2} />
      )}
    </span>
  );
}
