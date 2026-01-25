import React, { useState, useEffect, memo } from 'react';
import type { Vehicle, Conversation, Suggestion } from '../types';
import { generateSellerSuggestions } from '../services/geminiService';

interface AiAssistantProps {
  vehicles: Vehicle[];
  conversations: Conversation[];
  onNavigateToVehicle: (vehicleId: number) => void;
  onNavigateToInquiry: (conversationId: string) => void;
}

const SuggestionIcon: React.FC<{ type: Suggestion['type'] }> = memo(({ type }) => {
    switch (type) {
        case 'pricing':
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-reride-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>;
        case 'listing_quality':
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-reride-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>;
        case 'urgent_inquiry':
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" style={{ color: '#1E88E5' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
        default:
            return null;
    }
});

const priorityStyles = {
    high: 'border-reride-orange/50',
    medium: 'border-gray-200/50',
    low: 'border-rose-pink',
};

const SuggestionCard: React.FC<{ suggestion: Suggestion; onClick: () => void }> = ({ suggestion, onClick }) => (
    <div className={`p-4 bg-white rounded-lg border-l-4 ${priorityStyles[suggestion.priority]}`}>
        <div className="flex items-start gap-4">
            <div className="flex-shrink-0 pt-1"><SuggestionIcon type={suggestion.type} /></div>
            <div className="flex-grow">
                <h4 className="font-bold text-reride-text-dark">{suggestion.title}</h4>
                <p className="text-sm text-reride-text-dark mt-1">{suggestion.description}</p>
            </div>
            <button
                onClick={onClick}
                className="self-center btn-brand-primary text-white font-bold py-1.5 px-4 rounded-md text-sm transition-colors"
            >
                View
            </button>
        </div>
    </div>
);

const AiAssistant: React.FC<AiAssistantProps> = ({ vehicles, conversations, onNavigateToVehicle, onNavigateToInquiry }) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (vehicles.length > 0 || conversations.some(c => !c.isReadBySeller)) {
          const fetchedSuggestions = await generateSellerSuggestions(vehicles, conversations);
          setSuggestions(fetchedSuggestions);
        } else {
            setSuggestions([]);
        }
      } catch (err) {
        // Only show error if it's not the expected "API unavailable" case
        if (err instanceof Error && !err.message.includes('AI_API_UNAVAILABLE')) {
          console.warn("⚠️ Failed to get AI suggestions:", err);
          setError("Could not load AI suggestions at this time.");
        } else {
          // AI API unavailable (dev mode) - silently fail
          setError(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchSuggestions, 500); // Debounce slightly
    return () => clearTimeout(timer);
  }, [vehicles, conversations]);

  const handleSuggestionClick = (suggestion: Suggestion) => {
    if (suggestion.type === 'urgent_inquiry') {
      onNavigateToInquiry(suggestion.targetId as string);
    } else {
      onNavigateToVehicle(suggestion.targetId as number);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 bg-white rounded-lg flex items-center gap-4 animate-pulse">
                <div className="w-6 h-6 bg-white rounded-full"></div>
                <div className="flex-grow space-y-2">
                    <div className="h-4 bg-white rounded w-1/3"></div>
                    <div className="h-3 bg-white rounded w-full"></div>
                </div>
                <div className="w-20 h-8 bg-white rounded-md"></div>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return <p className="text-center text-reride-orange">{error}</p>;
    }

    if (suggestions.length === 0) {
      return (
        <div className="text-center py-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-reride-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
            <h4 className="mt-2 font-semibold text-reride-text-dark">All Clear!</h4>
            <p className="text-sm text-reride-text-dark">Your AI assistant has no new suggestions right now. Great job!</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {suggestions.map((s, i) => (
          <SuggestionCard key={i} suggestion={s} onClick={() => handleSuggestionClick(s)} />
        ))}
      </div>
    );
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-bold text-reride-text-dark dark:text-reride-text-dark mb-4 flex items-center gap-2">
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-reride-orange to-reride-blue">✨ AI Sales Assistant</span>
      </h3>
      {renderContent()}
    </div>
  );
};

export default AiAssistant;
