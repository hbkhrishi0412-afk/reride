import React, { useState } from 'react';
import type { ChatMessage, User } from '../types';

interface ReadReceiptIconProps {
  isRead: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'; // Real-time message status
}

// Real-time message status indicator
const ReadReceiptIcon: React.FC<ReadReceiptIconProps> = ({ isRead, status }) => {
    // Priority: status > isRead (for backward compatibility)
    const messageStatus = status || (isRead ? 'read' : 'sent');
    
    switch (messageStatus) {
        case 'sending':
            // Clock icon for sending
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block ml-1 text-gray-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            );
        
        case 'sent':
            // Single check (gray) - Sent to server
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block ml-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
            );
        
        case 'delivered':
            // Double check (gray) - Delivered to recipient's device
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block ml-1 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M1.5 12.5L5.5 16.5L11.5 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8.5 12.5L12.5 16.5L22.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            );
        
        case 'read':
            // Double check (blue) - Read by recipient
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block ml-1" viewBox="0 0 24 24" fill="none" style={{ color: '#1E88E5' }}>
                    <path d="M1.5 12.5L5.5 16.5L11.5 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8.5 12.5L12.5 16.5L22.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            );
        
        case 'failed':
            // X icon for failed
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block ml-1 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            );
        
        default:
            // Fallback to single check
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block ml-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
            );
    }
};

export default ReadReceiptIcon;


// --- Reusable Offer Components ---

const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(value);

