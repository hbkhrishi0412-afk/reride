import { useEffect, useState } from 'react';

/**
 * Returns extra bottom padding (px) when the on-screen keyboard shrinks visualViewport.
 * Works in mobile WebViews (Capacitor) and mobile browsers.
 */
export function useVisualViewportBottomInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset(Math.round(gap));
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
