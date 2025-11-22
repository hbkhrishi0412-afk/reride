import React, { useState, memo } from 'react';
import type { User, Vehicle, Conversation, Notification } from '../types';
import { View as ViewEnum } from '../types';

interface MobileDashboardProps {
  currentUser: User;
  userVehicles: Vehicle[];
  conversations: Conversation[];
  onNavigate: (view: ViewEnum) => void;
  onEditVehicle: (vehicle: Vehicle) => void;
  onDeleteVehicle: (vehicleId: number) => void;
  onMarkAsSold: (vehicleId: number) => void;
  onFeatureListing: (vehicleId: number) => void;
  onSendMessage: (conversationId: string, message: string) => void;
  onMarkConversationAsRead: (conversationId: string) => void;
  onOfferResponse: (conversationId: string, messageId: string, response: string, counterPrice?: number) => void;
  typingStatus: { conversationId: string; userRole: 'customer' | 'seller' } | null;
  onUserTyping: (conversationId: string, userRole: 'customer' | 'seller') => void;
  onMarkMessagesAsRead: (conversationId: string, readerRole: 'customer' | 'seller') => void;
  onFlagContent: (type: 'vehicle' | 'conversation', id: string, reason: string) => void;
  onLogout?: () => void;
  // Add vehicle form handlers
  onAddVehicle?: (vehicleData: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>, isFeaturing?: boolean) => void;
  onUpdateVehicle?: (vehicleData: Vehicle) => void;
  vehicleData?: any; // Vehicle data for form
  // Add prop for viewing vehicle details
  onViewVehicle?: (vehicle: Vehicle) => void;
  // Profile editing
  onUpdateProfile?: (profileData: Partial<User>) => Promise<void>;
  // Notifications
  notifications?: Notification[];
  onNotificationClick?: (notification: Notification) => void;
  onMarkNotificationsAsRead?: (ids: number[]) => void;
}

type DashboardTab = 'overview' | 'listings' | 'messages' | 'analytics' | 'profile' | 'addVehicle' | 'editVehicle' | 'notifications';

