import React, { useState } from 'react';

interface TestDriveModalProps {
  onClose: () => void;
  onSubmit: (details: { date: string; time: string }) => void;
}

const TestDriveModal: React.FC<TestDriveModalProps> = ({ onClose, onSubmit }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');

  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) {
      setError('Please select both a date and a time.');
      return;
    }
    setError('');
    onSubmit({ date, time });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-reride-text-dark dark:text-reride-text-dark">Book a Test Drive</h2>
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-reride-text-dark dark:hover:text-white text-3xl">&times;</button>
            </div>
            <p className="text-brand-gray-600 dark:text-reride-text mb-6">
              Select your preferred date and time. The seller will confirm your request via chat.
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor="test-drive-date" className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark">Preferred Date</label>
                <input
                  type="date"
                  id="test-drive-date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={getTodayString()}
                  required
                  className="mt-1 w-full p-3 border border-gray-200-300 dark:border-gray-200-300 rounded-lg bg-white dark:bg-brand-gray-700" onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--reride-orange)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.1)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}
                />
              </div>
              <div>
                <label htmlFor="test-drive-time" className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark">Preferred Time</label>
                <input
                  type="time"
                  id="test-drive-time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="mt-1 w-full p-3 border border-gray-200-300 dark:border-gray-200-300 rounded-lg bg-white dark:bg-brand-gray-700" onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--reride-orange)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.1)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}
                />
              </div>
              {error && <p className="text-sm text-reride-orange">{error}</p>}
            </div>
          </div>
          <div className="bg-white dark:bg-white/50 px-6 py-4 flex justify-end rounded-b-xl">
            <button
              type="submit"
              className="px-6 py-2 btn-brand-primary text-white font-bold rounded-lg transition-colors"
            >
              Send Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TestDriveModal;