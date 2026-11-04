import React, { useRef } from 'react';
import { WebsitePageGutters } from './WebsitePageShell';
import { formatSupportPhoneDisplay, supportTelHref } from '../utils/whatsappShare.js';
import { View } from '../types.js';
import AutoT from './AutoT';
import { useAutoT } from '../hooks/useAutoT';
import { useIsMobileApp } from '../hooks/useIsMobileApp';

interface AboutUsPageProps {
  onNavigate?: (view: View) => void;
}

const STAT_KEYS = [
  { labelKey: 'about.stat1.label', valueKey: 'about.stat1.value' },
  { labelKey: 'about.stat2.label', valueKey: 'about.stat2.value' },
  { labelKey: 'about.stat3.label', valueKey: 'about.stat3.value' },
] as const;

const DEAL_STEP_KEYS = [
  { titleKey: 'about.howDeals.step1.title', descKey: 'about.howDeals.step1.desc', tagKey: 'about.howDeals.step1.tag' },
  { titleKey: 'about.howDeals.step2.title', descKey: 'about.howDeals.step2.desc', tagKey: 'about.howDeals.step2.tag' },
  { titleKey: 'about.howDeals.step3.title', descKey: 'about.howDeals.step3.desc', tagKey: 'about.howDeals.step3.tag' },
] as const;

const FEATURE_KEYS = [
  { titleKey: 'about.feature1.title', descKey: 'about.feature1.desc', tone: 'orange' as const },
  { titleKey: 'about.feature2.title', descKey: 'about.feature2.desc', tone: 'blue' as const },
  { titleKey: 'about.feature3.title', descKey: 'about.feature3.desc', tone: 'teal' as const },
] as const;

const WHAT_POINTS = ['about.whatWeDo.point1', 'about.whatWeDo.point2', 'about.whatWeDo.point3'] as const;
const TRUST_KEYS = ['about.trust1', 'about.trust2', 'about.trust3'] as const;

