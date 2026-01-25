import React from 'react';

const benefits = [
    {
        icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        title: '1-year warranty',
    },
    {
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
        title: '200-points inspected',
    },
    {
        icon: 'M4 4v5h5V4H4zm0 9h5v5H4v-5zm9-9h5v5h-5V4zm0 9h5v5h-5v-5z',
        title: '5-day money back',
    },
    {
        icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
        title: 'Buyback guarantee',
    },
    {
        icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
        title: 'Fixed price assurance',
    }
];

const BenefitItem: React.FC<{ icon: string; title: string; }> = ({ icon, title }) => (
    <div className="flex flex-col items-center text-center gap-2">
         <div className="w-16 h-16 rounded-full bg-reride-off-white dark:bg-brand-gray-700 flex items-center justify-center" style={{ color: '#1E88E5' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon} />
            </svg>
        </div>
        <p className="font-semibold text-sm text-reride-text-dark dark:text-reride-text-dark">{title}</p>
    </div>
);

const Benefits: React.FC = () => {
  return (
    <div className="p-6 bg-white rounded-xl shadow-soft">
        <h3 className="text-xl font-semibold text-reride-text-dark dark:text-reride-text-dark mb-6 text-center">Benefits & Add-ons</h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
            {benefits.map(benefit => (
                <BenefitItem key={benefit.title} {...benefit} />
            ))}
        </div>
    </div>
  );
};

export default Benefits;
