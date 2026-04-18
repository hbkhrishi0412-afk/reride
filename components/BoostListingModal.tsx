import React, { useState, useEffect } from 'react';
import type { Vehicle, BoostPackage } from '../types';

interface BoostListingModalProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onBoost: (vehicleId: number, packageId: string) => Promise<void>;
}

// ---------- Premium inline SVG icon set (kept local to avoid new deps) ----------
type IconProps = { className?: string; size?: number; stroke?: number };
const Icon = ({ size = 20, stroke = 1.75, className, children }: IconProps & { children: React.ReactNode }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);
const IconCheck = (p: IconProps) => (<Icon {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></Icon>);
const IconRocket = (p: IconProps) => (<Icon {...p}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></Icon>);
const IconEye = (p: IconProps) => (<Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></Icon>);
const IconBolt = (p: IconProps) => (<Icon {...p}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></Icon>);
const IconCoin = (p: IconProps) => (<Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 9h4.5a1.5 1.5 0 0 1 0 3H10a1.5 1.5 0 0 0 0 3h5" /></Icon>);
const IconShield = (p: IconProps) => (<Icon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Icon>);
const IconStar = (p: IconProps) => (<Icon {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></Icon>);
const IconGlobe = (p: IconProps) => (<Icon {...p}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20" /></Icon>);
const IconTrophy = (p: IconProps) => (<Icon {...p}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M17 4h3v3a3 3 0 0 1-3 3M7 4H4v3a3 3 0 0 0 3 3" /></Icon>);
const IconArrowUp = (p: IconProps) => (<Icon {...p}><path d="M12 19V5M5 12l7-7 7 7" /></Icon>);

const BoostListingModal: React.FC<BoostListingModalProps> = ({
  vehicle,
  onClose,
  onBoost,
}) => {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [boostPackages, setBoostPackages] = useState<BoostPackage[]>([]);

  useEffect(() => {
    const loadBoostPackages = async () => {
      try {
        const { BOOST_PACKAGES } = await import('../constants');
        setBoostPackages(BOOST_PACKAGES);
      } catch (error) {
        console.error('Failed to load boost packages:', error);
      }
    };
    loadBoostPackages();
  }, []);

  if (!vehicle) return null;

  const handleBoost = async () => {
    if (!selectedPackage) return;
    setIsProcessing(true);
    try {
      await onBoost(vehicle.id, selectedPackage);
      onClose();
    } catch (error) {
      console.error('Boost error:', error);
      alert('Failed to boost listing. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getPackageMeta = (type: string): { icon: React.ReactNode; tint: string; color: string } => {
    switch (type) {
      case 'top_search':
        return { icon: <IconArrowUp size={18} stroke={2} />, tint: 'rgba(37,99,235,0.10)', color: '#1D4ED8' };
      case 'homepage_spotlight':
        return { icon: <IconStar size={18} stroke={2} />, tint: 'rgba(245,158,11,0.10)', color: '#B45309' };
      case 'featured_badge':
        return { icon: <IconTrophy size={18} stroke={2} />, tint: 'rgba(139,92,246,0.10)', color: '#6D28D9' };
      case 'multi_city':
        return { icon: <IconGlobe size={18} stroke={2} />, tint: 'rgba(16,185,129,0.10)', color: '#047857' };
      default:
        return { icon: <IconRocket size={18} stroke={2} />, tint: 'rgba(255,107,53,0.10)', color: '#EA580C' };
    }
  };

  const formatPrice = (n: number) => (n >= 10000000 ? `${(n / 10000000).toFixed(2)} Cr` : n >= 100000 ? `${(n / 100000).toFixed(2)} L` : n.toLocaleString('en-IN'));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" style={{ background: 'rgba(8,8,12,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <div
        className="w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-hidden flex flex-col animate-slide-in-up"
        style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.06)', boxShadow: '0 30px 60px -20px rgba(0,0,0,0.40)' }}
      >
        {/* Premium obsidian header */}
        <div
          className="relative overflow-hidden px-5 pt-5 pb-5 sm:px-6 sm:pt-6 text-white"
          style={{ background: 'linear-gradient(180deg, #0B0B0F 0%, #16161D 70%, #1C1C24 100%)' }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-20 -left-16 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(255,107,53,0.22), transparent 70%)' }} />
            <div className="absolute -bottom-24 -right-20 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(168,135,255,0.12), transparent 70%)' }} />
            <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)' }} />
          </div>

          {/* Drag handle (mobile) */}
          <div className="relative flex justify-center sm:hidden mb-3">
            <span className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
          </div>

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span
                className="w-11 h-11 rounded-2xl grid place-items-center text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #FF8456 0%, #FF6B35 100%)', boxShadow: '0 10px 22px -10px rgba(255,107,53,0.55), inset 0 1px 0 rgba(255,255,255,0.20)' }}
              >
                <IconRocket size={20} stroke={1.9} />
              </span>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase tracking-[0.22em] text-white/45 font-semibold">Boost</p>
                <h2 className="text-white font-semibold tracking-tight" style={{ fontSize: 22, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
                  Promote your listing
                </h2>
                <p className="mt-1.5 text-[12px] text-white/55 font-medium truncate">
                  {vehicle.year} {vehicle.make} {vehicle.model} · ₹{formatPrice(vehicle.price)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-9 h-9 rounded-full grid place-items-center text-white/85 active:scale-95 transition-transform shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4 sm:px-6 sm:pt-6 space-y-5">
          {/* Why boost */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { icon: <IconEye size={15} stroke={2} />, label: '3× more views', sub: 'Get noticed faster', tint: 'rgba(37,99,235,0.10)', color: '#1D4ED8' },
              { icon: <IconBolt size={15} stroke={2} />, label: 'Sell faster', sub: 'Lower listing time', tint: 'rgba(245,158,11,0.10)', color: '#B45309' },
              { icon: <IconCoin size={15} stroke={2} />, label: 'Better price', sub: 'Premium visibility', tint: 'rgba(16,185,129,0.10)', color: '#047857' },
            ].map((b, i) => (
              <div
                key={i}
                className="rounded-2xl p-3"
                style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.06)' }}
              >
                <span className="w-8 h-8 rounded-xl grid place-items-center mb-2" style={{ background: b.tint, color: b.color }}>
                  {b.icon}
                </span>
                <p className="text-[11.5px] font-bold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.01em' }}>{b.label}</p>
                <p className="text-[10.5px] text-slate-500 font-medium mt-0.5 leading-snug">{b.sub}</p>
              </div>
            ))}
          </div>

          {/* Packages */}
          <div>
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-slate-400">Packages</p>
                <h3 className="text-[15.5px] font-semibold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                  Choose your boost
                </h3>
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-[0.16em] px-2 py-1 rounded-full"
                style={{ background: 'rgba(16,185,129,0.10)', color: '#047857' }}
              >
                Instant
              </span>
            </div>

            <div className="space-y-2.5">
              {boostPackages.length === 0 ? (
                <div className="text-center py-8 rounded-2xl" style={{ background: 'rgba(15,23,42,0.025)', border: '1px solid rgba(15,23,42,0.06)' }}>
                  <p className="text-[12.5px] text-slate-500 font-medium">Loading packages…</p>
                </div>
              ) : (
                boostPackages.map((pkg) => {
                  const m = getPackageMeta(pkg.type);
                  const isSelected = selectedPackage === pkg.id;
                  const isBest = pkg.id.includes('_7');
                  return (
                    <div
                      key={pkg.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedPackage(pkg.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPackage(pkg.id); } }}
                      className="relative rounded-2xl p-4 cursor-pointer transition-all active:scale-[0.99]"
                      style={{
                        background: isSelected ? 'linear-gradient(180deg, #FFF7F2, #FFFFFF)' : '#FFFFFF',
                        border: `1.5px solid ${isSelected ? '#FF6B35' : 'rgba(15,23,42,0.08)'}`,
                        boxShadow: isSelected
                          ? '0 12px 28px -12px rgba(255,107,53,0.30), 0 1px 2px rgba(255,107,53,0.10)'
                          : '0 1px 2px rgba(15,23,42,0.04)'
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: m.tint, color: m.color }}>
                          {m.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-[14.5px] font-semibold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                              {pkg.name}
                            </h4>
                            {isBest && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-wider"
                                style={{ background: 'linear-gradient(135deg, #34D399, #10B981)', color: '#FFFFFF' }}
                              >
                                Best value
                              </span>
                            )}
                          </div>
                          <ul className="mt-2 space-y-1.5">
                            {pkg.features.map((feature, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-[12px] text-slate-600 font-medium leading-snug">
                                <span className="mt-0.5 shrink-0 text-emerald-600"><IconCheck size={11} stroke={2.4} /></span>
                                {feature}
                              </li>
                            ))}
                          </ul>
                          <p className="mt-2 text-[10.5px] text-slate-400 font-medium uppercase tracking-[0.14em]">
                            Duration · {pkg.durationDays} days
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[22px] font-bold tracking-tight" style={{ color: '#FF6B35', letterSpacing: '-0.02em' }}>
                            ₹{pkg.price}
                          </div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-[0.14em]">One-time</p>
                        </div>
                      </div>

                      {isSelected && (
                        <div
                          className="absolute -top-2 -right-2 w-7 h-7 rounded-full grid place-items-center text-white"
                          style={{ background: 'linear-gradient(135deg, #FF8456, #FF6B35)', boxShadow: '0 6px 14px -6px rgba(255,107,53,0.55)' }}
                        >
                          <IconCheck size={14} stroke={2.6} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { icon: <IconShield size={12} stroke={2.2} />, label: 'Secure payment' },
              { icon: <IconBolt size={12} stroke={2.2} />, label: 'Instant activation' },
            ].map((b, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: 'rgba(15,23,42,0.04)', color: '#475569', border: '1px solid rgba(15,23,42,0.06)' }}
              >
                {b.icon}
                {b.label}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-5 sm:px-6 py-3.5 flex gap-2.5"
          style={{ background: 'rgba(248,250,252,0.85)', borderTop: '1px solid rgba(15,23,42,0.06)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 inline-flex items-center justify-center rounded-2xl py-3 text-[13px] font-semibold text-slate-700 active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{ background: 'rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.06)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleBoost}
            disabled={!selectedPackage || isProcessing}
            className="flex-[1.4] inline-flex items-center justify-center gap-2 rounded-2xl py-3 text-[13px] font-semibold text-white active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: selectedPackage
                ? 'linear-gradient(135deg, #FF8456 0%, #FF6B35 100%)'
                : 'linear-gradient(135deg, #14141C 0%, #0B0B11 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: selectedPackage
                ? '0 14px 30px -12px rgba(255,107,53,0.45)'
                : '0 14px 30px -14px rgba(11,11,15,0.55)'
            }}
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing…
              </>
            ) : (
              <>
                <IconRocket size={15} stroke={2} />
                Boost now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BoostListingModal;
