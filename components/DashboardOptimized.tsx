import React, { useState, memo } from 'react';
import type { Vehicle, User, Conversation, VehicleData } from '../types';
import { View } from '../types';
import DashboardOverview from './DashboardOverview';
import DashboardListings from './DashboardListings';
import DashboardMessages from './DashboardMessages';

interface DashboardOptimizedProps {
  seller: User;
  sellerVehicles: Vehicle[];
  allVehicles: Vehicle[];
  reportedVehicles: Vehicle[];
  onAddVehicle: (vehicle: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>, isFeaturing: boolean) => void;
  onAddMultipleVehicles: (vehicles: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>[]) => void;
  onUpdateVehicle: (vehicle: Vehicle) => void;
  onDeleteVehicle: (vehicleId: number) => void;
  onMarkAsSold: (vehicleId: number) => void;
  conversations: Conversation[];
  onSellerSendMessage: (conversationId: string, messageText: string, type?: any, payload?: any) => void;
  onMarkConversationAsReadBySeller: (conversationId: string) => void;
  typingStatus: { conversationId: string; userRole: 'customer' | 'seller' } | null;
  onUserTyping: (conversationId: string, userRole: 'customer' | 'seller') => void;
  onMarkMessagesAsRead: (conversationId: string, readerRole: 'customer' | 'seller') => void;
  onUpdateSellerProfile: (details: { dealershipName: string; bio: string; logoUrl: string; }) => void;
  vehicleData: VehicleData;
  onFeatureListing: (vehicleId: number) => void;
  onRequestCertification: (vehicleId: number) => void;
  onNavigate: (view: View) => void;
  onTestDriveResponse?: (conversationId: string, messageId: number, newStatus: 'confirmed' | 'rejected') => void;
  onOfferResponse: (conversationId: string, messageId: number, response: 'accepted' | 'rejected' | 'countered', counterPrice?: number) => void;
}

type DashboardView = 'overview' | 'listings' | 'messages' | 'analytics' | 'profile';

const DashboardOptimized: React.FC<DashboardOptimizedProps> = memo((props) => {
  const {
    seller,
    sellerVehicles,
    conversations,
    onUpdateVehicle,
    onDeleteVehicle,
    onMarkAsSold,
    onFeatureListing,
    onRequestCertification,
    onNavigate,
    onSellerSendMessage,
    onMarkConversationAsReadBySeller,
    typingStatus,
    onUserTyping,
    onMarkMessagesAsRead,
    onOfferResponse
  } = props;

  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setActiveView('listings');
  };

  const handleViewSellerProfile = (sellerEmail: string) => {
    onNavigate(View.SELLER_PROFILE);
  };

  const handleToggleCompare = (vehicleId: number) => {
    // Handle compare toggle - this would need to be passed from parent
  };

  const handleToggleWishlist = (vehicleId: number) => {
    // Handle wishlist toggle - this would need to be passed from parent
  };

  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'listings', label: 'Listings', icon: '🚗' },
    { id: 'messages', label: 'Messages', icon: '💬' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'profile', label: 'Profile', icon: '👤' },
  ] as const;

  const renderContent = () => {
    switch (activeView) {
      case 'overview':
        return (
          <DashboardOverview
            seller={seller}
            sellerVehicles={sellerVehicles}
            conversations={conversations}
          />
        );
      case 'listings':
        return (
          <DashboardListings
            sellerVehicles={sellerVehicles}
            onEditVehicle={handleEditVehicle}
            onDeleteVehicle={onDeleteVehicle}
            onMarkAsSold={onMarkAsSold}
            onFeatureListing={onFeatureListing}
            onRequestCertification={onRequestCertification}
            onViewSellerProfile={handleViewSellerProfile}
            comparisonList={[]}
            onToggleCompare={handleToggleCompare}
            wishlist={[]}
            onToggleWishlist={handleToggleWishlist}
            onNavigateToAnalytics={() => setActiveView('analytics')}
            onBulkUpload={onAddMultipleVehicles}
            sellerEmail={seller.email}
          />
        );
      case 'messages':
        return (
          <DashboardMessages
            conversations={conversations}
            onSellerSendMessage={onSellerSendMessage}
            onMarkConversationAsReadBySeller={onMarkConversationAsReadBySeller}
            typingStatus={typingStatus}
            onUserTyping={onUserTyping}
            onMarkMessagesAsRead={onMarkMessagesAsRead}
            onOfferResponse={onOfferResponse}
          />
        );
      case 'analytics':
        return (
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold text-spinny-text-dark dark:text-spinny-text-dark mb-4">
              Analytics
            </h2>
            <p className="text-gray-600">Analytics view coming soon...</p>
          </div>
        );
      case 'profile':
        return (
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold text-spinny-text-dark dark:text-spinny-text-dark mb-4">
              Profile Settings
            </h2>
            <p className="text-gray-600">Profile settings coming soon...</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-spinny-text-dark dark:text-spinny-text-dark">
            Seller Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Welcome back, {seller.name}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-8">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 space-y-2 sticky top-8">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Dashboard</h3>
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as DashboardView)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    activeView === item.id
                      ? 'bg-brand-blue-50 text-brand-blue-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </aside>
          
          {/* Main Content */}
          <main className="lg:col-span-1">

            {/* Content */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              {renderContent()}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
});

DashboardOptimized.displayName = 'DashboardOptimized';

export default DashboardOptimized;
