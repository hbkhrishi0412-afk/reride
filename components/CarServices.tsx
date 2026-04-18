import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';
import { View as ViewEnum } from '../types';
import { supportTelHref } from '../utils/whatsappShare.js';

interface CarServicesProps {
  onNavigate?: (view: ViewEnum) => void;
}

type ServiceSlug =
  | 'diagnostics'
  | 'engine'
  | 'ac'
  | 'interior'
  | 'wheel'
  | 'periodic'
  | 'clutch'
  | 'denting';

/** Canonical English titles — used for sessionStorage / ServiceDetail lookup */
const CANONICAL_TITLE: Record<ServiceSlug, string> = {
  diagnostics: 'Car Diagnostics',
  engine: 'Engine Maintenance & Repairs',
  ac: 'Car AC Servicing',
  interior: 'Interior Deep Cleaning',
  wheel: 'Wheel Alignment & Balancing',
  periodic: 'Periodic Services',
  clutch: 'Clutch & Suspension',
  denting: 'Denting & Painting',
};

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  'Car Diagnostics': (
    <svg className="w-6 h-6 lg:w-7 lg:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  ),
  'Engine Maintenance & Repairs': (
    <svg className="w-6 h-6 lg:w-7 lg:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  'Car AC Servicing': (
    <svg className="w-6 h-6 lg:w-7 lg:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
      />
    </svg>
  ),
  'Interior Deep Cleaning': (
    <svg className="w-6 h-6 lg:w-7 lg:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  ),
  'Wheel Alignment & Balancing': (
    <svg className="w-6 h-6 lg:w-7 lg:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      />
    </svg>
  ),
  'Periodic Services': (
    <svg className="w-6 h-6 lg:w-7 lg:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  ),
  'Clutch & Suspension': (
    <svg className="w-6 h-6 lg:w-7 lg:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  ),
  'Denting & Painting': (
    <svg className="w-6 h-6 lg:w-7 lg:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
      />
    </svg>
  ),
};

const CATEGORY_ORDER: { slug: ServiceSlug; icon: string; accent: string }[] = [
  { slug: 'periodic', icon: '📅', accent: 'from-sky-400 via-blue-500 to-indigo-600' },
  { slug: 'ac', icon: '❄️', accent: 'from-cyan-400 via-sky-500 to-blue-600' },
  { slug: 'diagnostics', icon: '🔍', accent: 'from-violet-400 via-purple-500 to-fuchsia-600' },
  { slug: 'wheel', icon: '⚙️', accent: 'from-amber-400 via-orange-500 to-rose-600' },
  { slug: 'interior', icon: '🧹', accent: 'from-emerald-400 via-teal-500 to-cyan-600' },
  { slug: 'engine', icon: '🔧', accent: 'from-rose-400 via-pink-500 to-purple-600' },
  { slug: 'clutch', icon: '⚡', accent: 'from-yellow-300 via-amber-500 to-orange-600' },
  { slug: 'denting', icon: '🎨', accent: 'from-fuchsia-400 via-pink-500 to-rose-600' },
];

const DETAIL_ORDER: ServiceSlug[] = [
  'diagnostics',
  'engine',
  'ac',
  'interior',
  'wheel',
  'periodic',
  'clutch',
  'denting',
];

const STEP_ORDER = ['pickup', 'service', 'drop'] as const;

const FAQ_INDICES = [0, 1, 2] as const;

function splitBullets(raw: string): string[] {
  return raw.split('|||').map((s) => s.trim()).filter(Boolean);
}

/** Lightweight 3D tilt card — tracks pointer and rotates on X/Y */
const TiltCard: React.FC<React.HTMLAttributes<HTMLDivElement> & { as?: 'div' | 'button'; type?: 'button' }> = ({
  children,
  className = '',
  as = 'div',
  ...rest
}) => {
  const ref = useRef<HTMLDivElement | null>(null);

  const handleMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rx = (y - 0.5) * -10;
    const ry = (x - 0.5) * 12;
    el.style.setProperty('--rx', `${rx}deg`);
    el.style.setProperty('--ry', `${ry}deg`);
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', `0deg`);
    el.style.setProperty('--ry', `0deg`);
  };

  const Tag: any = as;
  return (
    <Tag
      ref={ref as any}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className={`cs-tilt ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
};

const CarServices: React.FC<CarServicesProps> = ({ onNavigate }) => {
  const supportTel = supportTelHref();
  const { t, i18n: i18nFromHook } = useTranslation(undefined, { i18n });
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const servicesSectionRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // Subtle mouse parallax on hero illustration (desktop only)
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!mq.matches || prefersReduced) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty('--hero-px', `${x * 18}px`);
      el.style.setProperty('--hero-py', `${y * 14}px`);
      el.style.setProperty('--hero-rx', `${y * -6}deg`);
      el.style.setProperty('--hero-ry', `${x * 8}deg`);
    };
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, []);

  const categoryTiles = useMemo(
    () =>
      CATEGORY_ORDER.map(({ slug, icon, accent }) => ({
        slug,
        icon,
        accent,
        title: t(`carServices.category.${slug}`),
        canonicalTitle: CANONICAL_TITLE[slug],
      })),
    [t, i18nFromHook.language, i18nFromHook.resolvedLanguage]
  );

  const detailedServices = useMemo(
    () =>
      DETAIL_ORDER.map((slug) => {
        const canonicalTitle = CANONICAL_TITLE[slug];
        return {
          slug,
          canonicalTitle,
          icon: SERVICE_ICONS[canonicalTitle],
          title: t(`carServices.services.${slug}.title`),
          description: t(`carServices.services.${slug}.description`),
          services: splitBullets(t(`carServices.services.${slug}.bullets`)),
        };
      }),
    [t, i18nFromHook.language, i18nFromHook.resolvedLanguage]
  );

  const serviceSteps = useMemo(
    () =>
      STEP_ORDER.map((key) => ({
        title: t(`carServices.step.${key}.title`),
        detail: t(`carServices.step.${key}.detail`),
        icon: key === 'pickup' ? '🚗' : key === 'service' ? '🔧' : '✅',
      })),
    [t, i18nFromHook.language, i18nFromHook.resolvedLanguage]
  );

  const faqs = useMemo(
    () =>
      FAQ_INDICES.map((i) => ({
        question: t(`carServices.faq.${i}.q`),
        answer: t(`carServices.faq.${i}.a`),
      })),
    [t, i18nFromHook.language, i18nFromHook.resolvedLanguage]
  );

  const scrollToServices = () => {
    servicesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleServiceClick = (canonicalTitle: string) => {
    if (!canonicalTitle) {
      console.error('Service title is missing');
      return;
    }

    try {
      sessionStorage.setItem('selectedService', JSON.stringify({ title: canonicalTitle }));
      if (onNavigate) {
        onNavigate(ViewEnum.SERVICE_DETAIL);
      } else {
        console.error('onNavigate function is not available');
      }
    } catch (error) {
      console.error('Error handling service click:', error);
    }
  };

  const handleBookService = () => {
    if (onNavigate) {
      onNavigate(ViewEnum.SERVICE_CART);
    }
  };

  return (
    <div className="cs-root bg-slate-50 min-h-screen pb-20 lg:pb-0 overflow-x-hidden">
      {/* Scoped premium styles */}
      <style>{`
        .cs-root { --cs-ink: #0b1020; }

        /* ======= HERO AURORA ======= */
        .cs-hero {
          position: relative;
          isolation: isolate;
          background:
            radial-gradient(1200px 600px at 10% -10%, rgba(59,130,246,0.55), transparent 60%),
            radial-gradient(900px 500px at 90% 10%, rgba(168,85,247,0.5), transparent 60%),
            radial-gradient(800px 500px at 50% 110%, rgba(14,165,233,0.45), transparent 60%),
            linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0b1120 100%);
          overflow: hidden;
          perspective: 1400px;
        }
        .cs-hero::before {
          content: "";
          position: absolute; inset: -20%;
          background:
            conic-gradient(from 0deg at 50% 50%,
              rgba(99,102,241,0.35),
              rgba(236,72,153,0.25),
              rgba(34,211,238,0.35),
              rgba(99,102,241,0.35));
          filter: blur(70px);
          animation: cs-aurora-spin 22s linear infinite;
          opacity: 0.55;
          z-index: 0;
        }
        .cs-hero::after {
          content: "";
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: radial-gradient(ellipse at center, black 40%, transparent 75%);
          opacity: 0.25;
          z-index: 0;
        }
        @keyframes cs-aurora-spin { to { transform: rotate(360deg); } }

        .cs-orb {
          position: absolute; border-radius: 9999px; filter: blur(44px);
          mix-blend-mode: screen; pointer-events: none; z-index: 0;
        }
        .cs-orb-a { width: 340px; height: 340px; left: -80px; top: -60px; background: #60a5fa; opacity: .45; animation: cs-orb-float 14s ease-in-out infinite; }
        .cs-orb-b { width: 420px; height: 420px; right: -120px; top: 20%; background: #c084fc; opacity: .4; animation: cs-orb-float 17s ease-in-out infinite reverse; }
        .cs-orb-c { width: 260px; height: 260px; left: 30%; bottom: -100px; background: #22d3ee; opacity: .35; animation: cs-orb-float 20s ease-in-out infinite; }
        @keyframes cs-orb-float {
          0%, 100% { transform: translate3d(0,0,0) scale(1); }
          50%      { transform: translate3d(30px,-24px,0) scale(1.08); }
        }

        /* Sparkles */
        .cs-spark {
          position: absolute; width: 4px; height: 4px; border-radius: 9999px;
          background: white; opacity: 0; z-index: 1;
          box-shadow: 0 0 14px 3px rgba(255,255,255,0.7);
          animation: cs-spark 4.5s ease-in-out infinite;
        }
        @keyframes cs-spark {
          0%, 100% { opacity: 0; transform: scale(0.6); }
          50%      { opacity: 1; transform: scale(1.1); }
        }

        /* Gradient headline */
        .cs-hero-title span.cs-grad {
          background: linear-gradient(90deg, #ffffff 0%, #e0e7ff 30%, #fbcfe8 65%, #ffffff 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
          background-size: 220% 100%;
          animation: cs-grad-shift 8s ease-in-out infinite;
          text-shadow: 0 2px 30px rgba(196, 181, 253, 0.25);
        }
        @keyframes cs-grad-shift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }

        .cs-rise-1 { animation: cs-rise .8s .05s both cubic-bezier(.2,.8,.2,1); }
        .cs-rise-2 { animation: cs-rise .8s .15s both cubic-bezier(.2,.8,.2,1); }
        .cs-rise-3 { animation: cs-rise .8s .25s both cubic-bezier(.2,.8,.2,1); }
        .cs-rise-4 { animation: cs-rise .8s .35s both cubic-bezier(.2,.8,.2,1); }
        @keyframes cs-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }

        /* CTA buttons */
        .cs-btn-primary {
          position: relative;
          background: linear-gradient(135deg,#ffffff,#e0e7ff);
          color: #3730a3;
          transition: transform .25s ease, box-shadow .25s ease;
          box-shadow: 0 10px 30px -8px rgba(99,102,241,.55), inset 0 1px 0 rgba(255,255,255,0.9);
        }
        .cs-btn-primary::before {
          content: ""; position: absolute; inset: -2px; border-radius: inherit;
          background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.9) 50%, transparent 70%);
          mix-blend-mode: overlay; opacity: 0; transform: translateX(-120%);
          transition: opacity .3s ease;
        }
        .cs-btn-primary:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 18px 40px -10px rgba(99,102,241,.75); }
        .cs-btn-primary:hover::before { opacity: 1; animation: cs-shine 1s ease forwards; }
        @keyframes cs-shine { to { transform: translateX(120%); } }

        .cs-btn-ghost {
          backdrop-filter: blur(10px);
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.35);
          transition: transform .25s ease, background .25s ease, border-color .25s ease;
        }
        .cs-btn-ghost:hover { transform: translateY(-2px); background: rgba(255,255,255,0.14); border-color: rgba(255,255,255,0.6); }

        /* Hero 3D illustration */
        .cs-hero-stage { perspective: 1200px; }
        .cs-hero-3d {
          transform-style: preserve-3d;
          transform: translate3d(var(--hero-px,0), var(--hero-py,0), 0) rotateX(var(--hero-rx,0deg)) rotateY(var(--hero-ry,0deg));
          transition: transform .25s cubic-bezier(.2,.8,.2,1);
          animation: cs-float-y 7s ease-in-out infinite;
          filter: drop-shadow(0 30px 40px rgba(12,10,40,0.45));
        }
        @keyframes cs-float-y {
          0%, 100% { translate: 0 0; }
          50% { translate: 0 -10px; }
        }
        .cs-ring {
          position: absolute; border-radius: 9999px;
          border: 1px solid rgba(255,255,255,0.18);
          box-shadow: 0 0 60px rgba(99,102,241,0.35) inset;
          animation: cs-ring-spin 18s linear infinite;
        }
        @keyframes cs-ring-spin { to { transform: rotate(360deg); } }

        /* ======= SECTION TITLES ======= */
        .cs-eyebrow {
          display: inline-flex; align-items: center; gap: .5rem;
          padding: .25rem .75rem; border-radius: 9999px;
          font-size: .7rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
          background: linear-gradient(90deg, rgba(99,102,241,.12), rgba(236,72,153,.12));
          color: #4f46e5; border: 1px solid rgba(99,102,241,.2);
        }

        /* ======= CATEGORY TILES (3D Tilt) ======= */
        .cs-tilt {
          transform: perspective(900px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));
          transition: transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s ease;
          will-change: transform;
        }
        .cs-cat {
          position: relative; isolation: isolate;
          background: linear-gradient(180deg, #ffffff, #f8fafc);
          border: 1px solid rgba(226,232,240,0.9);
          border-radius: 20px;
          box-shadow: 0 1px 0 rgba(255,255,255,0.9) inset, 0 10px 30px -18px rgba(15,23,42,0.25);
          overflow: hidden;
        }
        .cs-cat::before {
          content: "";
          position: absolute; inset: 0;
          background: radial-gradient(220px circle at var(--mx,50%) var(--my,50%), rgba(99,102,241,0.14), transparent 60%);
          opacity: 0; transition: opacity .3s ease;
          pointer-events: none;
        }
        .cs-cat:hover::before { opacity: 1; }
        .cs-cat:hover { box-shadow: 0 20px 40px -20px rgba(79,70,229,0.45), 0 0 0 1px rgba(99,102,241,0.3); }
        .cs-cat-ic {
          display: inline-flex; align-items: center; justify-content: center;
          width: 64px; height: 64px; border-radius: 20px;
          background: linear-gradient(135deg, var(--c1,#60a5fa), var(--c2,#a855f7));
          color: white; font-size: 28px;
          box-shadow: 0 10px 24px -10px rgba(99,102,241,.65), inset 0 1px 0 rgba(255,255,255,0.35);
          transform: translateZ(30px);
          transition: transform .4s cubic-bezier(.2,.8,.2,1);
        }
        .cs-cat:hover .cs-cat-ic { transform: translateZ(40px) rotate(-6deg) scale(1.05); }
        .cs-cat-title { transform: translateZ(20px); }

        .cs-stagger > * { opacity: 0; transform: translateY(14px); animation: cs-rise .6s both cubic-bezier(.2,.8,.2,1); }
        .cs-stagger > *:nth-child(1) { animation-delay: .05s; }
        .cs-stagger > *:nth-child(2) { animation-delay: .1s; }
        .cs-stagger > *:nth-child(3) { animation-delay: .15s; }
        .cs-stagger > *:nth-child(4) { animation-delay: .2s; }
        .cs-stagger > *:nth-child(5) { animation-delay: .25s; }
        .cs-stagger > *:nth-child(6) { animation-delay: .3s; }
        .cs-stagger > *:nth-child(7) { animation-delay: .35s; }
        .cs-stagger > *:nth-child(8) { animation-delay: .4s; }

        /* ======= DETAIL SERVICE CARD ======= */
        .cs-detail {
          position: relative; isolation: isolate;
          background: #ffffff;
          border-radius: 22px;
          border: 1px solid #eef2f7;
          transition: transform .3s cubic-bezier(.2,.8,.2,1), box-shadow .3s ease, border-color .3s ease;
          overflow: hidden;
        }
        .cs-detail::before {
          content: ""; position: absolute; inset: 0;
          background: linear-gradient(120deg, transparent, rgba(99,102,241,0.08), transparent);
          transform: translateX(-120%);
          transition: transform .9s ease;
          pointer-events: none;
        }
        .cs-detail:hover { transform: translateY(-4px); border-color: rgba(99,102,241,0.35); box-shadow: 0 30px 50px -25px rgba(30,41,59,.3), 0 0 0 1px rgba(99,102,241,0.15); }
        .cs-detail:hover::before { transform: translateX(120%); }
        .cs-detail-ic {
          position: relative;
          background: linear-gradient(135deg,#4f46e5,#9333ea 60%,#db2777);
          border-radius: 18px;
          box-shadow:
            0 18px 30px -12px rgba(79,70,229,.45),
            inset 0 1px 0 rgba(255,255,255,.4),
            inset 0 -6px 10px rgba(0,0,0,.18);
        }
        .cs-detail-ic::after {
          content: ""; position: absolute; inset: 6% 6% 55% 6%; border-radius: 14px 14px 40% 40%;
          background: linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,0));
        }
        .cs-chip {
          background: linear-gradient(180deg,#eef2ff,#e0e7ff);
          color: #4338ca;
          border: 1px solid rgba(99,102,241,.2);
          font-weight: 600;
        }
        .cs-arrow {
          transition: transform .3s ease, color .3s ease;
        }
        .cs-detail:hover .cs-arrow { transform: translateX(4px); color: #4f46e5; }

        /* ======= STEPS ======= */
        .cs-step {
          position: relative;
          background: linear-gradient(180deg,#ffffff,#f8fafc);
          border: 1px solid #eef2f7; border-radius: 22px;
          transition: transform .3s ease, box-shadow .3s ease;
        }
        .cs-step:hover { transform: translateY(-4px); box-shadow: 0 30px 40px -25px rgba(15,23,42,.3); }
        .cs-step-num {
          position: relative;
          background: linear-gradient(135deg,#4f46e5,#9333ea);
          color: white; border-radius: 9999px;
          box-shadow: 0 14px 28px -10px rgba(79,70,229,.5), inset 0 1px 0 rgba(255,255,255,.4);
        }
        .cs-step-num::before {
          content: ""; position: absolute; inset: -8px; border-radius: inherit;
          background: conic-gradient(from 0deg, rgba(99,102,241,.5), rgba(236,72,153,.4), rgba(34,211,238,.5), rgba(99,102,241,.5));
          filter: blur(10px); opacity: .7; z-index: -1;
          animation: cs-ring-spin 8s linear infinite;
        }
        .cs-step-ico { animation: cs-pop 3s ease-in-out infinite; display: inline-block; }
        @keyframes cs-pop {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-4px) scale(1.08); }
        }
        .cs-connector {
          position: absolute; left: 14%; right: 14%; top: 56px; height: 2px;
          background: linear-gradient(90deg, transparent, #c7d2fe, #f5d0fe, #c7d2fe, transparent);
          z-index: 0;
        }

        /* ======= FAQ ======= */
        .cs-faq {
          background: linear-gradient(180deg,#ffffff,#f8fafc);
          border: 1px solid #eef2f7; border-radius: 18px;
          overflow: hidden;
          transition: border-color .3s ease, box-shadow .3s ease, transform .3s ease;
        }
        .cs-faq:hover { border-color: rgba(99,102,241,.35); box-shadow: 0 20px 30px -20px rgba(15,23,42,.25); }
        .cs-faq-open { border-color: rgba(99,102,241,.45); box-shadow: 0 24px 40px -22px rgba(79,70,229,.4); }
        .cs-faq-body {
          overflow: hidden;
          display: grid; grid-template-rows: 0fr;
          transition: grid-template-rows .4s ease;
        }
        .cs-faq-body > div { min-height: 0; }
        .cs-faq-body.cs-open { grid-template-rows: 1fr; }
        .cs-faq-chev { transition: transform .35s cubic-bezier(.2,.8,.2,1); }
        .cs-faq-chev.cs-open { transform: rotate(180deg); }

        /* ======= CTA BAND ======= */
        .cs-cta {
          position: relative; isolation: isolate; overflow: hidden;
          background:
            radial-gradient(600px 300px at 10% 20%, rgba(236,72,153,.55), transparent 60%),
            radial-gradient(700px 400px at 90% 80%, rgba(59,130,246,.55), transparent 60%),
            linear-gradient(135deg,#4338ca,#7c3aed 50%,#db2777);
        }
        .cs-cta::before {
          content: ""; position: absolute; inset: -10%;
          background:
            conic-gradient(from 0deg, rgba(255,255,255,.25), transparent 20%, rgba(255,255,255,.2) 40%, transparent 60%, rgba(255,255,255,.25) 80%, transparent);
          filter: blur(40px); opacity: .35;
          animation: cs-aurora-spin 26s linear infinite;
          z-index: 0;
        }
        .cs-cta-btn {
          background: white; color: #4338ca; font-weight: 800;
          box-shadow: 0 18px 40px -12px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.8);
          transition: transform .25s ease, box-shadow .25s ease;
        }
        .cs-cta-btn:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 26px 50px -14px rgba(0,0,0,.4); }

        @media (prefers-reduced-motion: reduce) {
          .cs-hero::before, .cs-orb, .cs-spark, .cs-hero-3d,
          .cs-step-ico, .cs-step-num::before, .cs-cta::before,
          .cs-stagger > * { animation: none !important; }
        }
      `}</style>

      {/* ===== HERO ===== */}
      <section ref={heroRef} className="cs-hero text-white">
        <span className="cs-orb cs-orb-a" />
        <span className="cs-orb cs-orb-b" />
        <span className="cs-orb cs-orb-c" />
        <span className="cs-spark" style={{ top: '18%', left: '14%', animationDelay: '0s' }} />
        <span className="cs-spark" style={{ top: '30%', left: '80%', animationDelay: '.8s' }} />
        <span className="cs-spark" style={{ top: '65%', left: '22%', animationDelay: '1.6s' }} />
        <span className="cs-spark" style={{ top: '70%', left: '72%', animationDelay: '2.2s' }} />
        <span className="cs-spark" style={{ top: '45%', left: '55%', animationDelay: '3s' }} />

        <div className="relative z-10 px-4 sm:px-6 lg:px-8 pt-14 lg:pt-24 pb-12 lg:pb-24">
          <div className="max-w-md lg:max-w-7xl mx-auto grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 text-center lg:text-left space-y-5 lg:space-y-7">
              <div className="cs-rise-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs lg:text-sm font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                {t('carServices.badge')}
              </div>

              <h1 className="cs-rise-2 cs-hero-title text-3xl sm:text-4xl lg:text-6xl xl:text-7xl font-black leading-[1.05] tracking-tight">
                <span className="cs-grad">{t('carServices.heroTitle')}</span>
              </h1>

              <p className="cs-rise-3 text-white/85 text-sm lg:text-lg leading-relaxed max-w-2xl lg:max-w-xl mx-auto lg:mx-0">
                {t('carServices.heroSubtitle')}
              </p>

              <div className="cs-rise-4 flex flex-col sm:flex-row gap-3 lg:gap-4 pt-1 lg:pt-2 max-w-md lg:max-w-none mx-auto lg:mx-0">
                <button
                  onClick={handleBookService}
                  className="cs-btn-primary relative overflow-hidden w-full sm:w-auto px-7 py-3.5 lg:px-9 lg:py-4 rounded-2xl font-bold text-base lg:text-lg"
                >
                  <span className="relative z-10 inline-flex items-center gap-2">
                    {t('carServices.bookNow')}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </button>
                <button
                  onClick={scrollToServices}
                  className="cs-btn-ghost w-full sm:w-auto px-7 py-3.5 lg:px-9 lg:py-4 rounded-2xl text-white font-semibold text-base lg:text-lg"
                >
                  {t('carServices.viewServices')}
                </button>
              </div>

              <div className="cs-rise-4 flex flex-wrap justify-center lg:justify-start gap-x-5 gap-y-2 text-xs lg:text-sm text-white/80 pt-2 lg:pt-4">
                {[
                  t('carServices.workshops'),
                  t('carServices.pickupDrop'),
                  t('carServices.warranty'),
                ].map((label) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Hero 3D illustration */}
            <div className="hidden lg:flex lg:col-span-5 cs-hero-stage justify-center">
              <div className="relative w-[420px] h-[420px]">
                <span className="cs-ring absolute inset-0" />
                <span className="cs-ring absolute inset-8" style={{ animationDuration: '24s', animationDirection: 'reverse' }} />
                <span className="cs-ring absolute inset-16" style={{ animationDuration: '30s' }} />

                <div className="cs-hero-3d absolute inset-0 flex items-center justify-center">
                  {/* Glassy premium service card */}
                  <div
                    className="relative rounded-[28px] p-6 w-[320px]"
                    style={{
                      background: 'linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04))',
                      border: '1px solid rgba(255,255,255,0.28)',
                      backdropFilter: 'blur(18px)',
                      boxShadow: '0 30px 80px -20px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.4)',
                    }}
                  >
                    <div className="flex items-center gap-3 mb-5">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(135deg,#22d3ee,#a855f7)',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5), 0 10px 20px -6px rgba(34,211,238,.5)',
                        }}
                      >
                        <span className="text-2xl">🔧</span>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-white/60 font-semibold">Reride Service</div>
                        <div className="font-bold">Premium Care</div>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {['Diagnostics', 'Doorstep Pickup', '90-Day Warranty'].map((x, i) => (
                        <div
                          key={x}
                          className="flex items-center gap-2 text-sm text-white/90"
                          style={{ animation: `cs-rise .7s ${0.5 + i * 0.1}s both cubic-bezier(.2,.8,.2,1)` }}
                        >
                          <span className="w-5 h-5 rounded-full bg-emerald-400/20 border border-emerald-300/50 flex items-center justify-center">
                            <svg className="w-3 h-3 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                          {x}
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 pt-4 border-t border-white/15 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-white/60">Starts at</div>
                        <div className="text-2xl font-black">₹499</div>
                      </div>
                      <div
                        className="px-3 py-1.5 rounded-full text-xs font-bold"
                        style={{ background: 'linear-gradient(90deg,#34d399,#10b981)' }}
                      >
                        ★ 4.9
                      </div>
                    </div>
                  </div>

                  {/* Floating wrench badge */}
                  <div
                    className="absolute -left-2 -top-4 w-16 h-16 rounded-2xl flex items-center justify-center text-2xl"
                    style={{
                      background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
                      boxShadow: '0 20px 40px -10px rgba(239,68,68,.55), inset 0 1px 0 rgba(255,255,255,.5)',
                      animation: 'cs-float-y 5s ease-in-out infinite',
                    }}
                  >
                    🛠️
                  </div>
                  {/* Floating car badge */}
                  <div
                    className="absolute -right-4 bottom-6 w-20 h-20 rounded-3xl flex items-center justify-center text-3xl"
                    style={{
                      background: 'linear-gradient(135deg,#38bdf8,#6366f1)',
                      boxShadow: '0 20px 40px -10px rgba(99,102,241,.55), inset 0 1px 0 rgba(255,255,255,.5)',
                      animation: 'cs-float-y 6s ease-in-out infinite reverse',
                    }}
                  >
                    🚗
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom curve divider */}
        <svg
          className="relative block w-full text-slate-50"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M0,32L80,37.3C160,43,320,53,480,53.3C640,53,800,43,960,37.3C1120,32,1280,32,1360,32L1440,32L1440,80L1360,80C1280,80,1120,80,960,80C800,80,640,80,480,80C320,80,160,80,80,80L0,80Z"
          />
        </svg>
      </section>

      {/* ===== CATEGORIES ===== */}
      <section className="px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
        <div className="max-w-md lg:max-w-7xl mx-auto">
          <div className="mb-6 lg:mb-10 text-center lg:text-left">
            <span className="cs-eyebrow mb-3">Services</span>
            <h2 className="text-2xl lg:text-4xl font-black text-slate-900 mt-3">
              {t('carServices.chooseService')}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-6 cs-stagger">
            {categoryTiles.map((category) => (
              <TiltCard
                key={category.slug}
                as="button"
                type="button"
                onClick={(e: any) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleServiceClick(category.canonicalTitle);
                }}
                className="cs-cat p-4 lg:p-6 flex flex-col items-center gap-3 lg:gap-4 min-h-[140px] lg:min-h-[180px] text-center"
              >
                <div className={`cs-cat-ic bg-gradient-to-br ${category.accent}`}>
                  <span>{category.icon}</span>
                </div>
                <span className="cs-cat-title font-bold text-slate-900 text-sm lg:text-base">
                  {category.title}
                </span>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ===== DETAILED SERVICES ===== */}
      <section
        ref={servicesSectionRef}
        className="px-4 sm:px-6 lg:px-8 py-10 lg:py-16 bg-white relative"
      >
        <div
          aria-hidden
          className="absolute inset-0 -z-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="relative max-w-md lg:max-w-7xl mx-auto">
          <div className="mb-6 lg:mb-10 text-center lg:text-left">
            <span className="cs-eyebrow mb-3">All Services</span>
            <h2 className="text-2xl lg:text-4xl font-black text-slate-900 mt-3">
              {t('carServices.allServices')}
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6 cs-stagger">
            {detailedServices.map((service) => (
              <button
                key={service.slug}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleServiceClick(service.canonicalTitle);
                }}
                className="cs-detail w-full p-5 lg:p-6 text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="cs-detail-ic w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center text-white flex-shrink-0">
                    {service.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-slate-900 text-base lg:text-lg mb-1 lg:mb-1.5">
                      {service.title}
                    </h3>
                    <p className="text-slate-500 text-xs lg:text-sm mb-3 line-clamp-2">
                      {service.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5 lg:gap-2">
                      {service.services.slice(0, 3).map((item, idx) => (
                        <span
                          key={idx}
                          className="cs-chip text-[11px] lg:text-xs px-2.5 py-1 rounded-full"
                        >
                          {item}
                        </span>
                      ))}
                      {service.services.length > 3 && (
                        <span className="text-[11px] lg:text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-semibold">
                          {t('carServices.moreCount', { count: service.services.length - 3 })}
                        </span>
                      )}
                    </div>
                  </div>
                  <svg
                    className="cs-arrow w-5 h-5 lg:w-6 lg:h-6 text-slate-400 flex-shrink-0 mt-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="px-4 sm:px-6 lg:px-8 py-10 lg:py-16 bg-slate-50">
        <div className="max-w-md lg:max-w-7xl mx-auto">
          <div className="mb-8 lg:mb-12 text-center">
            <span className="cs-eyebrow mb-3">Process</span>
            <h2 className="text-2xl lg:text-4xl font-black text-slate-900 mt-3">
              {t('carServices.howItWorks')}
            </h2>
          </div>
          <div className="relative">
            <div className="hidden lg:block cs-connector" />
            <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-8 cs-stagger relative z-10">
              {serviceSteps.map((step, index) => (
                <div key={step.title} className="cs-step p-5 lg:p-8">
                  <div className="flex items-start gap-4 lg:flex-col lg:items-center lg:text-center">
                    <div className="cs-step-num w-12 h-12 lg:w-20 lg:h-20 flex items-center justify-center text-xl lg:text-3xl font-black flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 lg:flex-none">
                      <div className="flex items-center lg:flex-col gap-2 lg:gap-3 mb-1.5 lg:mb-4 lg:mt-5">
                        <span className="cs-step-ico text-3xl lg:text-5xl">{step.icon}</span>
                        <h3 className="font-black text-slate-900 text-base lg:text-xl">
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-slate-600 text-sm lg:text-base leading-relaxed">
                        {step.detail}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="px-4 sm:px-6 lg:px-8 py-10 lg:py-16 bg-white">
        <div className="max-w-md lg:max-w-4xl mx-auto">
          <div className="mb-6 lg:mb-10 text-center lg:text-left">
            <span className="cs-eyebrow mb-3">FAQ</span>
            <h2 className="text-2xl lg:text-4xl font-black text-slate-900 mt-3">
              {t('carServices.commonQuestions')}
            </h2>
          </div>
          <div className="space-y-3 cs-stagger">
            {faqs.map((faq, index) => {
              const open = expandedFaq === index;
              return (
                <div key={index} className={`cs-faq ${open ? 'cs-faq-open' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(open ? null : index)}
                    className="w-full px-4 lg:px-6 py-4 lg:py-5 text-left flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-3 flex-1">
                      <span
                        className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-sm lg:text-base"
                        style={{
                          background: open
                            ? 'linear-gradient(135deg,#4f46e5,#9333ea)'
                            : 'linear-gradient(135deg,#eef2ff,#e0e7ff)',
                          color: open ? 'white' : '#4338ca',
                          transition: 'all .3s ease',
                          boxShadow: open
                            ? '0 10px 20px -8px rgba(79,70,229,.5)'
                            : 'none',
                        }}
                      >
                        Q
                      </span>
                      <span className="font-bold text-slate-900 text-sm lg:text-base">
                        {faq.question}
                      </span>
                    </span>
                    <svg
                      className={`cs-faq-chev w-5 h-5 lg:w-6 lg:h-6 text-slate-500 flex-shrink-0 ${open ? 'cs-open' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className={`cs-faq-body ${open ? 'cs-open' : ''}`}>
                    <div>
                      <div className="px-4 lg:px-6 pb-4 lg:pb-5 pl-[4.25rem] lg:pl-[4.75rem] -mt-1 text-slate-600 text-sm lg:text-base leading-relaxed">
                        {faq.answer}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== NEED HELP CTA ===== */}
      <section className="cs-cta px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        <span className="cs-spark" style={{ top: '15%', left: '12%', animationDelay: '0s' }} />
        <span className="cs-spark" style={{ top: '35%', left: '85%', animationDelay: '1.1s' }} />
        <span className="cs-spark" style={{ top: '70%', left: '20%', animationDelay: '2.3s' }} />
        <span className="cs-spark" style={{ top: '55%', left: '65%', animationDelay: '.5s' }} />

        <div className="relative z-10 max-w-md lg:max-w-4xl mx-auto text-center text-white">
          <h3 className="text-3xl lg:text-5xl font-black mb-3 lg:mb-4 tracking-tight">
            {t('carServices.needHelp')}
          </h3>
          <p className="text-white/90 text-sm lg:text-lg mb-7 lg:mb-9 max-w-xl mx-auto">
            {t('carServices.needHelpSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 lg:gap-4 max-w-md lg:max-w-lg mx-auto justify-center">
            <button
              onClick={handleBookService}
              className="cs-cta-btn w-full sm:w-auto px-7 py-3.5 lg:px-9 lg:py-4 rounded-2xl text-base lg:text-lg"
            >
              <span className="inline-flex items-center gap-2">
                {t('carServices.bookNow')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
            {supportTel ? (
              <a
                href={supportTel}
                className="cs-btn-ghost w-full sm:w-auto px-7 py-3.5 lg:px-9 lg:py-4 rounded-2xl text-white font-semibold text-base lg:text-lg"
              >
                <span className="inline-flex items-center gap-2 justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.49a1 1 0 01-.5 1.21l-2.26 1.13a11.04 11.04 0 005.52 5.52l1.13-2.26a1 1 0 011.21-.5l4.49 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" />
                  </svg>
                  {t('carServices.callCta')}
                </span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate?.(ViewEnum.SUPPORT)}
                className="cs-btn-ghost w-full sm:w-auto px-7 py-3.5 lg:px-9 lg:py-4 rounded-2xl text-white font-semibold text-base lg:text-lg"
              >
                {t('carServices.callCta')}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default CarServices;
