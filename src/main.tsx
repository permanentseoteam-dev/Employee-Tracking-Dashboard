import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { FocusClockPopoutPage } from './pages/FocusClockPopoutPage';
import { AppUpdatePrompt } from './components/common/AppUpdatePrompt';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { isFocusClockPopoutRoute } from './utils/focusClockPopout';
import './styles/index.css';

const isPopoutClock = isFocusClockPopoutRoute();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary fallbackTitle={isPopoutClock ? 'Focus Clock Error' : 'Application Error'}>
      {isPopoutClock ? (
        <ThemeProvider>
          <FocusClockPopoutPage />
        </ThemeProvider>
      ) : (
        <AuthProvider>
          <ThemeProvider>
            <AppUpdatePrompt />
            <App />
          </ThemeProvider>
        </AuthProvider>
      )}
    </ErrorBoundary>
  </React.StrictMode>
);
