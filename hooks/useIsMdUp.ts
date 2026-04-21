import { useState, useEffect } from 'react';

/** True when viewport is at least Tailwind `md` (768px). */
export function useIsMdUp(): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const set = () => setMatches(mq.matches);
    set();
    mq.addEventListener('change', set);
    return () => mq.removeEventListener('change', set);
  }, []);
  return matches;
}
