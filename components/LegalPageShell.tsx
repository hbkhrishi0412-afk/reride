import React from 'react';

interface LegalPageShellProps {
  title: string;
  children: React.ReactNode;
}

/** Shared layout for static legal / policy pages. */
const LegalPageShell: React.FC<LegalPageShellProps> = ({ title, children }) => (
  <div className="animate-fade-in container mx-auto py-8 max-w-4xl px-4 pb-24 lg:pb-12">
    <div className="bg-white rounded-xl shadow-lg p-8 md:p-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold text-reride-text-dark mb-3">{title}</h1>
        <p className="text-gray-600">
          Last updated:{' '}
          {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
      <div className="prose prose-lg max-w-none text-gray-700">{children}</div>
    </div>
  </div>
);

export default LegalPageShell;
