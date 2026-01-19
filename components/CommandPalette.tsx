

import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import type { User } from '../types.js';
import { View } from '../types.js';
import type { Command } from '../types.js';


interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: View) => void;
  currentUser: User | null;
  onLogout: () => void;
}

// Icons for commands (using heroicons-style SVG paths)
const ICONS = {
  HOME: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  SEARCH: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  HEART: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" /></svg>,
  COMPARE: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
  USER: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  DASHBOARD: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  LOGOUT: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  THEME: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h8" /></svg>,
  SELL: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  PRICE: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>,
  SERVICE: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 112 0v1.586a1 1 0 00.293.707l1.414 1.414a1 1 0 00.707.293H17a2 2 0 110 2h-1.586a1 1 0 00-.707.293l-1.414 1.414a1 1 0 00-.293.707V15a2 2 0 11-2 0v-1.586a1 1 0 00-.293-.707l-1.414-1.414a1 1 0 00-.707-.293H7a2 2 0 110-2h1.586a1 1 0 00.707-.293l1.414-1.414A1 1 0 0011 5.586V4z" /></svg>,
};

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate, currentUser, onLogout }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const allCommands = useMemo<Command[]>(() => {
    const commands: Command[] = [
      // Navigation
      { id: 'home', title: 'Go to Home', icon: ICONS.HOME, action: () => onNavigate(View.HOME), section: 'Navigation' },
      { id: 'used_cars', title: 'Browse Used Cars', icon: ICONS.SEARCH, action: () => onNavigate(View.USED_CARS), section: 'Navigation' },
      { id: 'car_services', title: 'Car Services', icon: ICONS.SERVICE, action: () => onNavigate(View.CAR_SERVICES), section: 'Navigation' },
      { id: 'pricing', title: 'View Pricing', icon: ICONS.PRICE, action: () => onNavigate(View.PRICING), section: 'Navigation' },
      { id: 'sell_car', title: 'Sell a Car', icon: ICONS.SELL, action: () => onNavigate(View.SELLER_LOGIN), section: 'Navigation' },
      // Conditional Navigation
      ...(currentUser ? [
        { id: 'profile', title: 'My Profile', icon: ICONS.USER, action: () => onNavigate(View.PROFILE), section: 'Navigation' as const },
        { id: 'wishlist', title: 'My Wishlist', icon: ICONS.HEART, action: () => onNavigate(View.WISHLIST), section: 'Navigation' as const },
        { id: 'compare', title: 'Compare Vehicles', icon: ICONS.COMPARE, action: () => onNavigate(View.COMPARISON), section: 'Navigation' as const },
      ] : []),
      ...(currentUser?.role === 'seller' ? [{ id: 'dashboard', title: 'Seller Dashboard', icon: ICONS.DASHBOARD, action: () => onNavigate(View.SELLER_DASHBOARD), section: 'Navigation' as const }] : []),
      // Actions
      ...(currentUser ? [{ id: 'logout', title: 'Logout', icon: ICONS.LOGOUT, action: onLogout, section: 'Actions' as const }] : []),
    ];
    return commands;
  }, [currentUser, onNavigate, onLogout]);

  const filteredCommands = useMemo(() => {
    if (!query) return allCommands;
    return allCommands.filter(command => command.title.toLowerCase().includes(query.toLowerCase()));
  }, [allCommands, query]);
  
  const groupedCommands = useMemo(() => {
    return filteredCommands.reduce((acc, command) => {
        const section = command.section;
        if (!acc[section]) {
            acc[section] = [];
        }
        acc[section].push(command);
        return acc;
    }, {} as Record<string, Command[]>);
  }, [filteredCommands]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (filteredCommands.length === 0) return;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[activeIndex]) {
          filteredCommands[activeIndex].action();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, filteredCommands, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-start justify-center pt-20" onClick={onClose}>
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 w-full max-w-xl animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200/50 flex items-center gap-4">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            {ICONS.SEARCH}
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-transparent focus:outline-none text-lg font-semibold text-gray-800 placeholder-gray-500"
          />
        </div>
        <div className="max-h-96 overflow-y-auto premium-scrollbar">
          {Object.entries(groupedCommands).map(([section, commands]) => (
            <div key={section} className="p-4">
              <h3 className="text-sm font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent px-2 mb-3">{section}</h3>
              <ul className="space-y-1">
                {(commands as Command[]).map((command) => {
                  const globalIndex = filteredCommands.findIndex(c => c.id === command.id);
                  return (
                    <li key={command.id}>
                      <button
                        onClick={command.action}
                        onMouseEnter={() => setActiveIndex(globalIndex)}
                        className={`w-full text-left flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 ${
                          activeIndex === globalIndex 
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                            : 'text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-600'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                          activeIndex === globalIndex 
                            ? 'bg-white/20' 
                            : 'bg-gradient-to-br from-blue-100 to-purple-100'
                        }`}>
                          <span className={activeIndex === globalIndex ? 'text-white' : 'text-blue-600'}>{command.icon}</span>
                        </div>
                        <span className="font-semibold">{command.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {filteredCommands.length === 0 && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">No commands found</p>
              <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


export default memo(CommandPalette);
