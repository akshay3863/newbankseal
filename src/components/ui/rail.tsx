'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Horizontal scroll rail with overlay arrows — the carousel pattern used for the
 * property and news sections.
 *
 * Built on native overflow + scroll-snap rather than a transform-based carousel so
 * that touch, trackpad, keyboard and screen-reader navigation all work for free.
 * The arrows are progressive enhancement: they hide when there is nothing to scroll
 * to, and the rail is fully usable without them.
 */
export function Rail({
  children,
  ariaLabel,
  className,
  itemClassName,
}: {
  children: ReactNode;
  ariaLabel: string;
  className?: string;
  itemClassName?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // 1px tolerance: sub-pixel layout means scrollLeft rarely hits the exact bound.
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    syncArrows();
    el.addEventListener('scroll', syncArrows, { passive: true });

    // Content and viewport can both change after mount (images loading, resize).
    const observer = new ResizeObserver(syncArrows);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', syncArrows);
      observer.disconnect();
    };
  }, [syncArrows]);

  // The ResizeObserver above only sees the scroller's own box, which does not change
  // when its contents do — a filtered rail can go from twelve cards to one and still
  // advertise a scroll that no longer exists. Re-measure whenever the items change.
  useEffect(syncArrows, [children, syncArrows]);

  const scrollByPage = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // Exactly one page: the visible cards plus the gap after the last of them, which is
    // where the next whole card begins. Anything less and snapping drags the rail back
    // to a card that was already on screen.
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: direction * (el.clientWidth + gap), behavior: 'smooth' });
  };

  return (
    <div className={cn('relative', className)}>
      <div
        ref={scrollerRef}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        // How many whole cards a page holds, and the gap `rail-item` subtracts to fit
        // them. One on a phone, two where two still leave each card room for its price
        // and button, three at full width.
        className={cn(
          'rail gap-(--rail-gap) pb-1 [--rail-gap:var(--spacing-gap)]',
          '[--rail-per-view:1] sm:[--rail-per-view:2] lg:[--rail-per-view:3]',
          itemClassName,
        )}
      >
        {children}
      </div>

      <RailArrow side="left" hidden={!canScrollLeft} onClick={() => scrollByPage(-1)} />
      <RailArrow side="right" hidden={!canScrollRight} onClick={() => scrollByPage(1)} />
    </div>
  );
}

function RailArrow({ side, hidden, onClick }: { side: 'left' | 'right'; hidden: boolean; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      // Removed from the a11y tree entirely when inert: the rail itself is already
      // focusable and scrollable, so a disabled duplicate control adds only noise.
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : 0}
      aria-label={side === 'left' ? 'Scroll left' : 'Scroll right'}
      className={cn(
        // Square with rounded corners, per the design — not the fully-rounded circle
        // this used to be.
        'absolute top-1/2 z-20 hidden size-control-sm -translate-y-1/2 items-center justify-center rounded-lg',
        'border border-border-subtle bg-surface text-ink-700 shadow-lift',
        // Named properties, not `transition-all`: the arrow is absolutely positioned
        // and translated, and animating every property let it slide on resize.
        'transition-[opacity,background-color,color] hover:bg-ink-50 hover:text-ink-900 sm:flex',
        side === 'left' ? '-left-3' : '-right-3',
        hidden && 'pointer-events-none opacity-0',
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
