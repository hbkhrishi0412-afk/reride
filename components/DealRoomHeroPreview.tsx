import React from 'react';
import { useTranslation } from 'react-i18next';

interface DealRoomHeroPreviewProps {
  compact?: boolean;
  className?: string;
}

const STEPS = [
  { key: 'chat', done: true, labelKey: 'home.dealPreview.chat', fallback: 'Chat accepted' },
  { key: 'inspect', done: true, labelKey: 'home.dealPreview.inspect', fallback: 'Inspection booked' },
  { key: 'token', done: false, current: true, labelKey: 'home.dealPreview.token', fallback: 'Token' },
  { key: 'rc', done: false, labelKey: 'home.dealPreview.rc', fallback: 'RC transfer' },
] as const;

/** Decorative product shot — the deal room, not another classifieds search bar. */
export const DealRoomHeroPreview: React.FC<DealRoomHeroPreviewProps> = ({
  compact = false,
  className = '',
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={`text-left overflow-hidden rounded-2xl border border-white/10 bg-[#F7F4F0] shadow-[0_24px_48px_-24px_rgba(0,0,0,0.55)] ${className}`}
      data-testid="deal-room-hero-preview"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-2 border-b border-stone-200/80 bg-white px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-600">
            {t('home.dealPreview.eyebrow', { defaultValue: 'Deal room' })}
          </p>
          <p className="truncate text-[13px] font-semibold text-stone-900">
            {t('home.dealPreview.vehicle', { defaultValue: '2021 Swift · Pune' })}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-semibold text-white">
          {t('home.dealPreview.stage', { defaultValue: 'Token next' })}
        </span>
      </div>

      <div className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-[1fr_0.9fr]'}`}>
        <div className="space-y-2 border-stone-200/70 px-3.5 py-3 md:border-r">
          <p className="text-[11px] font-medium text-stone-500">
            {t('home.dealPreview.thread', { defaultValue: 'Buyer · Seller' })}
          </p>
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-[12px] text-stone-700 shadow-sm">
            {t('home.dealPreview.msg1', { defaultValue: 'RC copy is on the listing. Can we inspect Saturday?' })}
          </div>
          <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-stone-900 px-3 py-2 text-[12px] text-white">
            {t('home.dealPreview.msg2', { defaultValue: 'Yes — booked. Token after inspection.' })}
          </div>
        </div>

        {!compact && (
          <div className="hidden space-y-2 px-3.5 py-3 md:block">
            <p className="text-[11px] font-medium text-stone-500">
              {t('home.dealPreview.milestones', { defaultValue: 'Milestones' })}
            </p>
            <ol className="space-y-1.5">
              {STEPS.map((step) => (
                <li key={step.key} className="flex items-center gap-2 text-[12px]">
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                      step.done
                        ? 'bg-emerald-600 text-white'
                        : 'current' in step && step.current
                          ? 'bg-orange-500 text-white'
                          : 'border border-stone-300 bg-white text-stone-400'
                    }`}
                  >
                    {step.done ? '✓' : 'current' in step && step.current ? '•' : ''}
                  </span>
                  <span className={step.done ? 'text-stone-800' : 'text-stone-500'}>
                    {t(step.labelKey, { defaultValue: step.fallback })}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {compact && (
        <div className="flex gap-1 border-t border-stone-200/80 px-3 py-2">
          {STEPS.map((step) => (
            <span
              key={step.key}
              className={`flex-1 truncate rounded-md px-1.5 py-1 text-center text-[9px] font-semibold ${
                step.done
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'current' in step && step.current
                    ? 'bg-orange-50 text-orange-700'
                    : 'bg-stone-100 text-stone-500'
              }`}
            >
              {t(step.labelKey, { defaultValue: step.fallback })}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-stone-200/80 bg-white px-3.5 py-2 text-[11px] text-stone-600">
        <span>{t('home.dealPreview.rcLine', { defaultValue: 'RC on file · MH12' })}</span>
        <span className="font-semibold text-stone-900">
          {t('home.dealPreview.tracked', { defaultValue: 'Tracked to RC' })}
        </span>
      </div>
    </div>
  );
};

export default DealRoomHeroPreview;
