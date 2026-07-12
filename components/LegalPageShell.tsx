import React from 'react';
import WebsitePageShell from './WebsitePageShell';

interface LegalPageShellProps {
  title: string;
  children: React.ReactNode;
}

/** Shared layout for static legal / policy pages. */
const LegalPageShell: React.FC<LegalPageShellProps> = ({ title, children }) => (
  <WebsitePageShell narrow="4xl">
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 md:p-12">
      <div className="text-center mb-6 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-reride-text-dark mb-3 break-words">{title}</h1>
        <p className="text-sm sm:text-base text-gray-600">
          Last updated:{' '}
          {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
      <div className="prose prose-sm sm:prose-lg max-w-none text-gray-700 prose-responsive break-words">{children}</div>
    </div>
  </WebsitePageShell>
);

export default LegalPageShell;
