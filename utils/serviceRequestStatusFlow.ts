/**
 * Provider workflow for car service requests: happy-path button + valid manual status list.
 */
export type ServiceRequestStatus = 'open' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

/** Next status when the provider taps the primary advance button (Open → … → Completed). */
export function nextPrimaryStatus(s: ServiceRequestStatus): ServiceRequestStatus | null {
    if (s === 'open') return 'accepted';
    if (s === 'accepted') return 'in_progress';
    if (s === 'in_progress') return 'completed';
    return null;
}

/** Label for the primary advance button; null = no primary action (terminal states). */
export function primaryAdvanceButtonLabel(s: ServiceRequestStatus): string | null {
    if (s === 'open') return 'Accept';
    if (s === 'accepted') return 'Start job';
    if (s === 'in_progress') return 'Mark complete';
    return null;
}

/**
 * Statuses allowed in the manual dropdown for the current state (includes current + realistic transitions).
 */
export function allowedManualStatusOptions(s: ServiceRequestStatus): ServiceRequestStatus[] {
    switch (s) {
        case 'open':
            return ['open', 'accepted', 'cancelled'];
        case 'accepted':
            return ['accepted', 'in_progress', 'cancelled'];
        case 'in_progress':
            return ['in_progress', 'completed', 'cancelled'];
        case 'completed':
            return ['completed'];
        case 'cancelled':
            return ['cancelled'];
        default:
            return [s];
    }
}
