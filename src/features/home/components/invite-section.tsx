import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { formatCount } from '@/lib/format';
import { siteConfig } from '@/lib/site-config';
import type { StateFacet } from '@/domain/listing';
import { IndiaMap } from './india-map';
import { StatsBand } from './stats-band';

/**
 * Closing block: the invitation, the coverage map, and the statistics card.
 *
 * These are one visual unit in the design — a single city-skyline backdrop runs behind
 * all of it and stops where the footer begins — so they share a component rather than
 * each trying to paint a slice of the same image.
 */

/** How many states the card beside the map names; the rest are still pinned. */
const LISTED_STATES = 5;

export function InviteSection({ states }: { states: StateFacet[] }) {
  const topStates = states.slice(0, LISTED_STATES);
  const otherStates = states.length - topStates.length;

  return (
    <section className="relative isolate mt-section-lg overflow-hidden pb-section-lg" aria-labelledby="invite-heading">
      {/*
        Skyline backdrop. The source photograph is a colour sunset; the design wants a
        grey haze rising into dark silhouettes, so it is desaturated and re-graded here
        rather than in the asset — the file stays reusable and the treatment lives with
        the rest of the styling.

        Every number below is measured against the design, and they only work together.

        The box is a 1440:720 strip, which at the design width puts its top level with
        the map's midpoint. That height is the whole effect: the photograph's sky is what
        becomes the pale haze behind the map, and a shorter strip crops the sky away and
        leaves the skyline sitting on the page as a band.

        `object-top` then falls out of the arithmetic rather than being taste. At this
        aspect, cover scales the photo to 1440x959 and hides 239px of it; anchoring the
        top lands the tallest spire 359px down, which is where the design puts it. Change
        the strip's height and this has to be re-derived, not nudged.

        The grade is nearly transparent by design. The photograph already has the shape
        the section wants — a soft gradient sky, banded fog, silhouettes at three depths
        — so it is desaturated and left almost alone. Pushing contrast is the tempting
        mistake: it crushes the fog bands to white and the buildings to a flat cutout,
        and the depth that makes this read as haze rather than as a pasted-on band goes
        with them. Opacity does the blending instead, high enough that the mid-tones
        survive.

        Below `lg` the strip is measured against the section instead of its own width.
        A width-derived height is right on the design's canvas and nowhere else: as the
        column narrows the strip shrinks while the section grows taller with the stacked
        content, and by phone width the skyline is a sliver along the bottom edge that
        reads as a mistake. A percentage keeps the same proportion at every size.

        Layered by source order, not a negative z-index. An `opacity` and a `filter`
        each promote this to its own compositing layer, and at a negative index that
        layer lands under the page background and vanishes entirely. Both this and the
        content column are positioned, so the later one — the content — wins.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] min-h-80 w-full [mask-image:linear-gradient(to_bottom,transparent_0%,black_20%)] lg:h-auto lg:aspect-1440/720"
      >
        <Image
          src="/images/city-skyline.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-top opacity-90 grayscale contrast-[1.08]"
        />
      </div>

      <Container className="relative pt-4">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
          <div>
            <h2
              id="invite-heading"
              // `text-h2`, the same rank as the value-props heading: the two are the
              // page's feature headings and should match. At `h1` this rivalled the hero.
              className="max-w-[30rem] font-display text-h2 font-extrabold text-ink-900"
            >
              We&apos;d Like to Personally Invite You to Explore a New Opportunity with{' '}
              <span className="text-brand-600">{siteConfig.wordmark}</span>
            </h2>

            <p className="mt-5 max-w-md text-body leading-relaxed text-ink-500">
              Whether you&apos;re looking for a property, vehicle, or other bank-repossessed asset, discover verified
              listings and find the right opportunity with ease.
            </p>

            <Button asChild variant="primary" className="mt-block">
              <Link href="/explore">Explore {siteConfig.wordmark} Listed Assets</Link>
            </Button>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-[34rem]">
            <IndiaMap states={states} />

            {/* On a wide screen it floats lower right, over the Bay of Bengal: with a
                pin in every covered state, the sea is the one stretch no pin will land
                on. Narrower than that the map is too small for any overlay to miss a
                state, so the card drops below it instead. */}
            {topStates.length > 0 ? (
              <div className="mt-4 rounded-lg bg-surface p-3 shadow-lift lg:absolute lg:right-0 lg:bottom-[4%] lg:mt-0 lg:w-52">
                <h3 className="text-2xs font-semibold tracking-wide text-ink-500 uppercase">Listings by state</h3>
                <dl className="mt-2 space-y-1.5">
                  {topStates.map((state) => (
                    <div key={state.name} className="flex items-baseline justify-between gap-3 text-xs">
                      <dt className="truncate text-ink-700">{state.name}</dt>
                      <dd className="shrink-0 tabular-nums text-ink-400">{formatCount(state.listingCount)}</dd>
                    </div>
                  ))}
                </dl>
                {otherStates > 0 ? (
                  <p className="mt-2 border-t border-border-subtle pt-2 text-2xs text-ink-400">
                    + {otherStates} more {otherStates === 1 ? 'state' : 'states'} on the map
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <StatsBand className="mt-14 lg:mt-32" />
      </Container>
    </section>
  );
}
