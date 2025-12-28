import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from '../components/AppProvider';
import { View } from '../types';

// Mock the services
jest.mock('../services/ratingService', () => ({
  getRatings: jest.fn(() => Promise.resolve({})),
  addRating: jest.fn(),
  getSellerRatings: jest.fn(() => Promise.resolve({})),
  addSellerRating: jest.fn(),
}));

jest.mock('../services/chatService', () => ({
  getConversations: jest.fn(() => Promise.resolve([])),
  saveConversations: jest.fn(),
}));

jest.mock('../services/settingsService', () => ({
  getSettings: jest.fn(() => ({ listingFee: 0, siteAnnouncement: '' })),
  saveSettings: jest.fn(),
}));

jest.mock('../services/auditLogService', () => ({
  getAuditLog: jest.fn(() => Promise.resolve([])),
  logAction: jest.fn(),
  saveAuditLog: jest.fn(),
}));

jest.mock('../services/notificationService', () => ({
  showNotification: jest.fn(),
}));

jest.mock('../services/faqService', () => ({
  getFaqs: jest.fn(() => Promise.resolve([])),
  saveFaqs: jest.fn(),
}));

jest.mock('../services/supportTicketService', () => ({
  getSupportTickets: jest.fn(() => Promise.resolve([])),
  saveSupportTickets: jest.fn(),
}));

// Define mock implementation
const mockDataServiceImplementation = {
  getVehicles: jest.fn(() => Promise.resolve([])),
  getVehicleData: jest.fn(() => Promise.resolve({})),
  getUsers: jest.fn(() => Promise.resolve([])),
  syncWhenOnline: jest.fn(() => Promise.resolve()),
  addVehicle: jest.fn(() => Promise.resolve({ id: 1, make: 'Test', model: 'Car' } as any)),
  updateVehicle: jest.fn(() => Promise.resolve({ id: 1, make: 'Updated', model: 'Car' } as any)),
  deleteVehicle: jest.fn(() => Promise.resolve({ success: true } as any)),
  login: jest.fn(() => Promise.resolve({ success: true, user: { id: 1, email: 'test@test.com' } } as any)),
  register: jest.fn(() => Promise.resolve({ success: true, user: { id: 1, email: 'test@test.com' } } as any)),
};

// Mock dataService before importing AppProvider
jest.mock('../services/dataService', () => ({
  dataService: mockDataServiceImplementation,
  getVehicles: () => mockDataServiceImplementation.getVehicles(),
  getVehicleData: () => mockDataServiceImplementation.getVehicleData(),
  getUsers: () => mockDataServiceImplementation.getUsers(),
}));

jest.mock('../utils/loadingManager', () => ({
  loadingManager: {
    startLoading: jest.fn(),
    stopLoading: jest.fn(),
  },
  LOADING_OPERATIONS: {},
  withLoadingTimeout: jest.fn((fn) => fn),
}));

jest.mock('../hooks/useCleanup', () => ({
  useTimeout: jest.fn(),
}));

jest.mock('../components/vehicleData', () => ({
  VEHICLE_DATA: {},
}));

// Test component that uses the AppProvider
const TestComponent: React.FC = () => {
  const { addToast, currentView, navigate } = useApp();
  
  return (
    <div>
      <div data-testid="current-view">{currentView}</div>
      <button 
        data-testid="add-toast" 
        onClick={() => addToast('Test message', 'success')}
      >
        Add Toast
      </button>
      <button 
        data-testid="navigate-home" 
        onClick={() => navigate(View.HOME)}
      >
        Navigate Home
      </button>
    </div>
  );
};

describe('AppProvider', () => {
  beforeEach(() => {
    // Clear localStorage and sessionStorage before each test
    localStorage.clear();
    sessionStorage.clear();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should provide initial state correctly', () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    expect(screen.getByTestId('current-view')).toHaveTextContent(View.HOME);
  });

  it('should handle navigation correctly', () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    fireEvent.click(screen.getByTestId('navigate-home'));
    expect(screen.getByTestId('current-view')).toHaveTextContent(View.HOME);
  });

  it('should handle toast notifications', async () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    fireEvent.click(screen.getByTestId('add-toast'));
    
    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });

  it('should handle user login correctly', async () => {
    const mockUser = {
      name: 'Test User',
      email: 'test@test.com',
      mobile: '9876543210',
      role: 'customer' as const,
      location: 'Mumbai',
      status: 'active' as const,
      createdAt: new Date().toISOString(),
    };

    const LoginTestComponent: React.FC = () => {
      const { handleLogin, currentUser } = useApp();
      
      return (
        <div>
          <div data-testid="user-email">{currentUser?.email || 'No user'}</div>
          <button 
            data-testid="login-button" 
            onClick={() => handleLogin(mockUser)}
          >
            Login
          </button>
        </div>
      );
    };

    render(
      <AppProvider>
        <LoginTestComponent />
      </AppProvider>
    );

    expect(screen.getByTestId('user-email')).toHaveTextContent('No user');
    
    fireEvent.click(screen.getByTestId('login-button'));
    
    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@test.com');
    });
  });
});
