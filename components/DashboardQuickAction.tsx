import React from 'react';

interface DashboardQuickActionProps {
  label: string;
  icon: React.ReactNode;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const DashboardQuickAction: React.FC<DashboardQuickActionProps> = ({ label, icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-reride-orange transition-colors text-center cursor-pointer"
  >
    <div className="w-8 h-8 mx-auto mb-2 text-gray-400">{icon}</div>
    <span className="text-sm text-gray-600">{label}</span>
  </button>
);

export default DashboardQuickAction;





