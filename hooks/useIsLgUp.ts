import { useState, useEffect } from 'react';

export const APP_DESKTOP_MIN_WIDTH = 1024;
export const APP_DESKTOP_MEDIA_QUERY = `(min-width: ${APP_DESKTOP_MIN_WIDTH}px)`;

/** True when the shared app shell switches to desktop. */
export function useIsLgUp(): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia(APP_DESKTOP_MEDIA_QUERY).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(APP_DESKTOP_MEDIA_QUERY);
    const set = () => setMatches(mq.matches);
    set();
    mq.addEventListener('change', set);
    return () => mq.removeEventListener('change', set);
  }, []);

  return matches;
}

export default useIsLgUp;
