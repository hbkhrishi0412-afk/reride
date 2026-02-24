import React from 'react';

/**
 * Safe page transition wrapper that gracefully handles framer-motion errors.
 * Skips animation for views that contain Leaflet maps (e.g. DEALER_PROFILES)
 * to avoid "Map container is already initialized" from AnimatePresence remounts.
 */
interface PageTransitionProps {
  children: React.ReactNode;
  currentView: string | number;
}

// Views that must not be wrapped in AnimatePresence (e.g. contain Leaflet map)
const VIEWS_WITHOUT_TRANSITION = ['DEALER_PROFILES'];

const PageTransition: React.FC<PageTransitionProps> = ({ children, currentView }) => {
  const [useAnimations, setUseAnimations] = React.useState(true);
  const [MotionDiv, setMotionDiv] = React.useState<any>(null);
  const [AnimatePresence, setAnimatePresence] = React.useState<any>(null);

  React.useEffect(() => {
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
    return <>{children}</>;
  }

  if (useAnimations && MotionDiv && AnimatePresence) {
    return (
      <AnimatePresence mode="wait">
        <MotionDiv
          key={currentView}
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

  return <>{children}</>;
};

export default PageTransition;