function PremiumCarArt({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 520 320" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="au2-body" x1="60" y1="120" x2="460" y2="240" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF8A5B" />
          <stop offset="0.45" stopColor="#FF6B35" />
          <stop offset="1" stopColor="#E85D04" />
        </linearGradient>
        <linearGradient id="au2-glass" x1="180" y1="110" x2="360" y2="170" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E0F2FE" stopOpacity="0.95" />
          <stop offset="1" stopColor="#7DD3FC" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="au2-road" x1="40" y1="250" x2="480" y2="280" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0B1220" stopOpacity="0.9" />
          <stop offset="1" stopColor="#1E293B" stopOpacity="0.55" />
        </linearGradient>
        <filter id="au2-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#FF6B35" floodOpacity="0.35" />
        </filter>
        <filter id="au2-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#020617" floodOpacity="0.4" />
        </filter>
      </defs>

      <ellipse cx="260" cy="268" rx="190" ry="28" fill="#020617" opacity="0.45" />
      <path d="M40 248 C140 220 380 290 480 250 L480 300 C360 330 140 280 40 310 Z" fill="url(#au2-road)" />
      <path
        d="M90 262 C180 244 340 286 430 262"
        stroke="#94A3B8"
        strokeWidth="3"
        strokeDasharray="16 14"
        strokeLinecap="round"
        opacity="0.45"
        className="au-dash"
      />

      <g filter="url(#au2-glow)" className="au-car">
        <path
          d="M78 210 C92 168 130 146 176 140 L230 134 C278 112 348 112 392 136 L430 148 C454 156 468 174 470 196 L468 220 C468 234 456 244 440 244 H104 C86 244 76 232 76 218 C76 214 76 212 78 210Z"
          fill="url(#au2-body)"
        />
        <path
          d="M188 142 L232 136 C274 118 338 118 378 138 L412 150 L402 188 H198 Z"
          fill="#0F172A"
          opacity="0.22"
        />
        <path
          d="M198 148 L236 142 C270 128 328 128 360 142 L392 152 L386 180 H206 Z"
          fill="url(#au2-glass)"
        />
        <path d="M286 142 V180" stroke="#FFF" strokeOpacity="0.25" strokeWidth="2" />
        <rect x="432" y="188" width="18" height="10" rx="2" fill="#FDE68A" opacity="0.95" />
        <rect x="92" y="188" width="12" height="8" rx="2" fill="#F8FAFC" opacity="0.7" />
        <path d="M160 244 H250" stroke="#FFF" strokeOpacity="0.2" strokeWidth="3" strokeLinecap="round" />

        <circle cx="150" cy="244" r="28" fill="#0F172A" />
        <circle cx="150" cy="244" r="16" fill="#475569" />
        <circle cx="150" cy="244" r="6" fill="#E2E8F0" />
        <circle cx="150" cy="244" r="28" stroke="#FF6B35" strokeOpacity="0.35" strokeWidth="2" />

        <circle cx="390" cy="244" r="28" fill="#0F172A" />
        <circle cx="390" cy="244" r="16" fill="#475569" />
        <circle cx="390" cy="244" r="6" fill="#E2E8F0" />
        <circle cx="390" cy="244" r="28" stroke="#FF6B35" strokeOpacity="0.35" strokeWidth="2" />
      </g>

      {/* Floating RC card */}
      <g className="au-float-a" filter="url(#au2-soft)">
        <rect x="24" y="48" width="96" height="118" rx="16" fill="rgba(255,255,255,0.95)" />
        <rect x="24" y="48" width="96" height="28" rx="16" fill="#FF6B35" />
        <rect x="24" y="62" width="96" height="14" fill="#FF6B35" />
        <text x="48" y="68" fill="#fff" fontSize="11" fontWeight="800" fontFamily="Nunito Sans,system-ui,sans-serif">
          RC BOOK
        </text>
        <rect x="40" y="92" width="64" height="8" rx="4" fill="#CBD5E1" />
        <rect x="40" y="108" width="48" height="6" rx="3" fill="#E2E8F0" />
        <rect x="40" y="120" width="56" height="6" rx="3" fill="#E2E8F0" />
        <rect x="40" y="138" width="40" height="14" rx="7" fill="#1E88E5" />
      </g>

      {/* Chat pill */}
      <g className="au-float-b" filter="url(#au2-soft)">
        <rect x="380" y="36" width="112" height="64" rx="18" fill="rgba(255,255,255,0.95)" />
        <circle cx="408" cy="68" r="8" fill="#38BDF8" />
        <circle cx="430" cy="68" r="8" fill="#FF6B35" />
        <circle cx="452" cy="68" r="8" fill="#94A3B8" />
        <path d="M400 100 L414 100 L408 112 Z" fill="rgba(255,255,255,0.95)" />
      </g>

      {/* Milestone badge */}
      <g className="au-float-c" filter="url(#au2-soft)">
        <rect x="400" y="140" width="92" height="40" rx="20" fill="#0F172A" />
        <circle cx="422" cy="160" r="10" fill="#22C55E" />
        <path d="M417 160 l3.5 3.5 7-8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <text x="438" y="165" fill="#E2E8F0" fontSize="11" fontWeight="700" fontFamily="Nunito Sans,system-ui,sans-serif">
          Milestone
        </text>
      </g>
    </svg>
  );
}

