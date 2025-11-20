import React from 'react';

/**
 * Safe page transition wrapper that gracefully handles framer-motion errors
 */
interface PageTransitionProps {
  children: React.ReactNode;
  currentView: string | number;
}

const PageTransition: React.FC<PageTransitionProps> = ({ children, currentView }) => {
  // Try to use framer-motion, fallback to simple div if it fails
  const [useAnimations, setUseAnimations] = React.useState(true);
  const [MotionDiv, setMotionDiv] = React.useState<any>(null);
  const [AnimatePresence, setAnimatePresence] = React.useState<any>(null);

  React.useEffect(() => {
    // Dynamically import framer-motion to handle potential errors
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

  // If animations are available, use them
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

  // Fallback: render without animations
  return <>{children}</>;
};

export default PageTransition;

