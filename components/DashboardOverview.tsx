import React, { memo } from 'react';
import type { Vehicle, User } from '../types';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, LineController, BarController } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, LineController, BarController);

interface DashboardOverviewProps {
  seller: User;
  sellerVehicles: Vehicle[];
  conversations: any[];
}

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = memo(({ title, value, icon }) => (
  <div className="bg-white p-6 rounded-lg shadow-md flex items-center">
    <div className="p-3 rounded-full mr-4" style={{ background: 'rgba(30, 136, 229, 0.1)' }}>{icon}</div>
    <div>
      <h3 className="text-sm font-medium text-reride-text-dark dark:text-reride-text-dark">{title}</h3>
      <p className="text-2xl font-bold text-reride-text-dark dark:text-reride-text-dark">{value}</p>
    </div>
  </div>
));

const DashboardOverview: React.FC<DashboardOverviewProps> = memo(({ seller, sellerVehicles, conversations }) => {
  // Safety checks
  const safeSellerVehicles = sellerVehicles || [];
  const safeConversations = conversations || [];
  
  const activeListings = safeSellerVehicles.filter(v => v && v.status === 'published').length;
  const totalViews = safeSellerVehicles.reduce((sum, v) => sum + (v?.views || 0), 0);
  const totalInquiries = safeSellerVehicles.reduce((sum, v) => sum + (v?.inquiriesCount || 0), 0);
  const unreadMessages = safeConversations.filter(c => c && !c.isReadBySeller).length;

  // Chart data
  const viewsData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Views',
        data: [120, 190, 300, 500, 200, 300],
        backgroundColor: 'rgba(30, 136, 229, 0.2)',
        borderColor: 'rgba(30, 136, 229, 1)',
        borderWidth: 2,
      },
    ],
  };

  const inquiriesData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Inquiries',
        data: [12, 19, 30, 50, 20, 30],
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        borderColor: 'rgba(76, 175, 80, 1)',
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Listings"
          value={activeListings}
          icon={
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
        <StatCard
          title="Total Views"
          value={totalViews.toLocaleString()}
          icon={
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        />
        <StatCard
          title="Total Inquiries"
          value={totalInquiries}
          icon={
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          }
        />
        <StatCard
          title="Unread Messages"
          value={unreadMessages}
          icon={
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-reride-text-dark dark:text-reride-text-dark mb-4">Views Over Time</h3>
          <div className="h-64">
            <Line data={viewsData} options={chartOptions} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-reride-text-dark dark:text-reride-text-dark mb-4">Inquiries Over Time</h3>
          <div className="h-64">
            <Bar data={inquiriesData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
});

DashboardOverview.displayName = 'DashboardOverview';

export default DashboardOverview;
