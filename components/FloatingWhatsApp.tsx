import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PLATFORM_SUPPORT_PHONE_E164, supportWhatsAppHref } from '../utils/whatsappShare';

interface FloatingWhatsAppProps {
    /** Pre-filled WhatsApp message. Falls back to a localized greeting. */
    message?: string;
    /** Hide on very small viewports if a bottom sticky CTA already occupies the area. */
    className?: string;
}

/**
 * Floating WhatsApp CTA — India's highest-intent support/conversion channel.
 * WHY: rendered only when a business number is configured (VITE_SUPPORT_WHATSAPP_E164),
 * so we never ship a dead link to wa.me with no recipient.
 */
const FloatingWhatsApp: React.FC<FloatingWhatsAppProps> = ({ message, className = '' }) => {
    const { t } = useTranslation();

    // WHY: no configured recipient → don't render a broken/ambiguous chat link.
    if (!PLATFORM_SUPPORT_PHONE_E164) return null;

    const label = t('home.whatsapp.tooltip', { defaultValue: 'Chat with us' });
    const aria = t('home.whatsapp.aria', { defaultValue: 'Chat with ReRide support on WhatsApp' });
    const greeting =
        message ||
        t('home.whatsapp.message', {
            defaultValue: 'Hi ReRide, I need help buying or selling a vehicle.',
        });

    return (
        <a
            href={supportWhatsAppHref(greeting)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={aria}
            // WHY: z-40 keeps it below the active-chat ChatWidget overlay (z-50+) while
            // still floating above page content; contain/translateZ isolates paint.
            className={`group fixed bottom-5 right-5 z-40 flex items-center gap-0 rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_-6px_rgba(37,211,102,0.6)] ring-1 ring-white/30 transition-transform duration-300 hover:scale-105 active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 ${className}`}
            style={{ willChange: 'transform', contain: 'layout paint', transform: 'translateZ(0)' }}
        >
            {/* WHY: ping ring is decorative; suppressed under reduced-motion for a11y. */}
            <span className="pointer-events-none absolute inset-0 rounded-full bg-[#25D366] opacity-60 motion-safe:animate-ping motion-reduce:hidden" aria-hidden="true" />
            <span className="relative flex h-14 w-14 items-center justify-center">
                <svg viewBox="0 0 32 32" className="h-7 w-7 fill-current" aria-hidden="true">
                    <path d="M16.004 5.333c-5.89 0-10.667 4.776-10.667 10.667 0 1.88.494 3.71 1.43 5.327L5.333 26.667l5.49-1.41a10.62 10.62 0 0 0 5.181 1.32h.004c5.89 0 10.667-4.776 10.667-10.667 0-2.85-1.11-5.53-3.126-7.546a10.59 10.59 0 0 0-7.545-3.13Zm0 19.2h-.003a8.84 8.84 0 0 1-4.503-1.233l-.323-.192-3.258.837.87-3.176-.21-.326a8.81 8.81 0 0 1-1.353-4.69c0-4.886 3.977-8.863 8.866-8.863a8.8 8.8 0 0 1 6.265 2.6 8.8 8.8 0 0 1 2.594 6.27c0 4.887-3.977 8.864-8.865 8.864Zm4.862-6.64c-.266-.134-1.576-.778-1.82-.867-.244-.089-.422-.133-.6.134-.177.266-.688.866-.844 1.044-.155.178-.31.2-.577.067-.266-.134-1.125-.415-2.143-1.323-.792-.706-1.327-1.578-1.482-1.845-.155-.266-.017-.41.117-.543.12-.12.266-.31.4-.466.133-.155.177-.266.266-.444.089-.178.044-.334-.022-.467-.067-.133-.6-1.445-.822-1.978-.216-.52-.437-.449-.6-.457l-.51-.01a.98.98 0 0 0-.71.334c-.244.266-.932.91-.932 2.222s.954 2.578 1.087 2.756c.133.178 1.878 2.867 4.55 4.022.636.274 1.132.438 1.518.56.638.203 1.219.174 1.678.106.512-.076 1.576-.644 1.798-1.266.222-.622.222-1.156.155-1.267-.066-.111-.244-.178-.51-.311Z" />
                </svg>
            </span>
            {/* WHY: label collapses to icon-only on mobile to keep a 44px+ tap target without crowding. */}
            <span className="hidden max-w-0 overflow-hidden whitespace-nowrap pr-0 text-sm font-semibold transition-all duration-300 group-hover:max-w-[140px] group-hover:pr-5 md:inline-block">
                {label}
            </span>
        </a>
    );
};

export default memo(FloatingWhatsApp);
