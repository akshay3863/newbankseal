import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { CityIcon } from '@/components/ui/city-icon';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import type { CityFacet } from '@/domain/listing';
import { formatCount } from '@/lib/format';

/**
 * "Top Cities" — the highest-volume markets, each fronted by its landmark.
 *
 * Icons are resolved from the city slug by `CityIcon`, so adding a city to the seed
 * automatically picks up its artwork if we have it and falls back to a generic
 * building if we don't.
 */
export function TopCities({ cities }: { cities: CityFacet[] }) {
  if (cities.length === 0) return null;

  return (
    <Container as="section" className="pt-section" aria-labelledby="top-cities-heading">
      <SectionHeading id="top-cities-heading" lead="Top" highlight="Cities" viewAllHref="/cities" />

      <Card className="p-card">
        {/* Three across from the smallest phone: at two, twelve cities made a six-row
            column taller than the screen, with most of each row empty. */}
        <ul className="grid grid-cols-3 gap-x-2 gap-y-4 sm:gap-x-4 lg:grid-cols-6 lg:gap-y-6">
          {cities.map((city) => (
            <li key={city.slug}>
              <Link
                href={`/explore?city=${encodeURIComponent(city.slug)}`}
                className="group flex flex-col items-center gap-2.5 rounded-xl py-2 text-center transition-colors hover:bg-ink-50"
              >
                <span className="inline-flex size-14 items-center justify-center rounded-2xl text-ink-700 transition-colors group-hover:bg-brand-50 group-hover:text-brand-600 sm:size-16">
                  <CityIcon slug={city.slug} className="size-11 sm:size-12" />
                </span>

                {/* Name and count on their own lines, so a long name wraps cleanly in a
                    narrow column instead of splitting the count off mid-phrase. */}
                <span className="text-meta font-medium text-ink-800 group-hover:text-brand-700">
                  {city.name}
                  <span className="block font-normal text-ink-400">{formatCount(city.listingCount)} listings</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </Container>
  );
}
