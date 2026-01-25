import React, { useState } from 'react';
import type { User, SupportTicket } from '../types';

interface MobileSupportPageProps {
  currentUser: User | null;
  onSubmitTicket: (ticketData: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt' | 'replies' | 'status'>) => void;
  onNavigate?: (view: any) => void;
}

/**
 * Mobile-Optimized Support Page
 * Features:
 * - Touch-friendly form
 * - Mobile keyboard optimization
 * - Simplified submission flow
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
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Contact Support</h1>
        <p className="text-gray-600 text-sm">We're here to help!</p>
      </div>

      {/* Success Message */}
      {isSuccess && (
        <div className="mx-4 mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-green-800 font-medium">Ticket submitted successfully! We'll get back to you soon.</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="px-4 py-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
            style={{ minHeight: '48px' }}
            placeholder="Your name"
          />
          {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
            style={{ minHeight: '48px' }}
            placeholder="your.email@example.com"
            inputMode="email"
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
          <input
            type="text"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
            style={{ minHeight: '48px' }}
            placeholder="Brief description of your issue"
          />
          {errors.subject && <p className="text-red-500 text-sm mt-1">{errors.subject}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            rows={6}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none resize-none"
            placeholder="Describe your issue in detail..."
          />
          {errors.message && <p className="text-red-500 text-sm mt-1">{errors.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 bg-orange-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: '56px' }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
        </button>
      </form>
    </div>
  );
};

export default MobileSupportPage;



























