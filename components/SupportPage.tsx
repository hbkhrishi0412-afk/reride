import React, { useState, useEffect, useRef } from 'react';
import type { User, SupportTicket } from '../types';

interface SupportPageProps {
  currentUser: User | null;
  onSubmitTicket: (ticketData: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt' | 'replies' | 'status'>) => void;
}

const SupportPage: React.FC<SupportPageProps> = ({ currentUser, onSubmitTicket }) => {
  const [formData, setFormData] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Prefill from stored support intent (e.g., service package booking)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('supportPrefill');
      if (raw) {
        const prefill = JSON.parse(raw);
        setFormData((prev) => ({
          ...prev,
          subject: prefill.subject || prev.subject,
          message: prefill.message || prev.message,
        }));
        localStorage.removeItem('supportPrefill');
      }
    } catch {
      // ignore prefill errors
    }
  }, []);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []); // Empty dependency array means this only runs on mount/unmount

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
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

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    } else if (formData.subject.trim().length < 5) {
      newErrors.subject = 'Subject must be at least 5 characters';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      onSubmitTicket({
        userName: formData.name,
        userEmail: formData.email,
        subject: formData.subject,
        message: formData.message,
      });

      // Reset form
      setFormData({
        name: currentUser?.name || '',
        email: currentUser?.email || '',
        subject: '',
        message: '',
      });
      
      setIsSuccess(true);
      // Clear any existing timeout before setting a new one
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setIsSuccess(false), 5000);
    } catch (err) {
      setErrors({ submit: 'Failed to submit ticket. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

const formInputClass = (hasError: boolean, isDisabled: boolean = false) => 
  `block w-full px-4 py-3 border rounded-xl transition-all duration-200 text-sm shadow-sm ${
      isDisabled 
        ? 'bg-slate-50 text-slate-500 cursor-not-allowed border-slate-200' 
        : hasError
        ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-200'
        : 'border-slate-200 bg-white hover:border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
    } focus:outline-none text-slate-900 placeholder-slate-400`;

  const messageLength = formData.message.length;
  const maxMessageLength = 2000;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50">
      <div className="relative max-w-6xl mx-auto px-4 py-10 md:py-14">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-10 -right-12 h-64 w-64 bg-indigo-200/40 blur-3xl rounded-full" />
          <div className="absolute -bottom-16 -left-10 h-72 w-72 bg-sky-200/30 blur-3xl rounded-full" />
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              Priority support that actually answers
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
              Contact Support
            </h1>
            <p className="text-slate-600 max-w-2xl text-base">
              Tell us what you need. We’ll route your request to the right specialist and keep you posted every step of the way.
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white shadow-sm border border-slate-200">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold text-slate-800">Avg. response under 30 mins</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white shadow-sm border border-slate-200">
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-semibold text-slate-800">4.8/5 satisfaction</span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200">
            <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">24/7</div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Need urgent help?</div>
              <div className="text-xs text-slate-600">We monitor tickets around the clock.</div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-6">
          {/* Info / shortcuts */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute right-4 -top-6 h-24 w-24 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute -left-6 bottom-0 h-24 w-24 bg-white/10 rounded-full blur-2xl" />
              <div className="relative space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-bold uppercase tracking-wide">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Fastest Resolution
                </div>
                <h2 className="text-xl font-black leading-tight">We pair every ticket with a specialist</h2>
                <p className="text-indigo-100 text-sm leading-relaxed">
                  Share a few details and we’ll triage, prioritize, and keep you updated. 90% of tickets are resolved without a follow-up.
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Car service & detailing', icon: '🧽' },
                    { label: 'Buying & selling help', icon: '🚗' },
                    { label: 'Payments & RC', icon: '💳' },
                    { label: 'App issues', icon: '📱' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/10 backdrop-blur">
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Quick reach</p>
                  <h3 className="text-lg font-black text-slate-900">Prefer a faster lane?</h3>
                </div>
                <div className="hidden sm:flex h-10 w-10 rounded-full bg-indigo-50 text-indigo-700 items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10a9.004 9.004 0 00-7-8.73V3a2 2 0 11-4 0V1.27A9.004 9.004 0 003 10v1l-1 2v1a2 2 0 002 2h4a3 3 0 006 0h4a2 2 0 002-2v-1l-1-2v-1z" />
                  </svg>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                {[
                  { title: 'Call us', desc: 'Mon-Sat, 9am-8pm', action: '1-800-RERIDE' },
                  { title: 'WhatsApp', desc: 'Quick status updates', action: 'Chat now' },
                  { title: 'Email', desc: 'support@reride.com', action: 'Open mail' },
                ].map((item) => (
                  <div key={item.title} className="border border-slate-200 rounded-xl p-3 hover:-translate-y-0.5 hover:shadow-md transition-transform bg-slate-50/60">
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <div className="text-xs text-slate-600">{item.desc}</div>
                    <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700">
                      {item.action}
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60 p-6 lg:p-7">
            {isSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 animate-fade-in">
                <svg className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-emerald-800 font-semibold text-sm mb-0.5">Ticket submitted!</h3>
                  <p className="text-emerald-700 text-xs">We’ve received your request and will reach out shortly.</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Your Name
                    </div>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    disabled={!!currentUser}
                    placeholder="Enter your full name"
                    className={formInputClass(!!errors.name, !!currentUser)}
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Your Email
                    </div>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={!!currentUser}
                    placeholder="your.email@example.com"
                    className={formInputClass(!!errors.email, !!currentUser)}
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {errors.email}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="block text-xs font-semibold text-slate-700 mb-1">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h10m-7 4h7" />
                    </svg>
                    Subject
                  </div>
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  placeholder="Brief description of your issue"
                  className={formInputClass(!!errors.subject)}
                />
                {errors.subject && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errors.subject}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="message" className="block text-xs font-semibold text-slate-700 mb-1">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Message
                  </div>
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={5}
                  placeholder="Share more context to help us resolve this quickly..."
                  className={`${formInputClass(!!errors.message)} resize-y min-h-[100px]`}
                />
                <div className="flex items-center justify-between mt-1">
                  {errors.message && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {errors.message}
                    </p>
                  )}
                  <p className={`text-xs ml-auto ${messageLength > maxMessageLength * 0.9 ? 'text-orange-600' : 'text-slate-500'}`}>
                    {messageLength} / {maxMessageLength} characters
                  </p>
                </div>
              </div>

              {errors.submit && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-700 text-xs">{errors.submit}</p>
                </div>
              )}

              <div className="pt-2 flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-xl text-sm transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 ${
                    isSubmitting ? 'cursor-wait' : ''
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Submit Ticket
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Live updates on your ticket status
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-indigo-700 font-semibold hover:underline decoration-2 underline-offset-4"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  >
                    Back to top
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportPage;
