import { useState, useEffect } from 'react';

/** True when viewport is at least Tailwind `lg` (1024px). */
export function useIsLgUp(): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 1024px)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const set = () => setMatches(mq.matches);
    set();
    mq.addEventListener('change', set);
    return () => mq.removeEventListener('change', set);
  }, []);

  return matches;
}

export default useIsLgUp;
