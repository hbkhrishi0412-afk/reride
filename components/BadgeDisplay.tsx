import React from 'react';
import type { Badge } from '../types';

const badgeStyles: Record<Badge['type'], { icon: React.ReactElement<{ className?: string }>; colors: string }> = {
    verified: {
        icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5.002c-.149.066-.288.136-.422.21.036-.09.07-.18.106-.27.436-1.12 1.05-2.124 1.83-2.996C4.524 1.173 5.424.5 6.425.245c.222-.056.447-.1.675-.14a12.022 12.022 0 012.222-.205c.34.004.678.01.996.022.25.01.5.024.746.042.12.008.238.018.355.03.11.01.22.02.328.032.128.012.256.026.383.042a1.99 1.99 0 01.442.128c.135.05.267.103.398.16.12.05.237.102.352.158.128.06.255.123.379.19a11.954 11.954 0 012.833 2.833 11.954 11.954 0 01-8.216 14.707c-3.17.31-6.24-.83-8.216-3.22a11.954 11.954 0 014.12-11.854zM9 13.189l-2.436-2.437a1 1 0 011.414-1.414L9 10.36l3.022-3.022a1 1 0 011.414 1.414L9 13.189z" clipRule="evenodd" /></svg>,
        colors: 'bg-gradient-primary text-white border-reride-orange',
    },
    top_seller: {
        icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M11.285 3.125a.75.75 0 00-2.57 0L6.75 5.429a.75.75 0 01-.563.41l-2.67.388a.75.75 0 00-.416 1.283l1.932 1.883a.75.75 0 01.216.664l-.456 2.659a.75.75 0 001.088.791l2.389-1.256a.75.75 0 01.7 0l2.389 1.256a.75.75 0 001.088-.79l-.456-2.66a.75.75 0 01.216-.664l1.932-1.883a.75.75 0 00-.416-1.283l-2.67-.388a.75.75 0 01-.563-.41L11.285 3.125z" /></svg>,
        colors: 'bg-reride-blue text-reride-text-dark dark:bg-reride-blue dark:text-reride-text-dark border-amber-500/50',
    },
    high_rating: {
        icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v.512a26.63 26.63 0 014.288 3.013.75.75 0 11-.98 1.134A25.132 25.132 0 0010.5 4.792V10.5a.75.75 0 01-1.5 0V4.792a25.132 25.132 0 00-3.558 2.618.75.75 0 11-.98-1.134A26.63 26.63 0 019.25 3.262V2.75A.75.75 0 0110 2z" clipRule="evenodd" /><path fillRule="evenodd" d="M10 18a5 5 0 100-10 5 5 0 000 10zm.25-6.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z" clipRule="evenodd" /></svg>,
        colors: 'bg-reride-orange-light text-reride-orange dark:bg-reride-orange dark:text-reride-orange border-reride-orange/50',
    }
};

interface BadgeDisplayProps {
    badges: Badge[];
    size?: 'sm' | 'md';
}

const BadgeDisplay: React.FC<BadgeDisplayProps> = ({ badges, size = 'md' }) => {
    if (!badges || badges.length === 0) return null;

    const sizeClasses = size === 'sm' 
        ? 'px-2 py-0.5 text-xs' 
        : 'px-2.5 py-1 text-sm';
    
    const iconSizeClasses = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

    return (
        <div className="flex flex-wrap gap-2 items-center">
            {badges.map(badge => (
                <div key={badge.type} className="group relative">
                    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${sizeClasses} ${badgeStyles[badge.type].colors}`}>
                        {React.cloneElement(badgeStyles[badge.type].icon, { className: iconSizeClasses })}
                        {badge.label}
                    </span>
                    <div className="absolute bottom-full mb-2 w-60 bg-white text-white text-xs rounded py-1.5 px-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 left-1/2 -translate-x-1/2">
                        {badge.description}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default BadgeDisplay;