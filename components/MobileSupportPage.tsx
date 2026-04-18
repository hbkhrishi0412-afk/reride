import React, { useState } from 'react';
import type { User, SupportTicket } from '../types';

interface MobileSupportPageProps {
  currentUser: User | null;
  onSubmitTicket: (ticketData: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt' | 'replies' | 'status'>) => void;
  onNavigate?: (view: any) => void;
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
const IconChevronLeft = (p: IconProps) => (<Icon {...p}><path d="M15 18l-6-6 6-6" /></Icon>);
const IconCheck = (p: IconProps) => (<Icon {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></Icon>);
const IconHeadset = (p: IconProps) => (<Icon {...p}><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1v-7h3zM3 19a2 2 0 0 0 2 2h1v-7H3z" /></Icon>);
const IconMail = (p: IconProps) => (<Icon {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 7l10 7 10-7" /></Icon>);

/**
 * Mobile-Optimized Support Page (premium polish)
 */
export const MobileSupportPage: React.FC<MobileSupportPageProps> = ({ currentUser, onSubmitTicket, onNavigate }) => {
  const [formData, setFormData] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Please enter a valid email address';
    if (!formData.subject.trim()) newErrors.subject = 'Subject is required';
    if (!formData.message.trim()) newErrors.message = 'Message is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      onSubmitTicket({
        userName: formData.name,
        userEmail: formData.email,
        subject: formData.subject,
        message: formData.message,
      });
      setFormData({
        name: currentUser?.name || '',
        email: currentUser?.email || '',
        subject: '',
        message: '',
      });
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 5000);
    } catch (error) {
      console.error('Failed to submit ticket:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '13px 14px',
    background: '#FFFFFF',
    border: `1px solid ${hasError ? 'rgba(220,38,38,0.45)' : 'rgba(15,23,42,0.10)'}`,
    borderRadius: 14,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: 500,
    outline: 'none',
    minHeight: 48,
    transition: 'all 0.18s ease',
  });

  return (
    <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)' }}>
      {/* Premium obsidian header */}
      <div
        className="px-5 sticky top-0 z-30 relative overflow-hidden"
        style={{
          paddingTop: 'max(1.1rem, env(safe-area-inset-top, 0px))',
          paddingBottom: '1.5rem',
          background: 'linear-gradient(180deg, #0B0B0F 0%, #16161D 70%, #1C1C24 100%)',
          boxShadow: '0 10px 30px -12px rgba(0,0,0,0.55)',
        }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 -left-16 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(255,107,53,0.18), transparent 70%)' }} />
          <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(168,135,255,0.10), transparent 70%)' }} />
          <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)' }} />
        </div>

        <div className="relative z-10 flex items-center gap-3 mb-4">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('home')}
              aria-label="Back"
              className="w-9 h-9 rounded-full grid place-items-center text-white/85 active:scale-95 transition-transform"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
            >
              <IconChevronLeft size={16} stroke={2.2} />
            </button>
          )}
          <span className="text-[10.5px] uppercase tracking-[0.22em] text-white/45 font-semibold">Support</span>
        </div>

        <div className="relative z-10 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-white font-semibold truncate" style={{ fontSize: '26px', lineHeight: 1.1, letterSpacing: '-0.03em' }}>
              How can we help
              <span className="text-white/40 font-light">?</span>
            </h1>
            <p className="mt-2 text-[12.5px] text-white/55 font-medium">Send us a ticket — we typically reply within a day.</p>
          </div>
          <span
            className="shrink-0 w-12 h-12 rounded-2xl grid place-items-center text-white"
            style={{
              background: 'linear-gradient(135deg, #FF8456 0%, #FF6B35 100%)',
              boxShadow: '0 10px 22px -10px rgba(255,107,53,0.55), inset 0 1px 0 rgba(255,255,255,0.20)',
            }}
          >
            <IconHeadset size={22} stroke={1.8} />
          </span>
        </div>
      </div>

      {/* Success */}
      {isSuccess && (
        <div className="mx-4 mt-4">
          <div
            className="rounded-2xl p-3.5 flex items-start gap-3"
            style={{ background: 'linear-gradient(180deg, #ECFDF5, #D1FAE5)', border: '1px solid rgba(16,185,129,0.30)', boxShadow: '0 8px 24px -16px rgba(16,185,129,0.40)' }}
          >
            <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: '#10B981', color: '#FFFFFF' }}>
              <IconCheck size={16} stroke={2.4} />
            </span>
            <div>
              <p className="text-[13px] font-bold text-emerald-900 tracking-tight" style={{ letterSpacing: '-0.01em' }}>Ticket submitted</p>
              <p className="text-[11.5px] text-emerald-700 font-medium mt-0.5">We&apos;ll get back to you shortly.</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick contact card */}
      <div className="px-4 pt-4">
        <div
          className="rounded-3xl p-4 flex items-center gap-3"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(15,23,42,0.06)',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)',
          }}
        >
          <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgba(37,99,235,0.10)', color: '#1D4ED8' }}>
            <IconMail size={17} stroke={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-slate-400">Email us</p>
            <p className="text-[13.5px] font-semibold text-slate-900 truncate tracking-tight" style={{ letterSpacing: '-0.01em' }}>
              support@reride.app
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="mx-4 mt-4 rounded-3xl p-5 space-y-4"
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(15,23,42,0.06)',
          boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)',
        }}
      >
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-slate-400">New ticket</p>
          <h2 className="text-[16px] font-semibold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.01em' }}>Tell us what&apos;s happening</h2>
        </div>

        <label className="block">
          <span className="block text-[11.5px] font-semibold text-slate-700 mb-1.5 tracking-tight">Name</span>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Your name"
            style={fieldStyle(!!errors.name)}
          />
          {errors.name && <p className="text-[11px] text-rose-600 mt-1 font-semibold">{errors.name}</p>}
        </label>

        <label className="block">
          <span className="block text-[11.5px] font-semibold text-slate-700 mb-1.5 tracking-tight">Email</span>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="your.email@example.com"
            inputMode="email"
            style={fieldStyle(!!errors.email)}
          />
          {errors.email && <p className="text-[11px] text-rose-600 mt-1 font-semibold">{errors.email}</p>}
        </label>

        <label className="block">
          <span className="block text-[11.5px] font-semibold text-slate-700 mb-1.5 tracking-tight">Subject</span>
          <input
            type="text"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            placeholder="Brief description of your issue"
            style={fieldStyle(!!errors.subject)}
          />
          {errors.subject && <p className="text-[11px] text-rose-600 mt-1 font-semibold">{errors.subject}</p>}
        </label>

        <label className="block">
          <span className="flex items-center justify-between text-[11.5px] font-semibold text-slate-700 mb-1.5 tracking-tight">
            <span>Message</span>
            <span className="text-[10.5px] text-slate-400 font-medium">{formData.message.length}/1000</span>
          </span>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            rows={6}
            maxLength={1000}
            placeholder="Describe your issue in detail..."
            style={{ ...fieldStyle(!!errors.message), resize: 'none' }}
          />
          {errors.message && <p className="text-[11px] text-rose-600 mt-1 font-semibold">{errors.message}</p>}
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full inline-flex items-center justify-center rounded-2xl py-3.5 text-[13.5px] font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-70"
          style={{
            background: 'linear-gradient(135deg, #14141C 0%, #0B0B11 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 14px 30px -14px rgba(11,11,15,0.55)',
            minHeight: 56,
          }}
        >
          {isSubmitting ? 'Submitting…' : 'Submit ticket'}
        </button>
      </form>
    </div>
  );
};

export default MobileSupportPage;
