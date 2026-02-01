import React from 'react';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  backgroundClass?: string;
  iconGradientFrom?: string;
  iconGradientTo?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({
  title,
  subtitle,
  backgroundClass = 'bg-gradient-to-br from-slate-50 via-white to-blue-50',
  iconGradientFrom = 'from-blue-500',
  iconGradientTo = 'to-indigo-600',
  icon,
  children,
  footer,
}) => {
  return (
    <div className={`min-h-screen ${backgroundClass} relative overflow-hidden flex items-center justify-center p-4`}>
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-10 space-y-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className={`w-12 h-12 bg-gradient-to-br ${iconGradientFrom} ${iconGradientTo} rounded-xl flex items-center justify-center`}>
                {icon ?? (
                  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <h2 className="text-3xl font-black bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent">
                {title}
              </h2>
            </div>
            <p className="text-gray-600 text-lg">{subtitle}</p>
          </div>

          {children}

          {footer}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;