function StepArt({ index }: { index: number }) {
  if (index === 0) {
    return (
      <svg viewBox="0 0 280 160" className="w-full h-auto" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="s0a" x1="40" y1="20" x2="160" y2="140" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFF7ED" />
            <stop offset="1" stopColor="#FFEDD5" />
          </linearGradient>
        </defs>
        <rect width="280" height="160" rx="24" fill="url(#s0a)" />
        <rect x="36" y="28" width="100" height="104" rx="16" fill="#0F172A" />
        <rect x="46" y="40" width="80" height="80" rx="10" fill="#1E293B" />
        <rect x="54" y="48" width="64" height="40" rx="8" fill="#FF6B35" />
        <rect x="54" y="96" width="40" height="6" rx="3" fill="#64748B" />
        <rect x="54" y="108" width="52" height="6" rx="3" fill="#475569" />
        <circle cx="190" cy="70" r="42" fill="#FFF" opacity="0.9" />
        <path d="M172 72 l12 12 24-28" stroke="#16A34A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="230" cy="118" r="22" fill="#FF6B35" />
        <path d="M230 108 c-7 0-12 5-12 11 0 10 12 19 12 19 s12-9 12-19 c0-6-5-11-12-11z" fill="#FFF" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg viewBox="0 0 280 160" className="w-full h-auto" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="s1a" x1="40" y1="20" x2="200" y2="140" gradientUnits="userSpaceOnUse">
            <stop stopColor="#EFF6FF" />
            <stop offset="1" stopColor="#DBEAFE" />
          </linearGradient>
        </defs>
        <rect width="280" height="160" rx="24" fill="url(#s1a)" />
        <ellipse cx="120" cy="118" rx="70" ry="12" fill="#94A3B8" opacity="0.25" />
        <path d="M48 100 C60 72 86 58 118 54 L150 50 C178 40 206 46 224 62 L240 74 V100 H48 Z" fill="#FF6B35" />
        <path d="M124 56 C152 44 184 46 208 60 L226 70 H130 Z" fill="#0F172A" opacity="0.2" />
        <circle cx="86" cy="104" r="16" fill="#0F172A" />
        <circle cx="198" cy="104" r="16" fill="#0F172A" />
        <rect x="176" y="24" width="72" height="56" rx="14" fill="#FFF" />
        <rect x="188" y="38" width="40" height="6" rx="3" fill="#CBD5E1" />
        <rect x="188" y="50" width="28" height="6" rx="3" fill="#E2E8F0" />
        <circle cx="228" cy="68" r="10" fill="#22C55E" />
        <path d="M223 68 l3 3 7-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 280 160" className="w-full h-auto" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="s2a" x1="40" y1="20" x2="200" y2="140" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ECFDF5" />
          <stop offset="1" stopColor="#D1FAE5" />
        </linearGradient>
      </defs>
      <rect width="280" height="160" rx="24" fill="url(#s2a)" />
      <rect x="40" y="34" width="100" height="92" rx="16" fill="#FFF" />
      <rect x="40" y="34" width="100" height="28" rx="16" fill="#1E88E5" />
      <rect x="40" y="48" width="100" height="14" fill="#1E88E5" />
      <text x="68" y="54" fill="#fff" fontSize="12" fontWeight="800" fontFamily="Nunito Sans,system-ui,sans-serif">
        RC
      </text>
      <rect x="56" y="78" width="60" height="7" rx="3.5" fill="#CBD5E1" />
      <rect x="56" y="92" width="48" height="6" rx="3" fill="#E2E8F0" />
      <rect x="56" y="104" width="36" height="10" rx="5" fill="#FF6B35" />
      <circle cx="198" cy="84" r="44" fill="#FFF" />
      <circle cx="198" cy="84" r="32" stroke="#22C55E" strokeWidth="6" fill="none" />
      <path d="M182 84 l10 10 22-24" stroke="#16A34A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FeatureGlyph({ tone }: { tone: 'orange' | 'blue' | 'teal' }) {
  if (tone === 'orange') {
    return (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="4" y="6" width="14" height="20" rx="4" fill="#FF6B35" />
        <rect x="12" y="10" width="16" height="16" rx="4" fill="#1E88E5" />
        <path d="M16 16 h8 M16 21 h5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (tone === 'blue') {
    return (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="12" fill="#1E88E5" opacity="0.15" />
        <circle cx="16" cy="16" r="12" stroke="#1E88E5" strokeWidth="2.5" />
        <path d="M10 17c3-7 9-7 12 0" stroke="#FF6B35" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="16" cy="13" r="3.5" fill="#FF6B35" />
      </svg>
    );
  }
  return (
    <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 3 l11 5 v8 c0 7-5 12-11 14 C10 28 5 23 5 16 V8 z" fill="#0D9488" />
      <path d="M11 16 l3.5 3.5 7-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const AboutUsPage: React.FC<AboutUsPageProps> = ({ onNavigate }) => {
  const { isMobileApp } = useIsMobileApp();
  const supportTel = supportTelHref();
  const whatWeDoBody = useAutoT('about.whatWeDo.body');
  const stageRef = useRef<HTMLDivElement>(null);

  const onStageMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = stageRef.current;
    if (!el || window.matchMedia('(pointer: coarse)').matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${(-py * 8).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(px * 10).toFixed(2)}deg`);
  };

  const onStageLeave = () => {
    const el = stageRef.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };

  return (
    <div className={`au-root animate-fade-in overflow-x-hidden ${isMobileApp ? 'pb-4' : 'pb-24 lg:pb-12'}`}>
      <style>{`
        .au-root {
          --au-ink: #0B1220;
          --au-orange: #FF6B35;
          --au-blue: #1E88E5;
          background:
            radial-gradient(900px 420px at 8% -5%, rgba(255,107,53,0.09), transparent 55%),
            radial-gradient(800px 380px at 92% 8%, rgba(30,136,229,0.08), transparent 50%),
            linear-gradient(180deg, #FAFAFA 0%, #F5F7FA 40%, #FAFAFA 100%);
        }
        .dark .au-root {
          background:
            radial-gradient(900px 420px at 8% -5%, rgba(255,107,53,0.14), transparent 55%),
            radial-gradient(800px 380px at 92% 8%, rgba(56,189,248,0.1), transparent 50%),
            linear-gradient(180deg, #0B1220 0%, #111827 50%, #0B1220 100%);
        }

        .au-hero {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          background:
            radial-gradient(1000px 520px at 12% -8%, rgba(255,107,53,0.55), transparent 58%),
            radial-gradient(900px 480px at 88% 8%, rgba(30,136,229,0.45), transparent 55%),
            radial-gradient(700px 420px at 50% 110%, rgba(251,146,60,0.28), transparent 60%),
            linear-gradient(145deg, #0B1220 0%, #152238 48%, #0F172A 100%);
        }
        .au-hero::before {
          content: "";
          position: absolute; inset: -25%;
          background: conic-gradient(from 180deg at 50% 50%,
            rgba(255,107,53,0.28), rgba(30,136,229,0.18), rgba(251,191,36,0.16), rgba(255,107,53,0.28));
          filter: blur(80px);
          opacity: 0.55;
          animation: au-spin 28s linear infinite;
          z-index: 0;
        }
        .au-hero::after {
          content: "";
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse at 65% 35%, black 15%, transparent 72%);
          opacity: 0.35;
          z-index: 0;
        }
        @keyframes au-spin { to { transform: rotate(360deg); } }

        .au-orb {
          position: absolute; border-radius: 9999px; filter: blur(48px);
          mix-blend-mode: screen; pointer-events: none; z-index: 0;
        }
        .au-orb-a { width: 320px; height: 320px; left: -90px; top: -40px; background: #FF6B35; opacity: .35; animation: au-drift 16s ease-in-out infinite; }
        .au-orb-b { width: 380px; height: 380px; right: -120px; top: 12%; background: #38BDF8; opacity: .28; animation: au-drift 19s ease-in-out infinite reverse; }
        .au-orb-c { width: 240px; height: 240px; left: 38%; bottom: -80px; background: #FBBF24; opacity: .22; animation: au-drift 22s ease-in-out infinite; }
        @keyframes au-drift {
          0%, 100% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(28px,-20px,0) scale(1.08); }
        }

        .au-rise { animation: au-rise .85s both cubic-bezier(.2,.8,.2,1); }
        .au-d1 { animation-delay: .05s; }
        .au-d2 { animation-delay: .14s; }
        .au-d3 { animation-delay: .24s; }
        .au-d4 { animation-delay: .34s; }
        .au-d5 { animation-delay: .44s; }
        @keyframes au-rise {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .au-grad {
          background: linear-gradient(100deg, #FFFFFF 0%, #FFEDD5 35%, #FDE68A 55%, #FFFFFF 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
          background-size: 220% 100%;
          animation: au-shimmer 9s ease-in-out infinite;
        }
        @keyframes au-shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .au-btn-primary {
          background: linear-gradient(135deg, #FFFFFF, #FFEDD5);
          color: #9A3412;
          box-shadow: 0 14px 34px -10px rgba(255,107,53,.55), inset 0 1px 0 rgba(255,255,255,.9);
          transition: transform .25s ease, box-shadow .25s ease;
        }
        .au-btn-primary:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 20px 40px -12px rgba(255,107,53,.7);
        }
        .au-btn-ghost {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.28);
          backdrop-filter: blur(12px);
          transition: transform .25s ease, background .25s ease, border-color .25s ease;
        }
        .au-btn-ghost:hover {
          transform: translateY(-2px);
          background: rgba(255,255,255,0.14);
          border-color: rgba(255,255,255,0.5);
        }

        .au-stage {
          perspective: 1200px;
        }
        .au-tilt {
          transform-style: preserve-3d;
          transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
          transition: transform .28s cubic-bezier(.2,.8,.2,1);
        }
        .au-ring {
          position: absolute; inset: 0; border-radius: 9999px;
          border: 1px solid rgba(255,255,255,0.16);
          box-shadow: inset 0 0 50px rgba(255,107,53,0.12);
          animation: au-spin 22s linear infinite;
        }

        .au-glass {
          background: linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05));
          border: 1px solid rgba(255,255,255,0.28);
          backdrop-filter: blur(18px);
          box-shadow: 0 30px 80px -24px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.35);
        }

        .au-float-a { animation: au-float 5.8s ease-in-out infinite; }
        .au-float-b { animation: au-float 6.8s ease-in-out infinite reverse; animation-delay: .35s; }
        .au-float-c { animation: au-float 7.2s ease-in-out infinite; animation-delay: .7s; }
        .au-car { animation: au-float 4.8s ease-in-out infinite; }
        .au-dash { animation: au-dash 2.6s linear infinite; }
        @keyframes au-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-9px); }
        }
        @keyframes au-dash { to { stroke-dashoffset: -60; } }

        .au-stat {
          background: rgba(255,255,255,0.92);
          border: 1px solid rgba(226,232,240,0.9);
          box-shadow: 0 18px 40px -24px rgba(15,23,42,.35), inset 0 1px 0 #fff;
          transition: transform .3s ease, box-shadow .3s ease;
        }
        .dark .au-stat {
          background: rgba(30,41,59,0.92);
          border-color: rgba(51,65,85,0.9);
          box-shadow: 0 18px 40px -24px rgba(0,0,0,.5);
        }
        .au-stat:hover { transform: translateY(-3px); box-shadow: 0 24px 48px -22px rgba(255,107,53,.28); }

        .au-card {
          background: #fff;
          border: 1px solid #EEF2F7;
          box-shadow: 0 1px 0 rgba(255,255,255,.9) inset, 0 16px 40px -28px rgba(15,23,42,.28);
          transition: transform .3s cubic-bezier(.2,.8,.2,1), box-shadow .3s ease, border-color .3s ease;
        }
        .dark .au-card {
          background: #1E293B;
          border-color: #334155;
          box-shadow: 0 16px 40px -28px rgba(0,0,0,.5);
        }
        .au-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255,107,53,0.35);
          box-shadow: 0 28px 50px -26px rgba(255,107,53,.35);
        }

        .au-step-num {
          background: linear-gradient(135deg, #FF6B35, #F97316);
          box-shadow: 0 14px 28px -10px rgba(255,107,53,.55), inset 0 1px 0 rgba(255,255,255,.4);
        }
        .au-step-num::before {
          content: "";
          position: absolute; inset: -7px; border-radius: inherit;
          background: conic-gradient(from 0deg, rgba(255,107,53,.55), rgba(30,136,229,.35), rgba(251,191,36,.4), rgba(255,107,53,.55));
          filter: blur(8px); opacity: .65; z-index: -1;
          animation: au-spin 10s linear infinite;
        }

        .au-cta {
          position: relative; isolation: isolate; overflow: hidden;
          background:
            radial-gradient(520px 260px at 12% 20%, rgba(255,107,53,.55), transparent 60%),
            radial-gradient(560px 300px at 90% 80%, rgba(30,136,229,.45), transparent 60%),
            linear-gradient(135deg, #9A3412, #C2410C 45%, #1E3A5F);
        }
        .au-cta::before {
          content: "";
          position: absolute; inset: -12%;
          background: conic-gradient(from 0deg, rgba(255,255,255,.22), transparent 25%, rgba(255,255,255,.16) 45%, transparent 70%, rgba(255,255,255,.2));
          filter: blur(40px); opacity: .35;
          animation: au-spin 26s linear infinite;
          z-index: 0;
        }

        .au-eyebrow {
          display: inline-flex; align-items: center; gap: .5rem;
          padding: .3rem .85rem; border-radius: 9999px;
          font-size: .7rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
          background: linear-gradient(90deg, rgba(255,107,53,.12), rgba(30,136,229,.1));
          color: #C2410C; border: 1px solid rgba(255,107,53,.22);
        }
        .dark .au-eyebrow {
          color: #FDBA74;
          border-color: rgba(255,107,53,.3);
          background: linear-gradient(90deg, rgba(255,107,53,.18), rgba(30,136,229,.12));
        }

        @media (pointer: coarse) {
          .au-tilt { transform: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .au-hero::before, .au-orb, .au-rise, .au-grad, .au-float-a, .au-float-b, .au-float-c,
          .au-car, .au-dash, .au-ring, .au-step-num::before, .au-cta::before {
            animation: none !important;
          }
        }
      `}</style>

      {/* ===== HERO ===== */}
      <section className="au-hero text-white">
        <span className="au-orb au-orb-a" aria-hidden="true" />
        <span className="au-orb au-orb-b" aria-hidden="true" />
        <span className="au-orb au-orb-c" aria-hidden="true" />

        <WebsitePageGutters className="relative z-10 pt-12 lg:pt-20 pb-16 lg:pb-24">
          <div className="max-w-5xl mx-auto grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            <div className="lg:col-span-6 text-center lg:text-left space-y-5 lg:space-y-6">
              <div className="au-rise au-d1 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs sm:text-sm font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <AutoT i18nKey="about.badge" />
              </div>

              <h1 className="au-rise au-d2 font-brand text-3xl sm:text-4xl lg:text-5xl xl:text-[3.35rem] font-black leading-[1.08] tracking-tight">
                <span className="au-grad">
                  <AutoT i18nKey="about.hero.title" as="span" />
                </span>
              </h1>

              <p className="au-rise au-d3 text-white/80 text-sm sm:text-base lg:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0">
                <AutoT i18nKey="about.hero.subtitle" as="span" />
              </p>

              {onNavigate && (
                <div className="au-rise au-d4 flex flex-col sm:flex-row gap-3 pt-1 max-w-md mx-auto lg:mx-0">
                  <button
                    type="button"
                    onClick={() => onNavigate(View.USED_CARS)}
                    className="au-btn-primary w-full sm:w-auto px-7 py-3.5 rounded-2xl font-bold text-base"
                  >
                    <span className="inline-flex items-center gap-2">
                      <AutoT i18nKey="about.hero.ctaBuy" />
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate(View.SELL_CAR)}
                    className="au-btn-ghost w-full sm:w-auto px-7 py-3.5 rounded-2xl text-white font-semibold text-base"
                  >
                    <AutoT i18nKey="about.hero.ctaSell" />
                  </button>
                </div>
              )}

              <div className="au-rise au-d5 flex flex-wrap justify-center lg:justify-start gap-x-5 gap-y-2 text-xs sm:text-sm text-white/75 pt-1">
                {TRUST_KEYS.map((key) => (
                  <span key={key} className="inline-flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <AutoT i18nKey={key} />
                  </span>
                ))}
              </div>
            </div>

            {/* Premium stage */}
            <div className="hidden lg:flex lg:col-span-6 au-stage justify-center">
              <div
                ref={stageRef}
                className="relative w-[440px] h-[420px]"
                onMouseMove={onStageMove}
                onMouseLeave={onStageLeave}
              >
                <span className="au-ring" />
                <span className="au-ring" style={{ inset: 28, animationDuration: '28s', animationDirection: 'reverse' }} />
                <span className="au-ring" style={{ inset: 56, animationDuration: '36s' }} />

                <div className="au-tilt absolute inset-0 flex items-center justify-center">
                  <div className="relative w-full px-2">
                    <PremiumCarArt className="w-full drop-shadow-2xl" />

                    <div className="au-glass absolute left-6 bottom-8 rounded-3xl p-4 w-[200px]">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-white/60 font-bold mb-2">Live deal</div>
                      <div className="space-y-2">
                        {['Interest', 'Inspect', 'RC'].map((label, i) => (
                          <div key={label} className="flex items-center gap-2 text-sm text-white/90">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                i < 2 ? 'bg-emerald-400/25 border border-emerald-300/50 text-emerald-200' : 'bg-white/10 border border-white/25 text-white/70'
                              }`}
                            >
                              {i < 2 ? '✓' : '3'}
                            </span>
                            {label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </WebsitePageGutters>

        <svg className="relative block w-full text-[#FAFAFA] dark:text-[#0B1220]" viewBox="0 0 1440 72" preserveAspectRatio="none" aria-hidden="true">
          <path fill="currentColor" d="M0,32 C240,72 480,0 720,28 C960,56 1200,72 1440,24 L1440,72 L0,72 Z" />
        </svg>
      </section>

      <WebsitePageGutters narrow="5xl" className="-mt-2 relative z-10">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {STAT_KEYS.map((stat, i) => (
            <div key={stat.labelKey} className={`au-stat rounded-2xl p-5 md:p-6 text-center au-rise`} style={{ animationDelay: `${0.05 + i * 0.08}s` }}>
              <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-gradient-to-r from-reride-orange to-amber-400" />
              <div className="font-brand text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">
                <AutoT i18nKey={stat.valueKey} />
              </div>
              <div className="mt-1 text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium">
                <AutoT i18nKey={stat.labelKey} />
              </div>
            </div>
          ))}
        </div>

        {/* What we do */}
        <section className="mt-12 au-card rounded-[28px] p-6 sm:p-8 md:p-10 overflow-hidden relative">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-orange-400/10 blur-3xl" aria-hidden="true" />
          <div className="grid gap-8 lg:grid-cols-2 items-center relative">
            <div>
              <span className="au-eyebrow">
                <AutoT i18nKey="about.whatWeDo.eyebrow" />
              </span>
              <h2 className="mt-3 font-brand text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                <AutoT i18nKey="about.whatWeDo.title" />
              </h2>
              <p className="mt-4 text-slate-600 dark:text-slate-300 leading-relaxed text-base md:text-lg" data-no-translate>
                {whatWeDoBody}
              </p>
              <ul className="mt-6 space-y-3">
                {WHAT_POINTS.map((key) => (
                  <li key={key} className="flex items-start gap-3 text-sm md:text-base text-slate-700 dark:text-slate-200 font-medium">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-reride-orange to-orange-600 text-white shadow-orange">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <AutoT i18nKey={key} />
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative rounded-[24px] bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-5 sm:p-6 overflow-hidden min-h-[260px]">
              <div className="absolute inset-0 opacity-40" aria-hidden="true">
                <div className="absolute -left-8 top-0 h-32 w-32 rounded-full bg-reride-orange/40 blur-2xl" />
                <div className="absolute right-0 bottom-0 h-36 w-36 rounded-full bg-sky-400/30 blur-2xl" />
              </div>
              <div className="relative au-glass rounded-2xl p-5 mb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-reride-orange to-amber-500 flex items-center justify-center shadow-orange">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/55 font-bold">Deal room</div>
                    <div className="text-white font-bold text-sm">Buyer ↔ Seller</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="rounded-xl bg-white/10 px-3 py-2 text-xs text-white/85 w-[85%]">Can we schedule inspection Saturday?</div>
                  <div className="rounded-xl bg-reride-orange/90 px-3 py-2 text-xs text-white ml-auto w-[75%]">Yes — RC copy shared in docs.</div>
                </div>
              </div>
              <div className="relative flex gap-2">
                {['Offer', 'Token', 'Handover', 'RC'].map((m, i) => (
                  <div
                    key={m}
                    className={`flex-1 rounded-xl px-2 py-2.5 text-center text-[10px] sm:text-xs font-bold ${
                      i < 3 ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-300/30' : 'bg-white/10 text-white/70 border border-white/15'
                    }`}
                  >
                    {m}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How deals work */}
        <section id="how-deals-work" className="mt-16 scroll-mt-24">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="au-eyebrow">
              <AutoT i18nKey="about.howDeals.eyebrow" />
            </span>
            <h2 className="mt-3 font-brand text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              <AutoT i18nKey="about.howDeals.title" />
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300 text-base md:text-lg">
              <AutoT i18nKey="about.howDeals.subtitle" as="span" />
            </p>
          </div>

          <div className="relative grid gap-5 md:grid-cols-3">
            <div
              className="pointer-events-none absolute left-[17%] right-[17%] top-[9.5rem] hidden md:block h-[2px] bg-gradient-to-r from-transparent via-orange-300 to-transparent dark:via-orange-400/50"
              aria-hidden="true"
            />
            {DEAL_STEP_KEYS.map((step, idx) => (
              <article key={step.titleKey} className="au-card rounded-[28px] p-4 sm:p-5 relative">
                <div className="overflow-hidden rounded-2xl mb-4">
                  <StepArt index={idx} />
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="au-step-num relative z-[1] flex h-10 w-10 items-center justify-center rounded-full text-white text-sm font-extrabold">
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="font-brand font-bold text-slate-900 dark:text-white text-base">
                      <AutoT i18nKey={step.titleKey} />
                    </h3>
                    <div className="text-xs font-bold text-reride-orange tracking-wide uppercase">
                      <AutoT i18nKey={step.tagKey} />
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pl-[3.25rem] -mt-1">
                  <AutoT i18nKey={step.descKey} as="span" />
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* What we are not */}
        <section className="mt-12 relative overflow-hidden rounded-[28px] border border-amber-200/70 bg-gradient-to-br from-amber-50 via-orange-50/40 to-white dark:from-amber-950/30 dark:via-orange-950/15 dark:to-slate-900 dark:border-amber-500/20 p-6 sm:p-8">
          <div className="absolute right-6 top-6 opacity-20 dark:opacity-30" aria-hidden="true">
            <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
              <circle cx="36" cy="36" r="28" stroke="#FF6B35" strokeWidth="3" strokeDasharray="6 8" />
              <path d="M24 36h24M36 24v24" stroke="#FF6B35" strokeWidth="5" strokeLinecap="round" opacity="0.55" />
            </svg>
          </div>
          <h2 className="relative font-brand text-xl font-extrabold text-slate-900 dark:text-white mb-2">
            <AutoT i18nKey="about.notWe.title" />
          </h2>
          <p className="relative text-slate-700 dark:text-slate-300 leading-relaxed max-w-3xl">
            <AutoT i18nKey="about.notWe.body" as="span" />
          </p>
        </section>

        {/* Why ReRide */}
        <section className="mt-16">
          <div className="text-center mb-10">
            <span className="au-eyebrow">
              <AutoT i18nKey="about.why.eyebrow" />
            </span>
            <h2 className="mt-3 font-brand text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              <AutoT i18nKey="about.why.title" />
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {FEATURE_KEYS.map((f) => (
              <div key={f.titleKey} className="au-card rounded-[28px] p-6 sm:p-7">
                <div
                  className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${
                    f.tone === 'orange'
                      ? 'bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-500/15 dark:to-amber-500/10'
                      : f.tone === 'blue'
                        ? 'bg-gradient-to-br from-sky-50 to-blue-100 dark:from-sky-500/15 dark:to-blue-500/10'
                        : 'bg-gradient-to-br from-teal-50 to-emerald-100 dark:from-teal-500/15 dark:to-emerald-500/10'
                  }`}
                >
                  <FeatureGlyph tone={f.tone} />
                </div>
                <h3 className="mt-5 font-brand text-lg font-extrabold text-slate-900 dark:text-white">
                  <AutoT i18nKey={f.titleKey} />
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  <AutoT i18nKey={f.descKey} as="span" />
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact CTA */}
        <section className="au-cta mt-14 rounded-[28px] p-7 sm:p-9 md:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 text-white">
          <div className="relative z-10">
            <h2 className="font-brand text-xl md:text-2xl font-extrabold">
              <AutoT i18nKey="about.contact.title" />
            </h2>
            <p className="mt-2 text-white/80 leading-relaxed max-w-xl text-sm md:text-base">
              {supportTel ? (
                <AutoT i18nKey="about.contact.body" options={{ phone: formatSupportPhoneDisplay() }} as="span" />
              ) : (
                <AutoT i18nKey="about.contact.bodyNoPhone" as="span" />
              )}
            </p>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate(View.SUPPORT)}
              className="relative z-10 inline-flex items-center justify-center gap-2 w-full sm:w-auto px-7 py-3.5 min-h-[48px] rounded-2xl bg-white text-orange-800 font-extrabold shadow-lg hover:scale-[1.02] transition-transform flex-shrink-0"
            >
              <AutoT i18nKey="about.contact.cta" />
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          )}
        </section>
      </WebsitePageGutters>
    </div>
  );
};

export default AboutUsPage;
