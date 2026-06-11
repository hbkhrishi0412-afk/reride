import { useCallback, useEffect, useRef } from 'react';

/**
 * Adds `is-visible` to a `.reveal-on-scroll` element when it enters the viewport.
 * Uses a callback ref so sections that mount after async data (e.g. vehicle catalog)
 * still get observed — a plain ref + mount-only effect misses late-mounted nodes.
 */
export function useRevealOnScroll<T extends HTMLElement>(delayMs: number = 0) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disconnect = useCallback(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const ref = useCallback(
    (node: T | null) => {
      disconnect();
      if (!node) return;

      if (typeof IntersectionObserver === 'undefined') {
        node.classList.add('is-visible');
        return;
      }

      if (node.classList.contains('is-visible')) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            timeoutRef.current = window.setTimeout(() => {
              entry.target.classList.add('is-visible');
              timeoutRef.current = null;
            }, delayMs);
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
      );
      observerRef.current = observer;
      observer.observe(node);
    },
    [delayMs, disconnect]
  );

  useEffect(() => disconnect, [disconnect]);

  return ref;
}
