import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const mockIsDevelopmentEnvironment = jest.fn(() => false);

jest.mock('../utils/environment', () => ({
  ...jest.requireActual<typeof import('../utils/environment')>('../utils/environment'),
  isDevelopmentEnvironment: mockIsDevelopmentEnvironment,
}));

// Load after jest.mock so ErrorBoundary binds to the mocked environment module.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ErrorBoundary = require('../components/ErrorBoundary').default as typeof import('../components/ErrorBoundary').default;

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = false }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Custom fallback component
const CustomFallback: React.FC = () => (
  <div data-testid="custom-fallback">Custom error fallback</div>
);

describe('ErrorBoundary', () => {
  const originalLocation = window.location;
  const mockReload = jest.fn();

  beforeAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: mockReload },
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockIsDevelopmentEnvironment.mockReturnValue(false);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    mockIsDevelopmentEnvironment.mockReset();
    mockIsDevelopmentEnvironment.mockImplementation(() => false);
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should render default fallback when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Refresh Page')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<CustomFallback />}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
  });

  it('should show error details in development mode', () => {
    mockIsDevelopmentEnvironment.mockReturnValue(true);

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Error Details', { selector: 'summary' })).toBeInTheDocument();
    expect(screen.getByTestId('error-message')).toHaveTextContent('Test error');
  });

  it('should not show error details in production mode', () => {
    mockIsDevelopmentEnvironment.mockReturnValue(false);

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.queryByText('Error Details', { selector: 'summary' })).not.toBeInTheDocument();
  });

  it('should handle refresh page button click', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    fireEvent.click(screen.getByText('Refresh Page'));
    expect(mockReload).toHaveBeenCalled();
  });

  it('should handle try again button click', () => {
    const AlwaysFails: React.FC = () => {
      throw new Error('Persistent error');
    };

    render(
      <ErrorBoundary>
        <AlwaysFails />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Try Again'));
    // Retry re-renders the child; it throws again and the boundary shows the fallback again.
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
