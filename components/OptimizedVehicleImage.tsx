import React, { useState, memo } from 'react';
import LazyImage from './LazyImage.js';

interface OptimizedVehicleImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  onLoad?: () => void;
  onError?: () => void;
}

const OptimizedVehicleImage: React.FC<OptimizedVehicleImageProps> = memo(({
  src,
  alt,
  className = '',
  fallbackSrc = 'https://picsum.photos/800/600?random=1',
  onLoad,
  onError
}) => {
  const [imageError, setImageError] = useState(false);

  const handleError = () => {
    setImageError(true);
    onError?.();
  };

  const handleLoad = () => {
    setImageError(false);
    onLoad?.();
  };

  return (
    <LazyImage
      src={imageError ? fallbackSrc : src}
      alt={alt}
      className={className}
      onLoad={handleLoad}
      onError={handleError}
      placeholder="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNhciBJbWFnZTwvdGV4dD48L3N2Zz4="
    />
  );
});

OptimizedVehicleImage.displayName = 'OptimizedVehicleImage';

export default OptimizedVehicleImage;
