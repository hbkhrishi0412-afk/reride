import { Fragment, type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Safe page transition wrapper that gracefully handles framer-motion errors.
 * Skips animation for views that contain Leaflet maps (e.g. DEALER_PROFILES)
 * to avoid "Map container is already initialized" from AnimatePresence remounts.
 */
interface PageTransitionProps {
  children: ReactNode;
  currentView: string | number;
}

// Views that must not be wrapped in AnimatePresence (e.g. contain Leaflet map)
/** DETAIL: avoid transform containing-block so in-DOM fixed UI behaves; framer still breaks portaled bars if nested. */
/** SELL_CAR: motion.div has no explicit height — breaks `h-full` flex footer + pinned Continue on mobile Safari */
const VIEWS_WITHOUT_TRANSITION = ['DEALER_PROFILES', 'DETAIL', 'ADMIN_PANEL', 'SELL_CAR'];

const PageTransition = ({ children, currentView }: PageTransitionProps) => {
  const { i18n } = useTranslation();
  const langKey = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];
  const transitionKey = `${String(currentView)}-${langKey}`;

  const [useAnimations, setUseAnimations] = useState(true);
  const [MotionDiv, setMotionDiv] = useState<any>(null);
  const [AnimatePresence, setAnimatePresence] = useState<any>(null);

  useEffect(() => {
    import('framer-motion')
      .then((fm) => {
        if (fm.motion && fm.AnimatePresence && React) {
          setMotionDiv(() => fm.motion.div);
          setAnimatePresence(() => fm.AnimatePresence);
          setUseAnimations(true);
        } else {
          setUseAnimations(false);
        }
      })
      .catch((error) => {
        console.warn('Framer Motion not available, using fallback:', error);
        setUseAnimations(false);
      });
  }, []);

  const skipTransition = VIEWS_WITHOUT_TRANSITION.includes(String(currentView));

  // No animation for map-containing views: avoids Leaflet container re-init
  if (skipTransition) {
    return <Fragment key={transitionKey}>{children}</Fragment>;
  }

  if (useAnimations && MotionDiv && AnimatePresence) {
    return (
      <AnimatePresence mode="wait">
        <MotionDiv
          key={transitionKey}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </MotionDiv>
      </AnimatePresence>
    );
  }

  return <Fragment key={transitionKey}>{children}</Fragment>;
};

export default PageTransition;

