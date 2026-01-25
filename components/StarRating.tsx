import React, { useState, memo } from 'react';

interface StarRatingProps {
  rating: number;
  onRate?: (rating: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const Star: React.FC<{
  filled: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  sizeClass: string;
}> = ({ filled, onClick, onMouseEnter, onMouseLeave, sizeClass }) => (
  <svg
    className={`stroke-current transition-colors duration-200 ${
      filled ? 'text-reride-text-dark' : 'text-reride-text-dark dark:text-reride-text-dark'
    } ${onClick ? 'cursor-pointer' : ''} ${sizeClass}`}
    fill={filled ? 'currentColor' : 'none'}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
    />
  </svg>
);

const StarRating: React.FC<StarRatingProps> = ({ rating, onRate, readOnly = false, size = 'md' }) => {
  const [hoverRating, setHoverRating] = useState(0);

  // Ensure rating is a valid number
  const safeRating = typeof rating === 'number' && !isNaN(rating) ? rating : 0;

  const handleRate = (rate: number) => {
    if (!readOnly && onRate) {
      onRate(rate);
    }
  };

  const handleMouseEnter = (rate: number) => {
    if (!readOnly) {
      setHoverRating(rate);
    }
  };

  const handleMouseLeave = () => {
    if (!readOnly) {
      setHoverRating(0);
    }
  };

  const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-6 h-6',
      lg: 'w-8 h-8',
  }

  return (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map((star) => {
        const displayRating = hoverRating || safeRating;
        return (
          <Star
            key={star}
            filled={star <= displayRating}
            onClick={() => handleRate(star)}
            onMouseEnter={() => handleMouseEnter(star)}
            onMouseLeave={handleMouseLeave}
            sizeClass={sizeClasses[size]}
          />
        );
      })}
    </div>
  );
};

export default memo(StarRating);