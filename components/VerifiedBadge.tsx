import React from 'react';
import type { User, Badge } from '../types.js';

interface VerifiedBadgeProps {
	show: boolean;
	size?: 'sm' | 'md';
	className?: string;
	iconOnly?: boolean;
}

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
		aria-hidden="true"
		className={className}
	>
		<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.707 7.293-5.5 5.5a1 1 0 0 1-1.414 0l-2.5-2.5a1 1 0 0 1 1.414-1.414l1.793 1.793 4.793-4.793a1 1 0 1 1 1.414 1.414Z" />
	</svg>
);

export const isUserVerified = (user?: User | null): boolean => {
	if (!user) return false;
	// Prioritize explicit isVerified, then verificationStatus.govtIdVerified, then presence of a 'verified' badge
	if (user.isVerified) return true;
	if (user.verificationStatus?.govtIdVerified) return true;
	if (Array.isArray(user.badges)) {
		return (user.badges as Badge[]).some(b => b.type === 'verified');
	}
	return false;
};

const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ show, size = 'md', className, iconOnly = false }) => {
	if (!show) return null;

	const dimension = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
	const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

	if (iconOnly) {
		return (
			<span className={`inline-flex items-center justify-center rounded-full bg-blue-600 text-white ${className || ''}`}>
				<CheckIcon className={`${dimension}`} />
			</span>
		);
	}

	return (
		<span className={`inline-flex items-center gap-1 text-blue-600 ${textSize} ${className || ''}`}>
			<span className="inline-flex items-center justify-center rounded-full bg-blue-100">
				<CheckIcon className={`${dimension}`} />
			</span>
			<span className="font-semibold">Verified</span>
		</span>
	);
};

export default VerifiedBadge;


