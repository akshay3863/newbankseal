'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A figure that counts up from `from` to `to` the first time it scrolls into view.
 *
 * The server renders the final value, and so does the client until it knows it will
 * animate. A reader without JavaScript, a crawler, and anyone who asked their system for
 * less motion therefore all get the real number and never a zero. The count only resets
 * to `from` once the element is known to be off screen, so nobody watches a number they
 * have already read drop back to zero.
 *
 * Screen readers are not made to listen to the count: the element is not a live region,
 * and its accessible text is the final value from the first frame to the last, held in
 * `aria-label` while the visible digits run.
 */
const DURATION_MS = 1400;

/** Fast at first, settling into the final value rather than stopping on it. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function CountUp({
  from = 0,
  to,
  prefix = '',
  suffix = '',
  className,
}: {
  from?: number;
  to: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let armed = false;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;

        // First report: only arm the animation if the figure starts out of view.
        if (!armed) {
          armed = true;
          if (entry.isIntersecting) {
            observer.disconnect();
            return;
          }
          setValue(from);
          return;
        }

        if (!entry.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / DURATION_MS, 1);
          setValue(Math.round(from + (to - from) * easeOutCubic(t)));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      // Most of the band on screen, so the count is seen from its start rather than
      // finishing below the fold.
      { threshold: 0.6 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [from, to]);

  const final = `${prefix}${to}${suffix}`;

  return (
    // `tabular-nums` keeps every digit the same width, so the figure does not shudder
    // sideways as 9 turns into 10.
    <span ref={ref} role="img" aria-label={final} className={className}>
      <span aria-hidden="true" className="tabular-nums">
        {prefix}
        {value}
        {suffix}
      </span>
    </span>
  );
}