export const OfferModal: React.FC<{
    title: string;
    listingPrice?: number;
    onSubmit: (price: number) => void;
    onClose: () => void;
}> = ({ title, listingPrice, onSubmit, onClose }) => {
    const [price, setPrice] = useState('');
    const [error, setError] = useState('');

    const formatNumberWithCommas = (value: string) => {
        // Remove all non-numeric characters
        const numericValue = value.replace(/\D/g, '');
        // Add commas for Indian number format
        return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        // Remove commas and non-numeric characters for storage
        const numericValue = inputValue.replace(/\D/g, '');
        setPrice(numericValue);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const offerPrice = parseInt(price, 10);
        if (isNaN(offerPrice) || offerPrice <= 0) {
            setError('Please enter a valid price.');
            return;
        }
        setError('');
        onSubmit(offerPrice);
    };

    return (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4" 
          onClick={onClose}
          style={{ 
            zIndex: 2147483000, // Higher than chat widget z-index (2147482000)
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.2s ease-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
            <div 
              className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4" 
              onClick={e => e.stopPropagation()}
              style={{ 
                position: 'relative',
                zIndex: 2147483001,
                maxHeight: '90vh',
                overflowY: 'auto',
                animation: 'fadeInScale 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: 'scale(1)'
              }}
            >
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-xl font-bold text-reride-text-dark dark:text-reride-text-dark">{title}</h2>
                            <button type="button" onClick={onClose} className="text-gray-400 text-2xl">&times;</button>
                        </div>
                        {listingPrice && <p className="text-sm text-reride-text dark:text-reride-text mb-4">Listing Price: {formatCurrency(listingPrice)}</p>}
                        <div>
                            <label htmlFor="offer-price" className="block text-sm font-medium mb-1 text-reride-text-dark dark:text-reride-text-dark">Your Offer Amount (₹)</label>
                            <input
                                type="text"
                                id="offer-price"
                                value={formatNumberWithCommas(price)}
                                onChange={handlePriceChange}
                                placeholder="Enter amount"
                                style={{ colorScheme: 'light dark' }}
                                autoFocus
                                required
                                className="w-full p-3 border border-gray-200-300 dark:border-gray-200-300 rounded-lg bg-white dark:bg-brand-gray-700 text-lg text-gray-900 dark:text-white focus:outline-none" onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--reride-orange)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.1)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}
                            />
                        </div>
                        {error && <p className="text-sm text-reride-orange mt-2">{error}</p>}
                    </div>
                    <div className="bg-white dark:bg-gray-800 px-6 py-4 flex justify-end rounded-b-xl">
                        <button type="submit" className="px-6 py-2 btn-brand-primary text-white font-bold rounded-lg transition-colors">Submit Offer</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const OfferMessage: React.FC<{
    msg: ChatMessage;
    currentUserRole: User['role'];
    listingPrice?: number;
    onRespond: (messageId: number, response: 'accepted' | 'rejected' | 'countered', counterPrice?: number) => void;
}> = ({ msg, currentUserRole, listingPrice, onRespond }) => {
    const [isCounterModalOpen, setIsCounterModalOpen] = useState(false);
    const { offerPrice, counterPrice, status } = msg.payload || {};

    const isRecipient = (currentUserRole === 'customer' && msg.sender === 'seller') || (currentUserRole === 'seller' && msg.sender === 'user');
    const showActions = isRecipient && status === 'pending';
    
    // Debug logging
    console.log('🔧 OfferMessage debug:', {
        msgId: msg.id,
        msgSender: msg.sender,
        currentUserRole,
        payload: msg.payload,
        status,
        isRecipient,
        showActions,
        onRespond: typeof onRespond
    });
    
    const statusInfo = {
        pending: { text: "Pending", color: "bg-reride-blue-light text-reride-text-dark dark:bg-reride-blue/50 dark:text-reride-text-dark border-gray-200" },
        accepted: { text: "Accepted", color: "bg-reride-orange-light text-reride-orange dark:bg-reride-orange/50 dark:text-reride-orange border-reride-orange" },
        rejected: { text: "Rejected", color: "bg-reride-orange-light text-reride-orange dark:bg-reride-orange/50 dark:text-reride-orange border-reride-orange" },
        countered: { text: "Countered", color: "bg-white-dark text-reride-text-dark dark:bg-white dark:text-reride-text-dark border-gray-500" },
        confirmed: { text: "Confirmed", color: "bg-reride-orange-light text-reride-orange dark:bg-reride-orange/50 dark:text-reride-orange border-reride-orange" },
    };

    const handleCounterSubmit = (price: number) => {
        onRespond(msg.id, 'countered', price);
        setIsCounterModalOpen(false);
    };
    
    return (
        <>
            <div className={`p-3 border-l-4 rounded-r-lg bg-reride-off-white dark:bg-brand-gray-700/50 border-gray-200`}>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-semibold text-reride-text-dark dark:text-reride-text-dark">{msg.sender === 'user' ? 'Offer Made' : 'Counter-Offer'}</p>
                        <p className="text-xl font-bold text-reride-text-dark dark:text-white">{formatCurrency(offerPrice || 0)}</p>
                        {counterPrice && (
                            <p className="text-xs text-reride-text dark:text-gray-300 line-through">
                                Original: {formatCurrency(counterPrice)}
                            </p>
                        )}
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-reride-blue-light text-reride-text-dark`}>
                        {statusInfo[status || 'pending'].text}
                    </span>
                </div>
                {showActions && (
                    <div className="mt-3 pt-3 border-t border-gray-200-200 dark:border-gray-200-300 flex gap-2">
                        <button 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('🔧 Accept button clicked for message:', msg.id);
                                alert('Accept button clicked!'); // Temporary test
                                onRespond(msg.id, 'accepted');
                            }} 
                            className="flex-1 text-sm bg-green-500 text-white font-bold py-1.5 px-3 rounded-md hover:bg-green-600 transition-colors cursor-pointer"
                            style={{ pointerEvents: 'auto' }}
                        >
                            Accept
                        </button>
                        <button 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('🔧 Reject button clicked for message:', msg.id);
                                alert('Reject button clicked!'); // Temporary test
                                onRespond(msg.id, 'rejected');
                            }} 
                            className="flex-1 text-sm bg-red-500 text-white font-bold py-1.5 px-3 rounded-md hover:bg-red-600 transition-colors cursor-pointer"
                            style={{ pointerEvents: 'auto' }}
                        >
                            Reject
                        </button>
                        {currentUserRole === 'seller' && (
                            <button 
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('🔧 Counter button clicked for message:', msg.id);
                                    setIsCounterModalOpen(true);
                                }} 
                                className="flex-1 text-sm bg-blue-500 text-white font-bold py-1.5 px-3 rounded-md hover:bg-blue-600 transition-colors"
                            >
                                Counter
                            </button>
                        )}
                    </div>
                )}
            </div>
            {isCounterModalOpen && (
                <OfferModal
                    title="Make a Counter-Offer"
                    listingPrice={listingPrice}
                    onSubmit={handleCounterSubmit}
                    onClose={() => setIsCounterModalOpen(false)}
                />
            )}
        </>
    );
};