import { Suspense, lazy, useState } from 'react';
import { AppProvider } from './components/AppProvider';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import Footer from './components/Footer';

// Simple loading component
const LoadingSpinner = () => (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
            <span className="text-xl font-semibold text-gray-600">Loading...</span>
        </div>
    </div>
);

// Lazy load only the essential components
const Home = lazy(() => import('./components/Home'));

const AppContent = () => {
  const [currentView, setCurrentView] = useState('home');

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <Home />;
      default:
        return <Home />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="min-h-[calc(100vh-140px)]">
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            {renderView()}
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;
