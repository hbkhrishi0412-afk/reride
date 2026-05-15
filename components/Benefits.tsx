import React from 'react';

const benefits = [
    {
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        title: 'RC & listing details',
    },
    {
        icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
        title: 'Verified sellers',
    },
    {
        icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
        title: 'Call, WhatsApp & chat',
    },
    {
        icon: 'M4 4v5h5V4H4zm0 9h5v5H4v-5zm9-9h5v5h-5V4zm0 9h5v5h-5v-5z',
        title: 'Compare up to 4 cars',
    },
    {
        icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
        title: 'Report listings',
    },
];

const BenefitItem: React.FC<{ icon: string; title: string }> = ({ icon, title }) => (
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
            <h3 className="text-xl font-semibold text-reride-text-dark dark:text-reride-text-dark mb-6 text-center">
                Why use ReRide
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                {benefits.map((benefit) => (
                    <BenefitItem key={benefit.title} {...benefit} />
                ))}
            </div>
        </div>
    );
};

export default Benefits;
