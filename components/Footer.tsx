import React, { memo } from 'react';
import { View } from '../types.js';

interface FooterProps {
    onNavigate: (view: View) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const handleNav = (e: React.MouseEvent, view: View) => {
    e.preventDefault();
    onNavigate(view);
  };
  
  return (
    <footer className="relative bg-gradient-to-br from-slate-900 via-gray-900 to-black overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 right-10 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-gradient-to-tr from-orange-500/5 to-pink-500/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 container mx-auto py-12 mt-16">
        {/* Premium Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Section */}
          <div className="md:col-span-2">
            <p className="text-gray-300 text-lg mb-4 max-w-md">
              The premier AI-driven marketplace for your next vehicle. Trusted by over 1 million customers nationwide.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                </svg>
                <span className="text-white font-semibold">Verified Platform</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                </svg>
                <span className="text-white font-semibold">Secure Payments</span>
              </div>
            </div>
          </div>
          
          {/* Quick Links */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">Quick Links</h3>
            <div className="space-y-3">
              <a href="#" className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                Buy Used Cars
              </a>
              <a href="#" className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                Sell Your Car
              </a>
              <a href="#" onClick={(e) => handleNav(e, View.CAR_SERVICES)} className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                Car Services
              </a>
              <a href="#" className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                New Cars
              </a>
              <a href="#" className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                Dealer Network
              </a>
            </div>
          </div>
          
          {/* Support */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">Support</h3>
            <div className="space-y-3">
              <a href="#" onClick={(e) => handleNav(e, View.SUPPORT)} className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                Contact Support
              </a>
              <a href="#" onClick={(e) => handleNav(e, View.FAQ)} className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                FAQ
              </a>
              <a href="#" onClick={(e) => handleNav(e, View.PRIVACY_POLICY)} className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                Privacy Policy
              </a>
              <a href="#" onClick={(e) => handleNav(e, View.TERMS_OF_SERVICE)} className="block text-gray-300 hover:text-white transition-colors duration-300 hover:translate-x-1 transform">
                Terms of Service
              </a>
            </div>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="border-t border-gray-700 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400">
              &copy; {new Date().getFullYear()} ReRide. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <span className="text-gray-400 text-sm">Made with ❤️ in India</span>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
                  </svg>
                </div>
                <span className="text-gray-300 font-semibold">Premium Platform</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default memo(Footer);