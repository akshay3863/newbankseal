import Image from 'next/image';
import { Container } from '@/components/ui/container';
import { FeatureIcon, type FeatureIconKey } from '@/components/ui/feature-icon';
import { siteConfig } from '@/lib/site-config';

/**
 * "How Bank Seal Makes Asset Ownership Easier".
 *
 * The heading across the top, then three columns: two benefits on the left, the
 * photograph in the middle, three more on the right, both lists centred on the photo.
 * Below `lg` the photo moves above the benefits and they stack into one column.
 */
interface Benefit {
  icon: FeatureIconKey;
  title: string;
  body: string;
  /** Which side of the photograph this benefit sits on in the design. */
  column: 'left' | 'right';
}

const BENEFITS: readonly Benefit[] = [
  {
    icon: 'browse-shortlist',
    column: 'left',
    title: 'Browse & Shortlist',
    body: 'Explore verified bank-repossessed properties, vehicles, and assets with ease.',
  },
  {
    icon: 'exclusive-deals',
    column: 'right',
    title: 'Access Exclusive Deals',
    body: 'Get access to bank-approved listings before they reach the wider market.',
  },
  {
    icon: 'express-interest',
    column: 'left',
    title: 'Express Interest. No Obligation.',
    body: 'Show interest in an asset and receive updates without any commitment.',
  },
  {
    icon: 'better-value',
    column: 'right',
    title: 'Buy at Better Value',
    body: 'Secure quality assets at prices often below market value.',
  },
  {
    icon: 'secure-process',
    column: 'right',
    title: 'Secure & Transparent Process',
    body: 'Review, bid, and purchase with confidence through a clear process.',
  },
];

export function ValueProps() {
  const leftColumn = BENEFITS.filter((benefit) => benefit.column === 'left');
  const rightColumn = BENEFITS.filter((benefit) => benefit.column === 'right');

  return (
    <section className="mt-section-lg bg-surface py-section-lg" aria-labelledby="value-props-heading">
      <Container>
        {/* The heading spans the section rather than sitting atop the left column. In
            the left column it pushed that list down by its own height, so the two lists
            started at different heights either side of the photo and the third column
            never lined up with anything. */}
        <h2
          id="value-props-heading"
          className="max-w-3xl font-display text-h2 font-extrabold text-ink-900"
        >
          How <span className="text-brand-600">{siteConfig.wordmark}</span> Makes Asset Ownership Easier
        </h2>

        <div className="mt-block grid gap-block lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,1fr)] lg:items-center lg:gap-10">
          <ul className="space-y-block">
            {leftColumn.map((benefit) => (
              <BenefitItem key={benefit.title} {...benefit} />
            ))}
          </ul>

          {/* The design frames the photo with a white inset border and a soft shadow. */}
          <div className="order-first mx-auto w-full max-w-sm lg:order-none lg:max-w-none">
            <div className="relative aspect-4/3 overflow-hidden rounded-[1.85rem] bg-ink-100 shadow-lift ring-4 ring-white lg:aspect-2/3">
              <Image
                src="/images/value-props-couple.jpg"
                alt="A buyer being handed the documents for a property outside the front door"
                fill
                sizes="(min-width: 1024px) 340px, (min-width: 640px) 384px, 90vw"
                className="object-cover"
              />
            </div>
          </div>

          <ul className="space-y-block">
            {rightColumn.map((benefit) => (
              <BenefitItem key={benefit.title} {...benefit} />
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

function BenefitItem({ icon, title, body }: Omit<Benefit, 'column'>) {
  return (
    <li>
      {/* The same tile as `IconTile`'s compact size on the category grid's phone
          layout, so the blue squares on the page come in one size, not three. */}
      <span className="inline-flex size-12 items-center justify-center rounded-xl bg-brand-600 text-white">
        <FeatureIcon icon={icon} className="size-6" />
      </span>
      <h3 className="mt-4 text-h5 font-bold text-ink-900">{title}</h3>
      <p className="mt-1.5 text-body text-ink-500">{body}</p>
    </li>
  );
}
