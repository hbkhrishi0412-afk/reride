import React, { useEffect, useState } from 'react';

interface PerformanceMonitorProps {
  children: React.ReactNode;
  componentName: string;
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ children, componentName }) => {
  const [renderTime, setRenderTime] = useState<number>(0);

  useEffect(() => {
    const startTime = performance.now();
    
    // Monitor component render time
    const measureRender = () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      setRenderTime(duration);
      
      // Log slow renders in development
      if (process.env.NODE_ENV === 'development' && duration > 16) {
        console.warn(`Slow render detected in ${componentName}: ${duration.toFixed(2)}ms`);
      }
    };

    // Use requestAnimationFrame to measure after render
    requestAnimationFrame(measureRender);
  }, [componentName]);

  return (
    <div data-component={componentName}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white text-xs p-2 rounded">
          {componentName}: {renderTime.toFixed(2)}ms
        </div>
      )}
    </div>
  );
};

export default PerformanceMonitor;
