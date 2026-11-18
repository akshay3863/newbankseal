import { cn } from '@/lib/cn';
import { CountUp } from './count-up';

/**
 * Trust figures shown above the footer.
 *
 * The design sets the numbers in brand blue and separates the columns with a short,
 * vertically centred hairline rather than a full-height rule — one card holding four
 * readings, not four boxes butted together.
 *
 * Each figure counts up as the band scrolls into view. Only the number moves; a prefix
 * or unit stays put, so "1–3 days" counts its upper bound and never reads as "1–0".
 */
const STATS = [
  { to: 50, suffix: '+', label: 'Active listings' },
  { to: 70, suffix: '+', label: 'Happy Clients' },
  { to: 15, suffix: '+', label: 'Partner banks' },
  { from: 1, to: 3, prefix: '1–', suffix: ' days', label: 'Verified onboarding' },
] as const;

export function StatsBand({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-[1.75rem] bg-surface px-4 py-9 shadow-lift sm:px-8 sm:py-11', className)}
      aria-label="Marketplace at a glance"
    >
      <dl className="grid grid-cols-2 gap-y-9 lg:grid-cols-4">
        {STATS.map((stat, index) => (
          // The label is the real `dt` and the figure the `dd`, as the list requires, and
          // `flex-col-reverse` puts the figure on top as the design draws it. The label
          // used to be written twice, a hidden `dt` and a visible copy inside the `dd`,
          // which doubled it for anyone copying the text or reading in reader mode.
          <div key={stat.label} className="relative flex flex-col-reverse px-4 sm:px-8">
            {/* Divider belongs to the item on its right, and is suppressed wherever
                that item starts a row so no rule ever hangs off the card's edge. */}
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-1/2 left-0 h-14 w-px -translate-y-1/2 bg-border-subtle',
                  index % 2 === 0 && 'hidden lg:block',
                )}
              />
            ) : null}

            <dt className="mt-3 text-body text-ink-800">{stat.label}</dt>
            <dd>
              <CountUp
                from={'from' in stat ? stat.from : 0}
                to={stat.to}
                prefix={'prefix' in stat ? stat.prefix : ''}
                suffix={stat.suffix}
                className="block font-display text-h1 leading-none font-extrabold text-brand-600"
              />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