const MobileDashboard: React.FC<MobileDashboardProps> = memo(({
  currentUser,
  userVehicles,
  conversations,
  onNavigate,
  onEditVehicle: _onEditVehicle, // Kept for interface compatibility
  onDeleteVehicle,
  onMarkAsSold: _onMarkAsSold, // Kept for interface compatibility
  onFeatureListing: _onFeatureListing, // Kept for interface compatibility
  onSendMessage: _onSendMessage, // Kept for interface compatibility
  onMarkConversationAsRead: _onMarkConversationAsRead, // Kept for interface compatibility
  onOfferResponse: _onOfferResponse, // Kept for interface compatibility
  typingStatus: _typingStatus, // Kept for interface compatibility
  onUserTyping: _onUserTyping, // Kept for interface compatibility
  onMarkMessagesAsRead: _onMarkMessagesAsRead, // Kept for interface compatibility
  onFlagContent: _onFlagContent, // Kept for interface compatibility
  onLogout,
  onAddVehicle,
  onUpdateVehicle,
  vehicleData: _vehicleData, // Kept for interface compatibility
  onViewVehicle,
  onUpdateProfile,
  notifications = [],
  onNotificationClick,
  onMarkNotificationsAsRead
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [editFormData, setEditFormData] = useState<Vehicle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  
  // Add vehicle form state
  const initialAddFormData: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'> = {
    make: '',
    model: '',
    variant: '',
    year: new Date().getFullYear(),
    price: 0,
    mileage: 0,
    description: '',
    engine: '',
    transmission: 'Automatic',
    fuelType: 'Petrol',
    fuelEfficiency: '',
    color: '',
    features: [],
    images: [],
    documents: [],
    sellerEmail: currentUser.email,
    category: 'four_wheeler' as any,
    status: 'published',
    isFeatured: false,
    registrationYear: new Date().getFullYear(),
    insuranceValidity: '',
    insuranceType: 'Comprehensive',
    rto: '',
    city: '',
    state: '',
    location: '',
    noOfOwners: 1,
    displacement: '',
    groundClearance: '',
    bootSpace: '',
    qualityReport: { summary: '', fixesDone: [] },
    certifiedInspection: null,
    certificationStatus: 'none',
  };
  
  const [addFormData, setAddFormData] = useState(initialAddFormData);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  
  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    name: currentUser.name,
    email: currentUser.email,
    mobile: currentUser.mobile || '',
    dealershipName: (currentUser as any).dealershipName || '',
    bio: (currentUser as any).bio || '',
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Update edit form data when editingVehicle changes
  React.useEffect(() => {
    if (editingVehicle) {
      setEditFormData(editingVehicle);
    } else {
      setEditFormData(null);
    }
    setEditErrors({});
  }, [editingVehicle]);
  
  // Update profile form data when currentUser changes
  React.useEffect(() => {
    setProfileFormData({
      name: currentUser.name,
      email: currentUser.email,
      mobile: currentUser.mobile || '',
      dealershipName: (currentUser as any).dealershipName || '',
      bio: (currentUser as any).bio || '',
    });
  }, [currentUser]);
  
  // Reset add form when switching away from addVehicle tab
  React.useEffect(() => {
    if (activeTab !== 'addVehicle') {
      setAddFormData({
        ...initialAddFormData,
        sellerEmail: currentUser.email, // Ensure sellerEmail is current
      });
      setAddErrors({});
    } else {
      // When switching to addVehicle tab, ensure sellerEmail is set
      setAddFormData(prev => ({
        ...prev,
        sellerEmail: currentUser.email,
      }));
    }
  }, [activeTab, currentUser.email]);

  const isSeller = currentUser.role === 'seller';
  const isAdmin = currentUser.role === 'admin';
  // Removed unused isCustomer variable

  // Calculate stats
  // Safety checks
  const safeUserVehicles = userVehicles || [];
  const safeConversations = conversations || [];
  
  const totalListings = safeUserVehicles.length;
  const activeListings = safeUserVehicles.filter(v => v && v.status === 'published').length;
  const soldListings = safeUserVehicles.filter(v => v && v.status === 'sold').length;
  const unreadMessages = safeConversations.filter(c => c && !c.isReadByCustomer).length;
  const totalViews = safeUserVehicles.reduce((sum, v) => sum + (v?.views || 0), 0);
  const totalInquiries = safeConversations.length;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊', count: null },
    { id: 'listings', label: 'Listings', icon: '🚗', count: totalListings },
    { id: 'messages', label: 'Messages', icon: '💬', count: unreadMessages },
    { id: 'analytics', label: 'Analytics', icon: '📈', count: null },
    { id: 'profile', label: 'Profile', icon: '👤', count: null },
  ];

  const renderOverview = () => (
    <div className="space-y-5 pb-4">
      {/* Premium Welcome Card */}
      <div 
        className="rounded-2xl p-5 text-white"
        style={{
          background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 50%, #FF9F6B 100%)',
          boxShadow: '0 8px 24px rgba(255, 107, 53, 0.3), 0 4px 8px rgba(255, 107, 53, 0.2)',
          border: '0.5px solid rgba(255, 255, 255, 0.2)'
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xl font-bold mb-1 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              Welcome back, {currentUser.name?.split(' ')[0]}!
            </h2>
            <p className="text-white/90 text-sm leading-relaxed font-medium">
              {isSeller ? 'Manage your vehicle listings' : 
               isAdmin ? 'Monitor platform activity' : 
               'Track your car search journey'}
            </p>
          </div>
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1.5px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <span className="text-2xl">👋</span>
          </div>
        </div>
      </div>

      {/* Stats Grid - Native Style */}
      <div className="grid grid-cols-2 gap-4">
        <div 
          onClick={() => setActiveTab('listings')}
          className="native-card p-4 cursor-pointer active:opacity-80 native-transition"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <span className="text-xl">🚗</span>
            </div>
            {totalListings > 0 && (
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                {totalListings}
              </span>
            )}
            </div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1" style={{ letterSpacing: '0.05em' }}>Listings</p>
          <p className="text-2xl font-bold text-gray-900 tracking-tight" style={{ letterSpacing: '-0.03em' }}>{totalListings}</p>
          {activeListings > 0 && (
            <p className="text-xs text-gray-500 mt-1">{activeListings} active</p>
          )}
        </div>

        <div 
          onClick={() => setActiveTab('messages')}
          className="native-card p-4 cursor-pointer active:opacity-80 native-transition"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <span className="text-xl">💬</span>
            </div>
            {unreadMessages > 0 && (
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                {unreadMessages}
              </span>
            )}
            </div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1" style={{ letterSpacing: '0.05em' }}>Messages</p>
          <p className="text-2xl font-bold text-gray-900 tracking-tight" style={{ letterSpacing: '-0.03em' }}>{unreadMessages}</p>
          {safeConversations.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">{safeConversations.length} total</p>
          )}
        </div>

        <div className="native-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <span className="text-xl">👁️</span>
            </div>
            </div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1" style={{ letterSpacing: '0.05em' }}>Total Views</p>
          <p className="text-2xl font-bold text-gray-900 tracking-tight" style={{ letterSpacing: '-0.03em' }}>{totalViews}</p>
          {totalViews > 0 && (
            <p className="text-xs text-gray-500 mt-1">Across all listings</p>
          )}
          </div>

        <div className="native-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <span className="text-xl">✅</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1" style={{ letterSpacing: '0.05em' }}>Sold</p>
          <p className="text-2xl font-bold text-gray-900 tracking-tight" style={{ letterSpacing: '-0.03em' }}>{soldListings}</p>
          {soldListings > 0 && (
            <p className="text-xs text-gray-500 mt-1">{Math.round((soldListings / totalListings) * 100)}% success</p>
          )}
        </div>
      </div>

      {/* Premium Quick Actions */}
      <div className="native-card p-5">
        <h3 className="font-bold text-gray-900 mb-4 text-base tracking-tight" style={{ letterSpacing: '-0.01em' }}>Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          {isSeller && (
            <>
              <button 
                onClick={() => {
                  setEditingVehicle(null);
                  setActiveTab('addVehicle');
                }}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl font-bold native-button min-h-[80px]"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.1) 0%, rgba(255, 132, 86, 0.15) 100%)',
                  border: '0.5px solid rgba(255, 107, 53, 0.2)',
                  color: '#FF6B35',
                  boxShadow: '0 2px 8px rgba(255, 107, 53, 0.15)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.96)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <span className="text-2xl">➕</span>
                <span className="text-sm">Add Vehicle</span>
              </button>
              <button 
                onClick={() => setActiveTab('listings')}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl font-bold native-button min-h-[80px]"
                style={{
                  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(59, 130, 246, 0.15) 100%)',
                  border: '0.5px solid rgba(37, 99, 235, 0.2)',
                  color: '#2563EB',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.15)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.96)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <span className="text-2xl">📝</span>
                <span className="text-sm">Manage Listings</span>
              </button>
            </>
          )}
          <button 
            onClick={() => setActiveTab('messages')}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-green-50 rounded-xl text-green-700 font-semibold native-button active:opacity-70 min-h-[80px]"
          >
            <span className="text-2xl">💬</span>
            <span className="text-sm">Messages</span>
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-gray-50 rounded-xl text-gray-700 font-semibold native-button active:opacity-70 min-h-[80px]"
          >
            <span className="text-2xl">⚙️</span>
            <span className="text-sm">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderListings = () => (
    <div className="space-y-5 pb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Your Listings</h3>
          <p className="text-xs text-gray-500 mt-0.5">{totalListings} total • {activeListings} active</p>
        </div>
        {isSeller && (
          <button 
            onClick={() => {
              setEditingVehicle(null);
              setActiveTab('addVehicle');
            }}
            className="native-button native-button-primary px-5 py-2.5 text-sm font-bold flex items-center gap-2"
            style={{ letterSpacing: '-0.01em' }}
          >
            <span className="text-base">➕</span>
            <span>Add Vehicle</span>
          </button>
        )}
      </div>

      {safeUserVehicles.length === 0 ? (
        <div className="text-center py-12 px-4">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🚗</span>
          </div>
          <h4 className="text-xl font-bold text-gray-900 mb-2">No listings yet</h4>
          <p className="text-gray-600 text-sm mb-6 leading-relaxed max-w-sm mx-auto">
            {isSeller ? 'Start by adding your first vehicle to reach potential buyers' : 'You haven\'t saved any vehicles yet'}
          </p>
          {isSeller && (
            <button 
              onClick={() => {
                setEditingVehicle(null);
                setActiveTab('addVehicle');
              }}
              className="native-button native-button-primary px-8 py-3 font-semibold"
            >
              Add Your First Vehicle
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {safeUserVehicles.map((vehicle) => (
            <div 
              key={vehicle.id} 
              className="native-card p-4 cursor-pointer active:opacity-80 native-transition"
              onClick={() => {
                if (onViewVehicle) {
                  onViewVehicle(vehicle);
                }
              }}
            >
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-3xl">🚗</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-900 truncate text-base mb-1">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </h4>
                  {vehicle.variant && (
                    <p className="text-xs text-gray-500 mb-2">{vehicle.variant}</p>
                  )}
                  <p className="text-lg font-bold text-orange-600 mb-2">₹{vehicle.price.toLocaleString('en-IN')}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      vehicle.status === 'published' ? 'bg-green-100 text-green-800' :
                      vehicle.status === 'sold' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {vehicle.status === 'published' ? '✅ Active' : vehicle.status === 'sold' ? '✅ Sold' : '⏳ Pending'}
                    </span>
                    {vehicle.mileage && (
                      <span className="text-xs text-gray-500">📏 {vehicle.mileage.toLocaleString('en-IN')} km</span>
                    )}
                    {vehicle.views && (
                      <span className="text-xs text-gray-500">👁️ {vehicle.views} views</span>
                    )}
                  </div>
                </div>
                {isSeller && (
                  <div 
                    className="flex flex-col gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingVehicle(vehicle);
                        setActiveTab('editVehicle');
                      }}
                      className="p-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 active:scale-95 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
                      aria-label="Edit vehicle"
                      title="Edit vehicle"
                    >
                      <span className="text-lg">✏️</span>
                    </button>
                    {vehicle.status === 'published' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          _onMarkAsSold(vehicle.id);
                        }}
                        className="p-2.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 active:scale-95 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label="Mark as sold"
                        title="Mark as sold"
                      >
                        <span className="text-lg">✅</span>
                      </button>
                    )}
                    {!vehicle.isFeatured && vehicle.status === 'published' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          _onFeatureListing(vehicle.id);
                        }}
                        className="p-2.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 active:scale-95 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label="Feature listing"
                        title="Feature listing"
                      >
                        <span className="text-lg">⭐</span>
                      </button>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteVehicle(vehicle.id);
                      }}
                      className="p-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 active:scale-95 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
                      aria-label="Delete vehicle"
                      title="Delete vehicle"
                    >
                      <span className="text-lg">🗑️</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMessages = () => (
    <div className="space-y-5 pb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Messages</h3>
          <p className="text-xs text-gray-500 mt-0.5">{safeConversations.length} total • {unreadMessages} unread</p>
        </div>
      </div>

      {safeConversations.length === 0 ? (
        <div className="text-center py-12 px-4">
          <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">💬</span>
          </div>
          <h4 className="text-xl font-bold text-gray-900 mb-2">No messages yet</h4>
          <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
            Your conversations with potential buyers will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {safeConversations.slice(0, 5).map((conversation) => (
            <div 
              key={conversation.id} 
              className="native-card p-4 cursor-pointer active:opacity-80 native-transition"
              onClick={() => onNavigate(ViewEnum.INBOX)}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-orange-600 font-bold text-base">
                    {conversation.customerName?.charAt(0).toUpperCase() || 'C'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-gray-900 truncate text-base">
                      {conversation.customerName || 'Customer'}
                    </h4>
                    {!conversation.isReadByCustomer && (
                      <span className="w-2.5 h-2.5 bg-orange-500 rounded-full flex-shrink-0"></span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 truncate mb-1">
                    {conversation.vehicleName || 'Vehicle inquiry'}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {new Date(conversation.lastMessageAt).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        ...(new Date(conversation.lastMessageAt).getFullYear() !== new Date().getFullYear() && {
                          year: 'numeric'
                        })
                      })}
                    </span>
                    {conversation.messages && conversation.messages.length > 0 && (
                      <>
                        <span className="text-gray-300">•</span>
                        <span className="text-xs text-gray-500 truncate">
                          {conversation.messages[conversation.messages.length - 1]?.text || ''}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {safeConversations.length > 5 && (
            <button 
              onClick={() => onNavigate(ViewEnum.INBOX)}
              className="w-full py-3.5 text-orange-600 font-semibold native-button native-button-secondary"
            >
              View All Messages ({safeConversations.length})
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Analytics</h3>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Views</p>
              <p className="text-2xl font-bold text-gray-900">{totalViews}</p>
            </div>
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-blue-600 text-lg">👁️</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Inquiries</p>
              <p className="text-2xl font-bold text-gray-900">{totalInquiries}</p>
            </div>
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-green-600 text-lg">📞</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Active Listings</p>
              <p className="text-2xl font-bold text-gray-900">{activeListings}</p>
            </div>
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <span className="text-orange-600 text-lg">🚗</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Sold</p>
              <p className="text-2xl font-bold text-gray-900">{soldListings}</p>
            </div>
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-purple-600 text-lg">✅</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h4 className="font-medium text-gray-900 mb-3">Recent Activity</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-600">New inquiry received</span>
            <span className="text-gray-400 text-xs ml-auto">2h ago</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600">Vehicle viewed 5 times</span>
            <span className="text-gray-400 text-xs ml-auto">4h ago</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
            <span className="text-gray-600">New listing published</span>
            <span className="text-gray-400 text-xs ml-auto">1d ago</span>
          </div>
        </div>
      </div>
    </div>
  );

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileFormData(prev => ({ ...prev, [name]: value }));
    if (profileErrors[name]) {
      setProfileErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateProfileForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!profileFormData.name || profileFormData.name.trim() === '') {
      newErrors.name = 'Name is required';
    }
    if (!profileFormData.email || profileFormData.email.trim() === '') {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileFormData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!profileFormData.mobile || profileFormData.mobile.trim() === '') {
      newErrors.mobile = 'Mobile number is required';
    } else if (!/^[\d\s\-\+\(\)]{10,15}$/.test(profileFormData.mobile.replace(/\s/g, ''))) {
      newErrors.mobile = 'Please enter a valid mobile number';
    }
    if (isSeller && (!profileFormData.dealershipName || profileFormData.dealershipName.trim() === '')) {
      newErrors.dealershipName = 'Dealership name is required';
    }

    setProfileErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateProfileForm()) return;

    setIsSavingProfile(true);
    try {
      if (onUpdateProfile) {
        await onUpdateProfile({
          name: profileFormData.name,
          email: profileFormData.email,
          mobile: profileFormData.mobile,
          dealershipName: profileFormData.dealershipName,
          bio: profileFormData.bio,
        });
        setIsEditingProfile(false);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setProfileErrors({ general: 'Failed to update profile. Please try again.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const userNotifications = notifications.filter(n => n.recipientEmail === currentUser.email);
  const unreadNotifications = userNotifications.filter(n => !n.isRead);

  const renderProfile = () => {
    if (isEditingProfile) {
      return (
        <div className="space-y-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Edit Profile</h3>
              <p className="text-xs text-gray-500 mt-0.5">Update your account information</p>
            </div>
            <button 
              onClick={() => {
                setIsEditingProfile(false);
                setProfileErrors({});
                // Reset form data
                setProfileFormData({
                  name: currentUser.name,
                  email: currentUser.email,
                  mobile: currentUser.mobile || '',
                  dealershipName: (currentUser as any).dealershipName || '',
                  bio: (currentUser as any).bio || '',
                });
              }}
              className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleProfileSave} className="native-card p-5 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={profileFormData.name}
                onChange={handleProfileChange}
                className={`native-input ${profileErrors.name ? 'bg-red-50' : ''}`}
                required
              />
              {profileErrors.name && <p className="text-red-600 text-xs mt-1.5 font-medium">{profileErrors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={profileFormData.email}
                onChange={handleProfileChange}
                className={`native-input ${profileErrors.email ? 'bg-red-50' : ''}`}
                required
              />
              {profileErrors.email && <p className="text-red-600 text-xs mt-1.5 font-medium">{profileErrors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="mobile"
                value={profileFormData.mobile}
                onChange={handleProfileChange}
                placeholder="+91 98765 43210"
                className={`native-input ${profileErrors.mobile ? 'bg-red-50' : ''}`}
                required
              />
              {profileErrors.mobile && <p className="text-red-600 text-xs mt-1.5 font-medium">{profileErrors.mobile}</p>}
            </div>

            {isSeller && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Dealership Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="dealershipName"
                    value={profileFormData.dealershipName}
                    onChange={handleProfileChange}
                    className={`native-input ${profileErrors.dealershipName ? 'bg-red-50' : ''}`}
                    required
                  />
                  {profileErrors.dealershipName && <p className="text-red-600 text-xs mt-1.5 font-medium">{profileErrors.dealershipName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Bio
                  </label>
                  <textarea
                    name="bio"
                    value={profileFormData.bio}
                    onChange={handleProfileChange}
                    rows={4}
                    placeholder="Tell us about your dealership..."
                    className="native-input resize-none"
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-500 mt-1">{profileFormData.bio.length}/500</p>
                </div>
              </>
            )}

            {profileErrors.general && (
              <div className="p-3 bg-red-50 rounded-xl">
                <p className="text-red-600 text-sm">{profileErrors.general}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setIsEditingProfile(false);
                  setProfileErrors({});
                  setProfileFormData({
                    name: currentUser.name,
                    email: currentUser.email,
                    mobile: currentUser.mobile || '',
                    dealershipName: (currentUser as any).dealershipName || '',
                    bio: (currentUser as any).bio || '',
                  });
                }}
                className="flex-1 native-button native-button-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="flex-1 native-button native-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      );
    }

    return (
      <div className="space-y-5 pb-4">
        <div className="native-card p-4">
        <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-orange-600 font-bold text-xl">
                {currentUser.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 truncate">{currentUser.name}</h3>
              <p className="text-sm text-gray-500 truncate">{currentUser.email}</p>
              <p className="text-xs text-orange-600 font-semibold uppercase mt-1">{currentUser.role}</p>
              {isSeller && (currentUser as any).dealershipName && (
                <p className="text-sm text-gray-700 font-medium mt-1">{(currentUser as any).dealershipName}</p>
              )}
          </div>
        </div>
      </div>

        <div className="native-card p-4">
          <h4 className="font-bold text-gray-900 mb-4 text-base">Account Settings</h4>
          <div className="space-y-2">
            <button 
              onClick={() => setIsEditingProfile(true)}
              className="w-full text-left p-3.5 active:opacity-70 native-transition rounded-xl hover:bg-gray-50 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">✏️</span>
                <span className="text-gray-900 font-medium">Edit Profile</span>
            </div>
              <span className="text-gray-400">›</span>
          </button>
            <button 
              onClick={() => setActiveTab('notifications')}
              className="w-full text-left p-3.5 active:opacity-70 native-transition rounded-xl hover:bg-gray-50 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🔔</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-900 font-medium">Notifications</span>
                  {unreadNotifications.length > 0 && (
                    <span className="bg-orange-500 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center">
                      {unreadNotifications.length}
                    </span>
                  )}
            </div>
              </div>
              <span className="text-gray-400">›</span>
          </button>
            <button 
              onClick={() => onNavigate(ViewEnum.SUPPORT)}
              className="w-full text-left p-3.5 active:opacity-70 native-transition rounded-xl hover:bg-gray-50 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🛡️</span>
                <span className="text-gray-900 font-medium">Privacy</span>
              </div>
              <span className="text-gray-400">›</span>
            </button>
            <button 
              onClick={() => onNavigate(ViewEnum.SUPPORT)}
              className="w-full text-left p-3.5 active:opacity-70 native-transition rounded-xl hover:bg-gray-50 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">💬</span>
                <span className="text-gray-900 font-medium">Help & Support</span>
            </div>
              <span className="text-gray-400">›</span>
          </button>
          {onLogout && (
            <button 
              onClick={onLogout}
                className="w-full text-left p-3.5 active:opacity-70 native-transition rounded-xl hover:bg-red-50 flex items-center justify-between mt-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🚪</span>
                  <span className="text-red-600 font-medium">Log Out</span>
                </div>
                <span className="text-red-400">›</span>
              </button>
            )}
              </div>
        </div>
      </div>
    );
  };

  const renderNotifications = () => {
    const filteredNotifications = userNotifications.length > 0 ? userNotifications : notifications;
    
    return (
      <div className="space-y-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Notifications</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {filteredNotifications.length} total • {unreadNotifications.length} unread
            </p>
          </div>
          {unreadNotifications.length > 0 && onMarkNotificationsAsRead && (
            <button
              onClick={() => onMarkNotificationsAsRead(unreadNotifications.map(n => n.id))}
              className="text-sm font-semibold text-orange-600 active:opacity-70 native-transition"
            >
              Mark all read
            </button>
          )}
        </div>

        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🔔</span>
      </div>
            <h4 className="text-xl font-bold text-gray-900 mb-2">No notifications</h4>
            <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
              You're all caught up! New notifications will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => {
                  if (onNotificationClick) {
                    onNotificationClick(notification);
                  }
                  if (!notification.isRead && onMarkNotificationsAsRead) {
                    onMarkNotificationsAsRead([notification.id]);
                  }
                }}
                className={`native-card p-4 cursor-pointer active:opacity-80 native-transition ${
                  !notification.isRead ? 'border-l-4 border-l-orange-500' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-orange-600 text-lg">
                      {notification.targetType === 'conversation' ? '💬' :
                       notification.targetType === 'vehicle' ? '🚗' : '🔔'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className={`font-semibold text-sm ${!notification.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                        {notification.targetType === 'conversation' ? 'New Message' :
                         notification.targetType === 'vehicle' ? 'Vehicle Update' : 'Notification'}
                      </h4>
                      {!notification.isRead && (
                        <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0"></span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mb-1">{notification.message}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(notification.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        ...(new Date(notification.timestamp).getFullYear() !== new Date().getFullYear() && {
                          year: 'numeric'
                        })
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
  };

  const handleAddFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setAddFormData(prev => ({
      ...prev,
      [name]: name === 'year' || name === 'price' || name === 'mileage' || name === 'noOfOwners' || name === 'registrationYear'
        ? (value === '' ? 0 : Number(value))
        : value
    }));
    // Clear error when user starts typing
    if (addErrors[name]) {
      setAddErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateAddForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!addFormData.make || addFormData.make.trim() === '') {
      newErrors.make = 'Make is required';
    }
    if (!addFormData.model || addFormData.model.trim() === '') {
      newErrors.model = 'Model is required';
    }
    if (!addFormData.year || addFormData.year < 1900 || addFormData.year > new Date().getFullYear() + 1) {
      newErrors.year = 'Please enter a valid year';
    }
    if (!addFormData.price || addFormData.price <= 0) {
      newErrors.price = 'Price must be greater than 0';
    }
    if (addFormData.mileage < 0) {
      newErrors.mileage = 'Mileage cannot be negative';
    }

    setAddErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateAddForm()) {
      return;
    }

    setIsAddingVehicle(true);
    try {
      if (onAddVehicle) {
        await onAddVehicle(addFormData, false);
        setAddFormData(initialAddFormData);
        setActiveTab('listings');
      }
    } catch (error) {
      console.error('Failed to add vehicle:', error);
    } finally {
      setIsAddingVehicle(false);
    }
  };

  const renderAddVehicle = () => {

    return (
      <div className="space-y-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Add New Vehicle</h3>
            <p className="text-xs text-gray-500 mt-0.5">Fill in the details below</p>
          </div>
          <button 
            onClick={() => setActiveTab('listings')}
            className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        
        <form onSubmit={handleAddSubmit} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="font-bold text-gray-900 text-base border-b border-gray-200 pb-3">Basic Information</h4>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Make <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="make"
                value={addFormData.make}
                onChange={handleAddFormChange}
                placeholder="e.g., Tata, Hyundai, Maruti"
                className={`native-input ${addErrors.make ? 'bg-red-50' : ''}`}
                required
              />
              {addErrors.make && <p className="text-red-600 text-xs mt-1.5 font-medium">{addErrors.make}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="model"
                value={addFormData.model}
                onChange={handleAddFormChange}
                placeholder="e.g., Nexon, Creta, Swift"
                className={`native-input ${addErrors.model ? 'bg-red-50' : ''}`}
                required
              />
              {addErrors.model && <p className="text-red-600 text-xs mt-1.5 font-medium">{addErrors.model}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Year <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="year"
                  value={addFormData.year}
                  onChange={handleAddFormChange}
                  placeholder="2024"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  className={`native-input ${addErrors.year ? 'bg-red-50' : ''}`}
                  required
                />
                {addErrors.year && <p className="text-red-600 text-xs mt-1.5 font-medium">{addErrors.year}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Variant
                </label>
                <input
                  type="text"
                  name="variant"
                  value={addFormData.variant || ''}
                  onChange={handleAddFormChange}
                  placeholder="e.g., XZ+, VX"
                  className="native-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Price (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="price"
                  value={addFormData.price || ''}
                  onChange={handleAddFormChange}
                  placeholder="1500000"
                  min="0"
                  className={`native-input ${addErrors.price ? 'bg-red-50' : ''}`}
                  required
                />
                {addErrors.price && <p className="text-red-600 text-xs mt-1.5 font-medium">{addErrors.price}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Mileage (km) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="mileage"
                  value={addFormData.mileage || ''}
                  onChange={handleAddFormChange}
                  placeholder="25000"
                  min="0"
                  className={`native-input ${addErrors.mileage ? 'bg-red-50' : ''}`}
                  required
                />
                {addErrors.mileage && <p className="text-red-600 text-xs mt-1.5 font-medium">{addErrors.mileage}</p>}
              </div>
            </div>
          </div>

          {/* Specifications */}
          <div className="space-y-4 pt-6 border-t border-gray-200">
            <h4 className="font-bold text-gray-900 text-base border-b border-gray-200 pb-3">Specifications</h4>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Fuel Type
              </label>
              <select
                name="fuelType"
                value={addFormData.fuelType}
                onChange={handleAddFormChange}
                className="native-input bg-white"
              >
                <option value="Petrol">Petrol</option>
                <option value="Diesel">Diesel</option>
                <option value="Electric">Electric</option>
                <option value="Hybrid">Hybrid</option>
                <option value="CNG">CNG</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Transmission
              </label>
              <select
                name="transmission"
                value={addFormData.transmission}
                onChange={handleAddFormChange}
                className="native-input bg-white"
              >
                <option value="Manual">Manual</option>
                <option value="Automatic">Automatic</option>
                <option value="AMT">AMT</option>
                <option value="CVT">CVT</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Color
                </label>
                <input
                  type="text"
                  name="color"
                  value={addFormData.color || ''}
                  onChange={handleAddFormChange}
                  placeholder="e.g., White, Black"
                  className="native-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  No. of Owners
                </label>
                <input
                  type="number"
                  name="noOfOwners"
                  value={addFormData.noOfOwners || 1}
                  onChange={handleAddFormChange}
                  className="native-input"
                  min="1"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4 pt-6 border-t border-gray-200">
            <h4 className="font-bold text-gray-900 text-base border-b border-gray-200 pb-3">Location</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={addFormData.city || ''}
                  onChange={handleAddFormChange}
                  placeholder="e.g., Mumbai"
                  className="native-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  value={addFormData.state || ''}
                  onChange={handleAddFormChange}
                  placeholder="e.g., Maharashtra"
                  className="native-input"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4 pt-6 border-t border-gray-200">
            <h4 className="font-bold text-gray-900 text-base border-b border-gray-200 pb-3">Description</h4>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={addFormData.description || ''}
                onChange={handleAddFormChange}
                rows={4}
                placeholder="Describe the condition, features, and any additional information..."
                className="native-input resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setActiveTab('listings')}
              className="flex-1 native-button native-button-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAddingVehicle}
              className="flex-1 native-button native-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAddingVehicle ? 'Adding...' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </div>
    );
  };

  const renderEditVehicle = () => {
    if (!editingVehicle) {
      return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Edit Vehicle</h3>
        <button 
              onClick={() => setActiveTab('listings')}
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>
          <div className="bg-white rounded-lg p-4 shadow-sm text-center py-8">
            <p className="text-gray-500">No vehicle selected for editing.</p>
          </div>
        </div>
      );
    }

    const formData = editFormData || editingVehicle;
    if (!formData) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Edit Vehicle</h3>
          <button 
              onClick={() => setActiveTab('listings')}
              className="p-2 text-gray-400 hover:text-gray-600"
          >
              ✕
          </button>
        </div>
          <div className="bg-white rounded-lg p-4 shadow-sm text-center py-8">
            <p className="text-gray-500">No vehicle selected for editing.</p>
      </div>
    </div>
  );
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setEditFormData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          [name]: name === 'year' || name === 'price' || name === 'mileage' || name === 'noOfOwners' || name === 'registrationYear'
            ? (value === '' ? 0 : Number(value))
            : value
        };
      });
      // Clear error when user starts typing
      if (editErrors[name]) {
        setEditErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    };

    const validateForm = (): boolean => {
      const newErrors: Record<string, string> = {};
      
      if (!formData.make || formData.make.trim() === '') {
        newErrors.make = 'Make is required';
      }
      if (!formData.model || formData.model.trim() === '') {
        newErrors.model = 'Model is required';
      }
      if (!formData.year || formData.year < 1900 || formData.year > new Date().getFullYear() + 1) {
        newErrors.year = 'Please enter a valid year';
      }
      if (!formData.price || formData.price <= 0) {
        newErrors.price = 'Price must be greater than 0';
      }
      if (formData.mileage < 0) {
        newErrors.mileage = 'Mileage cannot be negative';
      }

      setEditErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!formData || !validateForm()) {
        return;
      }

      setIsSubmitting(true);
      try {
        if (onUpdateVehicle) {
          await onUpdateVehicle(formData);
          setEditingVehicle(null);
          setActiveTab('listings');
        }
      } catch (error) {
        console.error('Failed to update vehicle:', error);
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Edit Vehicle</h3>
        <button 
          onClick={() => setActiveTab('listings')}
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>
      
        <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 shadow-sm space-y-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900 border-b pb-2">Basic Information</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Make <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="make"
                value={formData.make}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg ${editErrors.make ? 'border-red-500' : 'border-gray-300'}`}
                required
              />
              {editErrors.make && <p className="text-red-500 text-xs mt-1">{editErrors.make}</p>}
          </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg ${editErrors.model ? 'border-red-500' : 'border-gray-300'}`}
                required
              />
              {editErrors.model && <p className="text-red-500 text-xs mt-1">{editErrors.model}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg ${editErrors.year ? 'border-red-500' : 'border-gray-300'}`}
                  required
                />
                {editErrors.year && <p className="text-red-500 text-xs mt-1">{editErrors.year}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Variant
                </label>
                <input
                  type="text"
                  name="variant"
                  value={formData.variant || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg ${editErrors.price ? 'border-red-500' : 'border-gray-300'}`}
                  required
                />
                {editErrors.price && <p className="text-red-500 text-xs mt-1">{editErrors.price}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mileage (km) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="mileage"
                  value={formData.mileage}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg ${editErrors.mileage ? 'border-red-500' : 'border-gray-300'}`}
                  required
                />
                {editErrors.mileage && <p className="text-red-500 text-xs mt-1">{editErrors.mileage}</p>}
              </div>
            </div>
          </div>

          {/* Specifications */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-semibold text-gray-900">Specifications</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fuel Type
              </label>
              <select
                name="fuelType"
                value={formData.fuelType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="Petrol">Petrol</option>
                <option value="Diesel">Diesel</option>
                <option value="Electric">Electric</option>
                <option value="Hybrid">Hybrid</option>
                <option value="CNG">CNG</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transmission
              </label>
              <select
                name="transmission"
                value={formData.transmission}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="Manual">Manual</option>
                <option value="Automatic">Automatic</option>
                <option value="AMT">AMT</option>
                <option value="CVT">CVT</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <input
                  type="text"
                  name="color"
                  value={formData.color || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  No. of Owners
                </label>
                <input
                  type="number"
                  name="noOfOwners"
                  value={formData.noOfOwners || 1}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min="1"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-semibold text-gray-900">Location</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-semibold text-gray-900">Description</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description || ''}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Describe the condition, features, and any additional information..."
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-semibold text-gray-900">Listing Status</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="published">Published</option>
                <option value="unpublished">Unpublished</option>
                <option value="sold">Sold</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
          <button 
              type="button"
              onClick={() => setActiveTab('listings')}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
        </form>
    </div>
  );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'listings': return renderListings();
      case 'messages': return renderMessages();
      case 'analytics': return renderAnalytics();
      case 'profile': return renderProfile();
      case 'notifications': return renderNotifications();
      case 'addVehicle': return renderAddVehicle();
      case 'editVehicle': return renderEditVehicle();
      default: return renderOverview();
    }
  };

  return (
    <div className="w-full bg-white">
      {/* Premium Dashboard Header */}
      <div 
        className="px-5 py-4 sticky top-0 z-20 safe-top" 
        style={{ 
          top: '0px', 
          paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '0.5px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-0.5 tracking-tight" style={{ letterSpacing: '-0.02em' }}>Dashboard</h1>
            <p className="text-xs text-gray-600 font-medium">
              {isSeller ? 'Manage your listings' : 
               isAdmin ? 'Platform overview' : 
               'Your car journey'}
            </p>
          </div>
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)',
              boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3), 0 2px 4px rgba(255, 107, 53, 0.2)',
              border: '2px solid rgba(255, 255, 255, 0.3)'
            }}
          >
            <span className="text-white font-bold text-lg">
              {currentUser.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
        </div>
      </div>

      {/* Premium Tab Navigation */}
      <div 
        className="px-4 py-3 sticky z-20" 
        style={{ 
          top: '73px',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '0.5px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div className="flex space-x-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as DashboardTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all min-h-[44px] ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-gray-700'
              }`}
              style={{
                background: activeTab === tab.id 
                  ? 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)'
                  : 'linear-gradient(180deg, #F9FAFB 0%, #F3F4F6 100%)',
                boxShadow: activeTab === tab.id 
                  ? '0 4px 12px rgba(255, 107, 53, 0.3), 0 2px 4px rgba(255, 107, 53, 0.2)'
                  : '0 1px 2px rgba(0, 0, 0, 0.04)',
                border: activeTab === tab.id ? 'none' : '0.5px solid rgba(0, 0, 0, 0.06)',
                transform: activeTab === tab.id ? 'scale(1.02)' : 'scale(1)',
                letterSpacing: '-0.01em'
              }}
              onMouseDown={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.transform = 'scale(0.97)';
                }
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = activeTab === tab.id ? 'scale(1.02)' : 'scale(1)';
              }}
            >
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== null && tab.count > 0 && (
                <span className={`text-xs rounded-full px-2 py-0.5 min-w-[22px] text-center font-bold ${
                  activeTab === tab.id
                    ? 'bg-white/30 text-white'
                    : 'bg-orange-500 text-white'
                }`}>
                  {tab.count > 99 ? '99+' : tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content - Enhanced with better spacing */}
      <div className="px-4 pt-5 pb-24 max-w-4xl mx-auto">
        {renderContent()}
      </div>
    </div>
  );
});

MobileDashboard.displayName = 'MobileDashboard';

export default MobileDashboard;
