import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { CurrencyProvider } from './utils/CurrencyContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initGlobalCrashHandler } from './utils/crashLogger.ts';
import './index.css';

// Initialize Global Crash Shield & Error Logger before React mounts
initGlobalCrashHandler();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <CurrencyProvider>
        <App />
      </CurrencyProvider>
    </ErrorBoundary>
  </StrictMode>,
);
